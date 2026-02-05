#!/usr/bin/env node
/**
 * SSH MCP Server 入口
 * 基于 MCP 协议的 SSH 远程服务器管理工具
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { MCPServerConfig, DEFAULT_CONFIG } from './types/index.js';
import { getEnvConfig } from './utils/index.js';
import { ConfirmationManager } from './utils/confirmation-manager.js';
import { TargetGuard } from './utils/target-guard.js';

// 核心模块
import { SSHManager } from './core/ssh-manager.js';
import { CommandExecutor } from './core/command-executor.js';
import { SFTPOperator } from './core/sftp-operator.js';

// 存储模块
import { ServerStore } from './storage/server-store.js';
import { CredentialStore } from './storage/credential-store.js';

// 日志模块
import { AuditLogger } from './logging/audit-logger.js';

// 工具模块
import { ConnectionTools, ConnectSchema, DisconnectSchema } from './tools/connection.js';
import { ServerTools, SaveServerSchema, ListServersSchema, RemoveServerSchema } from './tools/server.js';
import { ExecTools, ExecSchema, ExecSudoSchema, ExecBatchSchema, ExecShellSchema, ShellSendSchema, ShellReadSchema, ShellCloseSchema } from './tools/exec.js';
import { SftpTools, SftpLsSchema, SftpUploadSchema, SftpDownloadSchema, SftpMkdirSchema, SftpRmSchema } from './tools/sftp.js';
import { SystemTools, HealthCheckSchema, GetLogsSchema } from './tools/system.js';

// 错误处理
import { formatErrorWithSolution } from './errors/error-solutions.js';

/**
 * SSH MCP Server 主类
 */
class SSHMCPServer {
  private server: Server;
  private config: MCPServerConfig;

  // 核心组件
  private logger: AuditLogger;
  private sshManager: SSHManager;
  private commandExecutor: CommandExecutor;
  private sftpOperator: SFTPOperator;
  private serverStore: ServerStore;
  private credentialStore: CredentialStore;
  private confirmationManager: ConfirmationManager;
  private targetGuard: TargetGuard;

  // 工具处理器
  private connectionTools: ConnectionTools;
  private serverTools: ServerTools;
  private execTools: ExecTools;
  private sftpTools: SftpTools;
  private systemTools: SystemTools;

  constructor() {
    // 从环境变量加载配置
    this.config = this.loadConfig();

    // 初始化日志
    this.logger = new AuditLogger(this.config);

    // 初始化存储
    this.serverStore = new ServerStore(this.config);
    this.credentialStore = new CredentialStore(this.config, this.logger);

    // 初始化确认管理器
    this.confirmationManager = new ConfirmationManager();

    // 初始化核心模块
    this.sshManager = new SSHManager(this.config, this.logger);
    this.commandExecutor = new CommandExecutor(this.sshManager, this.config, this.logger);
    this.sftpOperator = new SFTPOperator(this.sshManager, this.config, this.logger);

    // 初始化目标锁定守卫
    this.targetGuard = new TargetGuard(this.sshManager, this.confirmationManager, this.serverStore);

    // 初始化工具处理器
    this.connectionTools = new ConnectionTools(this.sshManager, this.serverStore, this.credentialStore, this.targetGuard);
    this.serverTools = new ServerTools(this.serverStore, this.credentialStore, this.confirmationManager);
    this.execTools = new ExecTools(this.commandExecutor, this.sshManager, this.confirmationManager, this.targetGuard);
    this.sftpTools = new SftpTools(this.sftpOperator, this.sshManager, this.targetGuard);
    this.systemTools = new SystemTools(this.sshManager, this.logger);

    // 初始化 MCP Server
    this.server = new Server(
      {
        name: 'ssh-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * 加载配置
   */
  private loadConfig(): MCPServerConfig {
    return {
      logLevel: getEnvConfig('SSH_MCP_LOG_LEVEL', DEFAULT_CONFIG.logLevel),
      logFile: getEnvConfig('SSH_MCP_LOG_FILE', DEFAULT_CONFIG.logFile),
      connectionTimeout: getEnvConfig('SSH_MCP_CONN_TIMEOUT', DEFAULT_CONFIG.connectionTimeout),
      commandTimeout: getEnvConfig('SSH_MCP_CMD_TIMEOUT', DEFAULT_CONFIG.commandTimeout),
      longCommandTimeout: getEnvConfig('SSH_MCP_LONG_CMD_TIMEOUT', DEFAULT_CONFIG.longCommandTimeout),
      idleTimeout: getEnvConfig('SSH_MCP_IDLE_TIMEOUT', DEFAULT_CONFIG.idleTimeout),
      maxConnections: getEnvConfig('SSH_MCP_MAX_CONNECTIONS', DEFAULT_CONFIG.maxConnections),
      dataDir: getEnvConfig('SSH_MCP_DATA_DIR', DEFAULT_CONFIG.dataDir),
      enableHealthCheck: getEnvConfig('SSH_MCP_HEALTH_CHECK', DEFAULT_CONFIG.enableHealthCheck),
      healthCheckInterval: getEnvConfig('SSH_MCP_HEALTH_CHECK_INTERVAL', DEFAULT_CONFIG.healthCheckInterval),
      autoReconnect: getEnvConfig('SSH_MCP_AUTO_RECONNECT', DEFAULT_CONFIG.autoReconnect),
      maxReconnectAttempts: getEnvConfig('SSH_MCP_MAX_RECONNECT_ATTEMPTS', DEFAULT_CONFIG.maxReconnectAttempts),
    };
  }

  /**
   * 设置请求处理器
   */
  private setupHandlers(): void {
    // 列出所有工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: this.getToolDefinitions() };
    });

    // 调用工具
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.handleToolCall(name, args ?? {});
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        // 使用带解决方案的错误格式化
        const errorMessage = formatErrorWithSolution(error);

        return {
          content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
          isError: true,
        };
      }
    });
  }

  /**
   * 获取工具定义
   */
  private getToolDefinitions(): Tool[] {
    return [
      // 连接管理
      {
        name: 'connect',
        description: '建立 SSH 连接。可以通过别名连接已保存的服务器，或直接提供连接参数。',
        inputSchema: {
          type: 'object',
          properties: {
            alias: { type: 'string', description: '已保存服务器的别名' },
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口，默认 22' },
            username: { type: 'string', description: '用户名' },
            password: { type: 'string', description: '密码' },
            privateKey: { type: 'string', description: 'SSH 私钥内容' },
            passphrase: { type: 'string', description: '私钥密码' },
            timeout: { type: 'number', description: '连接超时时间（毫秒）' },
          },
        },
      },
      {
        name: 'disconnect',
        description: '断开 SSH 连接',
        inputSchema: {
          type: 'object',
          properties: {
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            all: { type: 'boolean', description: '断开所有连接' },
          },
        },
      },

      // 服务器管理
      {
        name: 'list_servers',
        description: '列出已保存的服务器配置',
        inputSchema: {
          type: 'object',
          properties: {
            group: { type: 'string', description: '按分组过滤' },
          },
        },
      },
      {
        name: 'save_server',
        description: '保存服务器配置。覆盖现有配置时需要先获取 confirmationToken。强烈建议设置 environment 字段以防止误操作生产服务器。',
        inputSchema: {
          type: 'object',
          properties: {
            alias: { type: 'string', description: '服务器别名' },
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口，默认 22' },
            username: { type: 'string', description: '用户名' },
            authType: { type: 'string', enum: ['password', 'privateKey'], description: '认证类型' },
            password: { type: 'string', description: '密码（authType=password 时）' },
            privateKey: { type: 'string', description: '私钥内容（authType=privateKey 时）' },
            passphrase: { type: 'string', description: '私钥密码' },
            environment: { type: 'string', enum: ['production', 'staging', 'test', 'development'], description: '环境标签（强烈建议设置，用于防止误操作生产服务器）' },
            description: { type: 'string', description: '服务器描述' },
            group: { type: 'string', description: '服务器分组' },
            confirmationToken: { type: 'string', description: '覆盖现有配置时需要的确认 token（首次调用会返回 token，使用 token 再次调用以确认）' },
          },
          required: ['alias', 'host', 'username', 'authType'],
        },
      },
      {
        name: 'remove_server',
        description: '删除已保存的服务器配置。删除任何服务器都需要先获取 confirmationToken，生产环境服务器会有特别警告。',
        inputSchema: {
          type: 'object',
          properties: {
            alias: { type: 'string', description: '服务器别名' },
            confirmationToken: { type: 'string', description: '删除确认 token（首次调用会返回 token，使用 token 再次调用以确认删除）' },
          },
          required: ['alias'],
        },
      },

      // 命令执行
      {
        name: 'exec',
        description: '在远程服务器执行命令。推荐使用 alias 指定目标服务器（需先通过 save_server 保存）。多服务器场景下切换目标服务器时会要求确认，防止误操作。危险命令需要先获取 confirmationToken。',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '要执行的命令' },
            alias: { type: 'string', description: '服务器别名（推荐，需先通过 save_server 保存）' },
            host: { type: 'string', description: '服务器地址（如果有多个活跃连接必须指定，或使用 alias）' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            timeout: { type: 'number', description: '命令超时时间（毫秒）' },
            useLongTimeout: { type: 'boolean', description: '使用长超时（30分钟），适用于 docker build 等耗时操作' },
            cwd: { type: 'string', description: '工作目录' },
            confirmationToken: { type: 'string', description: '危险命令确认 token' },
            targetConfirmationToken: { type: 'string', description: '服务器切换确认 token（切换目标服务器时返回，确认后重新调用）' },
          },
          required: ['command'],
        },
      },
      {
        name: 'exec_sudo',
        description: '以 sudo 权限执行命令。推荐使用 alias 指定目标服务器。多服务器场景下切换目标时需确认。危险命令需要 confirmationToken。',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '要执行的命令' },
            sudoPassword: { type: 'string', description: 'sudo 密码' },
            alias: { type: 'string', description: '服务器别名（推荐）' },
            host: { type: 'string', description: '服务器地址（如果有多个活跃连接必须指定，或使用 alias）' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            timeout: { type: 'number', description: '命令超时时间（毫秒）' },
            useLongTimeout: { type: 'boolean', description: '使用长超时（30分钟）' },
            confirmationToken: { type: 'string', description: '危险命令确认 token' },
            targetConfirmationToken: { type: 'string', description: '服务器切换确认 token' },
          },
          required: ['command', 'sudoPassword'],
        },
      },
      {
        name: 'exec_batch',
        description: '在多台服务器批量执行命令。批量操作风险极高！包含生产环境服务器时会有特别警告。危险命令需要 confirmationToken。',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '要执行的命令' },
            servers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  host: { type: 'string' },
                  port: { type: 'number' },
                  username: { type: 'string' },
                },
                required: ['host', 'username'],
              },
              description: '服务器列表',
            },
            timeout: { type: 'number', description: '命令超时时间（毫秒）' },
            confirmationToken: { type: 'string', description: '危险命令确认 token' },
          },
          required: ['command', 'servers'],
        },
      },
      {
        name: 'exec_shell',
        description: '通过交互式 shell 模式执行命令（用于堡垒机穿透）。推荐使用 alias 指定目标服务器。多服务器场景下切换目标时需确认。',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '要执行的命令' },
            alias: { type: 'string', description: '服务器别名（推荐）' },
            host: { type: 'string', description: '服务器地址（如果有多个活跃连接必须指定，或使用 alias）' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            timeout: { type: 'number', description: '命令超时时间（毫秒）' },
            promptPattern: { type: 'string', description: '自定义 shell 提示符正则表达式（可选）' },
            confirmationToken: { type: 'string', description: '危险命令确认 token' },
            targetConfirmationToken: { type: 'string', description: '服务器切换确认 token' },
          },
          required: ['command'],
        },
      },
      {
        name: 'shell_send',
        description: '发送输入到持久化 shell 会话（用于多轮交互，如堡垒机穿透）。推荐使用 alias 指定目标服务器。也会检测危险命令和服务器切换。',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: '要发送的输入内容' },
            alias: { type: 'string', description: '服务器别名（推荐）' },
            host: { type: 'string', description: '服务器地址（如果有多个活跃连接必须指定，或使用 alias）' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            timeout: { type: 'number', description: '等待响应超时时间（毫秒），默认 10000' },
            waitForPrompt: { type: 'boolean', description: '是否等待提示符出现，默认 true' },
            clearBuffer: { type: 'boolean', description: '是否先清空缓冲区，默认 false' },
            confirmationToken: { type: 'string', description: '危险命令确认 token' },
            targetConfirmationToken: { type: 'string', description: '服务器切换确认 token' },
          },
          required: ['input'],
        },
      },
      {
        name: 'shell_read',
        description: '读取持久化 shell 会话的输出缓冲区。推荐使用 alias 指定目标服务器。',
        inputSchema: {
          type: 'object',
          properties: {
            alias: { type: 'string', description: '服务器别名（推荐）' },
            host: { type: 'string', description: '服务器地址（可选，默认使用当前连接）' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            clear: { type: 'boolean', description: '是否清空缓冲区，默认 false' },
          },
        },
      },
      {
        name: 'shell_close',
        description: '关闭持久化 shell 会话。推荐使用 alias 指定目标服务器。',
        inputSchema: {
          type: 'object',
          properties: {
            alias: { type: 'string', description: '服务器别名（推荐）' },
            host: { type: 'string', description: '服务器地址（可选，默认使用当前连接）' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
          },
        },
      },

      // SFTP 操作
      {
        name: 'sftp_ls',
        description: '列出远程目录内容。推荐使用 alias 指定目标服务器。多服务器场景下切换目标时需确认。',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '远程目录路径' },
            alias: { type: 'string', description: '服务器别名（推荐）' },
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            targetConfirmationToken: { type: 'string', description: '服务器切换确认 token' },
          },
          required: ['path'],
        },
      },
      {
        name: 'sftp_upload',
        description: '上传文件到远程服务器。推荐使用 alias 指定目标服务器。多服务器场景下切换目标时需确认。',
        inputSchema: {
          type: 'object',
          properties: {
            localPath: { type: 'string', description: '本地文件路径' },
            remotePath: { type: 'string', description: '远程目标路径' },
            alias: { type: 'string', description: '服务器别名（推荐）' },
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            overwrite: { type: 'boolean', description: '是否覆盖已存在文件' },
            targetConfirmationToken: { type: 'string', description: '服务器切换确认 token' },
          },
          required: ['localPath', 'remotePath'],
        },
      },
      {
        name: 'sftp_download',
        description: '从远程服务器下载文件。推荐使用 alias 指定目标服务器。多服务器场景下切换目标时需确认。',
        inputSchema: {
          type: 'object',
          properties: {
            remotePath: { type: 'string', description: '远程文件路径' },
            localPath: { type: 'string', description: '本地目标路径' },
            alias: { type: 'string', description: '服务器别名（推荐）' },
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            overwrite: { type: 'boolean', description: '是否覆盖已存在文件' },
            targetConfirmationToken: { type: 'string', description: '服务器切换确认 token' },
          },
          required: ['remotePath', 'localPath'],
        },
      },
      {
        name: 'sftp_mkdir',
        description: '在远程服务器创建目录。推荐使用 alias 指定目标服务器。多服务器场景下切换目标时需确认。',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '目录路径' },
            alias: { type: 'string', description: '服务器别名（推荐）' },
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            recursive: { type: 'boolean', description: '是否递归创建' },
            targetConfirmationToken: { type: 'string', description: '服务器切换确认 token' },
          },
          required: ['path'],
        },
      },
      {
        name: 'sftp_rm',
        description: '删除远程文件或目录。推荐使用 alias 指定目标服务器。多服务器场景下切换目标时需确认。',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件或目录路径' },
            alias: { type: 'string', description: '服务器别名（推荐）' },
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            recursive: { type: 'boolean', description: '是否递归删除（目录）' },
            targetConfirmationToken: { type: 'string', description: '服务器切换确认 token' },
          },
          required: ['path'],
        },
      },

      // 系统工具
      {
        name: 'health_check',
        description: '检查 SSH 连接健康状态',
        inputSchema: {
          type: 'object',
          properties: {
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
          },
        },
      },
      {
        name: 'get_logs',
        description: '获取操作审计日志',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: '返回条数，默认 50' },
            server: { type: 'string', description: '按服务器过滤' },
            operation: { type: 'string', description: '按操作类型过滤' },
            level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'], description: '按日志级别过滤' },
          },
        },
      },
      {
        name: 'list_active_connections',
        description: '列出当前所有活跃的 SSH 连接，包含服务器环境标签（production/staging/test/development）和别名信息，帮助 AI 识别当前连接的是哪些服务器',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  /**
   * 处理工具调用
   */
  private async handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      // 连接管理
      case 'connect':
        return this.connectionTools.connect(ConnectSchema.parse(args));
      case 'disconnect':
        return this.connectionTools.disconnect(DisconnectSchema.parse(args));

      // 服务器管理
      case 'list_servers':
        return this.serverTools.listServers(ListServersSchema.parse(args));
      case 'save_server':
        return this.serverTools.saveServer(SaveServerSchema.parse(args));
      case 'remove_server':
        return this.serverTools.removeServer(RemoveServerSchema.parse(args));

      // 命令执行
      case 'exec':
        return this.execTools.exec(ExecSchema.parse(args));
      case 'exec_sudo':
        return this.execTools.execSudo(ExecSudoSchema.parse(args));
      case 'exec_batch':
        return this.execTools.execBatch(ExecBatchSchema.parse(args));
      case 'exec_shell':
        return this.execTools.execShell(ExecShellSchema.parse(args));
      case 'shell_send':
        return this.execTools.shellSend(ShellSendSchema.parse(args));
      case 'shell_read':
        return this.execTools.shellRead(ShellReadSchema.parse(args));
      case 'shell_close':
        return this.execTools.shellClose(ShellCloseSchema.parse(args));

      // SFTP 操作
      case 'sftp_ls':
        return this.sftpTools.ls(SftpLsSchema.parse(args));
      case 'sftp_upload':
        return this.sftpTools.upload(SftpUploadSchema.parse(args));
      case 'sftp_download':
        return this.sftpTools.download(SftpDownloadSchema.parse(args));
      case 'sftp_mkdir':
        return this.sftpTools.mkdir(SftpMkdirSchema.parse(args));
      case 'sftp_rm':
        return this.sftpTools.rm(SftpRmSchema.parse(args));

      // 系统工具
      case 'health_check':
        return this.systemTools.healthCheck(HealthCheckSchema.parse(args));
      case 'get_logs':
        return this.systemTools.getLogs(GetLogsSchema.parse(args));
      case 'list_active_connections':
        return this.connectionTools.listActiveConnections();

      default:
        throw new Error(`未知工具: ${name}`);
    }
  }

  /**
   * 启动服务器
   */
  async run(): Promise<void> {
    // 初始化凭证存储
    const masterPassword = process.env.SSH_MCP_MASTER_PASSWORD;
    await this.credentialStore.initialize(masterPassword);

    // 使用 stdio 传输
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.logger.log('info', 'server_start', {
      version: '0.1.0',
      config: {
        logLevel: this.config.logLevel,
        connectionTimeout: this.config.connectionTimeout,
        maxConnections: this.config.maxConnections,
      },
    });

    // 优雅退出
    process.on('SIGINT', async () => {
      await this.shutdown();
    });
    process.on('SIGTERM', async () => {
      await this.shutdown();
    });
  }

  /**
   * 关闭服务器
   */
  private async shutdown(): Promise<void> {
    this.logger.log('info', 'server_shutdown');
    this.confirmationManager.destroy();
    await this.sshManager.destroy();
    process.exit(0);
  }
}

// 启动服务器
const server = new SSHMCPServer();
server.run().catch((error) => {
  process.stderr.write(`启动失败: ${error}\n`);
  process.exit(1);
});
