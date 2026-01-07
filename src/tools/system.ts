/**
 * MCP 系统工具
 * 提供 health_check, get_logs 等工具
 */

import { z } from 'zod';
import { SSHManager } from '../core/ssh-manager.js';
import { AuditLogger } from '../logging/audit-logger.js';
import { AuditLogEntry, LogLevel } from '../types/index.js';

// health_check 参数 Schema
export const HealthCheckSchema = z.object({
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
});

// get_logs 参数 Schema
export const GetLogsSchema = z.object({
  limit: z.number().int().min(1).max(500).default(50),
  server: z.string().optional(),
  operation: z.string().optional(),
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
});

export type HealthCheckParams = z.infer<typeof HealthCheckSchema>;
export type GetLogsParams = z.infer<typeof GetLogsSchema>;

/**
 * 系统工具处理器
 */
export class SystemTools {
  constructor(
    private sshManager: SSHManager,
    private logger: AuditLogger
  ) {}

  /**
   * 健康检查
   */
  healthCheck(params: HealthCheckParams): {
    healthy: boolean;
    connections: unknown[];
    activeConnection?: unknown;
  } {
    const connections = this.sshManager.listConnections();

    let activeConnection;
    if (params.host && params.username) {
      // 检查指定连接
      activeConnection = connections.find(
        (c) =>
          c.host === params.host &&
          c.port === (params.port ?? 22) &&
          c.username === params.username
      );
    } else {
      // 获取当前活动连接
      const active = this.sshManager.getActiveConnection();
      if (active) {
        activeConnection = connections.find((c) => c.connected);
      }
    }

    return {
      healthy: connections.some((c) => c.connected),
      connections,
      activeConnection,
    };
  }

  /**
   * 获取日志
   */
  getLogs(params: GetLogsParams): { logs: AuditLogEntry[] } {
    const logs = this.logger.query({
      limit: params.limit,
      server: params.server,
      operation: params.operation,
      level: params.level as LogLevel,
    });
    return { logs };
  }
}
