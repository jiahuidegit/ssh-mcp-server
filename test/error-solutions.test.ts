/**
 * 错误解决方案模块测试
 */

import { describe, it, expect } from 'vitest';
import { formatErrorWithSolution, ERROR_SOLUTIONS } from '../src/errors/error-solutions.js';
import { SSHError, SSHErrorCode } from '../src/types/index.js';

describe('错误解决方案模块', () => {
  describe('ERROR_SOLUTIONS', () => {
    it('应该包含所有 8 个错误码的解决方案', () => {
      const errorCodes = Object.values(SSHErrorCode);
      expect(errorCodes.length).toBe(8);

      errorCodes.forEach((code) => {
        expect(ERROR_SOLUTIONS[code]).toBeDefined();
        expect(ERROR_SOLUTIONS[code].zh.solutions.length).toBeGreaterThan(0);
        expect(ERROR_SOLUTIONS[code].en.solutions.length).toBeGreaterThan(0);
      });
    });

    it('每个解决方案应该有中英文对照', () => {
      Object.values(ERROR_SOLUTIONS).forEach((solution) => {
        expect(solution.zh).toBeDefined();
        expect(solution.en).toBeDefined();
        expect(solution.zh.message).toBeDefined();
        expect(solution.en.message).toBeDefined();
      });
    });
  });

  describe('formatErrorWithSolution', () => {
    it('应该格式化 SSHError 并包含解决方案', () => {
      const error = new SSHError(SSHErrorCode.NOT_CONNECTED, '没有可用的 SSH 连接');
      const result = formatErrorWithSolution(error);

      // 检查错误码和消息
      expect(result).toContain('[SSH_NOT_CONNECTED]');
      expect(result).toContain('没有可用的 SSH 连接');

      // 检查中英文解决方案标记
      expect(result).toContain('💡 解决方案 / Solutions:');
      expect(result).toContain('中文:');
      expect(result).toContain('English:');

      // 检查具体的解决方案内容
      expect(result).toContain('connect');
      expect(result).toContain('SSH_MCP_IDLE_TIMEOUT');
    });

    it('应该正确处理所有错误码', () => {
      Object.values(SSHErrorCode).forEach((code) => {
        const error = new SSHError(code, 'test message');
        const result = formatErrorWithSolution(error);

        expect(result).toContain(`[${code}]`);
        expect(result).toContain('💡 解决方案 / Solutions:');
      });
    });

    it('应该正确处理普通 Error', () => {
      const error = new Error('普通错误消息');
      const result = formatErrorWithSolution(error);

      expect(result).toBe('普通错误消息');
      expect(result).not.toContain('解决方案');
    });

    it('应该正确处理字符串错误', () => {
      const result = formatErrorWithSolution('字符串错误');
      expect(result).toBe('字符串错误');
    });

    it('应该正确处理 null/undefined', () => {
      expect(formatErrorWithSolution(null)).toBe('null');
      expect(formatErrorWithSolution(undefined)).toBe('undefined');
    });

    it('CONNECTION_FAILED 应该包含网络相关提示', () => {
      const error = new SSHError(SSHErrorCode.CONNECTION_FAILED, '连接失败');
      const result = formatErrorWithSolution(error);

      expect(result).toContain('主机地址');
      expect(result).toContain('端口');
      expect(result).toContain('host');
      expect(result).toContain('port');
    });

    it('AUTH_FAILED 应该包含认证相关提示', () => {
      const error = new SSHError(SSHErrorCode.AUTH_FAILED, '认证失败');
      const result = formatErrorWithSolution(error);

      expect(result).toContain('密码');
      expect(result).toContain('私钥');
      expect(result).toContain('password');
      expect(result).toContain('key');
    });

    it('COMMAND_TIMEOUT 应该包含超时设置提示', () => {
      const error = new SSHError(SSHErrorCode.COMMAND_TIMEOUT, '命令超时');
      const result = formatErrorWithSolution(error);

      expect(result).toContain('useLongTimeout');
      expect(result).toContain('SSH_MCP_COMMAND_TIMEOUT');
    });
  });
});
