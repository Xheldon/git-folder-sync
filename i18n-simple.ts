// Simplified internationalization system
export type Language = 'zh' | 'en' | 'auto';

// Translation texts
const translations = {
  zh: {
    // Settings interface
    'settings.title': 'Git同步设置',
    'settings.language.name': '界面语言',
    'settings.language.desc': '选择插件界面显示语言',
    'settings.language.auto': '跟随Obsidian',
    'settings.github.token.name': 'GitHub Personal Token',
    'settings.github.token.desc': '输入你的GitHub Personal Access Token',
    'settings.github.token.placeholder': 'ghp_xxxxxxxxxxxx',
    'settings.github.repo.name': 'GitHub仓库路径',
    'settings.github.repo.desc': '支持两种格式：\n1. https://github.com/用户名/仓库名/路径\n2. 用户名/仓库名/路径',
    'settings.github.repo.placeholder': 'https://github.com/Xheldon/git-sync/data/_post',
    'settings.ribbon.name': '将插件按钮显示在侧边栏',
    'settings.ribbon.desc': '开启后，在左侧边栏显示插件按钮，点击可快速打开设置界面',
    'settings.save.name': '保存设置',
    'settings.save.desc': '保存当前的配置设置',
    'settings.save.button': '保存设置',
    'settings.diagnose.name': '诊断Vault文件',
    'settings.diagnose.desc': '检查当前Vault中有哪些文件可以同步',
    'settings.diagnose.button': '诊断',
    'settings.test.url.name': '测试仓库URL',
    'settings.test.url.desc': '验证GitHub仓库路径格式是否正确',
    'settings.test.url.button': '测试URL',
    'settings.sponsor.name': '💖 支持开发者',
    'settings.sponsor.desc': '如果这个插件对你有帮助，欢迎请我喝杯咖啡！你的支持是我继续开发的动力。',
    'settings.sponsor.button': '💝 PayPal 赞助',
    'settings.sponsor.china.label': '🇨🇳 中国大陆捐赠渠道',
    'settings.sponsor.section.title': '赞助',
    'settings.danger.zone.title': '危险区域',
    'settings.init.name': '初始化仓库',
    'settings.init.desc': '当本Vault为空的时候可用，将远端文件同步到本地',
    'settings.init.button': '初始化仓库',
    'settings.init.loading': '初始化中...',
    'settings.sync.remote.to.local.name': '强制同步远端路径到本地',
    'settings.sync.remote.to.local.desc': '将远端的文件一股脑的同步到本地的Vault中，同名文件会被覆盖',
    'settings.sync.remote.to.local.button': '强制同步到本地',
    'settings.sync.remote.to.local.loading': '同步中...',
    'settings.sync.local.to.remote.name': '强制同步本地文件到远端',
    'settings.sync.local.to.remote.desc': '将本地的Vault中的所有文件同步到远端配置的路径中，同名文件会被覆盖',
    'settings.sync.local.to.remote.button': '强制同步到远端',
    'settings.sync.local.to.remote.loading': '同步中...',
    'settings.clear.cache.name': '清空文件缓存',
    'settings.clear.cache.desc': '清空所有文件状态缓存，下次查看时将重新从GitHub获取',
    'settings.clear.cache.button': '清空缓存',
    
    // COS settings
    'settings.cos.section.title': '图片上传设置',
    'settings.cos.provider.name': '云存储服务商',
    'settings.cos.provider.desc': '选择要使用的云对象存储服务商',
    'settings.cos.provider.aliyun': '阿里云 OSS',
    'settings.cos.provider.tencent': '腾讯云 COS',
    'settings.cos.provider.aws': 'AWS S3',
    'settings.cos.provider.cloudflare': 'Cloudflare R2',
    'settings.cos.secret.id.name': 'Access Key ID / Secret ID',
    'settings.cos.secret.id.desc': '云存储服务的访问密钥ID',
    'settings.cos.secret.id.placeholder': '输入Access Key ID或Secret ID',
    'settings.cos.secret.key.name': 'Access Key Secret / Secret Key',
    'settings.cos.secret.key.desc': '云存储服务的访问密钥',
    'settings.cos.secret.key.placeholder': '输入Access Key Secret或Secret Key',
    'settings.cos.bucket.name': 'Bucket名称',
    'settings.cos.bucket.desc': '存储桶名称',
    'settings.cos.bucket.placeholder': '输入bucket名称',
    'settings.cos.endpoint.name': 'Endpoint',
    'settings.cos.endpoint.desc': '服务端点地址（仅Cloudflare R2需要）',
    'settings.cos.endpoint.placeholder': '例如：https://accountid.r2.cloudflarestorage.com',
    'settings.cos.region.name': 'Region',
    'settings.cos.region.desc': '区域设置（所有服务商都需要）',
    'settings.cos.region.placeholder': '例如：cn-hangzhou、ap-beijing、us-east-1',
    'settings.cos.cdn.name': 'CDN地址',
    'settings.cos.cdn.desc': 'CDN域名，用于生成访问链接',
    'settings.cos.cdn.placeholder': '例如：https://cdn.example.com',
    'settings.cos.keep.local.name': '保留图片在本地',
    'settings.cos.keep.local.desc': '上传后是否在本地保留图片副本',
    'settings.cos.local.path.name': '本地存储路径',
    'settings.cos.local.path.desc': '本地保存图片的目录（相对于vault根目录）',
    'settings.cos.local.path.placeholder': '例如：assets',
    'settings.cos.upload.path.name': '上传路径模板',
    'settings.cos.upload.path.desc': '支持占位符：{PATH}（当前文件路径）、{FILENAME}（文件名）、{FOLDER}（文件夹名）、{YYYY}（年）、{MM}（月）、{DD}（日）',
    'settings.cos.upload.path.placeholder': '例如：images/{YYYY}/{MM}/{DD}',
    'settings.cos.test.name': '测试COS配置',
    'settings.cos.test.desc': '测试当前COS配置是否可用',
    'settings.cos.test.button': '测试连接',
    'settings.cos.test.loading': '测试中...',
    
    // Notification messages
    'notice.settings.saved': '设置已保存',
    'notice.config.required': '请先配置GitHub Token和仓库地址',
    'notice.url.required': '请先输入GitHub仓库路径',
    'notice.url.test.success': 'URL格式正确！',
    'notice.url.test.failed': 'URL格式不正确，请检查格式。详情请查看控制台。',
    'notice.init.error': '初始化仓库时发生错误',
    'notice.sync.error': '强制同步时发生错误',
    'notice.diagnose.result': 'Vault中共有 {total} 个文件，其中 {syncable} 个可同步。详情请查看控制台。',
    'notice.result.with.count': '{message}，处理了 {count} 个文件',
    'notice.cache.cleared': '已清空 {count} 个文件的缓存',
    'notice.cache.clear.error': '清空缓存时发生错误',
    
    // Sync operations
    'sync.success': '同步成功: {filename}',
    'sync.failed': '同步失败: {message}',
    'sync.error': '同步时发生错误',
    'pull.success': '拉取成功: {filename}',
    'pull.failed': '拉取失败: {message}',
    'pull.error': '拉取时发生错误',
    
    // Repository operations
    'vault.not.empty': 'Vault不为空，无法初始化',
    'repo.init.success': '仓库初始化成功',
    'repo.init.failed': '仓库初始化失败: {error}',
    'force.sync.remote.to.local.success': '强制同步远端到本地成功',
    'force.sync.remote.to.local.failed': '强制同步远端到本地失败: {error}',
    'no.syncable.files.in.vault': 'Vault中没有可同步的文件',
    'force.sync.local.to.remote.success.no.failures': '强制同步本地到远端成功',
    'force.sync.local.to.remote.success': '强制同步本地到远端完成，成功: {processed}，失败: {failed}',
    'force.sync.local.to.remote.failed': '强制同步本地到远端失败: {error}',
    
    // Actions
    'actions.sync.current.to.remote': '同步当前文件到远端',
    'actions.pull.remote.to.current': '从远端拉取到当前文件',
    
    // Date
    'date.today': '今天',
    'date.yesterday': '昨天',
    
    // GitHub API Error
    'github.api.rate.limit.exceeded': 'GitHub API调用次数已达上限。请等待 {minutes} 分钟后重试。',
    'github.api.rate.limit.warning': '⚠️ GitHub API调用次数剩余 {remaining} 次，请谨慎使用。',
    'github.api.rate.limit.notice': '速率限制超出',
    'github.api.token.invalid': 'GitHub Token无效或已过期。请检查：\n1. Token是否正确\n2. Token是否有足够的权限\n3. Token是否已过期',
    'github.api.rate.limit.hourly': 'GitHub API调用次数已达上限（每小时5000次）。\n请等待 {minutes} 分钟后重试，或使用GitHub Pro账号获得更高限额。',
    'github.api.repo.not.found': '仓库不存在或无访问权限。请检查：\n1. 仓库地址是否正确\n2. Token是否有访问该仓库的权限\n3. 仓库是否为私有仓库',
    'github.api.file.conflict': '文件冲突。远程文件已被其他人修改。\n请先同步远程更改，然后重试。',
    'github.api.validation.failed': 'GitHub API验证失败。请检查：\n1. 文件路径是否正确\n2. 文件内容是否符合要求\n3. 仓库权限设置',
    'github.api.server.error': 'GitHub服务器错误（{status}）。请稍后重试。',
    'github.api.network.error': '网络连接错误。请检查：\n1. 网络连接是否正常\n2. 防火墙设置\n3. 代理配置',
    'github.api.timeout.error': '请求超时。请检查网络连接或稍后重试。',
    'github.api.unknown.error': '未知错误：{message}',
    'github.api.access.denied': 'GitHub访问被拒绝。可能原因：\n1. Token权限不足\n2. 仓库为私有且Token无访问权限\n3. 仓库不存在',
    'github.api.resource.not.found': '资源未找到。请检查：\n1. 仓库路径是否正确\n2. 文件路径是否存在\n3. Token是否有访问该仓库的权限',
    'github.api.file.conflict.detailed': '文件冲突。可能原因：\n1. 文件在远程已被修改\n2. 请先从远端同步最新版本',
    'github.api.invalid.request': '请求参数无效。请检查：\n1. 文件内容是否过大（>100MB）\n2. 文件路径格式是否正确',
    'github.api.server.error.detailed': 'GitHub服务器错误，请稍后重试。如果问题持续存在，请检查GitHub服务状态。',
    'github.api.error.with.status': 'GitHub API错误 ({status}): {message}',
    'github.api.network.failed': '网络连接失败。请检查：\n1. 网络连接是否正常\n2. 是否能访问github.com\n3. 防火墙或代理设置',
    'github.api.timeout.detailed': '请求超时。请检查网络连接或稍后重试。',
    'github.api.operation.failed': '操作失败: {message}',
    'github.api.retry.hint': '💡 提示：这是临时性错误，稍后可以重试',
    'github.api.invalid.url.format': '无效的仓库URL格式',
    'github.api.rate.limit.exceeded.short': 'GitHub API调用次数已达上限，请稍后重试',
    'github.api.file.upload.success': '文件上传成功',
    'github.api.all.files.download.success': '所有文件下载成功',
    
    // Status bar
    'status.bar.checking': '检查中...',
    'status.bar.sync': '同步',
    'status.bar.rate.limit': 'API限制: 等待{minutes}分钟',
    'status.bar.last.modified': '上次更新: {date}',
    'status.bar.not.published': '未发布',
    'status.bar.check.failed': '检查失败',
    'status.bar.not.configured': '未配置',
    'status.bar.local.modified': '本地已修改',
    'status.bar.synced': '已同步',
    
    // Plugin info
    'plugin.name': 'Git同步',
    'command.show.sync.menu': '显示同步菜单',
    
    // Test URL results
    'test.url.user': '用户',
    'test.url.repo': '仓库',
    'test.url.path': '路径',
    'test.url.root': '根目录',
    
    // Path info
    'path.info.empty': '请输入GitHub仓库路径以查看同步目标',
    'path.info.sync.to': '当前 Vault 内容将同步到 {owner}/{repo} 仓库',
    'path.info.folder': ' 的 {path} 文件夹下',
    'path.info.root': ' 的根目录下',
    'path.info.error': '路径格式不正确，请使用: https://github.com/用户名/仓库名/路径 或 用户名/仓库名/路径',
    
    // COS upload messages
    'cos.upload.success': '图片上传成功',
    'cos.upload.failed': '图片上传失败：{error}',
    'cos.upload.uploading': '正在上传图片...',
    'cos.test.success': 'COS配置测试成功',
    'cos.test.failed': 'COS配置测试失败：{error}',
    'cos.error.unsupported.provider': '不支持的云存储服务商：{provider}',
    'cos.error.upload.failed': '上传失败：{error}',
    'cos.error.aliyun.upload.failed': '阿里云OSS上传失败（{status}）：{error}',
    'cos.error.tencent.upload.failed': '腾讯云COS上传失败（{status}）：{error}',
    'cos.error.aws.upload.failed': 'AWS S3上传失败（{status}）：{error}',
    'cos.error.cloudflare.upload.failed': 'Cloudflare R2上传失败（{status}）：{error}',
    'cos.error.config.invalid': 'COS配置不完整，请检查配置项',
    'cos.paste.placeholder': '![上传中...]({filename})',
  },
  en: {
    // Settings interface
    'settings.title': 'Git Sync Settings',
    'settings.language.name': 'Interface Language',
    'settings.language.desc': 'Select the display language for the plugin interface',
    'settings.language.auto': 'Follow Obsidian',
    'settings.github.token.name': 'GitHub Personal Token',
    'settings.github.token.desc': 'Enter your GitHub Personal Access Token',
    'settings.github.token.placeholder': 'ghp_xxxxxxxxxxxx',
    'settings.github.repo.name': 'GitHub Repository Path',
    'settings.github.repo.desc': 'Supports two formats:\n1. https://github.com/username/repo/path\n2. username/repo/path',
    'settings.github.repo.placeholder': 'https://github.com/Xheldon/git-sync/data/_post',
    'settings.ribbon.name': 'Show plugin button in sidebar',
    'settings.ribbon.desc': 'When enabled, display plugin button in left sidebar for quick access to settings',
    'settings.save.name': 'Save Settings',
    'settings.save.desc': 'Save current configuration settings',
    'settings.save.button': 'Save Settings',
    'settings.diagnose.name': 'Diagnose Vault Files',
    'settings.diagnose.desc': 'Check which files in current Vault can be synchronized',
    'settings.diagnose.button': 'Diagnose',
    'settings.test.url.name': 'Test Repository URL',
    'settings.test.url.desc': 'Verify if GitHub repository path format is correct',
    'settings.test.url.button': 'Test URL',
    'settings.sponsor.name': '💖 Support Developer',
    'settings.sponsor.desc': 'If this plugin helps you, consider buying me a coffee! Your support motivates me to continue development.',
    'settings.sponsor.button': '💝 PayPal Sponsor',
    'settings.sponsor.section.title': 'Sponsor',
    'settings.danger.zone.title': 'Danger Zone',
    'settings.init.name': 'Initialize Repository',
    'settings.init.desc': 'Available when Vault is empty, sync remote files to local',
    'settings.init.button': 'Initialize Repository',
    'settings.init.loading': 'Initializing...',
    'settings.sync.remote.to.local.name': 'Force Sync Remote to Local',
    'settings.sync.remote.to.local.desc': 'Sync all remote files to local Vault, existing files will be overwritten',
    'settings.sync.remote.to.local.button': 'Force Sync to Local',
    'settings.sync.remote.to.local.loading': 'Syncing...',
    'settings.sync.local.to.remote.name': 'Force Sync Local to Remote',
    'settings.sync.local.to.remote.desc': 'Sync all local Vault files to remote repository, existing files will be overwritten',
    'settings.sync.local.to.remote.button': 'Force Sync to Remote',
    'settings.sync.local.to.remote.loading': 'Syncing...',
    'settings.clear.cache.name': 'Clear File Cache',
    'settings.clear.cache.desc': 'Clear all file status cache, will fetch from GitHub on next view',
    'settings.clear.cache.button': 'Clear Cache',
    
    // COS settings
    'settings.cos.section.title': 'Image Upload Settings',
    'settings.cos.provider.name': 'Cloud Storage Provider',
    'settings.cos.provider.desc': 'Select the cloud object storage service to use',
    'settings.cos.provider.aliyun': 'Aliyun OSS',
    'settings.cos.provider.tencent': 'Tencent COS',
    'settings.cos.provider.aws': 'AWS S3',
    'settings.cos.provider.cloudflare': 'Cloudflare R2',
    'settings.cos.secret.id.name': 'Access Key ID / Secret ID',
    'settings.cos.secret.id.desc': 'Access key ID for cloud storage service',
    'settings.cos.secret.id.placeholder': 'Enter Access Key ID or Secret ID',
    'settings.cos.secret.key.name': 'Access Key Secret / Secret Key',
    'settings.cos.secret.key.desc': 'Access key secret for cloud storage service',
    'settings.cos.secret.key.placeholder': 'Enter Access Key Secret or Secret Key',
    'settings.cos.bucket.name': 'Bucket Name',
    'settings.cos.bucket.desc': 'Storage bucket name',
    'settings.cos.bucket.placeholder': 'Enter bucket name',
    'settings.cos.endpoint.name': 'Endpoint',
    'settings.cos.endpoint.desc': 'Service endpoint address (only required for Cloudflare R2)',
    'settings.cos.endpoint.placeholder': 'e.g.: https://accountid.r2.cloudflarestorage.com',
    'settings.cos.region.name': 'Region',
    'settings.cos.region.desc': 'Region setting (required for all providers)',
    'settings.cos.region.placeholder': 'e.g.: cn-hangzhou, ap-beijing, us-east-1',
    'settings.cos.cdn.name': 'CDN URL',
    'settings.cos.cdn.desc': 'CDN domain for generating access links',
    'settings.cos.cdn.placeholder': 'e.g.: https://cdn.example.com',
    'settings.cos.keep.local.name': 'Keep Images Locally',
    'settings.cos.keep.local.desc': 'Whether to keep a local copy of images after upload',
    'settings.cos.local.path.name': 'Local Storage Path',
    'settings.cos.local.path.desc': 'Directory to save images locally (relative to vault root)',
    'settings.cos.local.path.placeholder': 'e.g.: assets',
    'settings.cos.upload.path.name': 'Upload Path Template',
    'settings.cos.upload.path.desc': 'Supports placeholders: {PATH} (current file path), {FILENAME} (file name), {FOLDER} (folder name), {YYYY} (year), {MM} (month), {DD} (day)',
    'settings.cos.upload.path.placeholder': 'e.g.: images/{YYYY}/{MM}/{DD}',
    'settings.cos.test.name': 'Test COS Configuration',
    'settings.cos.test.desc': 'Test if current COS configuration is available',
    'settings.cos.test.button': 'Test Connection',
    'settings.cos.test.loading': 'Testing...',
    
    // Notification messages
    'notice.settings.saved': 'Settings saved',
    'notice.config.required': 'Please configure GitHub Token and repository address first',
    'notice.url.required': 'Please enter GitHub repository path first',
    'notice.url.test.success': 'URL format is correct!',
    'notice.url.test.failed': 'URL format is incorrect, please check format. See console for details.',
    'notice.init.error': 'Error occurred during repository initialization',
    'notice.sync.error': 'Error occurred during force sync',
    'notice.diagnose.result': 'Vault has {total} files in total, {syncable} can be synced. See console for details.',
    'notice.result.with.count': '{message}, processed {count} files',
    'notice.cache.cleared': 'Cleared cache for {count} files',
    'notice.cache.clear.error': 'Error occurred while clearing cache',
    
    // Sync operations
    'sync.success': 'Sync success: {filename}',
    'sync.failed': 'Sync failed: {message}',
    'sync.error': 'Error occurred during sync',
    'pull.success': 'Pull success: {filename}',
    'pull.failed': 'Pull failed: {message}',
    'pull.error': 'Error occurred during pull',
    
    // Repository operations
    'vault.not.empty': 'Vault is not empty, cannot initialize',
    'repo.init.success': 'Repository initialized successfully',
    'repo.init.failed': 'Repository initialization failed: {error}',
    'force.sync.remote.to.local.success': 'Force sync remote to local success',
    'force.sync.remote.to.local.failed': 'Force sync remote to local failed: {error}',
    'no.syncable.files.in.vault': 'No syncable files in vault',
    'force.sync.local.to.remote.success.no.failures': 'Force sync local to remote success',
    'force.sync.local.to.remote.success': 'Force sync local to remote completed, success: {processed}, failed: {failed}',
    'force.sync.local.to.remote.failed': 'Force sync local to remote failed: {error}',
    
    // Actions
    'actions.sync.current.to.remote': 'Sync current file to remote',
    'actions.pull.remote.to.current': 'Pull remote to current file',
    
    // Date
    'date.today': 'Today',
    'date.yesterday': 'Yesterday',
    
    // GitHub API errors
    'github.api.rate.limit.exceeded': 'GitHub API rate limit exceeded. Please wait {minutes} minutes before retrying.',
    'github.api.rate.limit.warning': '⚠️ GitHub API calls remaining: {remaining}. Please use carefully.',
    'github.api.rate.limit.notice': 'Rate limit exceeded',
    'github.api.token.invalid': 'GitHub Token is invalid or expired. Please check:\n1. Token is correct\n2. Token has sufficient permissions\n3. Token has not expired',
    'github.api.rate.limit.hourly': 'GitHub API hourly rate limit exceeded (5000 per hour).\nPlease wait {minutes} minutes or use GitHub Pro for higher limits.',
    'github.api.repo.not.found': 'Repository not found or no access permission. Please check:\n1. Repository URL is correct\n2. Token has access to this repository\n3. Repository is not private',
    'github.api.file.conflict': 'File conflict. Remote file has been modified by others.\nPlease sync remote changes first, then retry.',
    'github.api.validation.failed': 'GitHub API validation failed. Please check:\n1. File path is correct\n2. File content meets requirements\n3. Repository permission settings',
    'github.api.server.error': 'GitHub server error ({status}). Please retry later.',
    'github.api.network.error': 'Network connection error. Please check:\n1. Network connection is normal\n2. Firewall settings\n3. Proxy configuration',
    'github.api.timeout.error': 'Request timeout. Please check network connection or retry later.',
    'github.api.unknown.error': 'Unknown error: {message}',
    'github.api.access.denied': 'GitHub access denied. Possible reasons:\n1. Insufficient token permissions\n2. Repository is private and token has no access\n3. Repository does not exist',
    'github.api.resource.not.found': 'Resource not found. Please check:\n1. Repository path is correct\n2. File path exists\n3. Token has access to this repository',
    'github.api.file.conflict.detailed': 'File conflict. Possible reasons:\n1. File has been modified remotely\n2. Please sync from remote first',
    'github.api.invalid.request': 'Invalid request parameters. Please check:\n1. File content is not too large (>100MB)\n2. File path format is correct',
    'github.api.server.error.detailed': 'GitHub server error, please retry later. If problem persists, check GitHub service status.',
    'github.api.error.with.status': 'GitHub API error ({status}): {message}',
    'github.api.network.failed': 'Network connection failed. Please check:\n1. Network connection is normal\n2. Can access github.com\n3. Firewall or proxy settings',
    'github.api.timeout.detailed': 'Request timeout. Please check network connection or retry later.',
    'github.api.operation.failed': 'Operation failed: {message}',
    'github.api.retry.hint': '💡 Tip: This is a temporary error, you can retry later',
    'github.api.invalid.url.format': 'Invalid repository URL format',
    'github.api.rate.limit.exceeded.short': 'GitHub API rate limit exceeded, please retry later',
    'github.api.file.upload.success': 'File uploaded successfully',
    'github.api.all.files.download.success': 'All files downloaded successfully',
    
    // Status bar
    'status.bar.checking': 'Checking...',
    'status.bar.sync': 'Sync',
    'status.bar.rate.limit': 'API limit: wait {minutes} minutes',
    'status.bar.last.modified': 'Last modified: {date}',
    'status.bar.not.published': 'Not published',
    'status.bar.check.failed': 'Check failed',
    'status.bar.not.configured': 'Not configured',
    'status.bar.local.modified': 'Local modified',
    'status.bar.synced': 'Synced',
    
    // Plugin info
    'plugin.name': 'Git Sync',
    'command.show.sync.menu': 'Show Sync Menu',
    
    // Test URL results
    'test.url.user': 'User',
    'test.url.repo': 'Repo',
    'test.url.path': 'Path',
    'test.url.root': 'Root',
    
    // Path info
    'path.info.empty': 'Enter GitHub repository path to view sync target',
    'path.info.sync.to': 'Current Vault content will sync to {owner}/{repo} repository',
    'path.info.folder': ' under {path} folder',
    'path.info.root': ' under root directory',
    'path.info.error': 'Path format is incorrect, please use: https://github.com/username/repo/path or username/repo/path',
    
    // COS upload messages
    'cos.upload.success': 'Image uploaded successfully',
    'cos.upload.failed': 'Image upload failed: {error}',
    'cos.upload.uploading': 'Uploading image...',
    'cos.test.success': 'COS configuration test successful',
    'cos.test.failed': 'COS configuration test failed: {error}',
    'cos.error.unsupported.provider': 'Unsupported cloud storage provider: {provider}',
    'cos.error.upload.failed': 'Upload failed: {error}',
    'cos.error.aliyun.upload.failed': 'Aliyun OSS upload failed ({status}): {error}',
    'cos.error.tencent.upload.failed': 'Tencent COS upload failed ({status}): {error}',
    'cos.error.aws.upload.failed': 'AWS S3 upload failed ({status}): {error}',
    'cos.error.cloudflare.upload.failed': 'Cloudflare R2 upload failed ({status}): {error}',
    'cos.error.config.invalid': 'COS configuration is incomplete, please check settings',
    'cos.paste.placeholder': '![Uploading...]({filename})',
  }
};

// Current language
let currentLanguage: Language = 'auto';

// Detect Obsidian's language settings
function detectObsidianLanguage(): 'zh' | 'en' {
  // Check Obsidian's language settings - more accurate method
  const obsidianLang = localStorage.getItem('language') || 
                      (window as any).app?.vault?.adapter?.path?.locale ||
                      (window as any).moment?.locale();
  
  // Check browser language
  const browserLang = navigator.language || navigator.languages?.[0] || 'en';
  
  // If it's Chinese-related language code, return Chinese
  if (obsidianLang?.includes('zh') || browserLang.startsWith('zh')) {
    return 'zh';
  }
  
  // Default return English
  return 'en';
}

// Get the actual language used
export function getActualLanguage(): 'zh' | 'en' {
  if (currentLanguage === 'auto') {
    return detectObsidianLanguage();
  }
  return currentLanguage as 'zh' | 'en';
}

// Set current language
export function setLanguage(language: Language): void {
  currentLanguage = language;
}

// Get current language
export function getCurrentLanguage(): Language {
  return currentLanguage;
}

// Translation function
export function t(key: string, params?: Record<string, string | number>): string {
  const actualLang = getActualLanguage();
  const translation = translations[actualLang][key as keyof typeof translations['zh']];
  
  if (!translation) {
    console.warn(`Translation missing for key: ${key}`);
    return key;
  }

  // If there are parameters, perform replacement
  if (params) {
    return Object.entries(params).reduce((text, [paramKey, paramValue]) => {
      return text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    }, translation);
  }

  return translation;
}

// Get all supported languages
export function getSupportedLanguages(): Array<{ value: Language; label: string }> {
  // Detect system language for displaying content in parentheses
  const detectedLang = detectObsidianLanguage();
  const detectedLangText = detectedLang === 'zh' ? '中文' : 'English';
  
  // Determine the display text for "Follow" based on current plugin language
  const currentLang = getActualLanguage();
  const followText = currentLang === 'zh' ? '跟随Obsidian' : 'Follow Obsidian';
  
  const autoLabel = `${followText} (${detectedLangText})`;
    
  return [
    { value: 'auto', label: autoLabel },
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' },
  ];
} 