# 贡献指南 | Contributing Guide

[English](#english) | [中文](#中文)

---

## 中文

感谢你对 SSH MCP Server 的关注！我们欢迎任何形式的贡献。

### 🚀 快速开始

#### 1. Fork 并克隆项目

```bash
git clone https://github.com/YOUR_USERNAME/ssh-mcp-server.git
cd ssh-mcp-server
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 创建开发分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

#### 4. 开发与测试

```bash
# 编译 TypeScript
npm run build

# 运行单元测试
npm test

# 运行集成测试（需要 Docker）
npm run test:integration

# 代码检查
npm run lint

# 代码格式化
npm run format
```

### 📝 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Type 类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构（不是新功能也不是修复） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建过程或辅助工具变动 |
| `ci` | CI 配置变更 |

#### 示例

```bash
feat(exec): 添加命令执行超时重试机制
fix(sftp): 修复大文件上传进度显示不准确
docs: 更新 README 安装说明
test(connection): 添加连接池边界测试用例
```

### 🔀 Pull Request 流程

1. **确保测试通过**
   ```bash
   npm test
   npm run lint
   ```

2. **更新文档**（如有必要）
   - 更新 README.md / README_CN.md
   - 更新 CHANGELOG.md

3. **提交 PR**
   - 使用清晰的标题描述变更
   - 在描述中说明变更内容和原因
   - 关联相关 Issue（如有）

4. **代码审查**
   - 等待维护者审查
   - 根据反馈进行修改
   - 审查通过后合并

### 🐛 报告 Bug

提交 Issue 时请包含：

1. **环境信息**
   - Node.js 版本
   - 操作系统
   - ssh-mcp-server 版本

2. **问题描述**
   - 期望行为
   - 实际行为
   - 复现步骤

3. **相关日志**（如有）

### 💡 功能建议

提交功能建议时请说明：

1. 功能描述
2. 使用场景
3. 预期实现方式（可选）

### 📋 开发规范

请参阅 [CLAUDE.md](CLAUDE.md) 了解详细的开发规范，包括：

- 代码风格
- TypeScript 最佳实践
- 安全规范
- 错误处理
- 测试要求

### 🔒 安全问题

如果发现安全漏洞，请**不要**公开提交 Issue。

请发送邮件至项目维护者，我们会尽快处理。

### 📄 许可证

贡献的代码将遵循项目的 [MIT 许可证](LICENSE)。

---

## English

Thank you for your interest in SSH MCP Server! We welcome contributions of all kinds.

### 🚀 Quick Start

#### 1. Fork and Clone

```bash
git clone https://github.com/YOUR_USERNAME/ssh-mcp-server.git
cd ssh-mcp-server
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

#### 4. Develop and Test

```bash
# Build TypeScript
npm run build

# Run unit tests
npm test

# Run integration tests (requires Docker)
npm run test:integration

# Lint code
npm run lint

# Format code
npm run format
```

### 📝 Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Code style (no functional changes) |
| `refactor` | Refactoring |
| `perf` | Performance improvement |
| `test` | Testing |
| `chore` | Build process or tooling |
| `ci` | CI configuration |

#### Examples

```bash
feat(exec): add command execution timeout retry
fix(sftp): fix large file upload progress display
docs: update README installation guide
test(connection): add connection pool edge case tests
```

### 🔀 Pull Request Process

1. **Ensure tests pass**
   ```bash
   npm test
   npm run lint
   ```

2. **Update documentation** (if needed)
   - Update README.md / README_CN.md
   - Update CHANGELOG.md

3. **Submit PR**
   - Use a clear title describing the change
   - Explain what and why in the description
   - Link related Issues (if any)

4. **Code Review**
   - Wait for maintainer review
   - Address feedback
   - Merge after approval

### 🐛 Reporting Bugs

When submitting an issue, include:

1. **Environment**
   - Node.js version
   - Operating system
   - ssh-mcp-server version

2. **Description**
   - Expected behavior
   - Actual behavior
   - Steps to reproduce

3. **Logs** (if applicable)

### 💡 Feature Requests

When suggesting features, include:

1. Feature description
2. Use case
3. Proposed implementation (optional)

### 📋 Development Guidelines

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines:

- Code style
- TypeScript best practices
- Security standards
- Error handling
- Testing requirements

### 🔒 Security Issues

If you discover a security vulnerability, please **do not** open a public issue.

Email the maintainers directly. We will address it promptly.

### 📄 License

Contributions are licensed under the project's [MIT License](LICENSE).
