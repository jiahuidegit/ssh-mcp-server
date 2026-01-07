/**
 * MCP 服务器管理工具
 * 提供 list_servers, save_server, remove_server 等工具
 */

import { z } from 'zod';
import { ServerStore } from '../storage/server-store.js';
import { CredentialStore } from '../storage/credential-store.js';
import { ServerConfig } from '../types/index.js';

// save_server 参数 Schema
export const SaveServerSchema = z.object({
  alias: z.string().min(1, '别名不能为空'),
  host: z.string().min(1, '主机地址不能为空'),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1, '用户名不能为空'),
  authType: z.enum(['password', 'privateKey']),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  passphrase: z.string().optional(),
  group: z.string().optional(),
});

// list_servers 参数 Schema
export const ListServersSchema = z.object({
  group: z.string().optional(),
});

// remove_server 参数 Schema
export const RemoveServerSchema = z.object({
  alias: z.string().min(1, '别名不能为空'),
});

export type SaveServerParams = z.infer<typeof SaveServerSchema>;
export type ListServersParams = z.infer<typeof ListServersSchema>;
export type RemoveServerParams = z.infer<typeof RemoveServerSchema>;

/**
 * 服务器管理工具处理器
 */
export class ServerTools {
  constructor(
    private serverStore: ServerStore,
    private credentialStore: CredentialStore
  ) {}

  /**
   * 保存服务器配置
   */
  async saveServer(params: SaveServerParams): Promise<{ success: boolean; message: string }> {
    // 保存服务器配置（不含凭证）
    const serverConfig: ServerConfig = {
      alias: params.alias,
      host: params.host,
      port: params.port,
      username: params.username,
      authType: params.authType,
      group: params.group,
    };

    this.serverStore.saveServer(serverConfig);

    // 保存凭证
    await this.credentialStore.save(params.alias, {
      password: params.password,
      privateKey: params.privateKey,
      passphrase: params.passphrase,
    });

    const isUpdate = this.serverStore.exists(params.alias);
    return {
      success: true,
      message: isUpdate ? `已更新服务器: ${params.alias}` : `已保存服务器: ${params.alias}`,
    };
  }

  /**
   * 列出服务器
   */
  listServers(params: ListServersParams): { servers: ServerConfig[]; groups: string[] } {
    const servers = this.serverStore.listServers(params.group);
    const groups = this.serverStore.listGroups();
    return { servers, groups };
  }

  /**
   * 删除服务器
   */
  async removeServer(params: RemoveServerParams): Promise<{ success: boolean; message: string }> {
    const exists = this.serverStore.exists(params.alias);
    if (!exists) {
      return { success: false, message: `服务器不存在: ${params.alias}` };
    }

    // 删除服务器配置
    this.serverStore.removeServer(params.alias);

    // 删除凭证
    await this.credentialStore.delete(params.alias);

    return { success: true, message: `已删除服务器: ${params.alias}` };
  }
}
