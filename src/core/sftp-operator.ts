/**
 * SFTP 操作器
 * 负责文件上传、下载、目录操作等
 */

import { Client, SFTPWrapper } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import {
  FileInfo,
  SftpOptions,
  SSHError,
  SSHErrorCode,
  MCPServerConfig,
} from '../types/index.js';
import { SSHManager } from './ssh-manager.js';
import { AuditLogger } from '../logging/audit-logger.js';
import { getConnectionKey } from '../utils/index.js';

// SFTP 文件属性接口
interface SftpAttrs {
  mode: number;
  uid: number;
  gid: number;
  size: number;
  atime: number;
  mtime: number;
}

// SFTP 目录项接口
interface SftpFileEntry {
  filename: string;
  longname: string;
  attrs: SftpAttrs;
}

/**
 * SFTP 操作器
 */
export class SFTPOperator {
  private logger: AuditLogger;

  constructor(
    private sshManager: SSHManager,
    _config: Partial<MCPServerConfig> = {},
    logger: AuditLogger
  ) {
    this.logger = logger;
  }

  /**
   * 列出目录内容
   */
  async ls(
    remotePath: string,
    host?: string,
    port?: number,
    username?: string
  ): Promise<FileInfo[]> {
    const sftp = await this.getSftp(host, port, username);
    const serverKey = this.getServerKey(host, port, username);

    try {
      const list = await this.readdir(sftp, remotePath);

      this.logger.log('info', 'sftp_ls', {
        server: serverKey,
        path: remotePath,
        count: list.length,
      });

      return list.map((item) => this.toFileInfo(item));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log('error', 'sftp_ls', {
        server: serverKey,
        path: remotePath,
        error: message,
      });
      throw new SSHError(SSHErrorCode.SFTP_ERROR, `列目录失败: ${message}`, error);
    }
  }

  /**
   * 上传文件
   */
  async upload(
    localPath: string,
    remotePath: string,
    host?: string,
    port?: number,
    username?: string,
    options: SftpOptions = {}
  ): Promise<void> {
    const sftp = await this.getSftp(host, port, username);
    const serverKey = this.getServerKey(host, port, username);

    // 检查本地文件是否存在
    if (!fs.existsSync(localPath)) {
      throw new SSHError(SSHErrorCode.SFTP_ERROR, `本地文件不存在: ${localPath}`);
    }

    try {
      // 检查远程文件是否存在
      const exists = await this.exists(sftp, remotePath);
      if (exists && !options.overwrite) {
        throw new SSHError(SSHErrorCode.SFTP_ERROR, `远程文件已存在: ${remotePath}`);
      }

      await this.fastPut(sftp, localPath, remotePath);

      const stats = fs.statSync(localPath);
      this.logger.log('info', 'sftp_upload', {
        server: serverKey,
        local: localPath,
        remote: remotePath,
        size: stats.size,
      });
    } catch (error) {
      if (error instanceof SSHError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log('error', 'sftp_upload', {
        server: serverKey,
        local: localPath,
        remote: remotePath,
        error: message,
      });
      throw new SSHError(SSHErrorCode.SFTP_ERROR, `上传失败: ${message}`, error);
    }
  }

  /**
   * 下载文件
   */
  async download(
    remotePath: string,
    localPath: string,
    host?: string,
    port?: number,
    username?: string,
    options: SftpOptions = {}
  ): Promise<void> {
    const sftp = await this.getSftp(host, port, username);
    const serverKey = this.getServerKey(host, port, username);

    try {
      // 检查远程文件是否存在
      const exists = await this.exists(sftp, remotePath);
      if (!exists) {
        throw new SSHError(SSHErrorCode.SFTP_ERROR, `远程文件不存在: ${remotePath}`);
      }

      // 检查本地文件是否存在
      if (fs.existsSync(localPath) && !options.overwrite) {
        throw new SSHError(SSHErrorCode.SFTP_ERROR, `本地文件已存在: ${localPath}`);
      }

      // 确保本地目录存在
      const localDir = path.dirname(localPath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      await this.fastGet(sftp, remotePath, localPath);

      const stats = fs.statSync(localPath);
      this.logger.log('info', 'sftp_download', {
        server: serverKey,
        remote: remotePath,
        local: localPath,
        size: stats.size,
      });
    } catch (error) {
      if (error instanceof SSHError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log('error', 'sftp_download', {
        server: serverKey,
        remote: remotePath,
        local: localPath,
        error: message,
      });
      throw new SSHError(SSHErrorCode.SFTP_ERROR, `下载失败: ${message}`, error);
    }
  }

  /**
   * 创建目录
   */
  async mkdir(
    remotePath: string,
    host?: string,
    port?: number,
    username?: string,
    options: SftpOptions = {}
  ): Promise<void> {
    const sftp = await this.getSftp(host, port, username);
    const serverKey = this.getServerKey(host, port, username);

    try {
      if (options.recursive) {
        await this.mkdirRecursive(sftp, remotePath);
      } else {
        await this.mkdirSingle(sftp, remotePath);
      }

      this.logger.log('info', 'sftp_mkdir', {
        server: serverKey,
        path: remotePath,
        recursive: options.recursive,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log('error', 'sftp_mkdir', {
        server: serverKey,
        path: remotePath,
        error: message,
      });
      throw new SSHError(SSHErrorCode.SFTP_ERROR, `创建目录失败: ${message}`, error);
    }
  }

  /**
   * 删除文件或目录
   */
  async rm(
    remotePath: string,
    host?: string,
    port?: number,
    username?: string,
    options: SftpOptions = {}
  ): Promise<void> {
    const sftp = await this.getSftp(host, port, username);
    const serverKey = this.getServerKey(host, port, username);

    // 安全检查：禁止删除根目录
    const dangerousPaths = ['/', '/etc', '/usr', '/var', '/home', '/root', '/bin', '/sbin'];
    if (dangerousPaths.includes(remotePath)) {
      throw new SSHError(SSHErrorCode.PERMISSION_DENIED, `禁止删除系统目录: ${remotePath}`);
    }

    try {
      const stat = await this.stat(sftp, remotePath);

      if (this.isDirectory(stat)) {
        if (options.recursive) {
          await this.rmRecursive(sftp, remotePath);
        } else {
          await this.rmdirSingle(sftp, remotePath);
        }
      } else {
        await this.unlink(sftp, remotePath);
      }

      this.logger.log('info', 'sftp_rm', {
        server: serverKey,
        path: remotePath,
        recursive: options.recursive,
      });
    } catch (error) {
      if (error instanceof SSHError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log('error', 'sftp_rm', {
        server: serverKey,
        path: remotePath,
        error: message,
      });
      throw new SSHError(SSHErrorCode.SFTP_ERROR, `删除失败: ${message}`, error);
    }
  }

  // ============ 私有方法 ============

  /**
   * 获取 SFTP 会话
   */
  private async getSftp(host?: string, port?: number, username?: string): Promise<SFTPWrapper> {
    let client: Client | undefined;

    if (host && username) {
      client = this.sshManager.getConnection(host, port ?? 22, username);
    } else {
      // 多连接安全检查：与 command-executor 的 getClient 对齐
      const allConnections = this.sshManager.listConnections();

      if (allConnections.length > 1) {
        const connectionsList = allConnections
          .map((conn) => {
            const identity = this.sshManager.getServerIdentity(conn.host, conn.port, conn.username);
            const envLabel = identity.environment
              ? ` [${identity.environment.toUpperCase()}]`
              : '';
            const aliasLabel = identity.alias ? ` (别名: ${identity.alias})` : '';
            return `  - ${conn.username}@${conn.host}:${conn.port}${envLabel}${aliasLabel}`;
          })
          .join('\n');

        throw new SSHError(
          SSHErrorCode.NOT_CONNECTED,
          `安全提示：当前有 ${allConnections.length} 个活跃连接，为防止误操作，必须明确指定要操作的服务器！\n\n当前活跃连接：\n${connectionsList}\n\n请明确指定 host 和 username 参数，或使用 alias 指定服务器别名。`
        );
      }

      const active = this.sshManager.getActiveConnection();
      client = active?.client;
    }

    if (!client) {
      throw new SSHError(SSHErrorCode.NOT_CONNECTED, '没有可用的 SSH 连接');
    }

    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) reject(err);
        else resolve(sftp);
      });
    });
  }

  /**
   * 获取服务器标识
   */
  private getServerKey(host?: string, port?: number, username?: string): string {
    if (host && username) {
      return getConnectionKey(host, port ?? 22, username);
    }
    const active = this.sshManager.getActiveConnection();
    return active?.key ?? 'unknown';
  }

  /**
   * 转换为 FileInfo
   */
  private toFileInfo(entry: SftpFileEntry): FileInfo {
    const mode = entry.attrs.mode;
    return {
      filename: entry.filename,
      longname: entry.longname,
      attrs: entry.attrs,
      isDirectory: (mode & 0o40000) !== 0,
      isFile: (mode & 0o100000) !== 0,
      isSymbolicLink: (mode & 0o120000) !== 0,
    };
  }

  /**
   * 判断是否为目录
   */
  private isDirectory(attrs: SftpAttrs): boolean {
    return (attrs.mode & 0o40000) !== 0;
  }

  // ============ Promise 封装方法 ============

  private readdir(sftp: SFTPWrapper, path: string): Promise<SftpFileEntry[]> {
    return new Promise((resolve, reject) => {
      sftp.readdir(path, (err, list) => {
        if (err) reject(err);
        else resolve(list as SftpFileEntry[]);
      });
    });
  }

  private stat(sftp: SFTPWrapper, path: string): Promise<SftpAttrs> {
    return new Promise((resolve, reject) => {
      sftp.stat(path, (err, stats) => {
        if (err) reject(err);
        else resolve(stats as SftpAttrs);
      });
    });
  }

  private exists(sftp: SFTPWrapper, path: string): Promise<boolean> {
    return new Promise((resolve) => {
      sftp.stat(path, (err) => {
        resolve(!err);
      });
    });
  }

  private fastPut(sftp: SFTPWrapper, localPath: string, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private fastGet(sftp: SFTPWrapper, remotePath: string, localPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private mkdirSingle(sftp: SFTPWrapper, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      sftp.mkdir(path, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async mkdirRecursive(sftp: SFTPWrapper, targetPath: string): Promise<void> {
    const parts = targetPath.split('/').filter(Boolean);
    let currentPath = '';

    for (const part of parts) {
      currentPath += '/' + part;
      const exists = await this.exists(sftp, currentPath);
      if (!exists) {
        await this.mkdirSingle(sftp, currentPath);
      }
    }
  }

  private rmdirSingle(sftp: SFTPWrapper, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      sftp.rmdir(path, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private unlink(sftp: SFTPWrapper, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      sftp.unlink(path, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async rmRecursive(sftp: SFTPWrapper, targetPath: string): Promise<void> {
    const list = await this.readdir(sftp, targetPath);

    for (const item of list) {
      const fullPath = `${targetPath}/${item.filename}`;
      if (this.isDirectory(item.attrs)) {
        await this.rmRecursive(sftp, fullPath);
      } else {
        await this.unlink(sftp, fullPath);
      }
    }

    await this.rmdirSingle(sftp, targetPath);
  }
}
