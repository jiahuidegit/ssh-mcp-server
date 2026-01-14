# SSH 重连优化总结

## 问题描述

原始问题：
```
Error: {"error":"[SSH_NOT_CONNECTED] 无法重连：连接配置不存在"}
```

### 根本原因

1. **原架构问题**：连接配置和连接状态耦合存储在 `SSHConnection` 接口中
   ```typescript
   interface SSHConnection {
     client: Client;
     config: ConnectOptions;  // ❌ 配置和状态耦合
     connectedAt: Date;
     // ...
   }
   ```

2. **触发场景**：
   - 用户建立 SSH 连接 → 配置存入 `SSHConnection`
   - 连接意外断开（网络中断/超时/服务器重启）
   - `close` 事件触发 → 整个 `SSHConnection` 被删除（包括配置）
   - 调用 `reconnect()` → 无法找到配置 → 报错

3. **核心矛盾**：
   - `close` 事件自动清理连接（合理）
   - `reconnect()` 需要原始配置（配置已被删除）

---

## 优化方案

### 架构改进：配置与状态分离

```typescript
// ✅ 新架构：配置和状态完全分离
interface SSHConnection {
  client: Client;           // 连接状态
  connectedAt: Date;
  lastActivity: Date;
  isHealthy: boolean;
  // ❌ 移除 config 字段
}

class SSHManager {
  private connections: Map<string, SSHConnection>;    // 活跃连接
  private configCache: Map<string, ConnectOptions>;   // 配置缓存（持久化）
}
```

### 关键改动

#### 1. 连接时自动缓存配置
```typescript
async connect(options: ConnectOptions) {
  const key = getConnectionKey(options.host, options.port, options.username);

  // ✅ 先缓存配置（无论是否已连接）
  this.configCache.set(key, options);

  // 建立连接...
}
```

#### 2. 断开时只删除连接状态
```typescript
client.on('close', () => {
  // ✅ 只删除连接，保留配置
  this.connections.delete(key);
  // configCache 保留！
});
```

#### 3. 重连时从缓存读取配置
```typescript
async reconnect(host, port, username) {
  const key = getConnectionKey(host, port, username);

  // ✅ 从配置缓存获取
  const cachedConfig = this.configCache.get(key);

  if (!cachedConfig) {
    throw new SSHError(
      SSHErrorCode.NOT_CONNECTED,
      '无法重连：连接配置不存在（未曾连接过此服务器）'
    );
  }

  // 使用缓存的配置重连（无需重新输入密码）
  return await this.connect(cachedConfig);
}
```

---

## 优化效果

### Before vs After

| 场景 | 优化前 ❌ | 优化后 ✅ |
|------|----------|----------|
| 连接断开后重连 | 报错"配置不存在" | 自动从缓存读取配置，重连成功 |
| 配置存储 | 随连接删除 | 持久化保留，支持随时重连 |
| 重连时密码 | 需要重新输入 | 无需输入（从缓存读取） |
| 架构设计 | 配置和状态耦合 | 完全分离，符合单一职责原则 |

### 新增 API

```typescript
// 获取缓存的连接配置
manager.getCachedConfig(host, port, username)

// 列出所有缓存配置
manager.listCachedConfigs()

// 清除指定配置缓存
manager.clearConfigCache(host, port, username)

// 清空所有配置缓存
manager.clearAllConfigCache()

// 查看配置缓存大小
manager.getConfigCacheSize()
```

---

## 测试验证

### 场景测试

```typescript
// 1. 建立连接
await manager.connect({ host, username, password });

// 2. 连接意外断开
await manager.disconnect(host, 22, username);

// 3. 配置仍在缓存
const cached = manager.getCachedConfig(host, 22, username);
console.log(cached); // ✅ 配置存在

// 4. 重连成功（无需重新输入密码）
await manager.reconnect(host, 22, username); // ✅ 成功
```

### 运行测试

```bash
# 编译通过
npm run build  # ✅

# 单元测试
npx tsx test/config-cache-test.ts  # ✅
```

---

## 影响范围

### 修改文件

- `src/core/ssh-manager.ts` - 核心改动
- `CHANGELOG.md` - 更新日志
- `test/` - 新增测试文件

### 兼容性

- ✅ **向后兼容** - 外部 API 无变化
- ✅ **类型安全** - TypeScript 编译通过
- ✅ **无破坏性** - 现有功能完全正常

---

## 后续优化建议

### 1. 配置持久化到磁盘（可选）

可以将 `configCache` 持久化到文件系统：

```typescript
// 启动时加载配置
constructor() {
  this.loadConfigCache(); // 从磁盘加载
}

// 销毁时保存配置
async destroy() {
  this.saveConfigCache(); // 保存到磁盘
}
```

### 2. 配置过期策略（可选）

为避免缓存无限增长，可添加过期机制：

```typescript
interface CachedConfig {
  config: ConnectOptions;
  cachedAt: Date;
  expiresAt: Date; // 7天后过期
}
```

### 3. 与 ServerStore 集成（推荐）

将 `configCache` 与现有的 `ServerStore` 关联：

```typescript
// 连接时检查是否是已保存的服务器
if (serverStore.exists(alias)) {
  const server = serverStore.getServer(alias);
  // 自动从 ServerStore 加载配置
}
```

---

## 总结

这次优化通过 **配置与状态分离** 的架构改进，从根本上解决了重连失败的问题，同时提升了代码的可维护性和扩展性。

**核心思想**：
- 连接状态是临时的（断开即删除）
- 连接配置是持久的（断开后保留）
- 职责分离，各司其职

**实际效果**：
- ✅ 彻底解决 `SSH_NOT_CONNECTED` 错误
- ✅ 用户体验提升（无需重复输入密码）
- ✅ 代码架构优化（符合设计原则）
- ✅ 为未来扩展打下基础（持久化、过期策略等）
