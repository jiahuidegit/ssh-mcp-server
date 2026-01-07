# SFTP 操作规格说明

## ADDED Requirements

### Requirement: 列出目录内容
系统 SHALL 支持列出远程目录内容。

#### Scenario: 列目录成功
- **WHEN** 提供有效目录路径
- **THEN** 返回文件和子目录列表
- **AND** 包含名称、大小、权限、修改时间

#### Scenario: 目录不存在
- **WHEN** 目录路径不存在
- **THEN** 返回路径不存在错误

### Requirement: 上传文件
系统 SHALL 支持上传本地文件到远程服务器。

#### Scenario: 上传成功
- **WHEN** 提供本地文件路径和远程路径
- **THEN** 上传文件到远程服务器
- **AND** 返回上传成功状态

#### Scenario: 上传大文件
- **WHEN** 上传大文件
- **THEN** 支持进度回调
- **AND** 支持断点续传（可选）

#### Scenario: 覆盖已存在文件
- **WHEN** 远程文件已存在且 overwrite=true
- **THEN** 覆盖远程文件

### Requirement: 下载文件
系统 SHALL 支持从远程服务器下载文件。

#### Scenario: 下载成功
- **WHEN** 提供远程文件路径和本地路径
- **THEN** 下载文件到本地
- **AND** 返回下载成功状态

#### Scenario: 远程文件不存在
- **WHEN** 远程文件不存在
- **THEN** 返回文件不存在错误

### Requirement: 创建目录
系统 SHALL 支持在远程服务器创建目录。

#### Scenario: 创建目录成功
- **WHEN** 提供目录路径
- **THEN** 创建目录
- **AND** 返回创建成功状态

#### Scenario: 递归创建目录
- **WHEN** 父目录不存在且 recursive=true
- **THEN** 递归创建所有父目录

### Requirement: 删除文件/目录
系统 SHALL 支持删除远程文件或目录。

#### Scenario: 删除文件成功
- **WHEN** 提供文件路径
- **THEN** 删除文件
- **AND** 返回删除成功状态

#### Scenario: 删除非空目录
- **WHEN** 目录非空且 recursive=true
- **THEN** 递归删除目录及内容

#### Scenario: 删除保护
- **WHEN** 尝试删除根目录或系统目录
- **THEN** 拒绝操作并返回错误
