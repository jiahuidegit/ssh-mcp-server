# 服务器管理规格说明

## ADDED Requirements

### Requirement: 保存服务器配置
系统 SHALL 支持保存服务器连接配置。

#### Scenario: 保存新服务器
- **WHEN** 提供服务器配置（alias、host、user 等）
- **THEN** 加密存储配置
- **AND** 返回保存成功状态

#### Scenario: 更新已有服务器
- **WHEN** alias 已存在
- **THEN** 更新配置
- **AND** 返回更新成功状态

### Requirement: 列出服务器配置
系统 SHALL 支持列出已保存的服务器配置。

#### Scenario: 列出所有服务器
- **WHEN** 调用 list_servers
- **THEN** 返回所有已保存服务器列表
- **AND** 不暴露密码/密钥内容

#### Scenario: 空列表
- **WHEN** 没有保存的服务器
- **THEN** 返回空列表

### Requirement: 删除服务器配置
系统 SHALL 支持删除已保存的服务器配置。

#### Scenario: 删除成功
- **WHEN** 提供有效的服务器 alias
- **THEN** 删除配置
- **AND** 同时删除关联的凭证

#### Scenario: 服务器不存在
- **WHEN** alias 不存在
- **THEN** 返回不存在错误

### Requirement: 服务器分组
系统 SHALL 支持对服务器进行分组管理。

#### Scenario: 添加到分组
- **WHEN** 保存服务器时指定 group
- **THEN** 将服务器归入指定分组

#### Scenario: 按分组列出
- **WHEN** 列出服务器时指定 group 过滤
- **THEN** 只返回该分组的服务器

### Requirement: 临时连接
系统 SHALL 支持不保存配置的临时连接。

#### Scenario: 临时连接成功
- **WHEN** 直接提供连接参数（不指定 alias）
- **THEN** 建立连接但不保存配置
- **AND** 连接断开后无痕迹
