/**
 * SSH 集成测试
 * 使用 testcontainers 启动真实的 SSH 服务器进行端到端测试
 *
 * 注意: 需要 Docker 环境
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { SSHManager } from '../src/core/ssh-manager.js';
import { CommandExecutor } from '../src/core/command-executor.js';
import { SFTPOperator } from '../src/core/sftp-operator.js';
import { AuditLogger } from '../src/logging/audit-logger.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 测试超时设置（容器启动可能需要时间）
const TEST_TIMEOUT = 60000;

describe('SSH Integration Tests', () => {
  let container: StartedTestContainer;
  let sshManager: SSHManager;
  let commandExecutor: CommandExecutor;
  let sftpOperator: SFTPOperator;
  let logger: AuditLogger;

  // SSH 服务器配置
  const SSH_USER = 'testuser';
  const SSH_PASSWORD = 'testpassword';
  let sshHost: string;
  let sshPort: number;

  beforeAll(async () => {
    logger = new AuditLogger({ logLevel: 'error' });

    // 启动 SSH 容器 (使用 linuxserver/openssh-server)
    container = await new GenericContainer('linuxserver/openssh-server:latest')
      .withEnvironment({
        PUID: '1000',
        PGID: '1000',
        TZ: 'UTC',
        USER_NAME: SSH_USER,
        USER_PASSWORD: SSH_PASSWORD,
        PASSWORD_ACCESS: 'true',
      })
      .withExposedPorts(2222)
      .withWaitStrategy(Wait.forLogMessage('Server listening on'))
      .withStartupTimeout(60000)
      .start();

    sshHost = container.getHost();
    sshPort = container.getMappedPort(2222);

    // 初始化管理器
    sshManager = new SSHManager(
      { connectionTimeout: 10000, commandTimeout: 30000 },
      logger
    );
    commandExecutor = new CommandExecutor(sshManager, {}, logger);
    sftpOperator = new SFTPOperator(sshManager, {}, logger);

    // 等待 SSH 服务完全就绪
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await sshManager?.destroy();
    await container?.stop();
  });

  describe('SSH 连接', () => {
    it('应该成功建立密码连接', async () => {
      const status = await sshManager.connect({
        host: sshHost,
        port: sshPort,
        username: SSH_USER,
        password: SSH_PASSWORD,
      });

      expect(status.connected).toBe(true);
      expect(status.host).toBe(sshHost);
      expect(status.username).toBe(SSH_USER);
    }, TEST_TIMEOUT);

    it('应该复用已存在的连接', async () => {
      const status1 = await sshManager.connect({
        host: sshHost,
        port: sshPort,
        username: SSH_USER,
        password: SSH_PASSWORD,
      });

      const status2 = await sshManager.connect({
        host: sshHost,
        port: sshPort,
        username: SSH_USER,
        password: SSH_PASSWORD,
      });

      expect(status1.connectedAt?.getTime()).toBe(status2.connectedAt?.getTime());
    }, TEST_TIMEOUT);

    it('应该列出当前连接', () => {
      const connections = sshManager.listConnections();
      expect(connections.length).toBeGreaterThan(0);
      expect(connections[0]?.connected).toBe(true);
    });
  });

  describe('命令执行', () => {
    it('应该执行简单命令', async () => {
      const result = await commandExecutor.exec('echo "Hello World"');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello World');
    }, TEST_TIMEOUT);

    it('应该返回命令输出', async () => {
      const result = await commandExecutor.exec('whoami');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(SSH_USER);
    }, TEST_TIMEOUT);

    it('应该处理命令失败', async () => {
      const result = await commandExecutor.exec('exit 1');

      expect(result.exitCode).toBe(1);
    }, TEST_TIMEOUT);

    it('应该捕获 stderr', async () => {
      const result = await commandExecutor.exec('echo "error" >&2');

      expect(result.stderr).toContain('error');
    }, TEST_TIMEOUT);

    it('应该支持工作目录', async () => {
      const result = await commandExecutor.exec('pwd', undefined, undefined, undefined, {
        cwd: '/tmp',
      });

      expect(result.stdout).toBe('/tmp');
    }, TEST_TIMEOUT);

    it('应该记录执行时间', async () => {
      const result = await commandExecutor.exec('sleep 0.1 && echo done');

      expect(result.duration).toBeGreaterThan(50);
    }, TEST_TIMEOUT);
  });

  describe('SFTP 操作', () => {
    const testDir = '/tmp/sftp-test';
    let localTempFile: string;

    beforeAll(async () => {
      // 创建测试目录
      await commandExecutor.exec(`mkdir -p ${testDir}`);

      // 创建本地临时文件
      localTempFile = path.join(os.tmpdir(), `ssh-mcp-test-${Date.now()}.txt`);
      fs.writeFileSync(localTempFile, 'Hello from integration test!');
    });

    afterAll(() => {
      // 清理本地临时文件
      if (fs.existsSync(localTempFile)) {
        fs.unlinkSync(localTempFile);
      }
    });

    it('应该列出目录内容', async () => {
      const { files } = await sftpOperator.ls('/tmp');

      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it('应该上传文件', async () => {
      const remotePath = `${testDir}/uploaded.txt`;

      await sftpOperator.upload(localTempFile, remotePath);

      // 验证文件存在
      const result = await commandExecutor.exec(`cat ${remotePath}`);
      expect(result.stdout).toContain('Hello from integration test');
    }, TEST_TIMEOUT);

    it('应该下载文件', async () => {
      const remotePath = `${testDir}/uploaded.txt`;
      const downloadPath = path.join(os.tmpdir(), `ssh-mcp-download-${Date.now()}.txt`);

      try {
        await sftpOperator.download(remotePath, downloadPath);

        const content = fs.readFileSync(downloadPath, 'utf-8');
        expect(content).toContain('Hello from integration test');
      } finally {
        if (fs.existsSync(downloadPath)) {
          fs.unlinkSync(downloadPath);
        }
      }
    }, TEST_TIMEOUT);

    it('应该创建目录', async () => {
      const newDir = `${testDir}/new-dir-${Date.now()}`;

      await sftpOperator.mkdir(newDir);

      const result = await commandExecutor.exec(`test -d ${newDir} && echo exists`);
      expect(result.stdout).toBe('exists');
    }, TEST_TIMEOUT);

    it('应该递归创建目录', async () => {
      const deepDir = `${testDir}/a/b/c/${Date.now()}`;

      await sftpOperator.mkdir(deepDir, undefined, undefined, undefined, { recursive: true });

      const result = await commandExecutor.exec(`test -d ${deepDir} && echo exists`);
      expect(result.stdout).toBe('exists');
    }, TEST_TIMEOUT);

    it('应该删除文件', async () => {
      const testFile = `${testDir}/to-delete-${Date.now()}.txt`;
      await commandExecutor.exec(`echo "delete me" > ${testFile}`);

      await sftpOperator.rm(testFile);

      const result = await commandExecutor.exec(`test -f ${testFile} && echo exists || echo deleted`);
      expect(result.stdout).toBe('deleted');
    }, TEST_TIMEOUT);
  });

  describe('断开连接', () => {
    it('应该成功断开连接', async () => {
      await sshManager.disconnect(sshHost, sshPort, SSH_USER);

      const connections = sshManager.listConnections();
      expect(connections.length).toBe(0);
    }, TEST_TIMEOUT);

    it('断开后应该能重新连接', async () => {
      const status = await sshManager.connect({
        host: sshHost,
        port: sshPort,
        username: SSH_USER,
        password: SSH_PASSWORD,
      });

      expect(status.connected).toBe(true);
    }, TEST_TIMEOUT);
  });
});
