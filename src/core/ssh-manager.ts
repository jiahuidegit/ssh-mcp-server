/**
 * SSH 连接管理器
 * 负责 SSH 连接的建立、复用和生命周期管理
 */

import { Client, ConnectConfig } from 'ssh2';
import {
  ConnectOptions,
  ConnectionStatus,
  SSHError,
  SSHErrorCode,
  MCPServerConfig,
  DEFAULT_CONFIG,
} from '../types/index.js';
import { getConnectionKey, withTimeout } from '../utils/index.js';
import { AuditLogger } from '../logging/audit-logger.js';

/** SSH 连接包装器 */
interface SSHConnection {
  client: Client;
  config: ConnectOptions;
  connectedAt: Date;
  lastActivity: Date;
}

/**
 * SSH 连接管理器
 * 实现连接池复用，自动清理空闲连接
 */
export class SSHManager {
  private connections: Map<string, SSHConnection> = new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private config: MCPServerConfig;
  private logger: AuditLogger;

  constructor(config: Partial<MCPServerConfig> = {}, logger: AuditLogger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger;
    this.startCleanupTimer();
  }

  /**
   * 建立 SSH 连接
   */
  async connect(options: ConnectOptions): Promise<ConnectionStatus> {
    const key = getConnectionKey(options.host, options.port ?? 22, options.username);

    // 检查是否已有连接
    const existing = this.connections.get(key);
    if (existing) {
      existing.lastActivity = new Date();
      this.logger.log('info', 'ssh_connect', {
        server: key,
        reused: true,
      });
      return this.getStatus(key);
    }

    // 检查连接数限制
    if (this.connections.size >= this.config.maxConnections) {
      throw new SSHError(
        SSHErrorCode.CONNECTION_FAILED,
        `达到最大连接数限制 (${this.config.maxConnections})`
      );
    }

    // 创建新连接
    const client = new Client();
    const connectConfig: ConnectConfig = {
      host: options.host,
      port: options.port ?? 22,
      username: options.username,
      readyTimeout: this.config.connectionTimeout,
    };

    // 设置认证方式
    if (options.password) {
      connectConfig.password = options.password;
    } else if (options.privateKey) {
      connectConfig.privateKey = options.privateKey;
      if (options.passphrase) {
        connectConfig.passphrase = options.passphrase;
      }
    } else {
      throw new SSHError(SSHErrorCode.AUTH_FAILED, '必须提供密码或私钥');
    }

    try {
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          client.on('ready', () => resolve());
          client.on('error', (err) => reject(err));
          client.connect(connectConfig);
        }),
        this.config.connectionTimeout,
        `连接超时 (${this.config.connectionTimeout}ms)`
      );

      const now = new Date();
      this.connections.set(key, {
        client,
        config: options,
        connectedAt: now,
        lastActivity: now,
      });

      this.logger.log('info', 'ssh_connect', {
        server: key,
        success: true,
      });

      return this.getStatus(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // 判断错误类型
      const errorCode = message.includes('authentication')
        ? SSHErrorCode.AUTH_FAILED
        : SSHErrorCode.CONNECTION_FAILED;

      this.logger.log('error', 'ssh_connect', {
        server: key,
        error: message,
      });

      throw new SSHError(errorCode, `连接失败: ${message}`, error);
    }
  }

  /**
   * 断开 SSH 连接
   */
  async disconnect(host?: string, port?: number, username?: string): Promise<void> {
    if (host && username) {
      // 断开指定连接
      const key = getConnectionKey(host, port ?? 22, username);
      await this.disconnectByKey(key);
    } else {
      // 断开所有连接
      const keys = Array.from(this.connections.keys());
      await Promise.all(keys.map((key) => this.disconnectByKey(key)));
    }
  }

  /**
   * 根据 key 断开连接
   */
  private async disconnectByKey(key: string): Promise<void> {
    const conn = this.connections.get(key);
    if (conn) {
      conn.client.end();
      this.connections.delete(key);
      this.logger.log('info', 'ssh_disconnect', { server: key });
    }
  }

  /**
   * 获取连接（用于执行命令等）
   */
  getConnection(host: string, port: number, username: string): Client | undefined {
    const key = getConnectionKey(host, port, username);
    const conn = this.connections.get(key);
    if (conn) {
      conn.lastActivity = new Date();
      return conn.client;
    }
    return undefined;
  }

  /**
   * 获取当前活动连接（最后使用的）
   */
  getActiveConnection(): { key: string; client: Client } | undefined {
    let latest: { key: string; conn: SSHConnection } | undefined;

    for (const [key, conn] of this.connections) {
      if (!latest || conn.lastActivity > latest.conn.lastActivity) {
        latest = { key, conn };
      }
    }

    if (latest) {
      latest.conn.lastActivity = new Date();
      return { key: latest.key, client: latest.conn.client };
    }
    return undefined;
  }

  /**
   * 获取连接状态
   */
  getStatus(key: string): ConnectionStatus {
    const conn = this.connections.get(key);
    if (!conn) {
      const [userHost, portStr] = key.split(':');
      const [username, host] = userHost?.split('@') ?? ['', ''];
      return {
        connected: false,
        host: host ?? '',
        port: parseInt(portStr ?? '22', 10),
        username: username ?? '',
      };
    }

    return {
      connected: true,
      host: conn.config.host,
      port: conn.config.port ?? 22,
      username: conn.config.username,
      connectedAt: conn.connectedAt,
      lastActivity: conn.lastActivity,
    };
  }

  /**
   * 列出所有连接
   */
  listConnections(): ConnectionStatus[] {
    return Array.from(this.connections.keys()).map((key) => this.getStatus(key));
  }

  /**
   * 启动空闲连接清理定时器
   */
  private startCleanupTimer(): void {
    // 每分钟检查一次
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000);
  }

  /**
   * 清理空闲连接
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    for (const [key, conn] of this.connections) {
      const idleTime = now - conn.lastActivity.getTime();
      if (idleTime > this.config.idleTimeout) {
        conn.client.end();
        this.connections.delete(key);
        this.logger.log('info', 'ssh_idle_cleanup', {
          server: key,
          idleTime: `${Math.round(idleTime / 1000)}s`,
        });
      }
    }
  }

  /**
   * 销毁管理器（关闭所有连接和定时器）
   */
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    await this.disconnect();
  }
}
