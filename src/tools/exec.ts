/**
 * MCP 命令执行工具
 * 提供 exec, exec_sudo, exec_batch 等工具
 */

import { z } from 'zod';
import { CommandExecutor } from '../core/command-executor.js';
import { SSHManager } from '../core/ssh-manager.js';
import { ExecResult, BatchExecResult } from '../types/index.js';
import { ConfirmationManager } from '../utils/confirmation-manager.js';

// 危险命令模式列表
const DANGEROUS_PATTERNS = [
  // ========== 系统文件操作 ==========
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
  { pattern: /\b(shutdown|reboot|init\s+[06]|poweroff|halt)\b/, desc: '关机或重启系统' },
  // 杀死所有进程
  { pattern: /kill\s+-9\s+-1/, desc: '杀死所有进程' },
  { pattern: /killall\s+-9/, desc: '批量杀死进程' },

  // ========== Docker/容器操作 ==========
  // 删除所有容器
  { pattern: /docker\s+rm.*\$\(docker\s+ps/, desc: '批量删除 Docker 容器' },
  { pattern: /docker\s+rm.*-f.*-a/, desc: '强制删除所有 Docker 容器' },
  // 删除所有镜像
  { pattern: /docker\s+rmi.*\$\(docker\s+images/, desc: '批量删除 Docker 镜像' },
  { pattern: /docker\s+rmi.*-f/, desc: '强制删除 Docker 镜像' },
  // 清理系统
  { pattern: /docker\s+system\s+prune.*-a/, desc: '清理所有 Docker 资源' },
  { pattern: /docker\s+volume\s+rm.*\$\(docker\s+volume\s+ls/, desc: '批量删除 Docker 卷' },
  // docker-compose
  { pattern: /docker-compose\s+down.*-v/, desc: '删除 Docker Compose 容器和卷' },
  { pattern: /docker-compose\s+rm.*-f/, desc: '强制删除 Docker Compose 容器' },
  // 停止所有容器
  { pattern: /docker\s+stop.*\$\(docker\s+ps/, desc: '批量停止 Docker 容器' },
  { pattern: /docker\s+kill.*\$\(docker\s+ps/, desc: '批量杀死 Docker 容器' },

  // ========== Kubernetes 操作 ==========
  { pattern: /kubectl\s+delete\s+(namespace|ns)/, desc: '删除 Kubernetes 命名空间' },
  { pattern: /kubectl\s+delete.*--all/, desc: '批量删除 Kubernetes 资源' },
  { pattern: /kubectl\s+delete\s+(deployment|deploy|service|svc|pod).*production/, desc: '删除 Kubernetes 生产资源' },
  { pattern: /kubectl\s+drain/, desc: '排空 Kubernetes 节点' },
  { pattern: /kubectl\s+cordon/, desc: '标记 Kubernetes 节点不可调度' },

  // ========== 数据库操作 ==========
  // MySQL/MariaDB
  { pattern: /mysql.*DROP\s+DATABASE/i, desc: '删除 MySQL 数据库' },
  { pattern: /mysql.*TRUNCATE\s+TABLE/i, desc: '清空 MySQL 表' },
  { pattern: /mysql.*DELETE\s+FROM.*WHERE\s*$/i, desc: '无条件删除 MySQL 数据' },
  // PostgreSQL
  { pattern: /psql.*DROP\s+DATABASE/i, desc: '删除 PostgreSQL 数据库' },
  { pattern: /psql.*TRUNCATE\s+TABLE/i, desc: '清空 PostgreSQL 表' },
  // MongoDB
  { pattern: /mongo.*dropDatabase/i, desc: '删除 MongoDB 数据库' },
  { pattern: /mongo.*drop\(\)/i, desc: '删除 MongoDB 集合' },
  // Redis
  { pattern: /redis-cli.*FLUSHALL/i, desc: '清空所有 Redis 数据' },
  { pattern: /redis-cli.*FLUSHDB/i, desc: '清空 Redis 当前数据库' },

  // ========== 服务管理 ==========
  // systemctl
  { pattern: /systemctl\s+(stop|disable|mask)/, desc: '停止或禁用系统服务' },
  { pattern: /systemctl\s+kill/, desc: '杀死系统服务进程' },
  // service
  { pattern: /service\s+\w+\s+stop/, desc: '停止服务' },
  // PM2
  { pattern: /pm2\s+delete\s+all/, desc: '删除所有 PM2 进程' },
  { pattern: /pm2\s+(stop|kill)\s+all/, desc: '停止所有 PM2 进程' },
  // Supervisor
  { pattern: /supervisorctl\s+stop\s+all/, desc: '停止所有 Supervisor 进程' },
  { pattern: /supervisorctl\s+shutdown/, desc: '关闭 Supervisor' },

  // ========== 包管理器 ==========
  // npm
  { pattern: /npm\s+uninstall.*-g/, desc: '卸载全局 npm 包' },
  // pip
  { pattern: /pip\s+uninstall.*-y.*\$\(pip\s+freeze\)/, desc: '批量卸载 Python 包' },
  // apt/yum
  { pattern: /(apt-get|apt|yum)\s+(remove|purge|autoremove)/, desc: '卸载系统软件包' },

  // ========== Git 操作 ==========
  { pattern: /git\s+push.*--force/, desc: 'Git 强制推送' },
  { pattern: /git\s+reset.*--hard/, desc: 'Git 硬重置' },
  { pattern: /git\s+clean\s+-.*f/, desc: 'Git 强制清理文件' },
  { pattern: /git\s+branch\s+-D/, desc: 'Git 强制删除分支' },

  // ========== 网络操作 ==========
  { pattern: /iptables\s+-F/, desc: '清空防火墙规则' },
  { pattern: /ip\s+link\s+set.*down/, desc: '关闭网络接口' },
  { pattern: /ufw\s+(disable|reset)/, desc: '禁用或重置防火墙' },
  { pattern: /firewall-cmd.*--remove/, desc: '删除防火墙规则' },

  // ========== 其他危险操作 ==========
  // 修改系统时间
  { pattern: /timedatectl\s+set/, desc: '修改系统时间' },
  // 清空日志
  { pattern: />\s*\/var\/log/, desc: '清空系统日志' },
  // 修改 hosts
  { pattern: />\s*\/etc\/hosts/, desc: '覆写 hosts 文件' },
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
  // 确认 token：危险命令需要先获取 token，然后用 token 确认执行
  confirmationToken: z.string().optional(),
});

// exec_sudo 参数 Schema
export const ExecSudoSchema = z.object({
  command: z.string().min(1, '命令不能为空'),
  sudoPassword: z.string().min(1, 'sudo 密码不能为空'),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  timeout: z.number().int().min(1000).optional(),
  // 确认 token
  confirmationToken: z.string().optional(),
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
  // 确认 token
  confirmationToken: z.string().optional(),
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
  // 确认 token
  confirmationToken: z.string().optional(),
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
  // 确认 token：危险输入需要先获取 token
  confirmationToken: z.string().optional(),
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
    private sshManager?: SSHManager,
    private confirmationManager?: ConfirmationManager
  ) {}

  /**
   * 辅助方法：处理危险命令的确认逻辑
   */
  private handleDangerousCommand(
    danger: string | null,
    operation: string,
    params: Record<string, unknown>,
    warning: string
  ): { confirmationRequired: true; confirmationToken: string; expiresAt: Date; warning: string } | null {
    if (!danger) {
      return null;
    }

    // 如果有 confirmationToken，验证
    const token = (params as { confirmationToken?: string }).confirmationToken;
    if (token) {
      if (!this.confirmationManager) {
        throw new Error('确认管理器未初始化');
      }

      const verification = this.confirmationManager.verifyToken(token, operation, params);

      if (!verification.valid) {
        throw new Error(`确认验证失败: ${verification.reason}`);
      }
      // 验证通过，返回 null 表示可以继续执行
      return null;
    }

    // 没有 token，生成新 token 并返回警告
    if (!this.confirmationManager) {
      throw new Error('确认管理器未初始化');
    }

    const { token: newToken, expiresAt } = this.confirmationManager.generateToken(operation, params);

    return {
      confirmationRequired: true,
      confirmationToken: newToken,
      expiresAt,
      warning: `${warning}\n\n如果用户确认执行，请使用返回的 confirmationToken 重新调用：\n{\n  ...原参数,\n  confirmationToken: "${newToken}"\n}\n\ntoken 有效期: 5 分钟`,
    };
  }

  /**
   * 执行命令
   */
  async exec(params: ExecParams): Promise<ExecResult | { confirmationRequired: true; confirmationToken: string; expiresAt: Date; warning: string }> {
    // 获取服务器环境信息
    const serverIdentity = this.sshManager?.getServerIdentity(params.host, params.port, params.username);
    const environment = serverIdentity?.environment;
    const isProduction = environment === 'production';

    // 危险命令检测
    const danger = detectDangerousCommand(params.command);
    if (danger) {
      // 生产环境额外警告
      const envWarning = isProduction
        ? `\n\n🚨 警告：这是【生产环境】服务器！\n服务器: ${serverIdentity?.alias || `${params.host}:${params.port ?? 22}`}\n环境: PRODUCTION\n`
        : environment
        ? `\n\n环境: ${environment.toUpperCase()}\n`
        : '';

      const confirmation = this.handleDangerousCommand(
        danger,
        'exec',
        params,
        `⚠️ 检测到危险命令: ${danger}${envWarning}命令: ${params.command}\n\n此命令可能对服务器造成不可恢复的损害！`
      );

      if (confirmation) {
        return confirmation;
      }
    }

    try {
      const result = await this.executor.exec(
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

      // 在返回结果中突出显示环境信息
      if (isProduction) {
        result.stdout = `[执行环境: 🔴 PRODUCTION]\n${result.stdout}`;
      } else if (environment) {
        result.stdout = `[执行环境: ${environment.toUpperCase()}]\n${result.stdout}`;
      }

      return result;
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
  async execSudo(params: ExecSudoParams): Promise<ExecResult | { confirmationRequired: true; confirmationToken: string; expiresAt: Date; warning: string }> {
    // 获取服务器环境信息
    const serverIdentity = this.sshManager?.getServerIdentity(params.host, params.port, params.username);
    const environment = serverIdentity?.environment;
    const isProduction = environment === 'production';

    // sudo 命令更危险，进行检测
    const danger = detectDangerousCommand(params.command);
    if (danger) {
      // 生产环境额外警告
      const envWarning = isProduction
        ? `\n\n🚨 警告：这是【生产环境】服务器！\n服务器: ${serverIdentity?.alias || `${params.host}:${params.port ?? 22}`}\n环境: PRODUCTION\n`
        : environment
        ? `\n\n环境: ${environment.toUpperCase()}\n`
        : '';

      const confirmation = this.handleDangerousCommand(
        danger,
        'exec_sudo',
        params,
        `⚠️ 检测到危险的 sudo 命令: ${danger}${envWarning}命令: sudo ${params.command}\n\n此命令以 root 权限执行，可能对服务器造成不可恢复的损害！`
      );

      if (confirmation) {
        return confirmation;
      }
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
  async execBatch(params: ExecBatchParams): Promise<{ results: BatchExecResult[] } | { confirmationRequired: true; confirmationToken: string; expiresAt: Date; warning: string }> {
    // 批量执行更危险，进行检测
    const danger = detectDangerousCommand(params.command);
    if (danger) {
      // 检查是否有生产环境服务器
      let hasProduction = false;
      for (const server of params.servers) {
        const identity = this.sshManager?.getServerIdentity(server.host, server.port, server.username);
        if (identity?.environment === 'production') {
          hasProduction = true;
          break;
        }
      }

      const envWarning = hasProduction
        ? `\n\n🚨 警告：目标服务器中包含【生产环境】！\n`
        : '';

      const confirmation = this.handleDangerousCommand(
        danger,
        'exec_batch',
        params,
        `⚠️ 检测到危险的批量命令: ${danger}${envWarning}命令: ${params.command}\n目标服务器: ${params.servers.length} 台\n\n此命令将在多台服务器上执行，可能造成大规模损害！`
      );

      if (confirmation) {
        return confirmation;
      }
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
  async execShell(params: ExecShellParams): Promise<ExecResult | { confirmationRequired: true; confirmationToken: string; expiresAt: Date; warning: string }> {
    // 获取服务器环境信息
    const serverIdentity = this.sshManager?.getServerIdentity(params.host, params.port, params.username);
    const environment = serverIdentity?.environment;
    const isProduction = environment === 'production';

    // 危险命令检测
    const danger = detectDangerousCommand(params.command);
    if (danger) {
      // 生产环境额外警告
      const envWarning = isProduction
        ? `\n\n🚨 警告：这是【生产环境】服务器！\n服务器: ${serverIdentity?.alias || `${params.host}:${params.port ?? 22}`}\n环境: PRODUCTION\n`
        : environment
        ? `\n\n环境: ${environment.toUpperCase()}\n`
        : '';

      const confirmation = this.handleDangerousCommand(
        danger,
        'exec_shell',
        params,
        `⚠️ 检测到危险命令: ${danger}${envWarning}命令: ${params.command}\n\n此命令可能对服务器造成不可恢复的损害！`
      );

      if (confirmation) {
        return confirmation;
      }
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
  async shellSend(params: ShellSendParams): Promise<{ output: string; promptDetected: boolean } | { confirmationRequired: true; confirmationToken: string; expiresAt: Date; warning: string }> {
    if (!this.sshManager) {
      throw new Error('SSHManager 未初始化');
    }

    // 危险命令检测（防止通过 shell_send 绕过 exec 的保护）
    const danger = detectDangerousCommand(params.input);
    if (danger) {
      const serverIdentity = this.sshManager.getServerIdentity(params.host, params.port, params.username);
      const environment = serverIdentity?.environment;
      const isProduction = environment === 'production';

      const envWarning = isProduction
        ? `\n\n🚨 警告：这是【生产环境】服务器！\n服务器: ${serverIdentity?.alias || `${params.host}:${params.port ?? 22}`}\n环境: PRODUCTION\n`
        : environment
        ? `\n\n环境: ${environment.toUpperCase()}\n`
        : '';

      const confirmation = this.handleDangerousCommand(
        danger,
        'shell_send',
        params,
        `⚠️ 检测到危险输入: ${danger}${envWarning}输入: ${params.input}\n\n此输入可能对服务器造成不可恢复的损害！`
      );

      if (confirmation) {
        return confirmation;
      }
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
