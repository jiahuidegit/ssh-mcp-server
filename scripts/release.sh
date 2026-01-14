#!/bin/bash

# SSH MCP Server 版本发布脚本
# 用法：./scripts/release.sh [major|minor|patch]

set -e

VERSION_TYPE=${1:-patch}

echo "🚀 开始发布流程..."
echo ""

# 1. 检查工作区是否干净
if [[ -n $(git status -s) ]]; then
  echo "❌ 工作区有未提交的更改，请先提交或暂存"
  git status -s
  exit 1
fi

echo "✅ 工作区干净"
echo ""

# 2. 运行测试
echo "🧪 运行测试..."
npm test
echo "✅ 测试通过"
echo ""

# 3. 构建项目
echo "🔨 构建项目..."
npm run build
echo "✅ 构建成功"
echo ""

# 4. 更新版本号
echo "📦 更新版本号 (${VERSION_TYPE})..."
NEW_VERSION=$(npm version $VERSION_TYPE -m "release: v%s")
echo "✅ 新版本: ${NEW_VERSION}"
echo ""

# 5. 推送到 GitHub
echo "📤 推送到 GitHub..."
git push origin main
git push --tags
echo "✅ 推送成功"
echo ""

# 6. 提示更新 README
echo "⚠️  请手动完成以下步骤："
echo ""
echo "1. 更新 README.md 和 README_CN.md 中的「最近更新」部分："
echo "   - 添加 ${NEW_VERSION} 的更新亮点"
echo ""
echo "2. 创建 Release Notes："
echo "   - 在 .github/ 创建 release-notes-${NEW_VERSION}.md"
echo "   - 包含中英文发布说明"
echo ""
echo "3. 创建 GitHub Release："
echo "   gh release create ${NEW_VERSION} \\"
echo "     --title \"${NEW_VERSION} - 版本标题\" \\"
echo "     --notes-file .github/release-notes-${NEW_VERSION}.md \\"
echo "     --latest"
echo ""
echo "4. 提交 README 更新："
echo "   git add README.md README_CN.md .github/release-notes-${NEW_VERSION}.md"
echo "   git commit -m \"docs: 更新版本说明到 ${NEW_VERSION}\""
echo "   git push origin main"
echo ""
echo "GitHub Actions 将自动发布到 npm，请在此查看状态："
echo "https://github.com/jiahuidegit/ssh-mcp-server/actions"
