/**
 * SSH MCP Server 类型定义
 */

import { z } from 'zod';

// ============ 服务器配置类型 ============

/** 认证类型 */
export type AuthType = 'password' | 'privateKey';

/** 服务器配置 Schema */
export const ServerConfigSchema = z.object({
  alias: z.string().min(1, '别名不能为空'),
  host: z.string().min(1, '主机地址不能为空'),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1, '用户名不能为空'),
  authType: z.enum(['password', 'privateKey']),
  group: z.string().optional(),
  // 敏感信息不在这里存储，由 CredentialStore 管理
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

/** 完整的服务器配置（包含凭证，仅内部使用） */
export interface ServerConfigWithCredentials extends ServerConfig {
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

// ============ 连接相关类型 ============

/** 连接选项 */
export interface ConnectOptions {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  timeout?: number;
}

/** 连接状态 */
export interface ConnectionStatus {
  connected: boolean;
  host: string;
  port: number;
  username: string;
  connectedAt?: Date;
  lastActivity?: Date;
}

// ============ 命令执行相关类型 ============

/** 命令执行选项 */
export interface ExecOptions {
  timeout?: number; // 自定义超时，毫秒
  useLongTimeout?: boolean; // 使用长超时（如 docker build），会使用 longCommandTimeout
  cwd?: string;
  env?: Record<string, string>;
}

/** 命令执行结果 */
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number; // 毫秒
}

/** 批量执行结果 */
export interface BatchExecResult {
  host: string;
  success: boolean;
  result?: ExecResult;
  error?: string;
}

// ============ SFTP 相关类型 ============

/** 文件信息 */
export interface FileInfo {
  filename: string;
  longname: string;
  attrs: {
    mode: number;
    uid: number;
    gid: number;
    size: number;
    atime: number;
    mtime: number;
  };
  isDirectory: boolean;
  isFile: boolean;
  isSymbolicLink: boolean;
}

/** SFTP 操作选项 */
export interface SftpOptions {
  overwrite?: boolean;
  recursive?: boolean;
}

// ============ 日志相关类型 ============

/** 日志级别 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** 审计日志条目 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  operation: string;
  server?: string;
  user?: string;
  details?: Record<string, unknown>;
  duration?: number;
  success: boolean;
  error?: string;
}

// ============ 错误类型 ============

/** SSH 错误码 */
export enum SSHErrorCode {
  CONNECTION_FAILED = 'SSH_CONN_FAILED',
  AUTH_FAILED = 'SSH_AUTH_FAILED',
  COMMAND_TIMEOUT = 'SSH_CMD_TIMEOUT',
  SFTP_ERROR = 'SSH_SFTP_ERROR',
  PERMISSION_DENIED = 'SSH_PERM_DENIED',
  NOT_CONNECTED = 'SSH_NOT_CONNECTED',
  CONFIG_ERROR = 'SSH_CONFIG_ERROR',
  CREDENTIAL_ERROR = 'SSH_CREDENTIAL_ERROR',
}

/** SSH 错误类 */
export class SSHError extends Error {
  constructor(
    public code: SSHErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'SSHError';
  }
}

// ============ 配置类型 ============

/** MCP Server 配置 */
export interface MCPServerConfig {
  logLevel: LogLevel;
  logFile?: string;
  connectionTimeout: number; // SSH 连接建立超时，毫秒
  commandTimeout: number; // 普通命令执行超时，毫秒
  longCommandTimeout: number; // 耗时命令超时（如 docker build），毫秒
  idleTimeout: number; // 连接池空闲超时，毫秒
  maxConnections: number;
  dataDir: string; // 数据存储目录
  enableHealthCheck: boolean; // 是否启用连接健康检查
  healthCheckInterval: number; // 健康检查间隔，毫秒
  autoReconnect: boolean; // 命令超时后是否自动重连
  maxReconnectAttempts: number; // 最大重连尝试次数
}

/** 默认配置 */
export const DEFAULT_CONFIG: MCPServerConfig = {
  logLevel: 'info',
  connectionTimeout: 30000, // 30 秒
  commandTimeout: 60000, // 1 分钟
  longCommandTimeout: 1800000, // 30 分钟（用于 docker build 等耗时操作）
  idleTimeout: 300000, // 5 分钟
  maxConnections: 10,
  dataDir: '~/.ssh-mcp',
  enableHealthCheck: true,
  healthCheckInterval: 30000, // 30 秒心跳检测
  autoReconnect: true,
  maxReconnectAttempts: 3,
};
