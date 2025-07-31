# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-19

### Added

- Initial release of Git Sync plugin
- Git synchronization with GitHub repositories
- Support for folder-specific sync (not entire repository)
- Image upload to cloud storage services:
  - Aliyun OSS
  - Tencent COS
  - AWS S3
  - Cloudflare R2
- Bilingual support (Chinese/English)
- Mobile device support
- Smart file caching system
- Real-time status display in status bar
- Configurable image processing with toggle switch
- Local image storage option
- Responsive settings interface
- Command palette integration
- Right-click context menu support

### Features

- **Git Sync**: Bidirectional synchronization with GitHub
- **Image Processing**: Paste images and automatically upload to cloud storage
- **Internationalization**: Full Chinese and English support
- **Mobile Support**: Works on both desktop and mobile devices
- **Performance**: Smart caching reduces API calls
- **User Experience**: Modern interface with real-time feedback

### Technical

- TypeScript implementation
- ESBuild for fast compilation
- Comprehensive error handling
- Plugin settings persistence
- Hot reload development support
