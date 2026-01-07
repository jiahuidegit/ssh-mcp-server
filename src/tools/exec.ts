/**
 * MCP 命令执行工具
 * 提供 exec, exec_sudo, exec_batch 等工具
 */

import { z } from 'zod';
import { CommandExecutor } from '../core/command-executor.js';
import { ExecResult, BatchExecResult } from '../types/index.js';

// exec 参数 Schema
export const ExecSchema = z.object({
  command: z.string().min(1, '命令不能为空'),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  timeout: z.number().int().min(1000).optional(),
  cwd: z.string().optional(),
});

// exec_sudo 参数 Schema
export const ExecSudoSchema = z.object({
  command: z.string().min(1, '命令不能为空'),
  sudoPassword: z.string().min(1, 'sudo 密码不能为空'),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  timeout: z.number().int().min(1000).optional(),
});

// exec_batch 参数 Schema
export const ExecBatchSchema = z.object({
  command: z.string().min(1, '命令不能为空'),
  servers: z.array(
    z.object({
      host: z.string(),
      port: z.number().int().min(1).max(65535).optional(),
      username: z.string(),
    })
  ).min(1, '至少需要一台服务器'),
  timeout: z.number().int().min(1000).optional(),
});

export type ExecParams = z.infer<typeof ExecSchema>;
export type ExecSudoParams = z.infer<typeof ExecSudoSchema>;
export type ExecBatchParams = z.infer<typeof ExecBatchSchema>;

/**
 * 命令执行工具处理器
 */
export class ExecTools {
  constructor(private executor: CommandExecutor) {}

  /**
   * 执行命令
   */
  async exec(params: ExecParams): Promise<ExecResult> {
    return this.executor.exec(
      params.command,
      params.host,
      params.port,
      params.username,
      {
        timeout: params.timeout,
        cwd: params.cwd,
      }
    );
  }

  /**
   * 执行 sudo 命令
   */
  async execSudo(params: ExecSudoParams): Promise<ExecResult> {
    return this.executor.execSudo(
      params.command,
      params.sudoPassword,
      params.host,
      params.port,
      params.username,
      { timeout: params.timeout }
    );
  }

  /**
   * 批量执行命令
   */
  async execBatch(params: ExecBatchParams): Promise<{ results: BatchExecResult[] }> {
    const results = await this.executor.execBatch(
      params.command,
      params.servers,
      { timeout: params.timeout }
    );
    return { results };
  }
}
