# SSH MCP Server

[![GitHub Stars](https://img.shields.io/github/stars/jiahuidegit/ssh-mcp-server?style=social)](https://github.com/jiahuidegit/ssh-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![npm version](https://img.shields.io/npm/v/@erliban/ssh-mcp-server.svg)](https://www.npmjs.com/package/@erliban/ssh-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@erliban/ssh-mcp-server.svg)](https://www.npmjs.com/package/@erliban/ssh-mcp-server)

**A secure remote server management tool based on MCP protocol, supporting SSH connections, command execution, and SFTP file transfers.**

**The only MCP SSH tool that truly prevents AI from accidentally running commands on the wrong server.**

> If you find this project helpful, please give it a star on [GitHub](https://github.com/jiahuidegit/ssh-mcp-server)! Your support helps us improve!

[English](README.md) | [中文](README_CN.md)

---

## Why SSH MCP Server?

Managing remote servers with AI assistants is powerful -- but also dangerous. When multiple servers are connected, AI models frequently mix up which server they're operating on. One wrong `rm -rf` on a production server, and you're in trouble.

**SSH MCP Server is built from the ground up to solve this problem.** Every safety mechanism is enforced server-side with cryptographic tokens -- the AI cannot bypass them, no matter what.

### Safety guarantees other tools don't have:

- **Target Lock** -- Tracks which server the AI is currently operating on. If it tries to switch targets, it must confirm first. No silent mistakes.
- **Alias-based routing** -- Save servers with aliases like `us-prod` or `jp-staging`, then use `exec(alias: "us-prod")` instead of raw IPs. Harder to mix up.
- **Dangerous command detection** -- 60+ patterns covering Docker, Kubernetes, databases, system commands. All require cryptographic token confirmation.
- **Multi-connection enforcement** -- When multiple servers are connected, every operation MUST specify the target. No ambiguous defaults.
- **Environment labels** -- Mark servers as `production` / `staging` / `test`. Every command output shows which environment it ran on.

---

## Features

- **SSH Connection Management** - Password/key authentication with connection pooling
- **Command Execution** - Regular commands, sudo commands, batch execution, shell mode (bastion hosts)
- **SFTP Operations** - Upload, download, list directories, create/delete files
- **Server Management** - Save/list/remove server configurations with alias support
- **Credential Security** - System Keychain encrypted storage (macOS/Windows/Linux)
- **Audit Logging** - Records all operations with sensitive data masking
- **Persistent Shell Sessions** - Multi-round interaction for bastion host scenarios
- **Target Lock Protection** - Prevents AI from accidentally running commands on the wrong server

---

## What's New

### v0.7.0 (Latest)

- **Target Lock: Server Switch Protection** - The core safety feature for multi-server scenarios
  - Tracks the AI's current operation target; switching servers requires explicit confirmation with a cryptographic token
  - Single server: zero overhead. Multi-server, same target: zero overhead. Only triggers on actual target switch.
  - Works across all tools: exec, exec_sudo, exec_shell, shell_send, and all SFTP operations
  - If both target switch and dangerous command confirmations are needed, they run in sequence (switch first)
- **Alias Support for All Tools** - Use server aliases instead of raw host/port/username
  - `exec(alias: "us-prod", command: "ls")` -- routes to the saved server configuration
  - Available on all exec and SFTP tools via the new `alias` parameter
- **Server Environment Labels in All Outputs** - Every command result now shows `[Server: us-prod (root@1.2.3.4) | Env: PRODUCTION]`
  - No longer limited to production only -- all environments are labeled
- **SFTP Multi-Connection Safety** - SFTP operations now enforce the same multi-connection safety checks as command execution
  - SFTP results include `server` field with full identity information
- **Connect shows active connections** - When connecting a second server, the response lists all active connections as a reminder

### v0.6.0

- **Server Identity System** - Commands return full server identity (host, port, username, environment, alias)
- **Confirmation Token Mechanism** - Cryptographic tokens replace boolean flags; AI cannot forge confirmations
- **60+ Dangerous Command Patterns** - Docker, Kubernetes, databases, system services, Git, network, package managers
- **Multi-Connection Enforcement** - Must specify target when multiple connections are active

### v0.5.0

- **Persistent Shell Sessions** - `shell_send`, `shell_read`, `shell_close` for multi-round bastion host interaction

[View Full Changelog](CHANGELOG.md) | [All Releases](https://github.com/jiahuidegit/ssh-mcp-server/releases)

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
| `exec` | Execute remote command (supports alias routing) |
| `exec_sudo` | Execute with sudo privileges |
| `exec_batch` | Batch execute on multiple servers |
| `exec_shell` | Execute via interactive shell (for bastion hosts) |
| `shell_send` | Send input to persistent shell session |
| `shell_read` | Read shell session output buffer |
| `shell_close` | Close persistent shell session |

### SFTP Operations

| Tool | Description |
|------|-------------|
| `sftp_ls` | List directory contents (supports alias routing) |
| `sftp_upload` | Upload file |
| `sftp_download` | Download file |
| `sftp_mkdir` | Create directory |
| `sftp_rm` | Delete file or directory |

### System Tools

| Tool | Description |
|------|-------------|
| `health_check` | Check connection status |
| `get_logs` | Get audit logs |
| `list_active_connections` | List all active connections with environment labels |

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

## Security Notes

1. **Target Lock** - Tracks the AI's operation target; switching servers requires cryptographic token confirmation. Prevents the #1 cause of AI server misoperations.
2. **Credential Storage** - Prefers system Keychain (macOS Keychain, Windows Credential Manager). Falls back to AES-256-GCM encrypted file storage when no desktop environment is available.
3. **Log Masking** - Passwords, private keys, and other sensitive information are automatically masked.
4. **Dangerous Commands** - 60+ patterns detected. All require token confirmation. Production environments get extra warnings.
5. **Connection Pool** - Automatically cleans up idle connections to prevent resource leaks.
6. **Multi-Connection Safety** - When multiple servers are connected, every operation must explicitly specify the target server.

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
