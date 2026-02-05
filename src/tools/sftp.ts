/**
 * MCP SFTP 工具
 * 提供 sftp_ls, sftp_upload, sftp_download, sftp_mkdir, sftp_rm 等工具
 */

import { z } from 'zod';
import { SFTPOperator } from '../core/sftp-operator.js';
import { SSHManager } from '../core/ssh-manager.js';
import { FileInfo, ServerIdentity } from '../types/index.js';
import { TargetGuard, TargetSwitchResponse } from '../utils/target-guard.js';
import { getConnectionKey } from '../utils/index.js';

// sftp_ls 参数 Schema
export const SftpLsSchema = z.object({
  path: z.string().min(1, '路径不能为空'),
  alias: z.string().optional(),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  targetConfirmationToken: z.string().optional(),
});

// sftp_upload 参数 Schema
export const SftpUploadSchema = z.object({
  localPath: z.string().min(1, '本地路径不能为空'),
  remotePath: z.string().min(1, '远程路径不能为空'),
  alias: z.string().optional(),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  overwrite: z.boolean().default(false),
  targetConfirmationToken: z.string().optional(),
});

// sftp_download 参数 Schema
export const SftpDownloadSchema = z.object({
  remotePath: z.string().min(1, '远程路径不能为空'),
  localPath: z.string().min(1, '本地路径不能为空'),
  alias: z.string().optional(),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  overwrite: z.boolean().default(false),
  targetConfirmationToken: z.string().optional(),
});

// sftp_mkdir 参数 Schema
export const SftpMkdirSchema = z.object({
  path: z.string().min(1, '路径不能为空'),
  alias: z.string().optional(),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  recursive: z.boolean().default(false),
  targetConfirmationToken: z.string().optional(),
});

// sftp_rm 参数 Schema
export const SftpRmSchema = z.object({
  path: z.string().min(1, '路径不能为空'),
  alias: z.string().optional(),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  recursive: z.boolean().default(false),
  targetConfirmationToken: z.string().optional(),
});

export type SftpLsParams = z.infer<typeof SftpLsSchema>;
export type SftpUploadParams = z.infer<typeof SftpUploadSchema>;
export type SftpDownloadParams = z.infer<typeof SftpDownloadSchema>;
export type SftpMkdirParams = z.infer<typeof SftpMkdirSchema>;
export type SftpRmParams = z.infer<typeof SftpRmSchema>;

/**
 * SFTP 工具处理器
 */
export class SftpTools {
  constructor(
    private sftpOperator: SFTPOperator,
    private sshManager?: SSHManager,
    private targetGuard?: TargetGuard
  ) {}

  /**
   * 列出目录内容
   */
  async ls(params: SftpLsParams): Promise<{ files: FileInfo[]; server?: ServerIdentity } | TargetSwitchResponse> {
    // 目标校验
    if (this.targetGuard) {
      const { resolved, confirmationResponse } = this.targetGuard.validateTarget('sftp_ls', params);
      if (confirmationResponse) {
        return confirmationResponse;
      }
      if (resolved.host) {
        params = { ...params, host: resolved.host, port: resolved.port, username: resolved.username };
      }
    }

    const files = await this.sftpOperator.ls(
      params.path,
      params.host,
      params.port,
      params.username
    );

    // 记录操作目标并获取 server 信息
    const server = this.recordAndGetIdentity(params);

    return { files, server };
  }

  /**
   * 上传文件
   */
  async upload(params: SftpUploadParams): Promise<{ success: boolean; message: string; server?: ServerIdentity } | TargetSwitchResponse> {
    // 目标校验
    if (this.targetGuard) {
      const { resolved, confirmationResponse } = this.targetGuard.validateTarget('sftp_upload', params);
      if (confirmationResponse) {
        return confirmationResponse;
      }
      if (resolved.host) {
        params = { ...params, host: resolved.host, port: resolved.port, username: resolved.username };
      }
    }

    await this.sftpOperator.upload(
      params.localPath,
      params.remotePath,
      params.host,
      params.port,
      params.username,
      { overwrite: params.overwrite }
    );

    const server = this.recordAndGetIdentity(params);

    return {
      success: true,
      message: `已上传 ${params.localPath} -> ${params.remotePath}`,
      server,
    };
  }

  /**
   * 下载文件
   */
  async download(params: SftpDownloadParams): Promise<{ success: boolean; message: string; server?: ServerIdentity } | TargetSwitchResponse> {
    // 目标校验
    if (this.targetGuard) {
      const { resolved, confirmationResponse } = this.targetGuard.validateTarget('sftp_download', params);
      if (confirmationResponse) {
        return confirmationResponse;
      }
      if (resolved.host) {
        params = { ...params, host: resolved.host, port: resolved.port, username: resolved.username };
      }
    }

    await this.sftpOperator.download(
      params.remotePath,
      params.localPath,
      params.host,
      params.port,
      params.username,
      { overwrite: params.overwrite }
    );

    const server = this.recordAndGetIdentity(params);

    return {
      success: true,
      message: `已下载 ${params.remotePath} -> ${params.localPath}`,
      server,
    };
  }

  /**
   * 创建目录
   */
  async mkdir(params: SftpMkdirParams): Promise<{ success: boolean; message: string; server?: ServerIdentity } | TargetSwitchResponse> {
    // 目标校验
    if (this.targetGuard) {
      const { resolved, confirmationResponse } = this.targetGuard.validateTarget('sftp_mkdir', params);
      if (confirmationResponse) {
        return confirmationResponse;
      }
      if (resolved.host) {
        params = { ...params, host: resolved.host, port: resolved.port, username: resolved.username };
      }
    }

    await this.sftpOperator.mkdir(
      params.path,
      params.host,
      params.port,
      params.username,
      { recursive: params.recursive }
    );

    const server = this.recordAndGetIdentity(params);

    return {
      success: true,
      message: `已创建目录 ${params.path}`,
      server,
    };
  }

  /**
   * 删除文件或目录
   */
  async rm(params: SftpRmParams): Promise<{ success: boolean; message: string; server?: ServerIdentity } | TargetSwitchResponse> {
    // 目标校验
    if (this.targetGuard) {
      const { resolved, confirmationResponse } = this.targetGuard.validateTarget('sftp_rm', params);
      if (confirmationResponse) {
        return confirmationResponse;
      }
      if (resolved.host) {
        params = { ...params, host: resolved.host, port: resolved.port, username: resolved.username };
      }
    }

    await this.sftpOperator.rm(
      params.path,
      params.host,
      params.port,
      params.username,
      { recursive: params.recursive }
    );

    const server = this.recordAndGetIdentity(params);

    return {
      success: true,
      message: `已删除 ${params.path}`,
      server,
    };
  }

  /**
   * 记录操作目标并返回服务器身份信息
   */
  private recordAndGetIdentity(params: { host?: string; port?: number; username?: string }): ServerIdentity | undefined {
    if (!this.sshManager) return undefined;

    try {
      const identity = this.sshManager.getServerIdentity(params.host, params.port, params.username);

      if (this.targetGuard && identity.host && identity.username) {
        const key = getConnectionKey(identity.host, identity.port, identity.username);
        this.targetGuard.recordTarget(key, identity);
      }

      return identity;
    } catch {
      return undefined;
    }
  }
}
