# 版本发布流程 | Release Process

本文档说明如何发布新版本到 npm 和 GitHub。

## 📋 发布前检查清单

- [ ] 所有功能已完成并测试通过
- [ ] 更新 `CHANGELOG.md` 中的 `[Unreleased]` 部分
- [ ] 确保代码已提交到 `main` 分支
- [ ] 运行测试：`npm test`
- [ ] 运行构建：`npm run build`

---

## 🚀 发布步骤

### 1. 更新版本号

根据 [语义化版本](https://semver.org/lang/zh-CN/) 规范选择版本类型：

```bash
# 主版本（不兼容的 API 变更）
npm version major

# 次版本（向后兼容的新功能）
npm version minor

# 修订版本（向后兼容的 bug 修复）
npm version patch
```

### 2. 推送标签

```bash
git push origin main
git push --tags
```

### 3. 更新 README

在 `README.md` 和 `README_CN.md` 的 `## 🆕 What's New / 最近更新` 部分：

**英文版示例：**
```markdown
### vX.Y.Z (Latest)

- 🎯 **Feature Name** - Brief description
- 🐛 **Bug Fix** - What was fixed
- ⚡ **Improvement** - What was improved
```

**中文版示例：**
```markdown
### vX.Y.Z（最新版）

- 🎯 **功能名称** - 简要说明
- 🐛 **问题修复** - 修复了什么
- ⚡ **性能优化** - 优化了什么
```

### 4. 创建 Release Notes

在 `.github/` 目录创建发布说明文件，例如 `release-notes-vX.Y.Z.md`：

```markdown
# vX.Y.Z - 版本标题

## 🎯 Highlights / 核心亮点

[英文描述]

[中文描述]

## ✨ What's New / 新增功能

### English

- Feature 1
- Feature 2

### 中文

- 功能 1
- 功能 2

## 🐛 Bug Fixes / 问题修复

### English

- Fix 1

### 中文

- 修复 1

## 📊 Comparison / 对比

| Scenario | Before | After |
|----------|--------|-------|
| ...      | ...    | ...   |

## 🚀 Upgrade / 升级方式

### Using npx
\`\`\`bash
npx @erliban/ssh-mcp-server
\`\`\`

### 全局安装
\`\`\`bash
npm update -g @erliban/ssh-mcp-server
\`\`\`
```

### 5. 创建 GitHub Release

```bash
gh release create vX.Y.Z \
  --title "vX.Y.Z - 版本标题（中英文）" \
  --notes-file .github/release-notes-vX.Y.Z.md \
  --latest
```

### 6. 提交 README 更新

```bash
git add README.md README_CN.md .github/release-notes-vX.Y.Z.md
git commit -m "docs: 更新版本说明到 vX.Y.Z"
git push origin main
```

---

## 🤖 自动化发布

本项目已配置 GitHub Actions 自动发布到 npm：

- **触发条件**：推送 `v*` 格式的 tag
- **工作流文件**：`.github/workflows/publish.yml`
- **所需 Secret**：`NPM_TOKEN`（已配置）

当你推送版本标签时，GitHub Actions 会自动：
1. 运行测试
2. 构建项目
3. 发布到 npm

查看发布状态：https://github.com/jiahuidegit/ssh-mcp-server/actions

---

## 📝 版本号规范

遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)：

- **主版本号（MAJOR）**：不兼容的 API 变更
- **次版本号（MINOR）**：向后兼容的新功能
- **修订号（PATCH）**：向后兼容的 bug 修复

示例：
- `0.2.2` → `0.3.0`（新增功能）
- `0.3.0` → `0.3.1`（bug 修复）
- `0.3.1` → `1.0.0`（重大变更）

---

## 🎯 Emoji 使用指南

在版本说明中使用统一的 emoji 风格：

| Emoji | 含义 | 使用场景 |
|-------|------|----------|
| 🎯 | 核心亮点 | 重要功能 |
| ✨ | 新功能 | 新增特性 |
| 🐛 | Bug 修复 | 问题修复 |
| ⚡ | 性能优化 | 速度/效率提升 |
| 🔒 | 安全 | 安全相关 |
| 📝 | 文档 | 文档更新 |
| 🔧 | 配置 | 配置相关 |
| 💾 | 存储/缓存 | 数据持久化 |
| 🔄 | 重构/优化 | 架构改进 |
| 📦 | 依赖/打包 | 依赖更新 |
| 🚀 | 部署/发布 | 发布相关 |

---

## 📊 检查发布结果

### npm 包

访问：https://www.npmjs.com/package/@erliban/ssh-mcp-server

检查：
- 版本号是否正确
- 发布时间是否最新
- 下载统计

### GitHub Release

访问：https://github.com/jiahuidegit/ssh-mcp-server/releases

检查：
- Release 是否创建成功
- Release Notes 是否完整
- 标记为 "Latest"

### README

访问：https://github.com/jiahuidegit/ssh-mcp-server

检查：
- "最近更新" 部分是否更新
- 版本号 badge 是否正确

---

## 🆘 问题排查

### npm 发布失败

1. 检查 GitHub Secrets 中的 `NPM_TOKEN` 是否有效
2. 查看 GitHub Actions 日志
3. 手动发布：`npm publish --access public`

### GitHub Release 创建失败

1. 检查 `gh` CLI 是否已认证：`gh auth status`
2. 检查 tag 是否已推送：`git tag`
3. 手动创建：访问 https://github.com/jiahuidegit/ssh-mcp-server/releases/new

---

## 📚 参考文档

- [语义化版本规范](https://semver.org/lang/zh-CN/)
- [npm 发布文档](https://docs.npmjs.com/cli/v10/commands/npm-publish)
- [GitHub CLI 文档](https://cli.github.com/manual/)
- [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)
