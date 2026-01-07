# SSH MCP Server

[English](#english) | [中文](#中文)

---

<a id="english"></a>
## English

A secure remote server management tool based on the MCP (Model Context Protocol), supporting SSH connections, command execution, and SFTP file transfers.

### Features

- **SSH Connection Management**: Password/key authentication, connection pooling
- **Command Execution**: Regular commands, sudo commands, batch execution
- **SFTP Operations**: Upload, download, list directories, create/delete files
- **Server Management**: Save/list/remove server configurations
- **Credential Security**: System Keychain encrypted storage
- **Audit Logging**: Records all operations with sensitive data masking

### Installation

```bash
npm install ssh-mcp-server
```

Or build from source:

```bash
git clone <repo>
cd ssh-mcp-server
npm install
npm run build
```

### Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ssh": {
      "command": "node",
      "args": ["/path/to/ssh-mcp-server/dist/index.js"],
      "env": {
        "SSH_MCP_LOG_LEVEL": "info",
        "SSH_MCP_DATA_DIR": "~/.ssh-mcp"
      }
    }
  }
}
```

### Environment Variables

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

### MCP Tools

#### Connection Management

##### `connect`
Establish an SSH connection.

```json
{
  "alias": "my-server",
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "password": "xxx",
  "privateKey": "-----BEGIN...",
  "passphrase": "key-password"
}
```

##### `disconnect`
Disconnect from server.

```json
{
  "host": "192.168.1.100",
  "username": "root",
  "all": true
}
```

#### Server Management

##### `save_server`
Save server configuration.

```json
{
  "alias": "prod-web",
  "host": "10.0.0.1",
  "port": 22,
  "username": "deploy",
  "authType": "privateKey",
  "privateKey": "-----BEGIN...",
  "group": "production"
}
```

##### `list_servers`
List saved servers.

```json
{
  "group": "production"
}
```

##### `remove_server`
Remove server configuration.

```json
{
  "alias": "old-server"
}
```

#### Command Execution

##### `exec`
Execute remote command.

```json
{
  "command": "ls -la /var/log",
  "host": "10.0.0.1",
  "timeout": 30000,
  "cwd": "/home/user"
}
```

Response:
```json
{
  "stdout": "...",
  "stderr": "...",
  "exitCode": 0,
  "duration": 150
}
```

##### `exec_sudo`
Execute with sudo privileges.

```json
{
  "command": "systemctl restart nginx",
  "sudoPassword": "xxx"
}
```

##### `exec_batch`
Batch execute commands.

```json
{
  "command": "uptime",
  "servers": [
    { "host": "10.0.0.1", "username": "root" },
    { "host": "10.0.0.2", "username": "root" }
  ]
}
```

#### SFTP Operations

##### `sftp_ls`
List directory contents.

```json
{
  "path": "/var/log"
}
```

##### `sftp_upload`
Upload file.

```json
{
  "localPath": "/tmp/app.tar.gz",
  "remotePath": "/opt/app.tar.gz",
  "overwrite": true
}
```

##### `sftp_download`
Download file.

```json
{
  "remotePath": "/var/log/app.log",
  "localPath": "/tmp/app.log"
}
```

##### `sftp_mkdir`
Create directory.

```json
{
  "path": "/opt/myapp/logs",
  "recursive": true
}
```

##### `sftp_rm`
Delete file or directory.

```json
{
  "path": "/tmp/old-backup",
  "recursive": true
}
```

#### System Tools

##### `health_check`
Check connection status.

##### `get_logs`
Get audit logs.

```json
{
  "limit": 50,
  "server": "prod-web",
  "level": "error"
}
```

### Usage Examples

#### Connect and Execute Command

```
User: Connect to 192.168.1.100 with username root and password 123456

Claude: [calls connect tool]
Connected to root@192.168.1.100:22

User: Check system load

Claude: [calls exec tool, command: "uptime"]
10:30:01 up 45 days, 2:15, 1 user, load average: 0.15, 0.10, 0.05
```

#### Upload Deployment File

```
User: Upload local /tmp/app.jar to server's /opt/app/

Claude: [calls sftp_upload tool]
Uploaded /tmp/app.jar -> /opt/app/app.jar
```

#### Batch Check Server Status

```
User: Check disk usage on all production servers

Claude: [calls list_servers tool, group: "production"]
Found 3 servers

[calls exec_batch tool, command: "df -h"]
Server 10.0.0.1: 45% used
Server 10.0.0.2: 62% used
Server 10.0.0.3: 78% used ⚠️
```

### Security Notes

1. **Credential Storage**: Prefers system Keychain (macOS Keychain, Windows Credential Manager). Falls back to AES-256-GCM encrypted file storage when no desktop environment is available.
2. **Log Masking**: Passwords, private keys, and other sensitive information are automatically masked.
3. **Dangerous Commands**: Operations like deleting system root directory are prohibited.
4. **Connection Pool**: Automatically cleans up idle connections to prevent resource leaks.

---

<a id="中文"></a>
## 中文

基于 MCP 协议的 SSH 远程服务器管理工具，支持 SSH 连接、命令执行、SFTP 文件传输。

### 功能特性

- **SSH 连接管理**: 密码/密钥认证，连接池复用
- **命令执行**: 普通命令、sudo 命令、批量执行
- **SFTP 操作**: 上传、下载、列目录、创建/删除
- **服务器管理**: 保存/列出/删除服务器配置
- **凭证安全**: 系统 Keychain 加密存储
- **审计日志**: 记录所有操作，敏感信息自动脱敏

### 安装

```bash
npm install ssh-mcp-server
```

或从源码构建：

```bash
git clone <repo>
cd ssh-mcp-server
npm install
npm run build
```

### 配置 Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "ssh": {
      "command": "node",
      "args": ["/path/to/ssh-mcp-server/dist/index.js"],
      "env": {
        "SSH_MCP_LOG_LEVEL": "info",
        "SSH_MCP_DATA_DIR": "~/.ssh-mcp"
      }
    }
  }
}
```

### 环境变量

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

### MCP 工具

#### 连接管理

##### `connect`
建立 SSH 连接。

```json
{
  "alias": "my-server",        // 使用已保存的服务器
  // 或直接提供参数
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "password": "xxx",           // 或 privateKey
  "privateKey": "-----BEGIN...",
  "passphrase": "key-password"
}
```

##### `disconnect`
断开连接。

```json
{
  "host": "192.168.1.100",     // 断开指定连接
  "username": "root",
  "all": true                  // 或断开所有
}
```

#### 服务器管理

##### `save_server`
保存服务器配置。

```json
{
  "alias": "prod-web",
  "host": "10.0.0.1",
  "port": 22,
  "username": "deploy",
  "authType": "privateKey",
  "privateKey": "-----BEGIN...",
  "group": "production"
}
```

##### `list_servers`
列出已保存的服务器。

```json
{
  "group": "production"        // 可选，按分组过滤
}
```

##### `remove_server`
删除服务器配置。

```json
{
  "alias": "old-server"
}
```

#### 命令执行

##### `exec`
执行远程命令。

```json
{
  "command": "ls -la /var/log",
  "host": "10.0.0.1",          // 可选，默认当前连接
  "timeout": 30000,
  "cwd": "/home/user"
}
```

返回：
```json
{
  "stdout": "...",
  "stderr": "...",
  "exitCode": 0,
  "duration": 150
}
```

##### `exec_sudo`
以 sudo 权限执行。

```json
{
  "command": "systemctl restart nginx",
  "sudoPassword": "xxx"
}
```

##### `exec_batch`
批量执行命令。

```json
{
  "command": "uptime",
  "servers": [
    { "host": "10.0.0.1", "username": "root" },
    { "host": "10.0.0.2", "username": "root" }
  ]
}
```

#### SFTP 操作

##### `sftp_ls`
列出目录内容。

```json
{
  "path": "/var/log"
}
```

##### `sftp_upload`
上传文件。

```json
{
  "localPath": "/tmp/app.tar.gz",
  "remotePath": "/opt/app.tar.gz",
  "overwrite": true
}
```

##### `sftp_download`
下载文件。

```json
{
  "remotePath": "/var/log/app.log",
  "localPath": "/tmp/app.log"
}
```

##### `sftp_mkdir`
创建目录。

```json
{
  "path": "/opt/myapp/logs",
  "recursive": true
}
```

##### `sftp_rm`
删除文件或目录。

```json
{
  "path": "/tmp/old-backup",
  "recursive": true
}
```

#### 系统工具

##### `health_check`
检查连接状态。

```json
{}
```

##### `get_logs`
获取审计日志。

```json
{
  "limit": 50,
  "server": "prod-web",
  "level": "error"
}
```

### 使用示例

#### 连接服务器并执行命令

```
用户: 连接到 192.168.1.100，用户名 root，密码 123456

Claude: [调用 connect 工具]
已连接到 root@192.168.1.100:22

用户: 查看系统负载

Claude: [调用 exec 工具，command: "uptime"]
10:30:01 up 45 days, 2:15, 1 user, load average: 0.15, 0.10, 0.05
```

#### 上传部署文件

```
用户: 把本地的 /tmp/app.jar 上传到服务器的 /opt/app/

Claude: [调用 sftp_upload 工具]
已上传 /tmp/app.jar -> /opt/app/app.jar
```

#### 批量检查服务器状态

```
用户: 检查所有生产服务器的磁盘使用情况

Claude: [调用 list_servers 工具，group: "production"]
找到 3 台服务器

[调用 exec_batch 工具，command: "df -h"]
服务器 10.0.0.1: 使用率 45%
服务器 10.0.0.2: 使用率 62%
服务器 10.0.0.3: 使用率 78% ⚠️
```

### 安全说明

1. **凭证存储**: 优先使用系统 Keychain（macOS Keychain、Windows 凭据管理器），无桌面环境时使用 AES-256-GCM 加密文件
2. **日志脱敏**: 密码、私钥等敏感信息自动脱敏
3. **危险命令**: 禁止删除系统根目录等危险操作
4. **连接池**: 自动清理空闲连接，避免资源泄漏

---

## License

MIT
