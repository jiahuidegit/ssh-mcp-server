/**
 * 命令执行器
 * 负责在远程服务器上执行命令
 */

import { Client, ClientChannel } from 'ssh2';
import {
  ExecOptions,
  ExecResult,
  BatchExecResult,
  SSHError,
  SSHErrorCode,
  MCPServerConfig,
  DEFAULT_CONFIG,
} from '../types/index.js';
import { SSHManager } from './ssh-manager.js';
import { AuditLogger } from '../logging/audit-logger.js';
import { withTimeout, getConnectionKey } from '../utils/index.js';

/**
 * 内部使用的原始执行结果（不包含 duration 和 server）
 */
interface RawExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * 命令执行器
 */
export class CommandExecutor {
  private config: MCPServerConfig;
  private logger: AuditLogger;

  constructor(
    private sshManager: SSHManager,
    config: Partial<MCPServerConfig> = {},
    logger: AuditLogger
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger;
  }

  /**
   * 执行远程命令
   */
  async exec(
    command: string,
    host?: string,
    port?: number,
    username?: string,
    options: ExecOptions = {}
  ): Promise<ExecResult> {
    // 支持自动重连
    const client = await this.getClientWithReconnect(host, port, username);
    const serverKey = this.getServerKey(host, port, username);

    // 确定超时时间：自定义 > 长超时 > 默认超时
    let timeout: number;
    if (options.timeout) {
      timeout = options.timeout;
    } else if (options.useLongTimeout) {
      timeout = this.config.longCommandTimeout;
      this.logger.log('debug', 'command_exec', {
        server: serverKey,
        message: `使用长超时模式: ${timeout}ms`,
      });
    } else {
      timeout = this.config.commandTimeout;
    }

    const startTime = Date.now();

    try {
      const result = await withTimeout(
        this.executeCommand(client, command, options),
        timeout,
        `命令执行超时 (${timeout}ms)`
      );

      const duration = Date.now() - startTime;
      this.logger.log('info', 'command_exec', {
        server: serverKey,
        command: this.maskCommand(command),
        exitCode: result.exitCode,
        duration,
      });

      // 获取服务器身份信息
      const serverIdentity = this.sshManager.getServerIdentity(host, port, username);

      return { ...result, duration, server: serverIdentity };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      this.logger.log('error', 'command_exec', {
        server: serverKey,
        command: this.maskCommand(command),
        error: message,
        duration,
      });

      // 超时错误处理
      if (message.includes('超时')) {
        // 检查连接是否仍然有效
        const isConnected = this.checkConnection(host, port, username);
        this.logger.log('warn', 'command_timeout', {
          server: serverKey,
          timeout,
          connectionStatus: isConnected ? '连接仍有效' : '连接已断开',
        });

        throw new SSHError(
          SSHErrorCode.COMMAND_TIMEOUT,
          `${message}\n提示：命令可能仍在后台运行。如需执行耗时命令（如 docker build），请使用 useLongTimeout: true 选项。`
        );
      }
      throw new SSHError(SSHErrorCode.CONNECTION_FAILED, `命令执行失败: ${message}`, error);
    }
  }

  /**
   * 执行 sudo 命令
   */
  async execSudo(
    command: string,
    sudoPassword: string,
    host?: string,
    port?: number,
    username?: string,
    options: ExecOptions = {}
  ): Promise<ExecResult> {
    // 构造 sudo 命令，使用 -S 从 stdin 读取密码
    const sudoCommand = `echo '${sudoPassword.replace(/'/g, "'\\''")}' | sudo -S ${command}`;
    return this.exec(sudoCommand, host, port, username, options);
  }

  /**
   * 批量执行命令
   */
  async execBatch(
    command: string,
    servers: Array<{ host: string; port?: number; username: string }>,
    options: ExecOptions = {}
  ): Promise<BatchExecResult[]> {
    const results = await Promise.all(
      servers.map(async (server) => {
        try {
          const result = await this.exec(
            command,
            server.host,
            server.port,
            server.username,
            options
          );
          return {
            host: server.host,
            success: result.exitCode === 0,
            result,
          };
        } catch (error) {
          return {
            host: server.host,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    this.logger.log('info', 'command_batch', {
      command: this.maskCommand(command),
      total: servers.length,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });

    return results;
  }

  /**
   * 获取 SSH 客户端
   */
  private getClient(host?: string, port?: number, username?: string): Client {
    let client: Client | undefined;

    if (host && username) {
      client = this.sshManager.getConnection(host, port ?? 22, username);
    } else {
      // 🚨 安全检查：如果有多个活跃连接，禁止使用默认连接
      const allConnections = this.sshManager.listConnections();

      if (allConnections.length > 1) {
        // 构建错误信息，列出所有连接和环境标签
        const connectionsList = allConnections
          .map((conn) => {
            const identity = this.sshManager.getServerIdentity(conn.host, conn.port, conn.username);
            const envLabel = identity.environment
              ? ` [${identity.environment.toUpperCase()}]`
              : '';
            const aliasLabel = identity.alias ? ` (别名: ${identity.alias})` : '';
            return `  - ${conn.username}@${conn.host}:${conn.port}${envLabel}${aliasLabel}`;
          })
          .join('\n');

        throw new SSHError(
          SSHErrorCode.NOT_CONNECTED,
          `🚨 安全提示：当前有 ${allConnections.length} 个活跃连接，为防止误操作，必须明确指定要操作的服务器！\n\n当前活跃连接：\n${connectionsList}\n\n请在命令中明确指定 host 和 username 参数。`
        );
      }

      // 只有一个连接时才允许使用默认连接
      const active = this.sshManager.getActiveConnection();
      client = active?.client;
    }

    if (!client) {
      throw new SSHError(SSHErrorCode.NOT_CONNECTED, '没有可用的 SSH 连接');
    }

    return client;
  }

  /**
   * 获取 SSH 客户端（支持自动重连）
   * 改进：即使不传 host/username，也能通过缓存配置实现自动重连
   */
  private async getClientWithReconnect(
    host?: string,
    port?: number,
    username?: string
  ): Promise<Client> {
    try {
      return this.getClient(host, port, username);
    } catch (error) {
      // 如果启用了自动重连，尝试重连
      if (
        error instanceof SSHError &&
        error.code === SSHErrorCode.NOT_CONNECTED &&
        this.config.autoReconnect
      ) {
        // 如果提供了 host/username，直接使用
        if (host && username) {
          this.logger.log('info', 'auto_reconnect_triggered', {
            server: getConnectionKey(host, port ?? 22, username),
          });
          await this.sshManager.reconnect(host, port ?? 22, username);
          return this.getClient(host, port, username);
        }

        // 未提供参数时，尝试使用缓存的配置重连
        const cachedConfigs = this.sshManager.listCachedConfigs();
        const firstCached = cachedConfigs[0];
        if (firstCached) {
          // 使用最近的配置
          const lastConfig = firstCached.config;
          this.logger.log('info', 'auto_reconnect_from_cache', {
            server: getConnectionKey(lastConfig.host, lastConfig.port ?? 22, lastConfig.username),
          });
          await this.sshManager.reconnect(lastConfig.host, lastConfig.port ?? 22, lastConfig.username);
          return this.getClient(lastConfig.host, lastConfig.port, lastConfig.username);
        }
      }
      throw error;
    }
  }

  /**
   * 获取服务器标识
   */
  private getServerKey(host?: string, port?: number, username?: string): string {
    if (host && username) {
      return getConnectionKey(host, port ?? 22, username);
    }
    const active = this.sshManager.getActiveConnection();
    return active?.key ?? 'unknown';
  }

  /**
   * 检查连接是否仍然有效
   */
  private checkConnection(host?: string, port?: number, username?: string): boolean {
    try {
      const client = this.getClient(host, port, username);
      // ssh2 客户端没有提供直接的连接状态检查
      // 通过能否获取到客户端来判断连接是否有效
      return !!client;
    } catch {
      return false;
    }
  }

  /**
   * 执行命令的底层实现
   */
  private executeCommand(
    client: Client,
    command: string,
    options: ExecOptions
  ): Promise<RawExecResult> {
    return new Promise((resolve, reject) => {
      // 构建完整命令（包含工作目录和环境变量）
      let fullCommand = command;
      if (options.cwd) {
        fullCommand = `cd ${options.cwd} && ${command}`;
      }
      if (options.env) {
        const envStr = Object.entries(options.env)
          .map(([k, v]) => `${k}='${v}'`)
          .join(' ');
        fullCommand = `${envStr} ${fullCommand}`;
      }

      client.exec(fullCommand, (err: Error | undefined, stream: ClientChannel) => {
        if (err) {
          return reject(err);
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('close', (code: number) => {
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code ?? 0,
          });
        });

        stream.on('error', (streamErr: Error) => {
          reject(streamErr);
        });
      });
    });
  }

  /**
   * 脱敏命令（隐藏密码等敏感信息）
   */
  private maskCommand(command: string): string {
    // 隐藏 echo '...' | sudo -S 中的密码
    return command.replace(/echo\s+'[^']*'\s*\|\s*sudo/g, "echo '***' | sudo");
  }

  /**
   * 通过 shell 模式执行命令（用于不支持 exec 的堡垒机）
   * 原理：分配 PTY，通过 stdin/stdout 交互，识别提示符判断命令结束
   */
  async execShell(
    command: string,
    host?: string,
    port?: number,
    username?: string,
    options: ExecOptions & { promptPattern?: string } = {}
  ): Promise<ExecResult> {
    const client = await this.getClientWithReconnect(host, port, username);
    const serverKey = this.getServerKey(host, port, username);
    const timeout = options.timeout || this.config.commandTimeout;
    const startTime = Date.now();

    try {
      const result = await withTimeout(
        this.executeCommandShell(client, command, options),
        timeout,
        `命令执行超时 (${timeout}ms)`
      );

      const duration = Date.now() - startTime;
      this.logger.log('info', 'command_exec_shell', {
        server: serverKey,
        command: this.maskCommand(command),
        duration,
      });

      // 获取服务器身份信息
      const serverIdentity = this.sshManager.getServerIdentity(host, port, username);

      return { ...result, duration, server: serverIdentity };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      this.logger.log('error', 'command_exec_shell', {
        server: serverKey,
        command: this.maskCommand(command),
        error: message,
        duration,
      });

      throw new SSHError(SSHErrorCode.CONNECTION_FAILED, `Shell 命令执行失败: ${message}`, error);
    }
  }

  /**
   * Shell 模式执行命令的底层实现
   */
  private executeCommandShell(
    client: Client,
    command: string,
    options: ExecOptions & { promptPattern?: string }
  ): Promise<RawExecResult> {
    return new Promise((resolve, reject) => {
      // 请求 PTY 并启动 shell
      client.shell({ term: 'xterm' }, (err: Error | undefined, stream: ClientChannel) => {
        if (err) {
          return reject(err);
        }

        let output = '';
        let commandSent = false;
        let commandStarted = false;

        // 默认提示符模式：匹配常见的 shell 提示符
        // 如 [user@host ~]$ 或 user@host:~$ 或 # 或 $
        const promptPattern: RegExp = options.promptPattern
          ? new RegExp(options.promptPattern)
          : /[$#]\s*$/;

        // 用于标记命令结束的唯一标识
        const endMarker = `__CMD_END_${Date.now()}__`;

        stream.on('data', (data: Buffer) => {
          const text = data.toString();
          output += text;

          // 等待初始提示符出现后发送命令
          if (!commandSent && promptPattern.test(output)) {
            commandSent = true;
            // 发送命令，并在最后加上 echo 标记来判断命令结束
            stream.write(`${command}; echo "${endMarker}" $?\n`);
            commandStarted = true;
            output = ''; // 清空之前的输出
          }

          // 检测命令是否执行完毕（通过结束标记）
          if (commandStarted && output.includes(endMarker)) {
            stream.end();
          }
        });

        stream.on('close', () => {
          // 解析输出和退出码
          const lines = output.split('\n');
          let exitCode = 0;
          let stdout = '';

          // 查找结束标记行，提取退出码
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? '';
            if (line.includes(endMarker)) {
              // 提取退出码
              const match = line.match(new RegExp(`${endMarker}\\s*(\\d+)`));
              if (match && match[1]) {
                exitCode = parseInt(match[1], 10);
              }
              // 结束标记之前的是输出
              stdout = lines.slice(1, i).join('\n'); // 跳过第一行（命令本身的回显）
              break;
            }
          }

          // 如果没找到标记，返回全部输出
          if (!stdout && output) {
            stdout = output;
          }

          resolve({
            stdout: stdout.trim(),
            stderr: '', // shell 模式下 stderr 混在 stdout 里
            exitCode,
          });
        });

        stream.on('error', (streamErr: Error) => {
          reject(streamErr);
        });

        // 超时保护：如果一直没有提示符出现
        setTimeout(() => {
          if (!commandSent) {
            stream.end();
            reject(new Error('等待 shell 提示符超时'));
          }
        }, 10000);
      });
    });
  }
}
