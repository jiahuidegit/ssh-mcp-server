# v0.3.0 - Improved Reconnection Mechanism

## 🎯 Highlights

This release focuses on improving the reconnection mechanism and fixing the "configuration not found" error that occurred after disconnection.

## ✨ What's New

### 🔄 Improved Reconnection

- **Fixed Reconnection Error** - Resolved the `SSH_NOT_CONNECTED` error ("configuration not found") that occurred when trying to reconnect after disconnection
- **Configuration Persistence** - Connection configurations now persist after disconnection, enabling reconnection at any time
- **No Password Re-entry** - Reconnect without re-entering credentials (password/private key)

### 🏗️ Architecture Optimization

- **Configuration & State Separation** - Completely separated connection configuration from connection state
  - Added independent `configCache` for persistent storage of connection configurations
  - Only connection state is cleaned up on disconnection, configurations are retained
  - Supports reconnection at any time after disconnection

### 📦 New Configuration Management APIs

- `getCachedConfig(host, port, username)` - Get cached connection configuration
- `listCachedConfigs()` - List all cached configurations
- `clearConfigCache(host, port, username)` - Clear specific configuration cache
- `clearAllConfigCache()` - Clear all configuration cache
- `getConfigCacheSize()` - Check configuration cache size

## 🔧 Technical Details

**Before this release:**
```
Connection -> close event -> Delete entire connection (including config)
Reconnect -> Error: "configuration not found"
```

**After this release:**
```
Connection -> close event -> Delete only connection state (config retained)
Reconnect -> Read from configCache -> Success!
```

## 📊 Comparison

| Scenario | Before ❌ | After ✅ |
|----------|----------|----------|
| Reconnect after disconnect | Error "config not found" | Auto-reconnect from cache |
| Password re-entry | Required | Not required |
| Configuration lifecycle | Deleted with connection | Persisted |
| Architecture | Config & state coupled | Completely separated |

## 🚀 Upgrade

### Using npx (Recommended)
```bash
# npx automatically uses the latest version
npx @erliban/ssh-mcp-server
```

### Globally installed
```bash
npm update -g @erliban/ssh-mcp-server
# or
npm install -g @erliban/ssh-mcp-server@latest
```

## 📝 Full Changelog

See [CHANGELOG.md](https://github.com/jiahuidegit/ssh-mcp-server/blob/main/CHANGELOG.md) for complete details.

---

# v0.3.0 - 优化重连机制

## 🎯 核心亮点

本版本专注于改进重连机制，修复断开连接后重连时出现的"配置不存在"错误。

## ✨ 新增功能

### 🔄 重连机制优化

- **修复重连错误** - 解决断开连接后尝试重连时出现的 `SSH_NOT_CONNECTED` 错误（"配置不存在"）
- **配置持久化** - 连接配置在断开后仍保留，支持随时重新连接
- **无需重新输入密码** - 重连时无需再次输入凭证（密码/私钥）

### 🏗️ 架构优化

- **配置与状态分离** - 将连接配置和连接状态完全分离
  - 新增独立的 `configCache` 持久化存储连接配置
  - 连接断开时仅清理连接状态，保留配置信息
  - 支持断开后任意时间重连

### 📦 新增配置管理 API

- `getCachedConfig(host, port, username)` - 获取缓存的连接配置
- `listCachedConfigs()` - 列出所有缓存配置
- `clearConfigCache(host, port, username)` - 清除指定配置缓存
- `clearAllConfigCache()` - 清空所有配置缓存
- `getConfigCacheSize()` - 查看配置缓存大小

## 🔧 技术细节

**此版本之前：**
```
连接 -> close 事件 -> 删除整个连接对象（包括配置）
重连 -> 错误："配置不存在"
```

**此版本之后：**
```
连接 -> close 事件 -> 只删除连接状态（保留配置）
重连 -> 从 configCache 读取配置 -> 成功！
```

## 📊 对比

| 场景 | 优化前 ❌ | 优化后 ✅ |
|------|----------|----------|
| 断开后重连 | 报错"配置不存在" | 从缓存自动重连 |
| 密码输入 | 需要重新输入 | 无需输入 |
| 配置生命周期 | 随连接删除 | 持久化保留 |
| 架构设计 | 配置和状态耦合 | 完全分离 |

## 🚀 升级方式

### 使用 npx（推荐）
```bash
# npx 会自动使用最新版本
npx @erliban/ssh-mcp-server
```

### 全局安装
```bash
npm update -g @erliban/ssh-mcp-server
# 或者
npm install -g @erliban/ssh-mcp-server@latest
```

## 📝 完整更新日志

详见 [CHANGELOG.md](https://github.com/jiahuidegit/ssh-mcp-server/blob/main/CHANGELOG.md)
