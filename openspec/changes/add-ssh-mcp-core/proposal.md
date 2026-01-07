# Change: 实现 SSH MCP Server 核心功能

## Why
现有的 SSH MCP 方案（ssh-mcp、claude-ssh-server）功能分散，缺乏完整的企业级特性：
- 没有 SFTP 文件传输支持
- 没有多服务器管理能力
- 没有凭证安全存储
- 没有操作审计日志
- 缺乏连接池和复用机制

我们需要一个功能完善、安全可靠的 SSH MCP Server，同时兼容 Claude 和 Codex 等主流 AI 助手。

## What Changes

### 新增能力
- **SSH 连接管理**: 支持密码/密钥认证，连接池复用
- **命令执行**: exec、sudo-exec、批量执行
- **SFTP 操作**: 上传、下载、列目录、删除、创建目录
- **服务器管理**: 保存/列出/删除服务器配置
- **凭证存储**: 系统 keychain 加密存储
- **审计日志**: 记录所有操作及结果

### MCP Tools 设计
```
连接管理: connect, disconnect, list_servers, save_server, remove_server
命令执行: exec, exec_sudo, exec_batch
SFTP:    sftp_ls, sftp_upload, sftp_download, sftp_mkdir, sftp_rm
系统:    health_check, get_logs
```

## Impact
- **新建 specs**:
  - `ssh-connection` - SSH 连接能力
  - `command-execution` - 命令执行能力
  - `sftp-operations` - SFTP 文件操作
  - `server-management` - 服务器配置管理
  - `credential-storage` - 凭证安全存储
  - `audit-logging` - 操作审计日志

- **依赖**:
  - @modelcontextprotocol/sdk
  - ssh2
  - keytar
  - zod
  - pino

- **兼容性**:
  - Claude Desktop
  - Claude Code
  - OpenAI Codex
  - 其他 MCP 兼容客户端
