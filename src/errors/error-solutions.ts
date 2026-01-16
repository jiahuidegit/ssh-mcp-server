/**
 * SSH 错误解决方案映射
 * 提供中英文对照的错误提示和解决方案
 */

import { SSHError, SSHErrorCode } from '../types/index.js';

/** 错误解决方案接口 */
interface ErrorSolution {
  zh: { message: string; solutions: string[] };
  en: { message: string; solutions: string[] };
}

/** 所有错误码的解决方案映射 */
export const ERROR_SOLUTIONS: Record<SSHErrorCode, ErrorSolution> = {
  [SSHErrorCode.CONNECTION_FAILED]: {
    zh: {
      message: '连接失败',
      solutions: [
        '检查主机地址是否正确',
        '检查端口是否开放（默认 22）',
        '确认网络连接正常，防火墙未阻止',
        '尝试增加连接超时：SSH_MCP_CONNECTION_TIMEOUT=60000',
      ],
    },
    en: {
      message: 'Connection failed',
      solutions: [
        'Verify the host address is correct',
        'Check if port is open (default 22)',
        'Ensure network is reachable and firewall allows connection',
        'Try increasing timeout: SSH_MCP_CONNECTION_TIMEOUT=60000',
      ],
    },
  },

  [SSHErrorCode.AUTH_FAILED]: {
    zh: {
      message: '认证失败',
      solutions: [
        '检查用户名是否正确',
        '密码认证：确认密码正确',
        '私钥认证：检查私钥文件是否正确，passphrase 是否需要',
        '确认服务器允许该认证方式',
      ],
    },
    en: {
      message: 'Authentication failed',
      solutions: [
        'Verify the username is correct',
        'Password auth: confirm password is correct',
        'Key auth: check private key file and passphrase if needed',
        'Ensure server allows this authentication method',
      ],
    },
  },

  [SSHErrorCode.COMMAND_TIMEOUT]: {
    zh: {
      message: '命令执行超时',
      solutions: [
        '使用 useLongTimeout: true 参数执行耗时命令',
        '调整超时设置：SSH_MCP_COMMAND_TIMEOUT=120000',
        '对于特别耗时的任务（如 docker build），使用 SSH_MCP_LONG_COMMAND_TIMEOUT=3600000',
        '检查远程服务器是否响应正常',
      ],
    },
    en: {
      message: 'Command execution timed out',
      solutions: [
        'Use useLongTimeout: true parameter for time-consuming commands',
        'Adjust timeout: SSH_MCP_COMMAND_TIMEOUT=120000',
        'For very long tasks (e.g., docker build), use SSH_MCP_LONG_COMMAND_TIMEOUT=3600000',
        'Check if remote server is responding normally',
      ],
    },
  },

  [SSHErrorCode.SFTP_ERROR]: {
    zh: {
      message: 'SFTP 操作失败',
      solutions: [
        '检查文件路径是否正确',
        '确认目标目录存在且有写入权限',
        '检查磁盘空间是否充足',
        '使用 overwrite: true 覆盖已存在的文件',
      ],
    },
    en: {
      message: 'SFTP operation failed',
      solutions: [
        'Verify file path is correct',
        'Ensure target directory exists and has write permission',
        'Check if disk space is sufficient',
        'Use overwrite: true to overwrite existing files',
      ],
    },
  },

  [SSHErrorCode.PERMISSION_DENIED]: {
    zh: {
      message: '权限不足',
      solutions: [
        '检查当前用户是否有执行权限',
        '使用 exec_sudo 工具以 root 权限执行',
        '确认文件/目录的权限设置',
        '联系服务器管理员获取权限',
      ],
    },
    en: {
      message: 'Permission denied',
      solutions: [
        'Check if current user has execution permission',
        'Use exec_sudo tool to run with root privileges',
        'Verify file/directory permission settings',
        'Contact server admin for permission',
      ],
    },
  },

  [SSHErrorCode.NOT_CONNECTED]: {
    zh: {
      message: '没有可用的 SSH 连接',
      solutions: [
        '请先使用 connect 工具建立连接',
        '连接可能因空闲超时断开，可设置 SSH_MCP_IDLE_TIMEOUT 延长',
        '启用自动重连：SSH_MCP_AUTO_RECONNECT=true',
        '使用 health_check 工具检查连接状态',
      ],
    },
    en: {
      message: 'No available SSH connection',
      solutions: [
        'Please establish connection using connect tool first',
        'Connection may have timed out, set SSH_MCP_IDLE_TIMEOUT to extend',
        'Enable auto-reconnect: SSH_MCP_AUTO_RECONNECT=true',
        'Use health_check tool to verify connection status',
      ],
    },
  },

  [SSHErrorCode.CONFIG_ERROR]: {
    zh: {
      message: '配置错误',
      solutions: [
        '检查服务器别名是否正确',
        '确认参数格式正确（如端口号为数字）',
        '使用 list_servers 查看已保存的服务器',
        '重新保存服务器配置：save_server',
      ],
    },
    en: {
      message: 'Configuration error',
      solutions: [
        'Check if server alias is correct',
        'Ensure parameter format is valid (e.g., port is a number)',
        'Use list_servers to view saved servers',
        'Re-save server configuration: save_server',
      ],
    },
  },

  [SSHErrorCode.CREDENTIAL_ERROR]: {
    zh: {
      message: '凭证错误',
      solutions: [
        '检查凭证是否已正确保存',
        '尝试重新保存服务器配置',
        '确认系统 Keychain/凭证管理器可用',
        '检查数据目录权限：~/.ssh-mcp',
      ],
    },
    en: {
      message: 'Credential error',
      solutions: [
        'Check if credentials are properly saved',
        'Try re-saving server configuration',
        'Ensure system Keychain/Credential Manager is available',
        'Check data directory permissions: ~/.ssh-mcp',
      ],
    },
  },
};

/**
 * 格式化错误信息（带解决方案）
 * @param error SSH 错误对象或普通错误
 * @returns 格式化后的错误信息
 */
export function formatErrorWithSolution(error: unknown): string {
  // 处理 SSHError
  if (error instanceof SSHError) {
    const solution = ERROR_SOLUTIONS[error.code];
    if (!solution) {
      return `[${error.code}] ${error.message}`;
    }

    // 构建中英文解决方案
    const zhSolutions = solution.zh.solutions
      .map((s, i) => `  ${i + 1}. ${s}`)
      .join('\n');
    const enSolutions = solution.en.solutions
      .map((s, i) => `  ${i + 1}. ${s}`)
      .join('\n');

    return `[${error.code}] ${error.message}

💡 解决方案 / Solutions:
中文:
${zhSolutions}

English:
${enSolutions}`;
  }

  // 处理普通 Error
  if (error instanceof Error) {
    return error.message;
  }

  // 其他情况
  return String(error);
}
