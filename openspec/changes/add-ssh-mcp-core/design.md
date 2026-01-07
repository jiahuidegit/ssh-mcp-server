# Technical Design: SSH MCP Server

## Context

### 背景
AI 助手（Claude、Codex）需要安全地访问远程服务器执行运维任务。现有方案功能分散，缺乏企业级特性。

### 约束
- 必须遵循 MCP 协议规范
- 跨平台支持（macOS/Windows/Linux）
- 凭证安全不能妥协
- 性能要求：连接复用，避免重复握手

### 利益相关者
- 开发者：使用 AI 助手管理服务器
- 运维人员：批量管理服务器
- 安全团队：审计和合规要求

## Goals / Non-Goals

### Goals
- 提供完整的 SSH 连接和命令执行能力
- 支持 SFTP 文件操作
- 安全的凭证存储
- 完整的操作审计日志
- 兼容主流 MCP 客户端

### Non-Goals
- 不实现 SSH Agent（使用系统 Agent）
- 不实现图形化界面
- 不做实时终端（PTY 全交互模式）

## Decisions

### 决策 1：项目结构

```
ssh-mcp-server/
├── src/
│   ├── index.ts              # MCP Server 入口
│   ├── core/
│   │   ├── ssh-manager.ts    # SSH 连接管理
│   │   ├── command-executor.ts
│   │   └── sftp-operator.ts
│   ├── storage/
│   │   ├── credential-store.ts
│   │   └── server-store.ts
│   ├── logging/
│   │   └── audit-logger.ts
│   ├── tools/                # MCP Tools 定义
│   │   ├── connection.ts
│   │   ├── server.ts
│   │   ├── exec.ts
│   │   ├── sftp.ts
│   │   └── system.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       └── index.ts
├── test/
├── package.json
├── tsconfig.json
└── README.md
```

**理由**: 按职责分层，core 处理业务逻辑，tools 负责 MCP 协议适配，storage 和 logging 独立便于替换。

### 决策 2：连接池设计

```typescript
class SSHConnectionPool {
  private connections: Map<string, SSHConnection> = new Map();
  private idleTimeout: number = 300000; // 5分钟

  async getConnection(config: ServerConfig): Promise<SSHConnection> {
    const key = this.getConnectionKey(config);
    if (this.connections.has(key)) {
      return this.connections.get(key)!.refresh();
    }
    const conn = await this.createConnection(config);
    this.connections.set(key, conn);
    return conn;
  }
}
```

**理由**:
- SSH 握手耗时（1-3秒），连接复用提升体验
- 使用 Map 存储，key 为 `${host}:${port}:${username}`
- 空闲超时自动清理，避免资源泄漏

**备选方案**:
- 每次新建连接：简单但性能差，放弃

### 决策 3：凭证存储策略

```
优先级：
1. keytar (系统 Keychain) - 最安全
2. 加密文件 (~/.ssh-mcp/credentials.enc) - 备用
```

**理由**:
- keytar 使用操作系统原生安全存储，已被 VSCode 等验证
- 加密文件作为 Linux 无桌面环境的备用方案
- 加密使用 AES-256-GCM，密钥派生自用户主密码

### 决策 4：MCP Tools 设计

| Tool | 参数 | 描述 |
|------|------|------|
| `connect` | host, user, password/key, [port] | 连接服务器（临时或别名） |
| `disconnect` | [host] | 断开连接 |
| `list_servers` | [group] | 列出已保存服务器 |
| `save_server` | alias, host, user, ... | 保存服务器配置 |
| `remove_server` | alias | 删除服务器配置 |
| `exec` | command, [host] | 执行命令 |
| `exec_sudo` | command, sudoPassword, [host] | sudo 执行 |
| `exec_batch` | command, hosts[] | 批量执行 |
| `sftp_ls` | path, [host] | 列目录 |
| `sftp_upload` | localPath, remotePath, [host] | 上传 |
| `sftp_download` | remotePath, localPath, [host] | 下载 |
| `sftp_mkdir` | path, [recursive], [host] | 创建目录 |
| `sftp_rm` | path, [recursive], [host] | 删除 |
| `health_check` | [host] | 健康检查 |
| `get_logs` | [limit], [server] | 查询日志 |

**理由**:
- 每个工具职责单一
- [host] 可选，不传则使用当前活动连接
- 参数使用 zod 校验

### 决策 5：错误处理

```typescript
enum SSHErrorCode {
  CONNECTION_FAILED = 'SSH_CONN_FAILED',
  AUTH_FAILED = 'SSH_AUTH_FAILED',
  COMMAND_TIMEOUT = 'SSH_CMD_TIMEOUT',
  SFTP_ERROR = 'SSH_SFTP_ERROR',
  PERMISSION_DENIED = 'SSH_PERM_DENIED',
}

class SSHError extends Error {
  constructor(
    public code: SSHErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}
```

**理由**: 结构化错误便于客户端处理和日志分析。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| keytar 在 CI 环境可能失败 | 中 | 提供环境变量配置备选 |
| 连接池内存占用 | 低 | 限制最大连接数 + 空闲清理 |
| 私钥格式兼容性 | 中 | ssh2 支持多种格式，增加格式转换 |
| 大文件 SFTP 传输 | 中 | 分块传输 + 进度回调 |

## Migration Plan

这是新项目，无迁移需求。

### 发布计划
1. v0.1.0 - 核心功能（连接、命令、SFTP）
2. v0.2.0 - 服务器管理 + 凭证存储
3. v0.3.0 - 审计日志 + 批量执行
4. v1.0.0 - 完整测试 + 文档 + 发布 npm

## Open Questions

1. **是否支持 SSH Agent 转发？**
   - 暂不支持，后续按需添加

2. **是否需要支持 SSH 隧道/端口转发？**
   - 作为 P2 功能，v1.x 考虑

3. **日志保留策略？**
   - 默认保留 7 天，可配置
