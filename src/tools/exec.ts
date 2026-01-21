/**
 * MCP 命令执行工具
 * 提供 exec, exec_sudo, exec_batch 等工具
 */

import { z } from 'zod';
import { CommandExecutor } from '../core/command-executor.js';
import { SSHManager } from '../core/ssh-manager.js';
import { ExecResult, BatchExecResult } from '../types/index.js';

// 危险命令模式列表
const DANGEROUS_PATTERNS = [
  // 删除根目录或系统目录
  { pattern: /rm\s+(-[rf]+\s+)*[/]\s*$/, desc: '删除根目录' },
  { pattern: /rm\s+(-[rf]+\s+)*\/\*/, desc: '删除根目录下所有文件' },
  { pattern: /rm\s+(-[rf]+\s+)*\/(etc|usr|var|bin|sbin|boot|lib|lib64|proc|sys|dev|root|home)\b/, desc: '删除系统关键目录' },
  // 格式化磁盘
  { pattern: /mkfs\s/, desc: '格式化磁盘' },
  { pattern: /dd\s+.*of=\/dev\/[sh]d[a-z]/, desc: '覆写磁盘' },
  // 危险的 chmod/chown
  { pattern: /chmod\s+(-R\s+)*777\s+\//, desc: '递归修改根目录权限' },
  { pattern: /chown\s+(-R\s+)*.*\s+\/\s*$/, desc: '递归修改根目录所有者' },
  // 清空文件
  { pattern: />\s*\/etc\/passwd/, desc: '清空密码文件' },
  { pattern: />\s*\/etc\/shadow/, desc: '清空影子密码文件' },
  // Fork 炸弹
  { pattern: /:\(\)\s*\{\s*:\|:&\s*\};\s*:/, desc: 'Fork 炸弹' },
  // 危险的 wget/curl 执行
  { pattern: /(wget|curl).*\|\s*(ba)?sh/, desc: '从网络下载并执行脚本' },
  // 关机/重启
  { pattern: /\b(shutdown|reboot|init\s+[06]|poweroff)\b/, desc: '关机或重启系统' },
  // 杀死所有进程
  { pattern: /kill\s+-9\s+-1/, desc: '杀死所有进程' },
  { pattern: /killall\s+-9/, desc: '批量杀死进程' },
];

/**
 * 检测命令是否危险
 * @returns 危险描述，如果安全则返回 null
 */
function detectDangerousCommand(command: string): string | null {
  const normalizedCmd = command.toLowerCase().replace(/\s+/g, ' ').trim();

  for (const { pattern, desc } of DANGEROUS_PATTERNS) {
    if (pattern.test(normalizedCmd) || pattern.test(command)) {
      return desc;
    }
  }
  return null;
}

// exec 参数 Schema
export const ExecSchema = z.object({
  command: z.string().min(1, '命令不能为空'),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  timeout: z.number().int().min(1000).optional(),
  useLongTimeout: z.boolean().optional(), // 使用长超时（30分钟，适用于 docker build 等耗时操作）
  cwd: z.string().optional(),
  // 确认参数：危险命令需要用户确认后设置为 true
  confirmed: z.boolean().optional(),
});

// exec_sudo 参数 Schema
export const ExecSudoSchema = z.object({
  command: z.string().min(1, '命令不能为空'),
  sudoPassword: z.string().min(1, 'sudo 密码不能为空'),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  timeout: z.number().int().min(1000).optional(),
  // 确认参数：危险命令需要用户确认后设置为 true
  confirmed: z.boolean().optional(),
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
  // 确认参数：危险命令需要用户确认后设置为 true
  confirmed: z.boolean().optional(),
});

export type ExecParams = z.infer<typeof ExecSchema>;
export type ExecSudoParams = z.infer<typeof ExecSudoSchema>;
export type ExecBatchParams = z.infer<typeof ExecBatchSchema>;

// exec_shell 参数 Schema（用于不支持 exec 的堡垒机）
export const ExecShellSchema = z.object({
  command: z.string().min(1, '命令不能为空'),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  timeout: z.number().int().min(1000).optional(),
  // 自定义提示符正则（可选，默认匹配 $ 或 #）
  promptPattern: z.string().optional(),
  // 确认参数：危险命令需要用户确认后设置为 true
  confirmed: z.boolean().optional(),
});

export type ExecShellParams = z.infer<typeof ExecShellSchema>;

// shell_send 参数 Schema（持久化 shell 交互）
export const ShellSendSchema = z.object({
  input: z.string().min(1, '输入不能为空'),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  timeout: z.number().int().min(1000).default(10000),
  waitForPrompt: z.boolean().default(true), // 是否等待提示符
  clearBuffer: z.boolean().default(false), // 是否先清空缓冲区
});

// shell_read 参数 Schema
export const ShellReadSchema = z.object({
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  clear: z.boolean().default(false), // 是否清空缓冲区
});

// shell_close 参数 Schema
export const ShellCloseSchema = z.object({
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
});

export type ShellSendParams = z.infer<typeof ShellSendSchema>;
export type ShellReadParams = z.infer<typeof ShellReadSchema>;
export type ShellCloseParams = z.infer<typeof ShellCloseSchema>;

/**
 * 命令执行工具处理器
 */
export class ExecTools {
  constructor(
    private executor: CommandExecutor,
    private sshManager?: SSHManager
  ) {}

  /**
   * 执行命令
   */
  async exec(params: ExecParams): Promise<ExecResult | { warning: string; requireConfirmation: true }> {
    // 危险命令检测
    const danger = detectDangerousCommand(params.command);
    if (danger && !params.confirmed) {
      return {
        warning: `⚠️ 检测到危险命令: ${danger}\n命令: ${params.command}\n\n此命令可能对服务器造成不可恢复的损害！如果确定要执行，请用户确认后重新调用并设置 confirmed: true`,
        requireConfirmation: true,
      };
    }

    try {
      return await this.executor.exec(
        params.command,
        params.host,
        params.port,
        params.username,
        {
          timeout: params.timeout,
          useLongTimeout: params.useLongTimeout,
          cwd: params.cwd,
        }
      );
    } catch (error) {
      // 增强错误提示
      if (error instanceof Error) {
        const message = error.message;

        // 超时错误提示
        if (message.includes('超时') && !params.useLongTimeout) {
          throw new Error(
            `${message}\n\n💡 建议：如果是 docker build、npm install 等耗时命令，请使用 useLongTimeout: true 选项（默认30分钟超时）。`
          );
        }

        // 连接断开错误提示
        if (message.includes('没有可用的 SSH 连接')) {
          throw new Error(
            `${message}\n\n💡 建议：\n1. 使用 ssh_connect 工具重新建立连接\n2. 如果启用了自动重连（默认开启），系统会尝试自动恢复连接`
          );
        }
      }
      throw error;
    }
  }

  /**
   * 执行 sudo 命令
   */
  async execSudo(params: ExecSudoParams): Promise<ExecResult | { warning: string; requireConfirmation: true }> {
    // sudo 命令更危险，进行检测
    const danger = detectDangerousCommand(params.command);
    if (danger && !params.confirmed) {
      return {
        warning: `⚠️ 检测到危险的 sudo 命令: ${danger}\n命令: sudo ${params.command}\n\n此命令以 root 权限执行，可能对服务器造成不可恢复的损害！如果确定要执行，请用户确认后重新调用并设置 confirmed: true`,
        requireConfirmation: true,
      };
    }

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
  async execBatch(params: ExecBatchParams): Promise<{ results: BatchExecResult[] } | { warning: string; requireConfirmation: true }> {
    // 批量执行更危险，进行检测
    const danger = detectDangerousCommand(params.command);
    if (danger && !params.confirmed) {
      return {
        warning: `⚠️ 检测到危险的批量命令: ${danger}\n命令: ${params.command}\n目标服务器: ${params.servers.length} 台\n\n此命令将在多台服务器上执行，可能造成大规模损害！如果确定要执行，请用户确认后重新调用并设置 confirmed: true`,
        requireConfirmation: true,
      };
    }

    const results = await this.executor.execBatch(
      params.command,
      params.servers,
      { timeout: params.timeout }
    );
    return { results };
  }

  /**
   * 通过 shell 模式执行命令（用于不支持 exec 的堡垒机）
   */
  async execShell(params: ExecShellParams): Promise<ExecResult | { warning: string; requireConfirmation: true }> {
    // 危险命令检测
    const danger = detectDangerousCommand(params.command);
    if (danger && !params.confirmed) {
      return {
        warning: `⚠️ 检测到危险命令: ${danger}\n命令: ${params.command}\n\n此命令可能对服务器造成不可恢复的损害！如果确定要执行，请用户确认后重新调用并设置 confirmed: true`,
        requireConfirmation: true,
      };
    }

    return this.executor.execShell(
      params.command,
      params.host,
      params.port,
      params.username,
      {
        timeout: params.timeout,
        promptPattern: params.promptPattern,
      }
    );
  }

  /**
   * 发送输入到持久化 shell（用于多轮交互，如堡垒机穿透）
   */
  async shellSend(params: ShellSendParams): Promise<{ output: string; promptDetected: boolean }> {
    if (!this.sshManager) {
      throw new Error('SSHManager 未初始化');
    }

    return this.sshManager.shellSend(
      params.input,
      params.host,
      params.port,
      params.username,
      {
        waitForPrompt: params.waitForPrompt,
        timeout: params.timeout,
        clearBuffer: params.clearBuffer,
      }
    );
  }

  /**
   * 读取 shell 缓冲区
   */
  async shellRead(params: ShellReadParams): Promise<{ buffer: string }> {
    if (!this.sshManager) {
      throw new Error('SSHManager 未初始化');
    }

    const buffer = await this.sshManager.shellRead(
      params.host,
      params.port,
      params.username,
      { clear: params.clear }
    );
    return { buffer };
  }

  /**
   * 关闭持久化 shell 会话
   */
  async shellClose(params: ShellCloseParams): Promise<{ success: true; message: string }> {
    if (!this.sshManager) {
      throw new Error('SSHManager 未初始化');
    }

    await this.sshManager.closeShell(params.host, params.port, params.username);
    return { success: true, message: '已关闭 shell 会话' };
  }
}
