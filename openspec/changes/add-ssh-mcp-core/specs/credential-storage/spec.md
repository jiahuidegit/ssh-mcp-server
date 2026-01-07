# 凭证存储规格说明

## ADDED Requirements

### Requirement: 系统 Keychain 存储
系统 SHALL 使用操作系统的安全存储机制保存凭证。

#### Scenario: macOS Keychain
- **WHEN** 运行在 macOS
- **THEN** 使用 Keychain Access 存储凭证

#### Scenario: Windows 凭据管理器
- **WHEN** 运行在 Windows
- **THEN** 使用 Windows Credential Manager 存储

#### Scenario: Linux Secret Service
- **WHEN** 运行在 Linux
- **THEN** 使用 libsecret/gnome-keyring 存储

### Requirement: 凭证加密
系统 SHALL 确保凭证在存储和传输过程中加密。

#### Scenario: 密码加密存储
- **WHEN** 保存包含密码的服务器配置
- **THEN** 密码加密后存储
- **AND** 明文密码不写入磁盘

#### Scenario: 私钥加密存储
- **WHEN** 保存包含私钥的服务器配置
- **THEN** 私钥加密后存储

### Requirement: 凭证读取
系统 SHALL 支持安全读取已存储的凭证。

#### Scenario: 读取凭证成功
- **WHEN** 连接使用已保存的服务器
- **THEN** 从安全存储读取凭证
- **AND** 解密后用于连接

#### Scenario: Keychain 访问授权
- **WHEN** 首次访问 Keychain
- **THEN** 可能触发系统授权提示

### Requirement: 凭证删除
系统 SHALL 支持安全删除存储的凭证。

#### Scenario: 删除凭证
- **WHEN** 删除服务器配置
- **THEN** 同时从安全存储删除凭证
- **AND** 确保凭证不可恢复

### Requirement: 备用存储
系统 SHALL 在 Keychain 不可用时提供备用方案。

#### Scenario: 加密文件存储
- **WHEN** 系统 Keychain 不可用
- **THEN** 使用本地加密文件存储
- **AND** 使用用户主密码加密
