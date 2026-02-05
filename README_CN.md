# SSH MCP Server

[![GitHub Stars](https://img.shields.io/github/stars/jiahuidegit/ssh-mcp-server?style=social)](https://github.com/jiahuidegit/ssh-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![npm version](https://img.shields.io/npm/v/@erliban/ssh-mcp-server.svg)](https://www.npmjs.com/package/@erliban/ssh-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@erliban/ssh-mcp-server.svg)](https://www.npmjs.com/package/@erliban/ssh-mcp-server)

**基于 MCP 协议的安全远程服务器管理工具，支持 SSH 连接、命令执行、SFTP 文件传输**

**唯一能真正防止 AI 在错误服务器上执行命令的 MCP SSH 工具。**

> 觉得有用？请在 [GitHub](https://github.com/jiahuidegit/ssh-mcp-server) 上点个 Star 支持一下！您的支持是我们前进的动力！

[English](README.md) | [中文](README_CN.md)

---

## 为什么选择 SSH MCP Server？

用 AI 助手管理远程服务器很强大 -- 但也很危险。当连接多台服务器时，AI 模型经常搞混当前操作的是哪台服务器。在生产服务器上误执行一个 `rm -rf`，后果不堪设想。

**SSH MCP Server 从底层架构就是为了解决这个问题而设计的。** 所有安全机制都在服务端通过加密 token 强制执行 -- AI 无法绕过，无论如何。

### 其他工具没有的安全保障：

- **目标锁定（Target Lock）** -- 追踪 AI 当前操作的服务器，切换目标时必须确认。不会悄悄犯错。
- **别名路由** -- 用别名（如 `us-prod`、`jp-staging`）保存服务器，然后用 `exec(alias: "us-prod")` 代替原始 IP。更难搞混。
- **危险命令检测** -- 60+ 种模式，覆盖 Docker、Kubernetes、数据库、系统命令。全部需要加密 token 确认。
- **多连接强制指定** -- 当连接多台服务器时，每个操作必须指定目标。没有模糊的默认行为。
- **环境标签** -- 给服务器标注 `production` / `staging` / `test`，每条命令输出都显示在哪个环境执行的。

---

## 功能特性

- **SSH 连接管理** - 密码/密钥认证，连接池自动复用
- **命令执行** - 普通命令、sudo 命令、批量执行、Shell 模式（堡垒机穿透）
- **SFTP 操作** - 上传、下载、列目录、创建/删除文件
- **服务器管理** - 保存/列出/删除服务器配置，支持别名路由
- **凭证安全** - 系统 Keychain 加密存储（macOS/Windows/Linux）
- **审计日志** - 记录所有操作，敏感信息自动脱敏
- **持久化 Shell 会话** - 支持堡垒机多轮交互
- **目标锁定保护** - 防止 AI 在错误的服务器上执行命令

---

## 最近更新

### v0.7.0（最新版）

- **目标锁定：服务器切换保护** - 多服务器场景的核心安全特性
  - 追踪 AI 当前操作目标，切换服务器时需要加密 token 确认
  - 单服务器：零开销。多服务器连续操作同一台：零开销。仅在实际切换时触发。
  - 覆盖所有工具：exec、exec_sudo、exec_shell、shell_send 以及所有 SFTP 操作
  - 如果同时需要切换确认和危险命令确认，分两轮执行（切换优先）
- **所有工具支持别名（alias）** - 用服务器别名代替原始 host/port/username
  - `exec(alias: "us-prod", command: "ls")` -- 自动路由到已保存的服务器配置
  - 所有 exec 和 SFTP 工具均支持新的 `alias` 参数
- **所有输出显示服务器环境标签** - 每条命令结果显示 `[服务器: us-prod (root@1.2.3.4) | 环境: PRODUCTION]`
  - 不再仅限生产环境 -- 所有环境都会标注
- **SFTP 多连接安全检查** - SFTP 操作现在与命令执行使用相同的多连接安全检查
  - SFTP 返回结果包含 `server` 字段，含完整身份信息
- **连接时显示活跃连接列表** - 连接第二台服务器时，返回信息列出所有活跃连接作为提醒

### v0.6.0

- **服务器身份识别系统** - 命令返回完整服务器身份（host、port、username、environment、alias）
- **确认 Token 机制** - 加密 token 替代布尔标志，AI 无法伪造确认
- **60+ 危险命令模式** - Docker、Kubernetes、数据库、系统服务、Git、网络、包管理器
- **多连接强制指定** - 多连接时必须指定目标

### v0.5.0

- **持久化 Shell 会话** - `shell_send`、`shell_read`、`shell_close` 支持堡垒机多轮交互

[查看完整更新日志](CHANGELOG.md) | [所有版本发布](https://github.com/jiahuidegit/ssh-mcp-server/releases)

---

## 📦 快速开始

### 方式一：npx 直接运行（推荐）

```bash
npx @erliban/ssh-mcp-server
```

### 方式二：全局安装

```bash
npm install -g @erliban/ssh-mcp-server
ssh-mcp-server
```

### 方式三：从源码构建

```bash
git clone https://github.com/jiahuidegit/ssh-mcp-server.git
cd ssh-mcp-server
npm install
npm run build
```

---

## 🔄 更新到最新版本

### 如果使用 npx（推荐）

npx 会自动使用最新版本，只需重启你的 MCP 客户端：

```bash
# 无需手动更新，npx 总是获取最新版本
npx @erliban/ssh-mcp-server
```

### 如果全局安装

```bash
# 更新到最新版本
npm update -g @erliban/ssh-mcp-server

# 或者重新安装
npm install -g @erliban/ssh-mcp-server@latest
```

### 查看当前版本

```bash
npm list -g @erliban/ssh-mcp-server
```

---

## 🎮 MCP 客户端配置

本服务器支持所有兼容 MCP 协议的客户端。以下是 Claude Desktop 的配置示例：

编辑配置文件：

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ssh": {
      "command": "npx",
      "args": ["-y", "@erliban/ssh-mcp-server"],
      "env": {
        "SSH_MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

> 其他 MCP 客户端的配置方法请参考各自的文档说明。

---

## ⚙️ 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SSH_MCP_LOG_LEVEL` | 日志级别 (debug/info/warn/error) | `info` |
| `SSH_MCP_LOG_FILE` | 日志文件路径 | stderr |
| `SSH_MCP_CONN_TIMEOUT` | 连接超时 (ms) | `30000` |
| `SSH_MCP_CMD_TIMEOUT` | 命令超时 (ms) | `60000` |
| `SSH_MCP_IDLE_TIMEOUT` | 空闲连接超时 (ms) | `300000` |
| `SSH_MCP_MAX_CONNECTIONS` | 最大连接数 | `10` |
| `SSH_MCP_DATA_DIR` | 数据目录 | `~/.ssh-mcp` |
| `SSH_MCP_MASTER_PASSWORD` | 文件存储主密码 | - |

---

## 🛠️ MCP 工具

### 连接管理

| 工具 | 说明 |
|------|------|
| `connect` | 建立 SSH 连接（支持密码/密钥认证） |
| `disconnect` | 断开指定或所有连接 |

### 服务器管理

| 工具 | 说明 |
|------|------|
| `save_server` | 保存服务器配置到本地 |
| `list_servers` | 列出已保存的服务器（支持分组过滤） |
| `remove_server` | 删除服务器配置 |

### 命令执行

| 工具 | 说明 |
|------|------|
| `exec` | 执行远程命令（支持别名路由） |
| `exec_sudo` | 以 sudo 权限执行命令 |
| `exec_batch` | 在多台服务器上批量执行 |
| `exec_shell` | 通过交互式 shell 执行（用于堡垒机穿透） |
| `shell_send` | 发送输入到持久化 shell 会话 |
| `shell_read` | 读取 shell 会话输出缓冲区 |
| `shell_close` | 关闭持久化 shell 会话 |

### SFTP 操作

| 工具 | 说明 |
|------|------|
| `sftp_ls` | 列出目录内容（支持别名路由） |
| `sftp_upload` | 上传文件 |
| `sftp_download` | 下载文件 |
| `sftp_mkdir` | 创建目录 |
| `sftp_rm` | 删除文件或目录 |

### 系统工具

| 工具 | 说明 |
|------|------|
| `health_check` | 检查连接状态 |
| `get_logs` | 获取审计日志 |
| `list_active_connections` | 列出所有活跃连接及环境标签 |

---

## 💡 使用示例

### 连接服务器并执行命令

```
用户: 连接到 192.168.1.100，用户名 root，密码 123456

Claude: [调用 connect 工具]
已连接到 root@192.168.1.100:22

用户: 查看系统负载

Claude: [调用 exec 工具]
10:30:01 up 45 days, 2:15, 1 user, load average: 0.15, 0.10, 0.05
```

### 上传部署文件

```
用户: 把本地的 /tmp/app.jar 上传到服务器的 /opt/app/

Claude: [调用 sftp_upload 工具]
已上传 /tmp/app.jar -> /opt/app/app.jar
```

### 批量检查服务器状态

```
用户: 检查所有生产服务器的磁盘使用情况

Claude: [调用 list_servers，然后 exec_batch]
服务器 10.0.0.1: 使用率 45%
服务器 10.0.0.2: 使用率 62%
服务器 10.0.0.3: 使用率 78% ⚠️
```

---

## 安全说明

1. **目标锁定** - 追踪 AI 操作目标，切换服务器时需要加密 token 确认。彻底防止 AI 服务器误操作这一头号安全隐患。
2. **凭证存储** - 优先使用系统 Keychain（macOS Keychain、Windows 凭据管理器），无桌面环境时使用 AES-256-GCM 加密文件
3. **日志脱敏** - 密码、私钥等敏感信息自动脱敏
4. **危险命令** - 60+ 种模式检测，全部需要 token 确认，生产环境有额外警告
5. **连接池** - 自动清理空闲连接，避免资源泄漏
6. **多连接安全** - 多服务器连接时，每个操作必须明确指定目标服务器

---

## 📊 Star History

<a href="https://star-history.com/#jiahuidegit/ssh-mcp-server&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=jiahuidegit/ssh-mcp-server&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=jiahuidegit/ssh-mcp-server&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=jiahuidegit/ssh-mcp-server&type=Date" />
 </picture>
</a>

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

---

**⭐ 如果这个项目对你有帮助，请给个 Star！**

**🤝 有问题欢迎提 Issue，有改进建议欢迎 PR！**
