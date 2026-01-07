/**
 * MCP SFTP 工具
 * 提供 sftp_ls, sftp_upload, sftp_download, sftp_mkdir, sftp_rm 等工具
 */

import { z } from 'zod';
import { SFTPOperator } from '../core/sftp-operator.js';
import { FileInfo } from '../types/index.js';

// sftp_ls 参数 Schema
export const SftpLsSchema = z.object({
  path: z.string().min(1, '路径不能为空'),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
});

// sftp_upload 参数 Schema
export const SftpUploadSchema = z.object({
  localPath: z.string().min(1, '本地路径不能为空'),
  remotePath: z.string().min(1, '远程路径不能为空'),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  overwrite: z.boolean().default(false),
});

// sftp_download 参数 Schema
export const SftpDownloadSchema = z.object({
  remotePath: z.string().min(1, '远程路径不能为空'),
  localPath: z.string().min(1, '本地路径不能为空'),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  overwrite: z.boolean().default(false),
});

// sftp_mkdir 参数 Schema
export const SftpMkdirSchema = z.object({
  path: z.string().min(1, '路径不能为空'),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  recursive: z.boolean().default(false),
});

// sftp_rm 参数 Schema
export const SftpRmSchema = z.object({
  path: z.string().min(1, '路径不能为空'),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  recursive: z.boolean().default(false),
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
  constructor(private sftpOperator: SFTPOperator) {}

  /**
   * 列出目录内容
   */
  async ls(params: SftpLsParams): Promise<{ files: FileInfo[] }> {
    const files = await this.sftpOperator.ls(
      params.path,
      params.host,
      params.port,
      params.username
    );
    return { files };
  }

  /**
   * 上传文件
   */
  async upload(params: SftpUploadParams): Promise<{ success: boolean; message: string }> {
    await this.sftpOperator.upload(
      params.localPath,
      params.remotePath,
      params.host,
      params.port,
      params.username,
      { overwrite: params.overwrite }
    );
    return {
      success: true,
      message: `已上传 ${params.localPath} -> ${params.remotePath}`,
    };
  }

  /**
   * 下载文件
   */
  async download(params: SftpDownloadParams): Promise<{ success: boolean; message: string }> {
    await this.sftpOperator.download(
      params.remotePath,
      params.localPath,
      params.host,
      params.port,
      params.username,
      { overwrite: params.overwrite }
    );
    return {
      success: true,
      message: `已下载 ${params.remotePath} -> ${params.localPath}`,
    };
  }

  /**
   * 创建目录
   */
  async mkdir(params: SftpMkdirParams): Promise<{ success: boolean; message: string }> {
    await this.sftpOperator.mkdir(
      params.path,
      params.host,
      params.port,
      params.username,
      { recursive: params.recursive }
    );
    return {
      success: true,
      message: `已创建目录 ${params.path}`,
    };
  }

  /**
   * 删除文件或目录
   */
  async rm(params: SftpRmParams): Promise<{ success: boolean; message: string }> {
    await this.sftpOperator.rm(
      params.path,
      params.host,
      params.port,
      params.username,
      { recursive: params.recursive }
    );
    return {
      success: true,
      message: `已删除 ${params.path}`,
    };
  }
}
