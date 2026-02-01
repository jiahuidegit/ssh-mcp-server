/**
 * MCP 服务器管理工具
 * 提供 list_servers, save_server, remove_server 等工具
 */

import { z } from 'zod';
import { ServerStore } from '../storage/server-store.js';
import { CredentialStore } from '../storage/credential-store.js';
import { ServerConfig } from '../types/index.js';
import { ConfirmationManager } from '../utils/confirmation-manager.js';

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
  environment: z.enum(['production', 'staging', 'test', 'development']).optional(),
  description: z.string().optional(),
  group: z.string().optional(),
  confirmationToken: z.string().optional(), // 覆盖现有配置的确认 token
});

// list_servers 参数 Schema
export const ListServersSchema = z.object({
  group: z.string().optional(),
});

// remove_server 参数 Schema
export const RemoveServerSchema = z.object({
  alias: z.string().min(1, '别名不能为空'),
  confirmationToken: z.string().optional(), // 删除确认 token
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
    private credentialStore: CredentialStore,
    private confirmationManager?: ConfirmationManager
  ) {}

  /**
   * 辅助方法：处理确认逻辑
   */
  private handleConfirmation(
    operation: string,
    params: Record<string, unknown>,
    warning: string
  ): { confirmationRequired: true; confirmationToken: string; expiresAt: Date; warning: string } | null {
    const token = (params as { confirmationToken?: string }).confirmationToken;

    if (token) {
      if (!this.confirmationManager) {
        throw new Error('确认管理器未初始化');
      }

      const verification = this.confirmationManager.verifyToken(token, operation, params);
      if (!verification.valid) {
        throw new Error(`确认验证失败: ${verification.reason}`);
      }
      return null;
    }

    // 没有 token，生成新 token
    if (!this.confirmationManager) {
      throw new Error('确认管理器未初始化');
    }

    const { token: newToken, expiresAt } = this.confirmationManager.generateToken(operation, params);

    return {
      confirmationRequired: true,
      confirmationToken: newToken,
      expiresAt,
      warning: `${warning}\n\n如果用户确认，请使用返回的 confirmationToken 重新调用：\n{\n  ...原参数,\n  confirmationToken: "${newToken}"\n}\n\ntoken 有效期: 5 分钟`,
    };
  }

  /**
   * 保存服务器配置
   */
  async saveServer(params: SaveServerParams): Promise<{ success: boolean; message: string } | { confirmationRequired: true; confirmationToken: string; expiresAt: Date; warning: string }> {
    // 检查是否覆盖现有配置
    const existingConfig = this.serverStore.getServer(params.alias);
    const isUpdate = !!existingConfig;

    // 如果是覆盖现有配置，需要确认
    if (isUpdate) {
      const existingEnv = existingConfig.environment;
      const isProductionExisting = existingEnv === 'production';

      // 构建警告信息
      let warning = '';
      if (isProductionExisting) {
        warning = `🚨 警告：即将覆盖【生产环境】服务器配置！\n\n现有配置:\n- 别名: ${existingConfig.alias}\n- 地址: ${existingConfig.host}:${existingConfig.port}\n- 用户: ${existingConfig.username}\n- 环境: PRODUCTION\n- 描述: ${existingConfig.description || '无'}\n\n新配置:\n- 地址: ${params.host}:${params.port}\n- 用户: ${params.username}\n- 环境: ${params.environment?.toUpperCase() || '未设置'}\n\n⚠️ 覆盖后原配置和凭证将丢失！`;
      } else {
        warning = `⚠️ 即将覆盖现有服务器配置\n\n现有配置:\n- 别名: ${existingConfig.alias}\n- 地址: ${existingConfig.host}:${existingConfig.port}\n- 用户: ${existingConfig.username}\n- 环境: ${existingEnv?.toUpperCase() || '未设置'}\n\n新配置:\n- 地址: ${params.host}:${params.port}\n- 用户: ${params.username}\n- 环境: ${params.environment?.toUpperCase() || '未设置'}\n\n覆盖后原配置和凭证将丢失！`;
      }

      const confirmation = this.handleConfirmation('save_server', params, warning);
      if (confirmation) {
        return confirmation;
      }
    }

    // 保存服务器配置（不含凭证）
    const serverConfig: ServerConfig = {
      alias: params.alias,
      host: params.host,
      port: params.port,
      username: params.username,
      authType: params.authType,
      environment: params.environment,
      description: params.description,
      group: params.group,
    };

    this.serverStore.saveServer(serverConfig);

    // 保存凭证
    await this.credentialStore.save(params.alias, {
      password: params.password,
      privateKey: params.privateKey,
      passphrase: params.passphrase,
    });

    const envLabel = params.environment ? ` [${params.environment.toUpperCase()}]` : '';
    return {
      success: true,
      message: isUpdate ? `已更新服务器${envLabel}: ${params.alias}` : `已保存服务器${envLabel}: ${params.alias}`,
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
  async removeServer(params: RemoveServerParams): Promise<{ success: boolean; message: string } | { confirmationRequired: true; confirmationToken: string; expiresAt: Date; warning: string }> {
    const exists = this.serverStore.exists(params.alias);
    if (!exists) {
      return { success: false, message: `服务器不存在: ${params.alias}` };
    }

    // 获取服务器配置，检查环境
    const serverConfig = this.serverStore.getServer(params.alias);
    if (!serverConfig) {
      return { success: false, message: `无法读取服务器配置: ${params.alias}` };
    }

    const environment = serverConfig.environment;
    const isProduction = environment === 'production';

    // 构建警告信息
    let warning = '';
    if (isProduction) {
      warning = `🚨 警告：即将删除【生产环境】服务器配置！\n\n服务器信息:\n- 别名: ${serverConfig.alias}\n- 地址: ${serverConfig.host}:${serverConfig.port}\n- 用户: ${serverConfig.username}\n- 环境: PRODUCTION\n- 描述: ${serverConfig.description || '无'}\n\n⚠️ 删除后将无法通过别名快速连接此服务器，凭证信息也会被删除且无法恢复！`;
    } else {
      warning = `⚠️ 即将删除服务器配置\n\n服务器信息:\n- 别名: ${serverConfig.alias}\n- 地址: ${serverConfig.host}:${serverConfig.port}\n- 用户: ${serverConfig.username}\n- 环境: ${environment?.toUpperCase() || '未设置'}\n- 描述: ${serverConfig.description || '无'}\n\n删除后将无法通过别名快速连接此服务器，凭证信息也会被删除。`;
    }

    const confirmation = this.handleConfirmation('remove_server', params, warning);
    if (confirmation) {
      return confirmation;
    }

    // 确认后执行删除
    this.serverStore.removeServer(params.alias);
    await this.credentialStore.delete(params.alias);

    const envLabel = environment ? ` [${environment.toUpperCase()}]` : '';
    return { success: true, message: `已删除服务器${envLabel}: ${params.alias}` };
  }
}
