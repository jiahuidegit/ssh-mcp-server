/**
 * MCP 连接管理工具
 * 提供 connect, disconnect 等连接相关工具
 */

import { z } from 'zod';
import { SSHManager } from '../core/ssh-manager.js';
import { ServerStore } from '../storage/server-store.js';
import { CredentialStore } from '../storage/credential-store.js';
import { ConnectOptions, SSHError, SSHErrorCode } from '../types/index.js';

// connect 参数 Schema
export const ConnectSchema = z.object({
  // 可以通过别名连接
  alias: z.string().optional(),
  // 或者直接提供连接参数
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().optional(),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  passphrase: z.string().optional(),
  timeout: z.number().int().min(1000).optional(),
});

// disconnect 参数 Schema
export const DisconnectSchema = z.object({
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  all: z.boolean().default(false),
});

export type ConnectParams = z.infer<typeof ConnectSchema>;
export type DisconnectParams = z.infer<typeof DisconnectSchema>;

/**
 * 连接工具处理器
 */
export class ConnectionTools {
  constructor(
    private sshManager: SSHManager,
    private serverStore: ServerStore,
    private credentialStore: CredentialStore
  ) {}

  /**
   * 建立 SSH 连接
   */
  async connect(params: ConnectParams): Promise<{ success: boolean; message: string; status?: unknown }> {
    let connectOptions: ConnectOptions;

    // 如果提供了别名，从存储中获取配置
    if (params.alias) {
      const serverConfig = this.serverStore.getServer(params.alias);
      if (!serverConfig) {
        throw new SSHError(SSHErrorCode.CONFIG_ERROR, `服务器不存在: ${params.alias}`);
      }

      // 获取凭证
      const credential = await this.credentialStore.get(params.alias);

      connectOptions = {
        host: serverConfig.host,
        port: serverConfig.port,
        username: serverConfig.username,
        password: credential?.password,
        privateKey: credential?.privateKey,
        passphrase: credential?.passphrase,
        timeout: params.timeout,
        // 传递 alias 和 environment 信息
        alias: params.alias,
        environment: serverConfig.environment,
      };
    } else {
      // 直接使用提供的参数
      if (!params.host || !params.username) {
        throw new SSHError(SSHErrorCode.CONFIG_ERROR, '必须提供 alias 或 host+username');
      }

      connectOptions = {
        host: params.host,
        port: params.port,
        username: params.username,
        password: params.password,
        privateKey: params.privateKey,
        passphrase: params.passphrase,
        timeout: params.timeout,
      };
    }

    const status = await this.sshManager.connect(connectOptions);

    return {
      success: true,
      message: `已连接到 ${status.username}@${status.host}:${status.port}`,
      status,
    };
  }

  /**
   * 断开 SSH 连接
   */
  async disconnect(params: DisconnectParams): Promise<{ success: boolean; message: string }> {
    if (params.all) {
      await this.sshManager.disconnect();
      return { success: true, message: '已断开所有连接' };
    }

    if (params.host && params.username) {
      await this.sshManager.disconnect(params.host, params.port, params.username);
      return { success: true, message: `已断开 ${params.username}@${params.host}` };
    }

    // 断开当前活动连接
    const active = this.sshManager.getActiveConnection();
    if (active) {
      const [userHost] = active.key.split(':');
      await this.sshManager.disconnect();
      return { success: true, message: `已断开 ${userHost}` };
    }

    return { success: false, message: '没有活动连接' };
  }

  /**
   * 列出当前连接
   */
  listConnections(): { connections: unknown[] } {
    const connections = this.sshManager.listConnections();
    return { connections };
  }

  /**
   * 列出活跃连接（包含环境信息）
   */
  listActiveConnections(): { connections: Array<{ host: string; port: number; username: string; environment?: string; alias?: string; connectedAt?: Date; lastActivity?: Date }> } {
    const connections = this.sshManager.listConnections();

    // 为每个连接附加环境和别名信息
    const enrichedConnections = connections.map((conn) => {
      const identity = this.sshManager.getServerIdentity(conn.host, conn.port, conn.username);
      return {
        host: conn.host,
        port: conn.port,
        username: conn.username,
        environment: identity.environment,
        alias: identity.alias,
        connectedAt: conn.connectedAt,
        lastActivity: conn.lastActivity,
      };
    });

    return { connections: enrichedConnections };
  }
}
