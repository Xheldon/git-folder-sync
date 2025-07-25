# Git 同步 Obsidian 插件

一个支持与 GitHub 仓库同步的 Obsidian 插件，使用 React 构建用户界面，支持热重载开发。

## 功能特性

- 🔄 **双向同步**: 支持将笔记同步到 GitHub 或从 GitHub 拉取笔记
- 🎯 **单文件操作**: 可以单独同步当前编辑的文件
- 📁 **批量操作**: 支持整个 Vault 的批量同步
- 🔧 **可视化配置**: 使用 React 构建的现代化配置界面
- 🚀 **热重载开发**: 支持开发时的热重载
- 📂 **递归文件夹**: 完整支持文件夹结构的递归同步

## 安装

### 手动安装

1. 下载最新的 release 文件
2. 将文件解压到你的 Obsidian 插件目录：`{vault}/.obsidian/plugins/git-sync/`
3. 重启 Obsidian
4. 在设置中启用"Git Sync"插件

### 开发安装

1. 克隆此仓库到你的插件目录：

   ```bash
   cd {vault}/.obsidian/plugins/
   git clone https://github.com/你的用户名/obsidian-git-sync git-sync
   cd git-sync
   ```

2. 安装依赖：

   ```bash
   npm install
   ```

3. 开发模式（支持热重载）：

   ```bash
   npm run dev
   ```

4. 构建生产版本：
   ```bash
   npm run build
   ```

## 配置

### 1. GitHub Personal Access Token

首先需要创建一个 GitHub Personal Access Token：

1. 访问 [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. 点击"Generate new token (classic)"
3. 选择以下权限：
   - `repo` (完整的仓库访问权限)
4. 复制生成的 token

### 2. 仓库路径配置

仓库路径格式：`@https://github.com/用户名/仓库名/路径/到/文件夹`

示例：

- `@https://github.com/Xheldon/git-sync/data/_post`
- `@https://github.com/username/notes/obsidian-vault`

## 使用方法

### 编辑器按钮

点击左侧边栏的设置图标打开配置界面。

### 笔记同步菜单

在编辑笔记时，可以通过以下方式访问同步菜单：

1. 使用命令面板：`Ctrl/Cmd + P` → 搜索"显示同步菜单"
2. 右键点击编辑器 → 选择"Git 同步"

菜单选项：

- **同步当前文件到远端**: 将当前文件上传到 GitHub
- **拉取远端覆盖当前文件**: 从 GitHub 下载文件覆盖本地

### 配置界面功能

#### 基本设置

- **GitHub Personal Token**: 输入你的访问令牌
- **GitHub 仓库路径**: 配置目标仓库和路径

#### 批量操作

- **初始化仓库**: 当 Vault 为空时，从远端下载所有文件
- **强制同步远端到本地**: 将远端文件同步到本地（会覆盖同名文件）
- **强制同步本地到远端**: 将本地文件同步到远端

## 开发

### 项目结构

```
├── main.ts              # 插件主文件
├── types.ts             # 类型定义
├── github-service.ts    # GitHub API服务
├── settings-modal.tsx   # React配置界面
├── styles.css          # 样式文件
├── manifest.json       # 插件清单
├── package.json        # 项目配置
├── tsconfig.json       # TypeScript配置
├── esbuild.config.mjs  # 构建配置
└── version-bump.mjs    # 版本管理脚本
```

### 开发命令

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build

# 版本管理
npm run version
```

## 技术栈

- **TypeScript**: 主要开发语言
- **React**: 用户界面框架
- **Obsidian API**: 插件核心 API
- **GitHub API**: 通过@octokit/rest 进行仓库操作
- **esbuild**: 快速构建工具

## 注意事项

1. **权限要求**: 需要 GitHub 仓库的写入权限
2. **文件冲突**: 强制同步会覆盖现有文件，请谨慎使用
3. **网络要求**: 需要稳定的网络连接访问 GitHub API
4. **Token 安全**: 请妥善保管你的 GitHub Personal Access Token

## 贡献

欢迎提交 Issue 和 Pull Request！

## 赞助

如果这个插件对你有帮助，欢迎请我喝杯咖啡 ☕

[![PayPal](https://img.shields.io/badge/PayPal-支持赞助-blue?style=for-the-badge&logo=paypal)](https://paypal.me/xheldoncao)

你的支持是我继续开发和维护这个项目的动力！

## 许可证

MIT License
