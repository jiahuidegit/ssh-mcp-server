/**
 * utils 模块单元测试
 */

import { describe, it, expect } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import {
  expandHome,
  generateId,
  getConnectionKey,
  maskSensitive,
  delay,
  withTimeout,
  safeStringify,
  getEnvConfig,
} from '../src/utils/index.js';

describe('utils', () => {
  describe('expandHome', () => {
    it('应该展开 ~ 为用户主目录', () => {
      const result = expandHome('~/.ssh-mcp');
      expect(result).toBe(path.join(os.homedir(), '.ssh-mcp'));
    });

    it('应该展开 ~/subdir/file', () => {
      const result = expandHome('~/subdir/file.txt');
      expect(result).toBe(path.join(os.homedir(), 'subdir/file.txt'));
    });

    it('应该保持绝对路径不变', () => {
      const result = expandHome('/var/log/app.log');
      expect(result).toBe('/var/log/app.log');
    });

    it('应该保持相对路径不变', () => {
      const result = expandHome('./config.json');
      expect(result).toBe('./config.json');
    });
  });

  describe('generateId', () => {
    it('应该生成唯一 ID', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('ID 应该包含时间戳', () => {
      const id = generateId();
      const timestamp = id.split('-')[0];
      expect(Number(timestamp)).toBeGreaterThan(0);
    });
  });

  describe('getConnectionKey', () => {
    it('应该生成正确格式的连接 key', () => {
      const key = getConnectionKey('192.168.1.1', 22, 'root');
      expect(key).toBe('root@192.168.1.1:22');
    });

    it('应该处理非标准端口', () => {
      const key = getConnectionKey('example.com', 2222, 'admin');
      expect(key).toBe('admin@example.com:2222');
    });
  });

  describe('maskSensitive', () => {
    it('应该脱敏长字符串', () => {
      const result = maskSensitive('mysecretpassword');
      expect(result).toBe('mys***ord');
    });

    it('应该完全隐藏短字符串', () => {
      const result = maskSensitive('abc');
      expect(result).toBe('***');
    });

    it('应该支持自定义可见字符数', () => {
      const result = maskSensitive('mysecretpassword', 4);
      expect(result).toBe('myse***word');
    });
  });

  describe('delay', () => {
    it('应该延迟指定时间', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // 允许 10ms 误差
    });
  });

  describe('withTimeout', () => {
    it('应该在超时前返回结果', async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 50);
      });
      const result = await withTimeout(promise, 200);
      expect(result).toBe('success');
    });

    it('应该在超时时抛出错误', async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 500);
      });
      await expect(withTimeout(promise, 100)).rejects.toThrow('Operation timed out');
    });

    it('应该使用自定义错误消息', async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 500);
      });
      await expect(withTimeout(promise, 100, '连接超时')).rejects.toThrow('连接超时');
    });
  });

  describe('safeStringify', () => {
    it('应该序列化普通对象', () => {
      const obj = { name: 'test', value: 123 };
      const result = safeStringify(obj);
      expect(result).toBe('{"name":"test","value":123}');
    });

    it('应该处理循环引用', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj;
      const result = safeStringify(obj);
      expect(result).toBe('{"name":"test","self":"[Circular]"}');
    });

    it('应该支持格式化输出', () => {
      const obj = { name: 'test' };
      const result = safeStringify(obj, 2);
      expect(result).toContain('\n');
    });
  });

  describe('getEnvConfig', () => {
    it('应该返回环境变量值', () => {
      process.env.TEST_STRING = 'hello';
      const result = getEnvConfig('TEST_STRING', 'default');
      expect(result).toBe('hello');
      delete process.env.TEST_STRING;
    });

    it('应该返回默认值当环境变量不存在', () => {
      const result = getEnvConfig('NON_EXISTENT_VAR', 'default');
      expect(result).toBe('default');
    });

    it('应该转换数字类型', () => {
      process.env.TEST_NUMBER = '42';
      const result = getEnvConfig('TEST_NUMBER', 0);
      expect(result).toBe(42);
      delete process.env.TEST_NUMBER;
    });

    it('应该转换布尔类型', () => {
      process.env.TEST_BOOL = 'true';
      const result = getEnvConfig('TEST_BOOL', false);
      expect(result).toBe(true);
      delete process.env.TEST_BOOL;
    });
  });
});
