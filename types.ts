export interface CosProviderConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  endpoint: string;
  cdnUrl: string;
  region: string;
}

export interface GitSyncSettings {
  githubToken: string;
  repositoryUrl: string; // Format: @https://github.com/user/repo/path/to/folder
  lastSyncTime: number;
  showRibbonIcon: boolean; // Whether to show sidebar button
  language: 'zh' | 'en' | 'auto'; // Language setting, auto means follow system
  
  // Image processing settings
  enableImageProcessing: boolean; // Whether to enable image processing and upload functionality
  
  // COS (Cloud Object Storage) settings
  cosProvider: 'aliyun' | 'tencent' | 'aws' | 'cloudflare'; // Current selected provider
  cosConfigs: {
    aliyun: CosProviderConfig;
    tencent: CosProviderConfig;
    aws: CosProviderConfig;
    cloudflare: CosProviderConfig;
  };
  
  // Local image storage settings
  keepLocalImages: boolean; // Whether to keep images locally after upload
  localImagePath: string; // Local path for storing images (relative to vault root)
  
  // Image upload path template
  imageUploadPath: string; // Path template with placeholders: PATH, FILENAME, FOLDER, YYYY, MM, DD
}

export const DEFAULT_SETTINGS: GitSyncSettings = {
  githubToken: '',
  repositoryUrl: '',
  lastSyncTime: 0,
  showRibbonIcon: true,
  language: 'auto', // Follow Obsidian language setting
  
  // Image processing defaults
  enableImageProcessing: false,
  
  // COS default settings
  cosProvider: 'aliyun',
  cosConfigs: {
    aliyun: {
      secretId: '',
      secretKey: '',
      bucket: '',
      endpoint: '',
      cdnUrl: '',
      region: ''
    },
    tencent: {
      secretId: '',
      secretKey: '',
      bucket: '',
      endpoint: '',
      cdnUrl: '',
      region: ''
    },
    aws: {
      secretId: '',
      secretKey: '',
      bucket: '',
      endpoint: '',
      cdnUrl: '',
      region: ''
    },
    cloudflare: {
      secretId: '',
      secretKey: '',
      bucket: '',
      endpoint: '',
      cdnUrl: '',
      region: ''
    }
  },
  
  // Local image storage defaults
  keepLocalImages: false,
  localImagePath: 'assets',
  
  // Image upload path template default
  imageUploadPath: 'images/{YYYY}/{MM}/{DD}'
};

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  filesProcessed?: number;
}

// File cache status
export interface FileCache {
  filePath: string; // File path in Obsidian
  githubPath: string; // File path in GitHub
  lastModified: string; // Last modified time
  sha: string; // SHA value of GitHub file
  isPublished: boolean; // Whether published to GitHub
  isSynced: boolean; // Whether synced with GitHub
  cacheTime: number; // Cache timestamp
  fileSize: number; // File size
  contentHash: string; // File content hash for detecting local modifications
}

// Cache manager interface
export interface FileCacheManager {
  getFileCache(filePath: string): FileCache | null;
  setFileCache(filePath: string, cache: FileCache): void;
  removeFileCache(filePath: string): void;
  clearCache(): void;
  isCacheValid(cache: FileCache, maxAge?: number): boolean;
  getAllCachedFiles(): FileCache[];
}

// COS upload result
export interface CosUploadResult {
  success: boolean;
  message: string;
  url?: string; // Final accessible URL
  key?: string; // Object key in COS
}

// COS configuration for different providers
export interface CosConfig {
  provider: 'aliyun' | 'tencent' | 'aws' | 'cloudflare';
  secretId: string;
  secretKey: string;
  bucket: string;
  endpoint: string;
  cdnUrl: string;
  region: string;
}

// Image paste context
export interface ImagePasteContext {
  file: File;
  fileName: string;
  currentFilePath: string; // Current markdown file path
  localPath?: string; // Local storage path (if keepLocalImages is true)
  remotePath: string; // Remote COS path
}