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
    const client = this.getClient(host, port, username);
    const serverKey = this.getServerKey(host, port, username);
    const timeout = options.timeout ?? this.config.commandTimeout;
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

      return { ...result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      this.logger.log('error', 'command_exec', {
        server: serverKey,
        command: this.maskCommand(command),
        error: message,
        duration,
      });

      if (message.includes('超时')) {
        throw new SSHError(SSHErrorCode.COMMAND_TIMEOUT, message);
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
      const active = this.sshManager.getActiveConnection();
      client = active?.client;
    }

    if (!client) {
      throw new SSHError(SSHErrorCode.NOT_CONNECTED, '没有可用的 SSH 连接');
    }

    return client;
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
   * 执行命令的底层实现
   */
  private executeCommand(
    client: Client,
    command: string,
    options: ExecOptions
  ): Promise<ExecResult> {
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
            duration: 0, // 由调用方填充
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
}
