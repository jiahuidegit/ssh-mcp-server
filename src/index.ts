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

import { MCPServerConfig, DEFAULT_CONFIG, SSHError } from './types/index.js';
import { getEnvConfig } from './utils/index.js';

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
import { ExecTools, ExecSchema, ExecSudoSchema, ExecBatchSchema } from './tools/exec.js';
import { SftpTools, SftpLsSchema, SftpUploadSchema, SftpDownloadSchema, SftpMkdirSchema, SftpRmSchema } from './tools/sftp.js';
import { SystemTools, HealthCheckSchema, GetLogsSchema } from './tools/system.js';

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
    this.credentialStore = new CredentialStore(this.config);

    // 初始化核心模块
    this.sshManager = new SSHManager(this.config, this.logger);
    this.commandExecutor = new CommandExecutor(this.sshManager, this.config, this.logger);
    this.sftpOperator = new SFTPOperator(this.sshManager, this.config, this.logger);

    // 初始化工具处理器
    this.connectionTools = new ConnectionTools(this.sshManager, this.serverStore, this.credentialStore);
    this.serverTools = new ServerTools(this.serverStore, this.credentialStore);
    this.execTools = new ExecTools(this.commandExecutor);
    this.sftpTools = new SftpTools(this.sftpOperator);
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
      idleTimeout: getEnvConfig('SSH_MCP_IDLE_TIMEOUT', DEFAULT_CONFIG.idleTimeout),
      maxConnections: getEnvConfig('SSH_MCP_MAX_CONNECTIONS', DEFAULT_CONFIG.maxConnections),
      dataDir: getEnvConfig('SSH_MCP_DATA_DIR', DEFAULT_CONFIG.dataDir),
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
        const errorMessage = error instanceof SSHError
          ? `[${error.code}] ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);

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
        description: '保存服务器配置',
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
            group: { type: 'string', description: '服务器分组' },
          },
          required: ['alias', 'host', 'username', 'authType'],
        },
      },
      {
        name: 'remove_server',
        description: '删除已保存的服务器配置',
        inputSchema: {
          type: 'object',
          properties: {
            alias: { type: 'string', description: '服务器别名' },
          },
          required: ['alias'],
        },
      },

      // 命令执行
      {
        name: 'exec',
        description: '在远程服务器执行命令',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '要执行的命令' },
            host: { type: 'string', description: '服务器地址（可选，默认使用当前连接）' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            timeout: { type: 'number', description: '命令超时时间（毫秒）' },
            cwd: { type: 'string', description: '工作目录' },
          },
          required: ['command'],
        },
      },
      {
        name: 'exec_sudo',
        description: '以 sudo 权限执行命令',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '要执行的命令' },
            sudoPassword: { type: 'string', description: 'sudo 密码' },
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            timeout: { type: 'number', description: '命令超时时间（毫秒）' },
          },
          required: ['command', 'sudoPassword'],
        },
      },
      {
        name: 'exec_batch',
        description: '在多台服务器批量执行命令',
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
          },
          required: ['command', 'servers'],
        },
      },

      // SFTP 操作
      {
        name: 'sftp_ls',
        description: '列出远程目录内容',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '远程目录路径' },
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
          },
          required: ['path'],
        },
      },
      {
        name: 'sftp_upload',
        description: '上传文件到远程服务器',
        inputSchema: {
          type: 'object',
          properties: {
            localPath: { type: 'string', description: '本地文件路径' },
            remotePath: { type: 'string', description: '远程目标路径' },
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            overwrite: { type: 'boolean', description: '是否覆盖已存在文件' },
          },
          required: ['localPath', 'remotePath'],
        },
      },
      {
        name: 'sftp_download',
        description: '从远程服务器下载文件',
        inputSchema: {
          type: 'object',
          properties: {
            remotePath: { type: 'string', description: '远程文件路径' },
            localPath: { type: 'string', description: '本地目标路径' },
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            overwrite: { type: 'boolean', description: '是否覆盖已存在文件' },
          },
          required: ['remotePath', 'localPath'],
        },
      },
      {
        name: 'sftp_mkdir',
        description: '在远程服务器创建目录',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '目录路径' },
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            recursive: { type: 'boolean', description: '是否递归创建' },
          },
          required: ['path'],
        },
      },
      {
        name: 'sftp_rm',
        description: '删除远程文件或目录',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件或目录路径' },
            host: { type: 'string', description: '服务器地址' },
            port: { type: 'number', description: 'SSH 端口' },
            username: { type: 'string', description: '用户名' },
            recursive: { type: 'boolean', description: '是否递归删除（目录）' },
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
