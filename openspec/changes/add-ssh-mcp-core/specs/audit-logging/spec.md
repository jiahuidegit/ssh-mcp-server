# 审计日志规格说明

## ADDED Requirements

### Requirement: 操作日志记录
系统 SHALL 记录所有 SSH 操作的审计日志。

#### Scenario: 命令执行日志
- **WHEN** 执行远程命令
- **THEN** 记录：时间、服务器、用户、命令、结果、耗时

#### Scenario: 连接日志
- **WHEN** 建立或断开连接
- **THEN** 记录：时间、服务器、用户、操作类型、结果

#### Scenario: SFTP 操作日志
- **WHEN** 执行 SFTP 操作
- **THEN** 记录：时间、服务器、操作类型、路径、结果

### Requirement: 日志级别
系统 SHALL 支持配置日志级别。

#### Scenario: DEBUG 级别
- **WHEN** 设置 logLevel=debug
- **THEN** 记录详细调试信息

#### Scenario: INFO 级别
- **WHEN** 设置 logLevel=info（默认）
- **THEN** 记录常规操作信息

#### Scenario: ERROR 级别
- **WHEN** 设置 logLevel=error
- **THEN** 只记录错误信息

### Requirement: 日志输出
系统 SHALL 支持多种日志输出方式。

#### Scenario: 文件输出
- **WHEN** 配置 logFile 路径
- **THEN** 日志写入指定文件
- **AND** 支持日志轮转

#### Scenario: 标准输出
- **WHEN** 未配置 logFile
- **THEN** 日志输出到 stderr
- **AND** 使用 JSON 格式

### Requirement: 日志查询
系统 SHALL 支持查询历史日志。

#### Scenario: 查询最近日志
- **WHEN** 调用 get_logs
- **THEN** 返回最近 N 条日志

#### Scenario: 按条件过滤
- **WHEN** 指定服务器或时间范围
- **THEN** 返回符合条件的日志

### Requirement: 敏感信息过滤
系统 SHALL 确保日志不包含敏感信息。

#### Scenario: 密码脱敏
- **WHEN** 日志包含密码字段
- **THEN** 使用 *** 替代实际密码

#### Scenario: 私钥脱敏
- **WHEN** 日志包含私钥内容
- **THEN** 只记录 [PRIVATE_KEY] 标识
