# SSH MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![npm version](https://img.shields.io/npm/v/@erliban/ssh-mcp-server.svg)](https://www.npmjs.com/package/@erliban/ssh-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@erliban/ssh-mcp-server.svg)](https://www.npmjs.com/package/@erliban/ssh-mcp-server)

**🔐 基于 MCP 协议的安全远程服务器管理工具，支持 SSH 连接、命令执行、SFTP 文件传输**

[English](README.md) | [中文](README_CN.md)

---

## 🚀 功能特性

- 🔗 **SSH 连接管理** - 密码/密钥认证，连接池自动复用
- ⚡ **命令执行** - 普通命令、sudo 命令、批量执行
- 📁 **SFTP 操作** - 上传、下载、列目录、创建/删除文件
- 💾 **服务器管理** - 保存/列出/删除服务器配置
- 🔒 **凭证安全** - 系统 Keychain 加密存储（macOS/Windows/Linux）
- 📝 **审计日志** - 记录所有操作，敏感信息自动脱敏

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

## 🎮 配置 Claude Desktop

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
| `exec` | 执行远程命令 |
| `exec_sudo` | 以 sudo 权限执行命令 |
| `exec_batch` | 在多台服务器上批量执行 |

### SFTP 操作

| 工具 | 说明 |
|------|------|
| `sftp_ls` | 列出目录内容 |
| `sftp_upload` | 上传文件 |
| `sftp_download` | 下载文件 |
| `sftp_mkdir` | 创建目录 |
| `sftp_rm` | 删除文件或目录 |

### 系统工具

| 工具 | 说明 |
|------|------|
| `health_check` | 检查连接状态 |
| `get_logs` | 获取审计日志 |

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

## 🔒 安全说明

1. **凭证存储** - 优先使用系统 Keychain（macOS Keychain、Windows 凭据管理器），无桌面环境时使用 AES-256-GCM 加密文件
2. **日志脱敏** - 密码、私钥等敏感信息自动脱敏
3. **危险命令** - 禁止删除系统根目录等危险操作
4. **连接池** - 自动清理空闲连接，避免资源泄漏

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
