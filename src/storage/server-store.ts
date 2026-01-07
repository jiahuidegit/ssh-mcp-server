/**
 * 服务器配置存储模块
 * 管理服务器连接配置（不含敏感凭证）
 */

import * as fs from 'fs';
import * as path from 'path';
import { ServerConfig, ServerConfigSchema, MCPServerConfig, DEFAULT_CONFIG } from '../types/index.js';
import { expandHome } from '../utils/index.js';

/**
 * 服务器存储器
 */
export class ServerStore {
  private config: MCPServerConfig;
  private serversFilePath: string;
  private servers: Map<string, ServerConfig> = new Map();

  constructor(config: Partial<MCPServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.serversFilePath = path.join(
      expandHome(this.config.dataDir),
      'servers.json'
    );
    this.load();
  }

  /**
   * 加载服务器配置
   */
  private load(): void {
    if (!fs.existsSync(this.serversFilePath)) {
      return;
    }

    try {
      const data = fs.readFileSync(this.serversFilePath, 'utf-8');
      const servers = JSON.parse(data) as ServerConfig[];
      for (const server of servers) {
        // 验证配置
        const result = ServerConfigSchema.safeParse(server);
        if (result.success) {
          this.servers.set(server.alias, result.data);
        }
      }
    } catch {
      // 文件损坏，忽略
    }
  }

  /**
   * 保存到文件
   */
  private save(): void {
    const dataDir = path.dirname(this.serversFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    }

    const servers = Array.from(this.servers.values());
    fs.writeFileSync(this.serversFilePath, JSON.stringify(servers, null, 2), {
      mode: 0o600,
    });
  }

  /**
   * 保存服务器配置
   */
  saveServer(config: ServerConfig): void {
    // 验证配置
    const result = ServerConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`配置验证失败: ${result.error.message}`);
    }

    this.servers.set(config.alias, result.data);
    this.save();
  }

  /**
   * 获取服务器配置
   */
  getServer(alias: string): ServerConfig | undefined {
    return this.servers.get(alias);
  }

  /**
   * 删除服务器配置
   */
  removeServer(alias: string): boolean {
    const deleted = this.servers.delete(alias);
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  /**
   * 列出所有服务器
   */
  listServers(group?: string): ServerConfig[] {
    const servers = Array.from(this.servers.values());
    if (group) {
      return servers.filter((s) => s.group === group);
    }
    return servers;
  }

  /**
   * 列出所有分组
   */
  listGroups(): string[] {
    const groups = new Set<string>();
    for (const server of this.servers.values()) {
      if (server.group) {
        groups.add(server.group);
      }
    }
    return Array.from(groups);
  }

  /**
   * 检查别名是否存在
   */
  exists(alias: string): boolean {
    return this.servers.has(alias);
  }
}
