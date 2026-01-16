# 变更日志 | Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范。

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
