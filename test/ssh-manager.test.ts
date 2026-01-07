/**
 * SSH Manager 单元测试 (使用 mock)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSHError, SSHErrorCode } from '../src/types/index.js';
import { AuditLogger } from '../src/logging/audit-logger.js';

// Mock ssh2 模块
vi.mock('ssh2', () => {
  const mockClient = {
    on: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    exec: vi.fn(),
    sftp: vi.fn(),
  };

  return {
    Client: vi.fn(() => mockClient),
  };
});

import { Client } from 'ssh2';
import { SSHManager } from '../src/core/ssh-manager.js';

describe('SSHManager', () => {
  let manager: SSHManager;
  let logger: AuditLogger;
  let mockClient: ReturnType<typeof Client>;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new AuditLogger({ logLevel: 'error' });
    manager = new SSHManager({ connectionTimeout: 5000, maxConnections: 5 }, logger);
    mockClient = new Client() as unknown as ReturnType<typeof Client>;
  });

  afterEach(async () => {
    await manager.destroy();
  });

  describe('connect', () => {
    it('应该成功建立密码连接', async () => {
      // 模拟连接成功
      (mockClient.on as ReturnType<typeof vi.fn>).mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 10);
        }
        return mockClient;
      });

      const status = await manager.connect({
        host: '192.168.1.1',
        port: 22,
        username: 'root',
        password: 'password123',
      });

      expect(status.connected).toBe(true);
      expect(status.host).toBe('192.168.1.1');
      expect(status.username).toBe('root');
    });

    it('应该拒绝无认证信息的连接', async () => {
      await expect(
        manager.connect({
          host: '192.168.1.1',
          username: 'root',
        })
      ).rejects.toThrow('必须提供密码或私钥');
    });

    it('应该复用已存在的连接', async () => {
      // 模拟连接成功
      (mockClient.on as ReturnType<typeof vi.fn>).mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 10);
        }
        return mockClient;
      });

      // 第一次连接
      await manager.connect({
        host: '192.168.1.1',
        username: 'root',
        password: 'password123',
      });

      // 第二次连接应该复用
      const status = await manager.connect({
        host: '192.168.1.1',
        username: 'root',
        password: 'password123',
      });

      expect(status.connected).toBe(true);
      // Client 构造函数只应该被调用一次（加上 beforeEach 中的一次）
      expect(Client).toHaveBeenCalledTimes(2);
    });

    it('应该处理连接错误', async () => {
      (mockClient.on as ReturnType<typeof vi.fn>).mockImplementation((event: string, callback: (err?: Error) => void) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection refused')), 10);
        }
        return mockClient;
      });

      await expect(
        manager.connect({
          host: '192.168.1.1',
          username: 'root',
          password: 'password123',
        })
      ).rejects.toThrow();
    });

    it('应该限制最大连接数', async () => {
      // 创建一个最大只允许 1 个连接的 manager
      const limitedManager = new SSHManager({ maxConnections: 1 }, logger);

      (mockClient.on as ReturnType<typeof vi.fn>).mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 10);
        }
        return mockClient;
      });

      // 第一个连接成功
      await limitedManager.connect({
        host: '192.168.1.1',
        username: 'root',
        password: 'password123',
      });

      // 第二个连接应该失败（不同服务器）
      await expect(
        limitedManager.connect({
          host: '192.168.1.2',
          username: 'root',
          password: 'password123',
        })
      ).rejects.toThrow('达到最大连接数限制');

      await limitedManager.destroy();
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      (mockClient.on as ReturnType<typeof vi.fn>).mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 10);
        }
        return mockClient;
      });

      await manager.connect({
        host: '192.168.1.1',
        username: 'root',
        password: 'password123',
      });
    });

    it('应该断开指定连接', async () => {
      await manager.disconnect('192.168.1.1', 22, 'root');

      const connections = manager.listConnections();
      expect(connections).toHaveLength(0);
    });

    it('应该断开所有连接', async () => {
      await manager.disconnect();

      const connections = manager.listConnections();
      expect(connections).toHaveLength(0);
    });
  });

  describe('listConnections', () => {
    it('应该返回空数组当没有连接', () => {
      const connections = manager.listConnections();
      expect(connections).toHaveLength(0);
    });

    it('应该列出所有连接', async () => {
      (mockClient.on as ReturnType<typeof vi.fn>).mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 10);
        }
        return mockClient;
      });

      await manager.connect({
        host: '192.168.1.1',
        username: 'root',
        password: 'password123',
      });

      const connections = manager.listConnections();
      expect(connections).toHaveLength(1);
      expect(connections[0]?.connected).toBe(true);
    });
  });

  describe('getActiveConnection', () => {
    it('应该返回 undefined 当没有连接', () => {
      const active = manager.getActiveConnection();
      expect(active).toBeUndefined();
    });

    it('应该返回最后活动的连接', async () => {
      (mockClient.on as ReturnType<typeof vi.fn>).mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          setTimeout(callback, 10);
        }
        return mockClient;
      });

      await manager.connect({
        host: '192.168.1.1',
        username: 'root',
        password: 'password123',
      });

      const active = manager.getActiveConnection();
      expect(active).toBeDefined();
      expect(active?.key).toBe('root@192.168.1.1:22');
    });
  });
});
