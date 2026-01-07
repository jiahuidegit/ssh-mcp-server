/**
 * 工具函数
 */

import * as os from 'os';
import * as path from 'path';

/**
 * 展开路径中的 ~ 为用户主目录
 */
export function expandHome(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 生成连接池 key
 */
export function getConnectionKey(host: string, port: number, username: string): string {
  return `${username}@${host}:${port}`;
}

/**
 * 脱敏处理敏感信息
 */
export function maskSensitive(value: string, visibleChars = 3): string {
  if (value.length <= visibleChars * 2) {
    return '***';
  }
  return `${value.slice(0, visibleChars)}***${value.slice(-visibleChars)}`;
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带超时的 Promise
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * 安全的 JSON 序列化（处理循环引用）
 */
export function safeStringify(obj: unknown, space?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    },
    space
  );
}

/**
 * 解析环境变量中的配置
 */
export function getEnvConfig<T>(key: string, defaultValue: T): T {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }

  // 根据默认值类型进行转换
  if (typeof defaultValue === 'number') {
    const num = parseInt(value, 10);
    return (isNaN(num) ? defaultValue : num) as T;
  }
  if (typeof defaultValue === 'boolean') {
    return (value.toLowerCase() === 'true') as T;
  }
  return value as T;
}
