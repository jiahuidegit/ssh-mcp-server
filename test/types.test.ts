/**
 * Types 模块测试
 */

import { describe, it, expect } from 'vitest';
import { ServerConfigSchema, SSHError, SSHErrorCode } from '../src/types/index.js';

describe('Types', () => {
  describe('ServerConfigSchema', () => {
    it('应该验证有效的服务器配置', () => {
      const config = {
        alias: 'test-server',
        host: '192.168.1.1',
        port: 22,
        username: 'root',
        authType: 'password' as const,
      };

      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('应该使用默认端口 22', () => {
      const config = {
        alias: 'test-server',
        host: '192.168.1.1',
        username: 'root',
        authType: 'password' as const,
      };

      const result = ServerConfigSchema.parse(config);
      expect(result.port).toBe(22);
    });

    it('应该拒绝空别名', () => {
      const config = {
        alias: '',
        host: '192.168.1.1',
        username: 'root',
        authType: 'password' as const,
      };

      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('应该拒绝空主机', () => {
      const config = {
        alias: 'test',
        host: '',
        username: 'root',
        authType: 'password' as const,
      };

      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('应该拒绝无效端口', () => {
      const config = {
        alias: 'test',
        host: '192.168.1.1',
        port: 70000,
        username: 'root',
        authType: 'password' as const,
      };

      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('应该拒绝无效认证类型', () => {
      const config = {
        alias: 'test',
        host: '192.168.1.1',
        username: 'root',
        authType: 'invalid',
      };

      const result = ServerConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('应该允许可选的分组字段', () => {
      const config = {
        alias: 'test-server',
        host: '192.168.1.1',
        username: 'root',
        authType: 'privateKey' as const,
        group: 'production',
      };

      const result = ServerConfigSchema.parse(config);
      expect(result.group).toBe('production');
    });
  });

  describe('SSHError', () => {
    it('应该创建正确的错误对象', () => {
      const error = new SSHError(SSHErrorCode.CONNECTION_FAILED, '连接失败');

      expect(error.code).toBe(SSHErrorCode.CONNECTION_FAILED);
      expect(error.message).toBe('连接失败');
      expect(error.name).toBe('SSHError');
    });

    it('应该携带详细信息', () => {
      const details = { host: '192.168.1.1', port: 22 };
      const error = new SSHError(SSHErrorCode.AUTH_FAILED, '认证失败', details);

      expect(error.details).toEqual(details);
    });

    it('应该是 Error 的实例', () => {
      const error = new SSHError(SSHErrorCode.COMMAND_TIMEOUT, '超时');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('SSHErrorCode', () => {
    it('应该包含所有错误码', () => {
      expect(SSHErrorCode.CONNECTION_FAILED).toBe('SSH_CONN_FAILED');
      expect(SSHErrorCode.AUTH_FAILED).toBe('SSH_AUTH_FAILED');
      expect(SSHErrorCode.COMMAND_TIMEOUT).toBe('SSH_CMD_TIMEOUT');
      expect(SSHErrorCode.SFTP_ERROR).toBe('SSH_SFTP_ERROR');
      expect(SSHErrorCode.PERMISSION_DENIED).toBe('SSH_PERM_DENIED');
      expect(SSHErrorCode.NOT_CONNECTED).toBe('SSH_NOT_CONNECTED');
      expect(SSHErrorCode.CONFIG_ERROR).toBe('SSH_CONFIG_ERROR');
      expect(SSHErrorCode.CREDENTIAL_ERROR).toBe('SSH_CREDENTIAL_ERROR');
    });
  });
});
