# 命令执行规格说明

## ADDED Requirements

### Requirement: 执行远程命令
系统 SHALL 支持在远程服务器执行 shell 命令。

#### Scenario: 命令执行成功
- **WHEN** 提供有效命令
- **THEN** 在远程服务器执行
- **AND** 返回 stdout 和 exit code

#### Scenario: 命令执行失败
- **WHEN** 命令执行出错
- **THEN** 返回 stderr 和非零 exit code

#### Scenario: 命令超时
- **WHEN** 命令执行超过 timeout
- **THEN** 终止命令执行
- **AND** 返回超时错误

### Requirement: Sudo 命令执行
系统 SHALL 支持以 sudo 权限执行命令。

#### Scenario: Sudo 执行成功
- **WHEN** 提供 sudoPassword 和命令
- **THEN** 以 root 权限执行命令
- **AND** 返回执行结果

#### Scenario: Sudo 密码错误
- **WHEN** 提供错误的 sudoPassword
- **THEN** 返回认证失败错误

#### Scenario: Sudo 禁用
- **WHEN** 服务器配置 disableSudo=true
- **THEN** sudo-exec 工具不可用

### Requirement: 批量命令执行
系统 SHALL 支持在多台服务器同时执行命令。

#### Scenario: 批量执行成功
- **WHEN** 指定多个服务器和命令
- **THEN** 并行在各服务器执行
- **AND** 返回每台服务器的结果

#### Scenario: 部分服务器失败
- **WHEN** 部分服务器执行失败
- **THEN** 返回成功和失败的结果列表
- **AND** 不中断其他服务器执行

### Requirement: 命令安全限制
系统 SHALL 支持命令安全限制。

#### Scenario: 命令长度限制
- **WHEN** 命令超过 maxChars 限制
- **THEN** 拒绝执行
- **AND** 返回错误提示

#### Scenario: 危险命令过滤
- **WHEN** 启用危险命令过滤
- **THEN** 阻止 rm -rf /、mkfs 等危险命令
