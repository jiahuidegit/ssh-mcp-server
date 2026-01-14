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

/** SSH 连接包装器（只存状态） */
interface SSHConnection {
  client: Client;
  connectedAt: Date;
  lastActivity: Date;
  isHealthy: boolean; // 连接健康状态
  lastHealthCheck?: Date; // 最后一次健康检查时间
  isManualDisconnect: boolean; // 是否为主动断开（用于区分异常断开）
}

/**
 * SSH 连接管理器
 * 实现连接池复用，自动清理空闲连接
 *
 * 优化：配置和连接状态分离
 * - connections: 只存活跃连接状态（断开自动清理）
 * - configCache: 持久化连接配置（断开后仍保留，支持重连）
 */
export class SSHManager {
  private connections: Map<string, SSHConnection> = new Map();
  private configCache: Map<string, ConnectOptions> = new Map(); // 配置缓存（独立存储）
  private cleanupTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout; // 健康检查定时器
  private config: MCPServerConfig;
  private logger: AuditLogger;

  constructor(config: Partial<MCPServerConfig> = {}, logger: AuditLogger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger;
    this.startCleanupTimer();
    if (this.config.enableHealthCheck) {
      this.startHealthCheckTimer();
    }
  }

  /**
   * 建立 SSH 连接
   */
  async connect(options: ConnectOptions): Promise<ConnectionStatus> {
    const key = getConnectionKey(options.host, options.port ?? 22, options.username);

    // 先缓存配置（无论是否已连接）
    this.configCache.set(key, options);

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
      // 启用 keepalive 保持连接活跃
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
      // 增加算法兼容性（支持旧版 SSH 服务器）
      algorithms: {
        kex: [
          'curve25519-sha256',
          'curve25519-sha256@libssh.org',
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
          'diffie-hellman-group-exchange-sha256',
          'diffie-hellman-group14-sha256',
          'diffie-hellman-group14-sha1',
          'diffie-hellman-group1-sha1',
        ],
        cipher: [
          'aes128-ctr',
          'aes192-ctr',
          'aes256-ctr',
          'aes128-gcm',
          'aes128-gcm@openssh.com',
          'aes256-gcm',
          'aes256-gcm@openssh.com',
          'aes256-cbc',
          'aes192-cbc',
          'aes128-cbc',
          '3des-cbc',
        ],
        serverHostKey: [
          'ssh-ed25519',
          'ecdsa-sha2-nistp256',
          'ecdsa-sha2-nistp384',
          'ecdsa-sha2-nistp521',
          'rsa-sha2-512',
          'rsa-sha2-256',
          'ssh-rsa',
          'ssh-dss',
        ],
        hmac: [
          'hmac-sha2-256',
          'hmac-sha2-512',
          'hmac-sha1',
        ],
      },
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
          // 监听连接事件
          client.on('ready', () => {
            this.logger.log('debug', 'ssh_ready', { server: key });
            resolve();
          });
          client.on('error', (err) => {
            this.logger.log('error', 'ssh_error', { server: key, error: err.message });
            reject(err);
          });

          // 监听连接断开事件，自动清理
          client.on('close', () => {
            this.logger.log('debug', 'ssh_close', { server: key });
            const conn = this.connections.get(key);
            // 只有在非主动断开时才标记为异常
            if (conn && !conn.isManualDisconnect) {
              conn.isHealthy = false;
              this.logger.log('warn', 'ssh_unexpected_close', {
                server: key,
                reason: '连接意外关闭'
              });
            }
            // 自动从连接池中移除
            if (this.connections.has(key)) {
              this.connections.delete(key);
              this.logger.log('info', 'ssh_auto_cleanup', {
                server: key,
                reason: conn?.isManualDisconnect ? 'manual disconnect' : 'connection closed'
              });
            }
          });
          client.on('end', () => {
            this.logger.log('debug', 'ssh_end', { server: key });
          });

          // 启用 debug 模式（仅在 debug 级别时）
          if (this.config.logLevel === 'debug') {
            connectConfig.debug = (msg: string) => {
              this.logger.log('debug', 'ssh_debug', { server: key, message: msg });
            };
          }

          client.connect(connectConfig);
        }),
        this.config.connectionTimeout,
        `连接超时 (${this.config.connectionTimeout}ms)`
      );

      const now = new Date();
      this.connections.set(key, {
        client,
        connectedAt: now,
        lastActivity: now,
        isHealthy: true,
        lastHealthCheck: now,
        isManualDisconnect: false,
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
   * 重新连接（用于连接丢失后恢复）
   */
  async reconnect(host: string, port: number, username: string): Promise<ConnectionStatus> {
    const key = getConnectionKey(host, port, username);

    // 从配置缓存获取原始配置
    const cachedConfig = this.configCache.get(key);

    if (!cachedConfig) {
      throw new SSHError(
        SSHErrorCode.NOT_CONNECTED,
        '无法重连：连接配置不存在（未曾连接过此服务器，或配置已过期）'
      );
    }

    // 先断开旧连接（如果存在）
    await this.disconnectByKey(key);

    // 使用缓存的配置重新连接
    let attempts = 0;
    const maxAttempts = this.config.maxReconnectAttempts;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        this.logger.log('info', 'ssh_reconnect_attempt', {
          server: key,
          attempt: attempts,
          maxAttempts,
        });

        const status = await this.connect(cachedConfig);
        this.logger.log('info', 'ssh_reconnect_success', {
          server: key,
          attempts,
        });
        return status;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.log('warn', 'ssh_reconnect_failed', {
          server: key,
          attempt: attempts,
          error: message,
        });

        if (attempts >= maxAttempts) {
          throw new SSHError(
            SSHErrorCode.CONNECTION_FAILED,
            `重连失败 (${maxAttempts} 次尝试): ${message}`,
            error
          );
        }

        // 等待后重试（指数退避）
        const delay = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // 不应该到这里，但为了类型安全
    throw new SSHError(SSHErrorCode.CONNECTION_FAILED, '重连失败');
  }

  /**
   * 根据 key 断开连接
   */
  private async disconnectByKey(key: string): Promise<void> {
    const conn = this.connections.get(key);
    if (conn) {
      conn.isManualDisconnect = true; // 标记为主动断开
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
    const cachedConfig = this.configCache.get(key);

    if (!conn) {
      // 连接已断开，但可能还有缓存配置
      if (cachedConfig) {
        return {
          connected: false,
          host: cachedConfig.host,
          port: cachedConfig.port ?? 22,
          username: cachedConfig.username,
        };
      }

      // 完全没有信息，从 key 解析
      const [userHost, portStr] = key.split(':');
      const [username, host] = userHost?.split('@') ?? ['', ''];
      return {
        connected: false,
        host: host ?? '',
        port: parseInt(portStr ?? '22', 10),
        username: username ?? '',
      };
    }

    // 连接存在，返回详细状态
    return {
      connected: true,
      host: cachedConfig?.host ?? '',
      port: cachedConfig?.port ?? 22,
      username: cachedConfig?.username ?? '',
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
        conn.isManualDisconnect = true; // 标记为主动断开
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
   * 启动健康检查定时器
   */
  private startHealthCheckTimer(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    this.logger.log('debug', 'health_check_started', {
      interval: `${this.config.healthCheckInterval}ms`,
    });
  }

  /**
   * 执行健康检查（心跳检测）
   */
  private performHealthCheck(): void {
    for (const [key, conn] of this.connections) {
      // 执行简单的 echo 命令作为心跳
      conn.client.exec('echo "heartbeat"', (err, stream) => {
        if (err) {
          // 心跳失败，标记为不健康
          conn.isHealthy = false;
          this.logger.log('warn', 'health_check_failed', {
            server: key,
            error: err.message,
          });
          return;
        }

        let response = '';
        stream.on('data', (data: Buffer) => {
          response += data.toString();
        });

        stream.on('close', () => {
          // 检查响应是否正确
          if (response.trim() === 'heartbeat') {
            conn.isHealthy = true;
            conn.lastHealthCheck = new Date();
            this.logger.log('debug', 'health_check_success', {
              server: key,
            });
          } else {
            conn.isHealthy = false;
            this.logger.log('warn', 'health_check_invalid_response', {
              server: key,
              response: response.trim(),
            });
          }
        });

        stream.on('error', (streamErr: Error) => {
          conn.isHealthy = false;
          this.logger.log('warn', 'health_check_stream_error', {
            server: key,
            error: streamErr.message,
          });
        });
      });
    }
  }

  /**
   * 销毁管理器（关闭所有连接和定时器）
   */
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    await this.disconnect();
    // 注意：不清空 configCache，保留配置用于下次启动
  }

  // ============ 配置缓存管理（新增） ============

  /**
   * 获取缓存的连接配置
   */
  getCachedConfig(host: string, port: number, username: string): ConnectOptions | undefined {
    const key = getConnectionKey(host, port, username);
    return this.configCache.get(key);
  }

  /**
   * 列出所有缓存的配置
   */
  listCachedConfigs(): Array<{ key: string; config: ConnectOptions }> {
    return Array.from(this.configCache.entries()).map(([key, config]) => ({
      key,
      config,
    }));
  }

  /**
   * 手动清除指定配置缓存
   */
  clearConfigCache(host: string, port: number, username: string): boolean {
    const key = getConnectionKey(host, port, username);
    return this.configCache.delete(key);
  }

  /**
   * 清空所有配置缓存
   */
  clearAllConfigCache(): void {
    this.configCache.clear();
    this.logger.log('info', 'config_cache_cleared', {
      message: '已清空所有配置缓存',
    });
  }

  /**
   * 检查配置缓存大小（用于调试）
   */
  getConfigCacheSize(): number {
    return this.configCache.size;
  }
}
