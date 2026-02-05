/**
 * 确认管理器
 * 用于生成和验证确认 token，防止 AI 绕过安全检查
 */

import * as crypto from 'crypto';

/**
 * 确认记录
 */
interface ConfirmationRecord {
  token: string;
  operation: string; // 操作类型（exec, remove_server, etc.）
  params: string; // 参数的哈希值，确保参数没有被修改
  createdAt: Date;
  expiresAt: Date;
}

/**
 * 确认管理器
 */
export class ConfirmationManager {
  private confirmations: Map<string, ConfirmationRecord> = new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private readonly TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 分钟有效期

  constructor() {
    // 每分钟清理过期的确认记录
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * 生成确认 token
   */
  generateToken(operation: string, params: Record<string, unknown>): {
    token: string;
    expiresAt: Date;
  } {
    // 生成随机 token
    const token = crypto.randomBytes(16).toString('hex');

    // 计算参数的哈希值（用于验证参数未被修改）
    const paramsHash = this.hashParams(params);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.TOKEN_EXPIRY_MS);

    // 存储确认记录
    this.confirmations.set(token, {
      token,
      operation,
      params: paramsHash,
      createdAt: now,
      expiresAt,
    });

    return { token, expiresAt };
  }

  /**
   * 验证确认 token
   */
  verifyToken(
    token: string,
    operation: string,
    params: Record<string, unknown>
  ): { valid: boolean; reason?: string } {
    const record = this.confirmations.get(token);

    // token 不存在
    if (!record) {
      return { valid: false, reason: '无效的确认 token' };
    }

    // 检查是否过期
    if (new Date() > record.expiresAt) {
      this.confirmations.delete(token);
      return { valid: false, reason: '确认 token 已过期（5分钟有效期）' };
    }

    // 检查操作类型是否匹配
    if (record.operation !== operation) {
      return {
        valid: false,
        reason: `token 操作类型不匹配（期望: ${record.operation}, 实际: ${operation}）`,
      };
    }

    // 检查参数是否被修改
    const paramsHash = this.hashParams(params);
    if (record.params !== paramsHash) {
      return {
        valid: false,
        reason: '参数已被修改，请重新获取确认 token',
      };
    }

    // 验证通过，删除 token（一次性使用）
    this.confirmations.delete(token);

    return { valid: true };
  }

  /**
   * 计算参数哈希值
   */
  private hashParams(params: Record<string, unknown>): string {
    // 移除 confirmationToken 和 targetConfirmationToken 字段本身
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmationToken, targetConfirmationToken, ...rest } = params;
    // 按字母顺序排序 key，确保哈希一致性
    const sorted = Object.keys(rest)
      .sort()
      .reduce((acc, key) => {
        acc[key] = rest[key];
        return acc;
      }, {} as Record<string, unknown>);

    const json = JSON.stringify(sorted);
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  /**
   * 清理过期的确认记录
   */
  private cleanup(): void {
    const now = new Date();
    for (const [token, record] of this.confirmations) {
      if (now > record.expiresAt) {
        this.confirmations.delete(token);
      }
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.confirmations.clear();
  }
}
