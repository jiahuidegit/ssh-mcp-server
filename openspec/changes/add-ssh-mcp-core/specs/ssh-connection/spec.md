# SSH 连接规格说明

## ADDED Requirements

### Requirement: 密码认证连接
系统 SHALL 支持通过密码建立 SSH 连接。

#### Scenario: 密码连接成功
- **WHEN** 提供有效的 host、username、password
- **THEN** 建立 SSH 连接
- **AND** 返回连接成功状态

#### Scenario: 密码连接失败
- **WHEN** 提供无效的密码
- **THEN** 返回认证失败错误
- **AND** 不暴露敏感信息

### Requirement: 密钥认证连接
系统 SHALL 支持通过 SSH 私钥建立连接。

#### Scenario: 密钥连接成功
- **WHEN** 提供有效的 host、username、privateKey
- **THEN** 建立 SSH 连接
- **AND** 返回连接成功状态

#### Scenario: 加密密钥连接
- **WHEN** 提供加密的私钥和 passphrase
- **THEN** 解密密钥并建立连接

### Requirement: 连接池管理
系统 SHALL 支持连接池以复用 SSH 连接。

#### Scenario: 连接复用
- **WHEN** 请求连接已存在的服务器
- **THEN** 复用现有连接
- **AND** 不创建新连接

#### Scenario: 连接超时清理
- **WHEN** 连接空闲超过配置时间
- **THEN** 自动关闭连接
- **AND** 从连接池移除

### Requirement: 断开连接
系统 SHALL 支持主动断开 SSH 连接。

#### Scenario: 正常断开
- **WHEN** 调用 disconnect
- **THEN** 关闭 SSH 连接
- **AND** 从连接池移除
- **AND** 返回断开成功状态

### Requirement: 连接配置
系统 SHALL 支持配置连接参数。

#### Scenario: 自定义端口
- **WHEN** 指定非默认端口
- **THEN** 使用指定端口连接

#### Scenario: 连接超时设置
- **WHEN** 指定 timeout 参数
- **THEN** 连接超时后自动终止
- **AND** 返回超时错误
