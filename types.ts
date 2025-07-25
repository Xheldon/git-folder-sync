export interface GitSyncSettings {
  githubToken: string;
  repositoryUrl: string; // Format: @https://github.com/user/repo/path/to/folder
  lastSyncTime: number;
  showRibbonIcon: boolean; // Whether to show sidebar button
  language: 'zh' | 'en' | 'auto'; // Language setting, auto means follow system
}

export const DEFAULT_SETTINGS: GitSyncSettings = {
  githubToken: '',
  repositoryUrl: '',
  lastSyncTime: 0,
  showRibbonIcon: true,
  language: 'auto' // Follow Obsidian language setting
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