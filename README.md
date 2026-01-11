# SSH MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![npm version](https://img.shields.io/npm/v/@erliban/ssh-mcp-server.svg)](https://www.npmjs.com/package/@erliban/ssh-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@erliban/ssh-mcp-server.svg)](https://www.npmjs.com/package/@erliban/ssh-mcp-server)

**🔐 A secure remote server management tool based on MCP protocol, supporting SSH connections, command execution, and SFTP file transfers.**

[English](README.md) | [中文](README_CN.md)

---

## 🚀 Features

- 🔗 **SSH Connection Management** - Password/key authentication with connection pooling
- ⚡ **Command Execution** - Regular commands, sudo commands, batch execution
- 📁 **SFTP Operations** - Upload, download, list directories, create/delete files
- 💾 **Server Management** - Save/list/remove server configurations
- 🔒 **Credential Security** - System Keychain encrypted storage (macOS/Windows/Linux)
- 📝 **Audit Logging** - Records all operations with sensitive data masking

---

## 📦 Quick Start

### Option 1: Run with npx (Recommended)

```bash
npx @erliban/ssh-mcp-server
```

### Option 2: Global Installation

```bash
npm install -g @erliban/ssh-mcp-server
ssh-mcp-server
```

### Option 3: Build from Source

```bash
git clone https://github.com/jiahuidegit/ssh-mcp-server.git
cd ssh-mcp-server
npm install
npm run build
```

---

## 🔄 Update to Latest Version

### If using npx (Recommended)

npx automatically uses the latest version, just restart your MCP client:

```bash
# No manual update needed, npx always fetches latest
npx @erliban/ssh-mcp-server
```

### If globally installed

```bash
# Update to latest version
npm update -g @erliban/ssh-mcp-server

# Or reinstall
npm install -g @erliban/ssh-mcp-server@latest
```

### Check current version

```bash
npm list -g @erliban/ssh-mcp-server
```

---

## 🎮 MCP Client Configuration

This server supports all MCP-compatible clients. Here's an example with Claude Desktop:

Edit the configuration file:

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

> For other MCP clients, please refer to their respective documentation for configuration methods.

---

## ⚙️ Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SSH_MCP_LOG_LEVEL` | Log level (debug/info/warn/error) | `info` |
| `SSH_MCP_LOG_FILE` | Log file path | stderr |
| `SSH_MCP_CONN_TIMEOUT` | Connection timeout (ms) | `30000` |
| `SSH_MCP_CMD_TIMEOUT` | Command timeout (ms) | `60000` |
| `SSH_MCP_IDLE_TIMEOUT` | Idle connection timeout (ms) | `300000` |
| `SSH_MCP_MAX_CONNECTIONS` | Maximum connections | `10` |
| `SSH_MCP_DATA_DIR` | Data directory | `~/.ssh-mcp` |
| `SSH_MCP_MASTER_PASSWORD` | Master password for file storage | - |

---

## 🛠️ MCP Tools

### Connection Management

| Tool | Description |
|------|-------------|
| `connect` | Establish SSH connection (password/key auth) |
| `disconnect` | Disconnect specific or all connections |

### Server Management

| Tool | Description |
|------|-------------|
| `save_server` | Save server configuration locally |
| `list_servers` | List saved servers (supports group filtering) |
| `remove_server` | Remove server configuration |

### Command Execution

| Tool | Description |
|------|-------------|
| `exec` | Execute remote command |
| `exec_sudo` | Execute with sudo privileges |
| `exec_batch` | Batch execute on multiple servers |

### SFTP Operations

| Tool | Description |
|------|-------------|
| `sftp_ls` | List directory contents |
| `sftp_upload` | Upload file |
| `sftp_download` | Download file |
| `sftp_mkdir` | Create directory |
| `sftp_rm` | Delete file or directory |

### System Tools

| Tool | Description |
|------|-------------|
| `health_check` | Check connection status |
| `get_logs` | Get audit logs |

---

## 💡 Usage Examples

### Connect and Execute Command

```
User: Connect to 192.168.1.100 with username root and password 123456

Claude: [calls connect tool]
Connected to root@192.168.1.100:22

User: Check system load

Claude: [calls exec tool]
10:30:01 up 45 days, 2:15, 1 user, load average: 0.15, 0.10, 0.05
```

### Upload Deployment File

```
User: Upload local /tmp/app.jar to server's /opt/app/

Claude: [calls sftp_upload tool]
Uploaded /tmp/app.jar -> /opt/app/app.jar
```

### Batch Check Server Status

```
User: Check disk usage on all production servers

Claude: [calls list_servers, then exec_batch]
Server 10.0.0.1: 45% used
Server 10.0.0.2: 62% used
Server 10.0.0.3: 78% used ⚠️
```

---

## 🔒 Security Notes

1. **Credential Storage** - Prefers system Keychain (macOS Keychain, Windows Credential Manager). Falls back to AES-256-GCM encrypted file storage when no desktop environment is available.
2. **Log Masking** - Passwords, private keys, and other sensitive information are automatically masked.
3. **Dangerous Commands** - Operations like deleting system root directory are prohibited.
4. **Connection Pool** - Automatically cleans up idle connections to prevent resource leaks.

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

## 🤝 Contributing

Issues and Pull Requests are welcome!

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

**⭐ If you find this project helpful, please give it a star!**

**🤝 Feel free to open issues for questions or submit PRs for improvements!**
