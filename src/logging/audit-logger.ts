/**
 * 审计日志模块
 * 负责记录所有操作的审计日志
 */

import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { LogLevel, AuditLogEntry, MCPServerConfig, DEFAULT_CONFIG } from '../types/index.js';
import { expandHome, generateId, maskSensitive } from '../utils/index.js';

/**
 * 审计日志记录器
 */
export class AuditLogger {
  private logger: pino.Logger;
  private config: MCPServerConfig;
  private logs: AuditLogEntry[] = [];
  private maxLogEntries = 1000; // 内存中最大日志条数

  constructor(config: Partial<MCPServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = this.createLogger();
  }

  /**
   * 创建 pino logger
   */
  private createLogger(): pino.Logger {
    const options: pino.LoggerOptions = {
      level: this.config.logLevel,
      // 格式化时间戳
      timestamp: pino.stdTimeFunctions.isoTime,
      // 自定义序列化器
      serializers: {
        // 脱敏敏感字段
        password: () => '***',
        privateKey: () => '[PRIVATE_KEY]',
        passphrase: () => '***',
        sudoPassword: () => '***',
      },
    };

    // 如果指定了日志文件
    if (this.config.logFile) {
      const logPath = expandHome(this.config.logFile);
      const logDir = path.dirname(logPath);

      // 确保目录存在
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      return pino(options, pino.destination(logPath));
    }

    // 默认输出到 stderr，使用 pino-pretty 格式
    return pino(options);
  }

  /**
   * 记录日志
   */
  log(
    level: LogLevel,
    operation: string,
    details?: Record<string, unknown>,
    server?: string
  ): void {
    // 脱敏处理
    const sanitizedDetails = this.sanitize(details ?? {});

    // 创建日志条目
    const entry: AuditLogEntry = {
      id: generateId(),
      timestamp: new Date(),
      level,
      operation,
      server,
      details: sanitizedDetails,
      success: level !== 'error',
      error: level === 'error' ? (sanitizedDetails.error as string) : undefined,
    };

    // 写入 pino
    this.logger[level]({ ...sanitizedDetails, operation, server });

    // 保存到内存（用于查询）
    this.logs.push(entry);

    // 限制内存中的日志数量
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }
  }

  /**
   * 查询日志
   */
  query(options: {
    limit?: number;
    server?: string;
    operation?: string;
    level?: LogLevel;
    startTime?: Date;
    endTime?: Date;
  }): AuditLogEntry[] {
    let filtered = this.logs;

    // 按服务器过滤
    if (options.server) {
      filtered = filtered.filter((log) => log.server === options.server);
    }

    // 按操作类型过滤
    if (options.operation) {
      filtered = filtered.filter((log) => log.operation === options.operation);
    }

    // 按级别过滤
    if (options.level) {
      filtered = filtered.filter((log) => log.level === options.level);
    }

    // 按时间范围过滤
    if (options.startTime) {
      filtered = filtered.filter((log) => log.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      filtered = filtered.filter((log) => log.timestamp <= options.endTime!);
    }

    // 按时间倒序
    filtered = filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // 限制数量
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * 获取最近的日志
   */
  getRecent(limit = 50): AuditLogEntry[] {
    return this.query({ limit });
  }

  /**
   * 清除日志
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * 脱敏处理
   */
  private sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'privateKey', 'passphrase', 'sudoPassword', 'key'];
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
        // 敏感字段脱敏
        if (typeof value === 'string') {
          result[key] = maskSensitive(value);
        } else {
          result[key] = '***';
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // 递归处理嵌套对象
        result[key] = this.sanitize(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
