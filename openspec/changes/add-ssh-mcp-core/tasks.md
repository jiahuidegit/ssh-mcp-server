# Implementation Tasks

## 1. 项目初始化
- [x] 1.1 初始化 npm 项目（package.json）
- [x] 1.2 配置 TypeScript（tsconfig.json）
- [x] 1.3 配置 ESLint + Prettier
- [x] 1.4 安装核心依赖（@modelcontextprotocol/sdk, ssh2, keytar, zod, pino）
- [x] 1.5 创建目录结构

## 2. 核心模块实现
- [x] 2.1 SSH 连接管理器（src/core/ssh-manager.ts）
  - [x] 2.1.1 密码认证连接
  - [x] 2.1.2 密钥认证连接
  - [x] 2.1.3 连接池管理
  - [x] 2.1.4 连接超时处理
- [x] 2.2 命令执行器（src/core/command-executor.ts）
  - [x] 2.2.1 普通命令执行
  - [x] 2.2.2 Sudo 命令执行
  - [x] 2.2.3 批量命令执行
  - [x] 2.2.4 超时和安全限制
- [x] 2.3 SFTP 操作器（src/core/sftp-operator.ts）
  - [x] 2.3.1 列目录
  - [x] 2.3.2 上传文件
  - [x] 2.3.3 下载文件
  - [x] 2.3.4 创建/删除目录和文件

## 3. 存储模块实现
- [x] 3.1 凭证存储（src/storage/credential-store.ts）
  - [x] 3.1.1 Keychain 集成（keytar）
  - [x] 3.1.2 备用加密文件存储
- [x] 3.2 服务器配置存储（src/storage/server-store.ts）
  - [x] 3.2.1 服务器配置 CRUD
  - [x] 3.2.2 分组管理

## 4. 日志模块实现
- [x] 4.1 审计日志（src/logging/audit-logger.ts）
  - [x] 4.1.1 操作日志记录
  - [x] 4.1.2 敏感信息脱敏
  - [x] 4.1.3 日志查询接口

## 5. MCP 工具层实现
- [x] 5.1 MCP Server 入口（src/index.ts）
- [x] 5.2 连接管理工具（src/tools/connection.ts）
  - [x] connect, disconnect
- [x] 5.3 服务器管理工具（src/tools/server.ts）
  - [x] list_servers, save_server, remove_server
- [x] 5.4 命令执行工具（src/tools/exec.ts）
  - [x] exec, exec_sudo, exec_batch
- [x] 5.5 SFTP 工具（src/tools/sftp.ts）
  - [x] sftp_ls, sftp_upload, sftp_download, sftp_mkdir, sftp_rm
- [x] 5.6 系统工具（src/tools/system.ts）
  - [x] health_check, get_logs

## 6. 测试
- [x] 6.1 单元测试
  - [x] 工具函数测试 (utils.test.ts)
  - [x] 类型验证测试 (types.test.ts)
  - [x] 服务器存储测试 (server-store.test.ts)
  - [x] 审计日志测试 (audit-logger.test.ts)
  - [x] SSH 管理器测试 (ssh-manager.test.ts, mock)
- [x] 6.2 集成测试
  - [x] 使用 testcontainers 创建 SSH 容器
  - [x] 端到端测试各工具

## 7. 文档和发布
- [x] 7.1 编写 README.md
- [x] 7.2 编写 API 文档（包含在 README 中）
- [x] 7.3 添加使用示例
- [x] 7.4 配置 npm 发布
- [x] 7.5 配置 GitHub Actions CI/CD
