# Project Context

## Purpose
ssh-mcp-server 是一个功能完善的 SSH MCP Server，让 AI 助手（Claude、Codex 等）能够安全地连接和管理远程服务器。

**核心目标：**
- 提供标准 MCP 协议的 SSH 连接能力
- 支持多种认证方式（密码、密钥）
- 支持 SFTP 文件操作
- 支持多服务器管理
- 凭证安全存储
- 操作审计日志

## Tech Stack
- **语言**: TypeScript (ES Module)
- **运行时**: Node.js >= 18
- **核心依赖**:
  - `@modelcontextprotocol/sdk` - 官方 MCP SDK
  - `ssh2` - SSH 连接库
  - `zod` - 参数校验
  - `keytar` - 系统 keychain 凭证存储
  - `pino` - 日志

## Project Conventions

### Code Style
- 使用 ESLint + Prettier
- CSS 类名使用小驼峰（camelCase）
- 变量/函数使用小驼峰，类使用大驼峰
- 关键代码添加注释，简单代码无需注释
- 优先使用 async/await 而非回调

### Architecture Patterns
- 单一职责：每个模块只做一件事
- 依赖注入：便于测试
- 错误优先：所有操作都考虑错误处理
- 配置外置：敏感信息不硬编码

### Testing Strategy
- 单元测试：vitest
- 集成测试：testcontainers（SSH 容器）
- 覆盖率目标：>80%

### Git Workflow
- 主分支：main
- 功能分支：feat/xxx
- 修复分支：fix/xxx
- Commit 规范：Conventional Commits

## Domain Context

### MCP (Model Context Protocol)
- Anthropic 推出的标准协议
- 允许 AI 助手与外部工具交互
- 通过 stdio 或 HTTP 传输
- 定义 Tools、Resources、Prompts 三种能力

### SSH 认证方式
- 密码认证：简单但不够安全
- 密钥认证：推荐，更安全
- 支持 SSH Agent 转发

### 安全考量
- 凭证不能明文存储
- 操作需要审计日志
- 支持超时和命令长度限制
- 可禁用危险操作（如 sudo）

## Important Constraints
- 必须兼容 Claude Desktop、Claude Code、OpenAI Codex
- 遵循 MCP 协议规范
- 不依赖特定操作系统（跨平台）
- 敏感信息不上传到任何第三方

## External Dependencies
- MCP SDK: https://github.com/modelcontextprotocol/typescript-sdk
- ssh2: https://github.com/mscdex/ssh2
- keytar: https://github.com/atom/node-keytar
