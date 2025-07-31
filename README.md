# Git Folder Sync Obsidian Plugin

An Obsidian plugin that supports synchronization with GitHub repositories, built with a modern interface and hot reload development support.

## Features

- 🔄 **Bidirectional Sync**: Support syncing notes to GitHub or pulling notes from GitHub
- 🎯 **Single File Operations**: Sync individual files currently being edited
- 📁 **Batch Operations**: Support batch synchronization of entire Vault
- 🔧 **Visual Configuration**: Modern configuration interface with intuitive controls
- 🚀 **Hot Reload Development**: Support for hot reload during development
- 📂 **Recursive Folders**: Complete support for recursive synchronization of folder structures
- 🌍 **Internationalization**: Support for Chinese and English languages
- 💾 **Smart Caching**: File status caching to reduce GitHub API calls
- 📊 **Real-time Status**: Status bar showing file sync status and last modified time
- 🖼️ **Image Processing**: Automatic image upload to cloud storage when pasting images

## Installation

### Manual Installation

1. Download the latest release files
2. Extract files to your Obsidian plugins directory: `{vault}/.obsidian/plugins/git-folder-sync/`
3. Restart Obsidian
4. Enable the "Git Folder Sync" plugin in settings

### Development Installation

1. Clone this repository to your plugins directory:

   ```bash
   cd {vault}/.obsidian/plugins/
   git clone https://github.com/Xheldon/git-folder-sync git-folder-sync
   cd git-folder-sync
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Development mode (with hot reload):

   ```bash
   npm run dev
   ```

4. Build production version:
   ```bash
   npm run build
   ```

## Configuration

### 1. GitHub Personal Access Token

First, create a GitHub Personal Access Token:

1. Visit [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select the following permissions:
   - `repo` (Full repository access)
4. Copy the generated token

### 2. Repository Path Configuration

Repository path formats:

- `https://github.com/username/repo/path/to/folder` (Standard GitHub URL)
- `username/repo/path/to/folder` (Short format)

Examples:

- `https://github.com/yourusername/your-repo/docs/notes`
- `username/notes/obsidian-vault`

### 3. Image Processing Configuration (Optional)

The plugin includes an optional image processing feature that automatically uploads pasted images to cloud storage services.

#### Supported Cloud Storage Providers

- **Aliyun OSS**: Alibaba Cloud Object Storage Service
- **Tencent COS**: Tencent Cloud Object Storage
- **AWS S3**: Amazon Simple Storage Service
- **Cloudflare R2**: Cloudflare's S3-compatible storage

#### Configuration Steps

1. **Enable Image Processing**: Turn on the "Enable Image Processing" toggle in settings
2. **Select Cloud Provider**: Choose your preferred cloud storage service
3. **Configure Credentials**: Enter your cloud storage credentials:
   - Access Key ID / Secret ID
   - Access Key Secret / Secret Key
   - Bucket Name
   - Region (required for all providers)
   - Endpoint (required for Cloudflare R2 only)
   - CDN URL (optional, for faster image loading)

#### Image Upload Settings

- **Keep Images Locally**: Optionally keep a local copy of uploaded images
- **Local Image Path**: Specify where to store local image copies (when enabled)
- **Upload Path Template**: Customize the remote storage path using variables:
  - `{YYYY}`: Current year
  - `{MM}`: Current month
  - `{DD}`: Current day
  - `{FILENAME}`: Current file name
  - `{FOLDER}`: Current folder name

#### How It Works

1. **Paste Image**: When you paste an image in a markdown file
2. **Automatic Upload**: The image is automatically uploaded to your configured cloud storage
3. **Link Replacement**: The pasted image is replaced with a CDN link
4. **Local Copy** (optional): A local copy is saved if enabled

#### Behavior Options

- **Image Processing Disabled**: Uses Obsidian's default image handling
- **Image Processing Enabled + Cloud Storage Configured**: Uploads to cloud and inserts CDN links
- **Image Processing Enabled + Local Storage Only**: Saves images to specified local directory
- **Image Processing Enabled + No Configuration**: Shows configuration reminder

## Usage

### Settings Interface

Click the settings icon in the left sidebar to open the configuration interface, or access it through Obsidian's plugin settings.

### Note Sync Menu

While editing notes, you can access the sync menu through:

1. Command palette: `Ctrl/Cmd + P` → Search for "Show Sync Menu"
2. Right-click in editor → Select "Git Folder Sync"
3. Status bar sync button (bottom right)

Menu options:

- **Sync current file to remote**: Upload current file to GitHub
- **Pull remote to current file**: Download file from GitHub to overwrite local

### Configuration Interface Features

#### Basic Settings

- **Interface Language**: Choose between Chinese, English, or follow Obsidian
- **GitHub Personal Token**: Enter your access token
- **GitHub Repository Path**: Configure target repository and path
- **Show Ribbon Icon**: Toggle sidebar button visibility

#### Image Processing Settings

- **Enable Image Processing**: Master toggle for image upload functionality
- **Cloud Storage Provider**: Select from Aliyun OSS, Tencent COS, AWS S3, or Cloudflare R2
- **Storage Credentials**: Configure access keys, bucket, region, and optional CDN URL
- **Local Image Storage**: Option to keep local copies of uploaded images
- **Upload Path Template**: Customize remote storage path with date and file variables

#### Batch Operations (Danger Zone)

- **Initialize Repository**: Download all files from remote when Vault is empty
- **Force Sync Remote to Local**: Sync remote files to local (overwrites same-name files)
- **Force Sync Local to Remote**: Sync local files to remote
- **Clear File Cache**: Clear all cached file status data

#### Sponsor

- **Support Development**: Links to sponsor the project development

## Development

### Project Structure

```
├── main.ts              # Main plugin file
├── types.ts             # Type definitions
├── github-service.ts    # GitHub API service
├── cos-service.ts       # Cloud storage service
├── file-cache.ts        # File caching service
├── i18n-simple.ts       # Internationalization system
├── styles.css          # Stylesheet
├── manifest.json       # Plugin manifest
├── package.json        # Project configuration
├── tsconfig.json       # TypeScript configuration
├── esbuild.config.mjs  # Build configuration
└── version-bump.mjs    # Version management script
```

### Development Commands

```bash
# Install dependencies
npm install

# Development mode (hot reload)
npm run dev

# Build production version
npm run build

# Version management
npm run version
```

## Tech Stack

- **TypeScript**: Primary development language
- **Obsidian API**: Core plugin API
- **GitHub API**: Repository operations via @octokit/rest
- **esbuild**: Fast build tool
- **i18n**: Custom internationalization system

## Important Notes

1. **Permission Requirements**: Requires write access to GitHub repository
2. **File Conflicts**: Force sync will overwrite existing files, use with caution
3. **Network Requirements**: Requires stable network connection to access GitHub API
4. **Token Security**: Keep your GitHub Personal Access Token secure
5. **Rate Limits**: GitHub API has rate limits (5000 requests/hour for authenticated users)

## Contributing

Issues and Pull Requests are welcome!

## Sponsor

If this plugin helps you, consider buying me a coffee ☕

[![PayPal](https://img.shields.io/badge/PayPal-Sponsor-blue?style=for-the-badge&logo=paypal)](https://paypal.me/xheldoncao)

For users in mainland China: [https://www.xheldon.com/donate/](https://www.xheldon.com/donate/)

Your support motivates me to continue developing and maintaining this project!

## License

MIT License
