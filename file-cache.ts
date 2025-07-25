import { FileCache, FileCacheManager } from './types';

export class FileCacheService implements FileCacheManager {
  private cache: Map<string, FileCache> = new Map();
  private readonly CACHE_KEY = 'git-sync-file-cache';
  private readonly DEFAULT_CACHE_AGE = 5 * 60 * 1000; // 5 minutes cache validity period

  constructor() {
    this.loadCacheFromStorage();
  }

  /**
   * Load cache from local storage
   */
  private loadCacheFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        const cacheData = JSON.parse(stored);
        this.cache = new Map(Object.entries(cacheData));
        console.log(`Loaded ${this.cache.size} file caches`);
      }
    } catch (error) {
      console.error('Failed to load file cache:', error);
      this.cache.clear();
    }
  }

  /**
   * Save cache to local storage
   */
  private saveCacheToStorage(): void {
    try {
      const cacheObj = Object.fromEntries(this.cache);
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheObj));
    } catch (error) {
      console.error('Failed to save file cache:', error);
    }
  }

  /**
   * Get file cache
   */
  getFileCache(filePath: string): FileCache | null {
    const cache = this.cache.get(filePath);
    if (!cache) {
      console.log(`File ${filePath} has no cache`);
      return null;
    }

    if (!this.isCacheValid(cache)) {
      console.log(`File ${filePath} cache has expired`);
      this.removeFileCache(filePath);
      return null;
    }

          console.log(`File ${filePath} using cache`);
    return cache;
  }

  /**
   * Set file cache
   */
  setFileCache(filePath: string, cache: FileCache): void {
    this.cache.set(filePath, {
      ...cache,
      cacheTime: Date.now()
    });
    this.saveCacheToStorage();
    console.log(`File ${filePath} cache updated`);
  }

  /**
   * Remove file cache
   */
  removeFileCache(filePath: string): void {
    if (this.cache.delete(filePath)) {
      this.saveCacheToStorage();
      console.log(`File ${filePath} cache removed`);
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
    localStorage.removeItem(this.CACHE_KEY);
    console.log('All file caches cleared');
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(cache: FileCache, maxAge?: number): boolean {
    const age = maxAge || this.DEFAULT_CACHE_AGE;
    return (Date.now() - cache.cacheTime) < age;
  }

  /**
   * Get all cached files
   */
  getAllCachedFiles(): FileCache[] {
    return Array.from(this.cache.values());
  }

  /**
   * Calculate file content hash
   */
  static calculateContentHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Check if file has been modified locally
   */
  async checkLocalFileModified(filePath: string, vault: any): Promise<boolean> {
    try {
      const cache = this.getFileCache(filePath);
      if (!cache) return true; // Consider modified when no cache exists

      const file = vault.getAbstractFileByPath(filePath);
      if (!file) return true; // Consider modified when file doesn't exist

      const content = await vault.read(file);
      const currentHash = FileCacheService.calculateContentHash(content);
      
      return currentHash !== cache.contentHash;
    } catch (error) {
      console.error('Failed to check file modification status:', error);
      return true; // Consider modified when error occurs
    }
  }

  /**
   * Update file cache status
   */
  async updateFileCache(
    filePath: string, 
    githubPath: string,
    lastModified: string,
    sha: string,
    isPublished: boolean,
    vault: any
  ): Promise<void> {
    try {
      const file = vault.getAbstractFileByPath(filePath);
      if (!file) return;

      const content = await vault.read(file);
      const contentHash = FileCacheService.calculateContentHash(content);

      const cache: FileCache = {
        filePath,
        githubPath,
        lastModified,
        sha,
        isPublished,
        isSynced: true, // Newly updated cache is considered synced
        cacheTime: Date.now(),
        fileSize: content.length,
        contentHash
      };

      this.setFileCache(filePath, cache);
    } catch (error) {
      console.error('Failed to update file cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalFiles: number;
    publishedFiles: number;
    syncedFiles: number;
    expiredCaches: number;
  } {
    const allCaches = this.getAllCachedFiles();
    const expiredCaches = allCaches.filter(cache => !this.isCacheValid(cache));
    
    return {
      totalFiles: allCaches.length,
      publishedFiles: allCaches.filter(cache => cache.isPublished).length,
      syncedFiles: allCaches.filter(cache => cache.isSynced).length,
      expiredCaches: expiredCaches.length
    };
  }
} 