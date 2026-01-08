# SSH MCP Server - 项目开发规范

本文档为 AI 助手和开发者提供项目开发指南和规范。

## 项目概述

SSH MCP Server 是基于 MCP (Model Context Protocol) 协议的 SSH 远程服务器管理工具，为 Claude 等 AI 助手提供安全的服务器操作能力。

### 技术栈

- **运行时**: Node.js 20+
- **语言**: TypeScript 5.x (strict mode)
- **协议**: MCP (Model Context Protocol)
- **SSH**: ssh2 库
- **验证**: Zod
- **日志**: Pino
- **测试**: Vitest
- **代码规范**: ESLint 9 + Prettier

### 目录结构

```
ssh-mcp-server/
├── src/
│   ├── index.ts           # MCP Server 入口
│   ├── core/              # 核心功能模块
│   │   ├── ssh-manager.ts     # SSH 连接管理
│   │   ├── command-executor.ts # 命令执行器
│   │   └── sftp-operator.ts   # SFTP 操作
│   ├── tools/             # MCP 工具定义
│   │   ├── connection.ts      # 连接管理工具
│   │   ├── exec.ts            # 命令执行工具
│   │   ├── sftp.ts            # SFTP 工具
│   │   ├── server.ts          # 服务器管理工具
│   │   └── system.ts          # 系统工具
│   ├── storage/           # 数据存储
│   │   ├── credential-store.ts # 凭证存储
│   │   └── server-store.ts    # 服务器配置存储
│   ├── logging/           # 日志模块
│   │   └── audit-logger.ts    # 审计日志
│   ├── types/             # 类型定义
│   │   └── index.ts
│   └── utils/             # 工具函数
│       └── index.ts
├── test/                  # 测试文件
├── dist/                  # 编译输出
└── docs/                  # 文档
```

---

## 开发规范

### 代码风格

#### 命名约定

```typescript
// 类名: PascalCase
class SSHManager {}
class CommandExecutor {}

// 接口/类型: PascalCase
interface ServerConfig {}
type ExecResult = { ... }

// 函数/方法: camelCase
function getConnectionKey() {}
async function executeCommand() {}

// 常量: UPPER_SNAKE_CASE
const DEFAULT_TIMEOUT = 30000;
const SSH_ERROR_CODES = { ... };

// 变量: camelCase
const serverConfig = {};
let activeConnection = null;

// 文件名: kebab-case
// ssh-manager.ts, command-executor.ts
```

#### TypeScript 规范

```typescript
// 1. 显式类型声明（避免 any）
function exec(command: string, options: ExecOptions): Promise<ExecResult> {}

// 2. 使用 Zod 进行运行时验证
const ExecSchema = z.object({
  command: z.string().min(1),
  timeout: z.number().optional(),
});

// 3. 错误处理使用自定义错误类
throw new SSHError(SSHErrorCode.CONNECTION_FAILED, '连接失败');

// 4. 异步操作使用 async/await
async function connect(): Promise<void> {
  try {
    await client.connect(config);
  } catch (error) {
    throw new SSHError(SSHErrorCode.CONNECTION_FAILED, error.message);
  }
}

// 5. 使用 readonly 保护不可变数据
interface Config {
  readonly host: string;
  readonly port: number;
}
```

#### 注释规范

```typescript
/**
 * SSH 连接管理器
 * 负责管理 SSH 连接的生命周期，包括连接池、重连、空闲检测等
 */
export class SSHManager {
  /**
   * 建立 SSH 连接
   * @param config - 连接配置
   * @returns 连接成功返回 true
   * @throws SSHError 连接失败时抛出
   */
  async connect(config: ConnectionConfig): Promise<boolean> {
    // 检查连接池是否已满
    if (this.connections.size >= this.maxConnections) {
      throw new SSHError(SSHErrorCode.MAX_CONNECTIONS, '连接池已满');
    }
    // ...
  }
}
```

### 安全规范

#### 危险命令检测

所有命令执行必须经过危险命令检测：

```typescript
// 危险命令模式（src/tools/exec.ts）
const DANGEROUS_PATTERNS = [
  { pattern: /rm\s+(-[rf]+\s+)*\/\*/, desc: '删除根目录' },
  { pattern: /mkfs\s/, desc: '格式化磁盘' },
  // ...
];

// 执行前检测
const danger = detectDangerousCommand(command);
if (danger && !confirmed) {
  return { warning: `危险命令: ${danger}`, requireConfirmation: true };
}
```

#### 凭证安全

1. **优先使用系统 Keychain**：macOS Keychain、Windows Credential Manager
2. **降级方案**：AES-256-GCM 加密文件存储
3. **禁止明文存储**：密码、私钥等敏感信息必须加密

#### 日志脱敏

```typescript
// 自动脱敏敏感信息
private maskCommand(command: string): string {
  return command.replace(/echo\s+'[^']*'\s*\|\s*sudo/g, "echo '***' | sudo");
}
```

### 错误处理规范

```typescript
// 使用统一的错误码
export enum SSHErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  AUTH_FAILED = 'AUTH_FAILED',
  COMMAND_TIMEOUT = 'COMMAND_TIMEOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_CONNECTED = 'NOT_CONNECTED',
}

// 自定义错误类
export class SSHError extends Error {
  constructor(
    public code: SSHErrorCode,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'SSHError';
  }
}

// 错误处理
try {
  await executor.exec(command);
} catch (error) {
  if (error instanceof SSHError) {
    logger.error({ code: error.code, message: error.message });
  }
  throw error;
}
```

### 测试规范

#### 单元测试

```typescript
// test/unit/command-executor.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('CommandExecutor', () => {
  it('should execute command successfully', async () => {
    const result = await executor.exec('echo hello');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello');
  });

  it('should detect dangerous command', async () => {
    const result = await execTools.exec({ command: 'rm -rf /' });
    expect(result.requireConfirmation).toBe(true);
  });
});
```

#### 集成测试

```typescript
// test/integration.test.ts
describe('SSH Integration', () => {
  it('should connect and execute command', async () => {
    await sshManager.connect(testConfig);
    const result = await executor.exec('whoami');
    expect(result.exitCode).toBe(0);
  });
});
```

### Git 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

#### 类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关
- `ci`: CI 配置
- `security`: 安全相关

#### 示例

```bash
feat(exec): 添加危险命令检测和确认机制
fix(ssh): 修复连接超时后未正确清理的问题
docs: 更新 README 添加安全说明
security: 增强凭证存储加密强度
```

### 版本发布规范

遵循 [Semantic Versioning](https://semver.org/)：

- **MAJOR** (x.0.0): 不兼容的 API 变更
- **MINOR** (0.x.0): 向后兼容的新功能
- **PATCH** (0.0.x): 向后兼容的 Bug 修复

#### 发布流程

1. 更新 `CHANGELOG.md`
2. 执行 `npm version <major|minor|patch>`
3. 推送代码和 tag: `git push && git push --tags`
4. CI 自动发布到 npm 和 GitHub Releases

---

## MCP 工具开发指南

### 添加新工具

1. **定义 Schema**（src/tools/xxx.ts）：

```typescript
export const NewToolSchema = z.object({
  param1: z.string().min(1, '参数不能为空'),
  param2: z.number().optional(),
});
```

2. **实现处理器**：

```typescript
export class NewTools {
  async newTool(params: NewToolParams): Promise<Result> {
    // 实现逻辑
  }
}
```

3. **注册工具**（src/index.ts）：

```typescript
// ListToolsRequest 中添加工具定义
{
  name: 'new_tool',
  description: '工具描述',
  inputSchema: { ... },
}

// CallToolRequest 中添加处理
case 'new_tool': {
  const params = NewToolSchema.parse(args);
  return await newTools.newTool(params);
}
```

### 安全检查清单

新增工具时必须检查：

- [ ] 输入参数使用 Zod 验证
- [ ] 敏感操作添加危险检测
- [ ] 日志记录已脱敏
- [ ] 错误信息不泄露敏感数据
- [ ] 添加对应的单元测试

---

## 常见问题

### Q: 如何调试 MCP Server？

设置环境变量开启详细日志：

```bash
SSH_MCP_LOG_LEVEL=debug npx @erliban/ssh-mcp-server
```

### Q: 如何添加新的危险命令模式？

编辑 `src/tools/exec.ts` 中的 `DANGEROUS_PATTERNS` 数组：

```typescript
{ pattern: /your-pattern/, desc: '危险描述' },
```

### Q: 如何运行测试？

```bash
npm test              # 单元测试
npm run test:integration  # 集成测试（需要 SSH 环境）
npm run test:all      # 所有测试
```

---

## 参考链接

- [MCP 协议文档](https://modelcontextprotocol.io/)
- [ssh2 库文档](https://github.com/mscdex/ssh2)
- [Zod 文档](https://zod.dev/)
- [Vitest 文档](https://vitest.dev/)
