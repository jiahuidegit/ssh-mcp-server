# 变更日志 | Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范。

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.6.0] - 2026-02-01

### Added
- 🎯 **服务器身份识别系统** - 彻底解决 AI 无法分辨连接服务器的严重安全问题
  - 命令执行结果 `ExecResult` 增加 `server` 字段，包含完整服务器身份信息（host、port、username、environment、alias）
  - 服务器配置增加 `environment` 字段，支持标注环境类型（production/staging/test/development）
  - 服务器配置增加 `description` 字段，用于备注说明
  - 新增 `list_active_connections` 工具 - 列出所有活跃连接及其环境标签，方便 AI 随时查看当前连接状态

### Changed
- 🔒 **生产环境增强保护** - 危险命令检测增加环境识别
  - 生产环境执行危险命令时显示醒目的 🚨 警告标识
  - 命令执行结果自动标注执行环境（`[执行环境: 🔴 PRODUCTION]`）
  - 批量执行命令时检测是否包含生产环境服务器
  - 所有命令工具（exec、exec_sudo、exec_batch、exec_shell）均增加环境提示
- 📝 **优化工具描述防止 AI 误操作** - MCP 工具描述全面优化，引导 AI 正确识别服务器
  - `exec`/`exec_sudo`/`exec_shell` 工具描述强调：执行前先调用 `list_active_connections` 确认服务器
  - `host` 参数描述明确说明：有多个活跃连接时必须明确指定服务器
  - `exec_batch` 工具特别警告：批量操作风险极高，包含生产环境时会有特别提示
  - 所有工具 schema 统一改为 `confirmationToken` 机制，废弃 `confirmed`/`overwrite` 参数
  - 命令执行工具描述中明确说明返回值包含服务器身份信息（server.host、server.environment、server.alias）

### Security
- ✅ **防止误操作生产服务器** - AI 现在可以清楚知道自己连接的是哪个服务器
  - 每个命令返回值都包含服务器身份信息
  - 生产环境危险命令需要二次确认并显示特殊警告
  - AI 可通过 `list_active_connections` 主动检查当前连接状态
  - 🚨 **多连接强制指定服务器（彻底防止混淆）** - 当有多个活跃 SSH 连接时，所有操作都必须明确指定 host 和 username
    - 影响范围：`exec`、`exec_sudo`、`exec_batch`、`exec_shell`、`shell_send`、`shell_read`、`shell_close`、SFTP 操作
    - 错误信息会列出所有活跃连接及其环境标签（production/staging/test），帮助 AI 识别正确的服务器
    - 只有当仅有一个活跃连接时，才允许省略服务器参数使用默认连接
    - 彻底杜绝 AI 以为在测试服务器实则在生产服务器执行命令的严重安全隐患
- 🛡️ **服务器配置删除保护** - 防止误删生产服务器配置
  - `remove_server` 增加 `confirmationToken` 参数，删除生产环境服务器必须明确确认
  - 删除前显示完整的服务器信息和环境标签
  - 删除任何服务器配置都需要确认（非生产环境也会警告）
- 🛡️ **服务器配置覆盖保护** - 防止意外覆盖现有配置
  - `save_server` 增加 `confirmationToken` 参数，覆盖现有配置需要明确确认
  - 覆盖前对比显示现有配置和新配置的差异
  - 覆盖生产环境配置需要更严格的确认
- 📝 **凭证操作审计日志** - 所有敏感凭证操作均记录审计日志
  - 记录凭证保存操作（新增/更新）
  - 记录凭证删除操作（高风险，使用 warn 级别）
  - 记录凭证读取失败
  - 审计日志包含操作类型、存储方式、凭证类型（不记录实际内容）
- 🔐 **确认 Token 机制** - 彻底防止 AI 绕过安全检查
  - 替换所有 `confirmed` 参数为 `confirmationToken` 机制
  - Token 由服务端生成，AI 无法伪造
  - Token 有 5 分钟有效期，过期自动失效
  - Token 一次性使用，验证后立即销毁
  - Token 绑定操作类型和参数哈希，防止参数篡改
  - 影响工具：`exec`、`exec_sudo`、`exec_batch`、`exec_shell`、`shell_send`、`save_server`、`remove_server`
- 🛡️ **shell_send 危险命令检测** - 修复可绕过 exec 保护的严重漏洞
  - `shell_send` 现在也会检测危险命令
  - 与 `exec` 使用相同的 token 确认机制
  - 防止 AI 通过交互式 shell 绕过安全检查
- 🔍 **全面的危险命令检测模式** - 从 15 个基础模式扩展到 60+ 个全面覆盖的模式
  - **容器操作**（10个模式）：Docker 批量删除、镜像清理、系统清理；Kubernetes 删除命名空间/部署/服务
  - **数据库操作**（8个模式）：MySQL DROP DATABASE/TABLE、PostgreSQL TRUNCATE/DROP、MongoDB dropDatabase、Redis FLUSHALL/FLUSHDB
  - **服务管理**（6个模式）：systemctl stop/disable/mask、pm2 delete all、supervisorctl stop all
  - **包管理器**（4个模式）：npm uninstall -g、pip uninstall、apt/yum remove/purge
  - **Git 操作**（4个模式）：push --force、reset --hard、clean -f、branch -D
  - **网络操作**（4个模式）：iptables 清空规则、防火墙禁用、网络接口关闭
  - **系统操作**（15个模式）：删除根目录、格式化磁盘、chmod 777、Fork 炸弹、关机重启等
  - 涵盖生产环境中最常见的破坏性操作场景，防止 AI 误操作容器、数据库、服务

### Technical Details
- 新增文件：
  - `src/utils/confirmation-manager.ts` - 确认 Token 管理器
- 修改文件：
  - `src/types/index.ts` - 新增 `ServerIdentity` 接口，扩展 `ExecResult`、`ServerConfig`、`ConnectOptions`
  - `src/core/ssh-manager.ts` - 新增 `getServerIdentity()` 方法缓存并返回服务器身份
  - `src/core/command-executor.ts` - 所有命令执行方法返回值附加 `server` 字段
  - `src/tools/connection.ts` - 连接时传递 alias 和 environment，新增 `listActiveConnections()` 方法
  - `src/tools/server.ts` - 保存服务器时支持 environment 和 description 字段，使用 token 确认机制
  - `src/tools/exec.ts` - 所有命令工具使用 token 确认机制，shell_send 增加危险命令检测
  - `src/storage/credential-store.ts` - 增加 AuditLogger 集成，记录所有凭证操作
  - `src/index.ts` - 初始化 ConfirmationManager，传递给所有需要确认的工具

---

## [0.5.0] - 2026-01-21

### Added
- 🔗 **持久化 Shell 会话 / Persistent Shell Session** - 支持多轮交互场景
  - 新增 `shell_send` 工具 - 发送输入到持久化 shell 会话
  - 新增 `shell_read` 工具 - 读取 shell 输出缓冲区
  - 新增 `shell_close` 工具 - 关闭 shell 会话
  - 支持堡垒机穿透后的多步认证（输入用户名、密码等）
  - Shell 会话自动管理，复用已有会话
  - 新增 `ShellSession` 接口管理会话状态
  - 改动文件：
    - `src/core/ssh-manager.ts` - 新增 shell 会话管理功能
    - `src/tools/exec.ts` - 新增 3 个工具处理器
    - `src/index.ts` - 注册新工具

---

## [0.4.0] - 2026-01-21

### Added
- 🔗 **Shell 模式执行 / Shell Mode Execution** - 新增 `exec_shell` 工具
  - 通过交互式 PTY shell 执行命令，用于不支持 exec 模式的堡垒机
  - Uses interactive PTY shell to execute commands for bastion hosts that don't support exec mode
  - 支持自定义提示符正则表达式 `promptPattern`
  - 自动识别命令结束，解析退出码
  - 新增文件：
    - `src/core/command-executor.ts` - 新增 `execShell()` 和 `executeCommandShell()` 方法
    - `src/tools/exec.ts` - 新增 `ExecShellSchema` 和 `execShell()` 处理器
    - `src/index.ts` - 注册 `exec_shell` 工具

---

## [0.3.1] - 2026-01-16

### Added
- 💡 **错误提示增强** - 所有 SSH 错误现在包含中英文对照的解决方案提示
  - 新增 `src/errors/error-solutions.ts` 模块
  - 8 个错误码均提供详细的解决建议
  - 支持 `SSH_CONN_FAILED`、`SSH_AUTH_FAILED`、`SSH_CMD_TIMEOUT` 等所有错误类型
- 📖 **npm 文档完善** - package.json 添加 `repository`、`homepage`、`bugs` 字段
- ⭐ **GitHub Star 徽章** - README 添加 Star 徽章，鼓励用户支持项目

### Changed
- 🔧 **错误处理重构** - 使用统一的 `formatErrorWithSolution()` 函数格式化错误信息

---

## [0.3.0] - 2026-01-15

### Fixed
- 🐛 **修复重连失败问题** - 解决连接断开后 `reconnect()` 报错"配置不存在"的问题

### Changed
- ⚡ **架构优化：配置与状态分离** - 将连接配置和连接状态完全分离
  - 新增独立的 `configCache` 缓存连接配置
  - 连接断开时仅清理连接状态，保留配置信息
  - 支持断开后任意时间重连，无需重新输入密码/私钥
- 📦 **新增配置管理 API**:
  - `getCachedConfig()` - 获取缓存的连接配置
  - `listCachedConfigs()` - 列出所有缓存配置
  - `clearConfigCache()` - 清除指定配置缓存
  - `clearAllConfigCache()` - 清空所有配置缓存
  - `getConfigCacheSize()` - 查看配置缓存大小

---

## [0.2.2] - 2025-01-11

### Added
- ⏱️ **长超时支持** - 新增 `longCommandTimeout` 配置，默认 30 分钟，适用于 docker build 等耗时操作
- 💓 **连接健康检查** - 新增心跳检测机制，每 30 秒自动检查连接状态
- 🔄 **自动重连功能** - 连接丢失后自动重连，支持指数退避重试策略（最多 3 次）
- 📊 **增强错误提示** - 超时和连接错误提供详细的解决建议

### Changed
- 🚀 **优化超时处理** - 命令超时不再立即销毁连接，支持连接状态检查
- 🔧 **改进连接管理** - 区分主动断开和异常断开，优化连接池清理逻辑
- 📝 **完善日志记录** - 增加健康检查、重连等关键操作的详细日志

### Fixed
- 🐛 修复命令超时后连接意外关闭导致的 `SSH_NOT_CONNECTED` 错误
- 🐛 修复长时间运行命令（如 docker build）超时问题

---

## [0.1.2] - 2025-01-08

### Added
- 添加项目开发规范文档
- 添加贡献指南 CONTRIBUTING.md
- 添加行为准则 CODE_OF_CONDUCT.md
- 添加 GitHub Issue/PR 模板
- 添加 .editorconfig 编辑器配置

### Changed
- 优化 CI/CD 流程，支持自动创建 Release

---

## [0.1.1] - 2025-01-08

### Added
- 🔒 **危险命令检测** - 新增危险命令识别机制，防止执行破坏性操作
  - 检测 `rm -rf /`、`mkfs`、`dd` 等危险命令
  - 检测 Fork 炸弹、shutdown/reboot 等系统命令
  - 危险命令需要用户明确确认（`confirmed: true`）才能执行
- 📝 完善项目文档
  - 新增英文 README.md
  - 新增中文 README_CN.md
  - 添加 Star History 图表
  - 添加 npm 版本和下载量徽章

### Changed
- 更改包名为 `@erliban/ssh-mcp-server`
- 更新 Node.js 最低版本要求为 20.x
- 优化 exec、exec_sudo、exec_batch 工具的返回类型

### Fixed
- 修复 ESLint 配置中缺少 Node.js 全局变量的问题

---

## [0.1.0] - 2025-01-07

### Added
- 🎉 **首次发布**
- 🔗 **SSH 连接管理**
  - 支持密码认证
  - 支持密钥认证（支持 passphrase）
  - 连接池自动复用
  - 空闲连接自动清理
- ⚡ **命令执行**
  - `exec` - 执行远程命令
  - `exec_sudo` - 以 sudo 权限执行命令
  - `exec_batch` - 多服务器批量执行
- 📁 **SFTP 操作**
  - `sftp_ls` - 列出目录内容
  - `sftp_upload` - 上传文件
  - `sftp_download` - 下载文件
  - `sftp_mkdir` - 创建目录
  - `sftp_rm` - 删除文件/目录
- 💾 **服务器管理**
  - `save_server` - 保存服务器配置
  - `list_servers` - 列出已保存服务器
  - `remove_server` - 删除服务器配置
- 🔒 **安全特性**
  - 系统 Keychain 加密存储凭证（macOS/Windows/Linux）
  - 无桌面环境时使用 AES-256-GCM 加密文件存储
  - 敏感信息自动脱敏日志
- 📝 **审计日志**
  - 记录所有操作
  - 支持按服务器、操作类型、日志级别过滤
- 🏥 **健康检查**
  - `health_check` - 检查连接状态

---

## 版本对比

- [Unreleased]: https://github.com/jiahuidegit/ssh-mcp-server/compare/v0.1.1...HEAD
- [0.1.1]: https://github.com/jiahuidegit/ssh-mcp-server/compare/v0.1.0...v0.1.1
- [0.1.0]: https://github.com/jiahuidegit/ssh-mcp-server/releases/tag/v0.1.0
