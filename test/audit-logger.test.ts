/**
 * AuditLogger 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogger } from '../src/logging/audit-logger.js';

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger({ logLevel: 'debug' });
  });

  describe('log', () => {
    it('应该记录日志条目', () => {
      logger.log('info', 'test_operation', { key: 'value' });

      const logs = logger.getRecent(1);
      expect(logs).toHaveLength(1);
      expect(logs[0]?.operation).toBe('test_operation');
      expect(logs[0]?.level).toBe('info');
    });

    it('应该记录服务器信息', () => {
      logger.log('info', 'ssh_connect', { host: '192.168.1.1' }, 'root@192.168.1.1:22');

      const logs = logger.getRecent(1);
      expect(logs[0]?.server).toBe('root@192.168.1.1:22');
    });

    it('应该脱敏密码字段', () => {
      logger.log('info', 'ssh_connect', { password: 'supersecret123' });

      const logs = logger.getRecent(1);
      expect(logs[0]?.details?.password).not.toBe('supersecret123');
      expect(logs[0]?.details?.password).toContain('***');
    });

    it('应该脱敏私钥字段', () => {
      logger.log('info', 'ssh_connect', { privateKey: '-----BEGIN RSA PRIVATE KEY-----...' });

      const logs = logger.getRecent(1);
      expect(logs[0]?.details?.privateKey).toContain('***');
    });
  });

  describe('query', () => {
    beforeEach(() => {
      // 添加多条日志
      logger.log('info', 'ssh_connect', {}, 'server-1');
      logger.log('info', 'command_exec', {}, 'server-1');
      logger.log('error', 'ssh_connect', { error: 'connection failed' }, 'server-2');
      logger.log('info', 'sftp_upload', {}, 'server-1');
    });

    it('应该按服务器过滤', () => {
      const logs = logger.query({ server: 'server-1' });
      expect(logs.every((log) => log.server === 'server-1')).toBe(true);
    });

    it('应该按操作类型过滤', () => {
      const logs = logger.query({ operation: 'ssh_connect' });
      expect(logs.every((log) => log.operation === 'ssh_connect')).toBe(true);
    });

    it('应该按级别过滤', () => {
      const logs = logger.query({ level: 'error' });
      expect(logs.every((log) => log.level === 'error')).toBe(true);
    });

    it('应该限制返回数量', () => {
      const logs = logger.query({ limit: 2 });
      expect(logs).toHaveLength(2);
    });

    it('应该按时间倒序排列', () => {
      const logs = logger.query({});
      for (let i = 1; i < logs.length; i++) {
        const prev = logs[i - 1];
        const curr = logs[i];
        if (prev && curr) {
          expect(prev.timestamp.getTime()).toBeGreaterThanOrEqual(curr.timestamp.getTime());
        }
      }
    });
  });

  describe('getRecent', () => {
    it('应该返回最近的日志', async () => {
      logger.log('info', 'op1', {});
      await new Promise((r) => setTimeout(r, 5)); // 确保时间戳不同
      logger.log('info', 'op2', {});
      await new Promise((r) => setTimeout(r, 5));
      logger.log('info', 'op3', {});

      const logs = logger.getRecent(2);
      expect(logs).toHaveLength(2);
      expect(logs[0]?.operation).toBe('op3');
      expect(logs[1]?.operation).toBe('op2');
    });
  });

  describe('clear', () => {
    it('应该清除所有日志', () => {
      logger.log('info', 'test', {});
      logger.log('info', 'test', {});

      logger.clear();
      expect(logger.getRecent(10)).toHaveLength(0);
    });
  });

  describe('日志条目属性', () => {
    it('应该包含唯一 ID', () => {
      logger.log('info', 'test', {});
      logger.log('info', 'test', {});

      const logs = logger.getRecent(2);
      expect(logs[0]?.id).not.toBe(logs[1]?.id);
    });

    it('应该包含时间戳', () => {
      const before = new Date();
      logger.log('info', 'test', {});
      const after = new Date();

      const logs = logger.getRecent(1);
      expect(logs[0]?.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(logs[0]?.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('error 级别应该标记 success 为 false', () => {
      logger.log('error', 'test', { error: 'something went wrong' });

      const logs = logger.getRecent(1);
      expect(logs[0]?.success).toBe(false);
      expect(logs[0]?.error).toBe('something went wrong');
    });
  });
});
