/**
 * ServerStore 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ServerStore } from '../src/storage/server-store.js';

describe('ServerStore', () => {
  let tempDir: string;
  let store: ServerStore;

  beforeEach(() => {
    // 创建临时目录
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-mcp-test-'));
    store = new ServerStore({ dataDir: tempDir });
  });

  afterEach(() => {
    // 清理临时目录
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('saveServer', () => {
    it('应该保存服务器配置', () => {
      store.saveServer({
        alias: 'test-server',
        host: '192.168.1.1',
        port: 22,
        username: 'root',
        authType: 'password',
      });

      const server = store.getServer('test-server');
      expect(server).toBeDefined();
      expect(server?.host).toBe('192.168.1.1');
      expect(server?.username).toBe('root');
    });

    it('应该更新已存在的服务器配置', () => {
      store.saveServer({
        alias: 'test-server',
        host: '192.168.1.1',
        port: 22,
        username: 'root',
        authType: 'password',
      });

      store.saveServer({
        alias: 'test-server',
        host: '192.168.1.2',
        port: 2222,
        username: 'admin',
        authType: 'privateKey',
      });

      const server = store.getServer('test-server');
      expect(server?.host).toBe('192.168.1.2');
      expect(server?.port).toBe(2222);
      expect(server?.username).toBe('admin');
    });

    it('应该验证必填字段', () => {
      expect(() => {
        store.saveServer({
          alias: '',
          host: '192.168.1.1',
          port: 22,
          username: 'root',
          authType: 'password',
        });
      }).toThrow();
    });
  });

  describe('getServer', () => {
    it('应该返回 undefined 当服务器不存在', () => {
      const server = store.getServer('non-existent');
      expect(server).toBeUndefined();
    });
  });

  describe('removeServer', () => {
    it('应该删除服务器配置', () => {
      store.saveServer({
        alias: 'test-server',
        host: '192.168.1.1',
        port: 22,
        username: 'root',
        authType: 'password',
      });

      const deleted = store.removeServer('test-server');
      expect(deleted).toBe(true);
      expect(store.getServer('test-server')).toBeUndefined();
    });

    it('应该返回 false 当服务器不存在', () => {
      const deleted = store.removeServer('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('listServers', () => {
    beforeEach(() => {
      store.saveServer({
        alias: 'prod-web-1',
        host: '10.0.0.1',
        port: 22,
        username: 'deploy',
        authType: 'privateKey',
        group: 'production',
      });
      store.saveServer({
        alias: 'prod-web-2',
        host: '10.0.0.2',
        port: 22,
        username: 'deploy',
        authType: 'privateKey',
        group: 'production',
      });
      store.saveServer({
        alias: 'dev-server',
        host: '192.168.1.100',
        port: 22,
        username: 'dev',
        authType: 'password',
        group: 'development',
      });
    });

    it('应该列出所有服务器', () => {
      const servers = store.listServers();
      expect(servers).toHaveLength(3);
    });

    it('应该按分组过滤', () => {
      const prodServers = store.listServers('production');
      expect(prodServers).toHaveLength(2);
      expect(prodServers.every((s) => s.group === 'production')).toBe(true);
    });

    it('应该返回空数组当分组不存在', () => {
      const servers = store.listServers('non-existent');
      expect(servers).toHaveLength(0);
    });
  });

  describe('listGroups', () => {
    it('应该列出所有分组', () => {
      store.saveServer({
        alias: 'server-1',
        host: '10.0.0.1',
        port: 22,
        username: 'root',
        authType: 'password',
        group: 'production',
      });
      store.saveServer({
        alias: 'server-2',
        host: '10.0.0.2',
        port: 22,
        username: 'root',
        authType: 'password',
        group: 'staging',
      });

      const groups = store.listGroups();
      expect(groups).toContain('production');
      expect(groups).toContain('staging');
    });
  });

  describe('exists', () => {
    it('应该返回 true 当服务器存在', () => {
      store.saveServer({
        alias: 'test-server',
        host: '192.168.1.1',
        port: 22,
        username: 'root',
        authType: 'password',
      });

      expect(store.exists('test-server')).toBe(true);
    });

    it('应该返回 false 当服务器不存在', () => {
      expect(store.exists('non-existent')).toBe(false);
    });
  });

  describe('persistence', () => {
    it('应该持久化数据到文件', () => {
      store.saveServer({
        alias: 'persistent-server',
        host: '192.168.1.1',
        port: 22,
        username: 'root',
        authType: 'password',
      });

      // 创建新实例读取数据
      const newStore = new ServerStore({ dataDir: tempDir });
      const server = newStore.getServer('persistent-server');
      expect(server).toBeDefined();
      expect(server?.host).toBe('192.168.1.1');
    });
  });
});
