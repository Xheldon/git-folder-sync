#!/bin/bash

# 创建发布脚本 - 只包含必要文件
# 使用方法: ./create-release.sh 1.0.2

if [ -z "$1" ]; then
    echo "使用方法: $0 <version>"
    echo "示例: $0 1.0.2"
    exit 1
fi

VERSION=$1
RELEASE_DIR="release-$VERSION"

echo "🚀 准备发布 v$VERSION..."

# 确保已构建
echo "📦 构建插件..."
npm run build

# 创建发布目录
mkdir -p $RELEASE_DIR

# 复制必需文件
echo "📋 复制发布文件..."
cp main.js $RELEASE_DIR/
cp manifest.json $RELEASE_DIR/
cp styles.css $RELEASE_DIR/

# 创建压缩包
echo "🗜️ 创建压缩包..."
cd $RELEASE_DIR
zip -r "../git-folder-sync-$VERSION.zip" .
cd ..

echo "✅ 发布文件已准备完成："
echo "   📁 $RELEASE_DIR/ (文件夹)"
echo "   📦 git-folder-sync-$VERSION.zip (压缩包)"
echo ""
echo "📋 包含的文件："
ls -la $RELEASE_DIR/

echo ""
echo "🎯 接下来的步骤："
echo "1. 在 GitHub 上创建新的 Release"
echo "2. 上传 $RELEASE_DIR 中的三个文件作为 assets"
echo "3. 或者上传 git-folder-sync-$VERSION.zip"