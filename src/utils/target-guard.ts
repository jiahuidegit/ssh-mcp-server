/**
 * 目标锁定守卫
 * 追踪 AI 当前操作的目标服务器，当目标切换时强制确认，防止多服务器场景下误操作
 */

import { SSHManager } from '../core/ssh-manager.js';
import { ConfirmationManager } from './confirmation-manager.js';
import { ServerStore } from '../storage/server-store.js';
import { ServerIdentity } from '../types/index.js';
import { getConnectionKey } from './index.js';

/** 目标切换确认的返回结构 */
export interface TargetSwitchResponse {
  targetSwitchRequired: true;
  targetConfirmationToken: string;
  expiresAt: Date;
  from: ServerIdentity;
  to: ServerIdentity;
  warning: string;
}

/** validateTarget 的返回结果 */
export interface TargetValidationResult {
  /** 解析后的服务器参数 */
  resolved: { host: string; port: number; username: string };
  /** 如果需要切换确认，返回确认响应；null 表示放行 */
  confirmationResponse: TargetSwitchResponse | null;
}

/**
 * 目标锁定守卫
 */
export class TargetGuard {
  /** 上次操作目标的 connectionKey */
  private lastTargetKey: string | null = null;
  /** 上次操作目标的身份信息 */
  private lastTargetIdentity: ServerIdentity | null = null;

  constructor(
    private sshManager: SSHManager,
    private confirmationManager: ConfirmationManager,
    private serverStore: ServerStore
  ) {}

  /**
   * 解析服务器参数：alias 优先，否则使用 host/port/username
   * @returns 解析后的 host/port/username
   */
  resolveServer(params: {
    alias?: string;
    host?: string;
    port?: number;
    username?: string;
  }): { host: string; port: number; username: string } {
    // alias 优先
    if (params.alias) {
      const serverConfig = this.serverStore.getServer(params.alias);
      if (!serverConfig) {
        throw new Error(`服务器别名不存在: ${params.alias}，请先使用 save_server 保存或使用 list_servers 查看已保存的服务器`);
      }
      return {
        host: serverConfig.host,
        port: serverConfig.port ?? 22,
        username: serverConfig.username,
      };
    }

    // 使用原始参数（host/username 可能为空，后续由 CommandExecutor 处理单连接默认逻辑）
    if (params.host && params.username) {
      return {
        host: params.host,
        port: params.port ?? 22,
        username: params.username,
      };
    }

    // 没有指定任何目标，返回空（交给下层的多连接检查处理）
    return { host: '', port: params.port ?? 22, username: '' };
  }

  /**
   * 校验目标切换
   * @param operation 操作类型，如 "exec"、"sftp_ls"
   * @param params 调用参数（含 alias/host/port/username/targetConfirmationToken）
   * @returns 解析后的参数 + 可能的确认响应
   */
  validateTarget(
    operation: string,
    params: {
      alias?: string;
      host?: string;
      port?: number;
      username?: string;
      targetConfirmationToken?: string;
    }
  ): TargetValidationResult {
    const resolved = this.resolveServer(params);

    // 如果没有指定目标（没传 host/alias），不做切换检查，交给下层处理
    if (!resolved.host) {
      return { resolved, confirmationResponse: null };
    }

    const targetKey = getConnectionKey(resolved.host, resolved.port, resolved.username);

    // 获取活跃连接数
    const activeConnections = this.sshManager.listConnections();

    // 规则1: 只有 0 或 1 个连接，不可能搞混，放行
    if (activeConnections.length <= 1) {
      return { resolved, confirmationResponse: null };
    }

    // 规则2: 首次操作（lastTarget 为空），记录并放行
    if (!this.lastTargetKey) {
      return { resolved, confirmationResponse: null };
    }

    // 规则3: 目标没变，放行
    if (this.lastTargetKey === targetKey) {
      return { resolved, confirmationResponse: null };
    }

    // 规则4: 目标变了，需要确认
    const tokenOperation = `target_switch:${operation}`;

    // 如果携带了 targetConfirmationToken，验证
    if (params.targetConfirmationToken) {
      const verification = this.confirmationManager.verifyToken(
        params.targetConfirmationToken,
        tokenOperation,
        this.buildTokenParams(operation, params)
      );

      if (!verification.valid) {
        throw new Error(`目标切换确认失败: ${verification.reason}`);
      }

      // 验证通过，放行
      return { resolved, confirmationResponse: null };
    }

    // 没有 token，生成确认请求
    const fromIdentity = this.lastTargetIdentity ?? this.buildIdentity(this.lastTargetKey);
    const toIdentity = this.sshManager.getServerIdentity(resolved.host, resolved.port, resolved.username);

    const { token, expiresAt } = this.confirmationManager.generateToken(
      tokenOperation,
      this.buildTokenParams(operation, params)
    );

    const fromLabel = this.formatIdentity(fromIdentity);
    const toLabel = this.formatIdentity(toIdentity);

    return {
      resolved,
      confirmationResponse: {
        targetSwitchRequired: true,
        targetConfirmationToken: token,
        expiresAt,
        from: fromIdentity,
        to: toIdentity,
        warning: [
          '检测到服务器切换！',
          `上次操作: ${fromLabel}`,
          `即将操作: ${toLabel}`,
          '',
          '请确认切换目标正确。',
          `使用返回的 targetConfirmationToken 重新调用以确认切换。`,
          `token 有效期: 5 分钟`,
        ].join('\n'),
      },
    };
  }

  /**
   * 记录成功操作的目标
   */
  recordTarget(key: string, identity: ServerIdentity): void {
    this.lastTargetKey = key;
    this.lastTargetIdentity = identity;
  }

  /**
   * 重置目标（断开连接时调用）
   */
  resetTarget(): void {
    this.lastTargetKey = null;
    this.lastTargetIdentity = null;
  }

  /**
   * 获取上次操作目标的 key（用于外部查询）
   */
  getLastTargetKey(): string | null {
    return this.lastTargetKey;
  }

  // ============ 私有方法 ============

  /**
   * 构建 token 验证用的参数（排除 targetConfirmationToken 本身）
   */
  private buildTokenParams(
    operation: string,
    params: Record<string, unknown>
  ): Record<string, unknown> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { targetConfirmationToken, ...rest } = params;
    return { ...rest, _operation: operation };
  }

  /**
   * 从 connectionKey 构建 ServerIdentity
   */
  private buildIdentity(key: string): ServerIdentity {
    const [userHost, portStr] = key.split(':');
    const [username, host] = (userHost ?? '').split('@');
    return {
      host: host ?? 'unknown',
      port: parseInt(portStr ?? '22', 10),
      username: username ?? 'unknown',
    };
  }

  /**
   * 格式化 ServerIdentity 为人类可读的标签
   */
  private formatIdentity(identity: ServerIdentity): string {
    const parts: string[] = [];

    if (identity.alias) {
      parts.push(`[${identity.alias}]`);
    }

    parts.push(`${identity.username}@${identity.host}:${identity.port}`);

    if (identity.environment) {
      parts.push(identity.environment.toUpperCase());
    }

    return parts.join(' ');
  }
}
