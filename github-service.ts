import { Octokit } from '@octokit/rest';
import { GitHubFile, SyncResult } from './types';
import { Notice } from 'obsidian';
import { t } from './i18n-simple';

export class GitHubService {
  private octokit: Octokit;
  private rateLimitInfo: { remaining: number; resetTime: number } | null = null;

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
    });
  }

  updateToken(token: string) {
    this.octokit = new Octokit({
      auth: token,
    });
    // Reset rate limit information
    this.rateLimitInfo = null;
  }

  // Check rate limit status
  async checkRateLimit(): Promise<{ canProceed: boolean; waitMinutes?: number; message?: string }> {
    try {
      const { data } = await this.octokit.rest.rateLimit.get();
      const core = data.resources.core;
      
      this.rateLimitInfo = {
        remaining: core.remaining,
        resetTime: core.reset
      };

      if (core.remaining === 0) {
        const resetDate = new Date(core.reset * 1000);
        const waitMinutes = Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60));
        
        return {
          canProceed: false,
          waitMinutes,
          message: t('github.api.rate.limit.exceeded', { minutes: waitMinutes })
        };
      }

      // Give warning if remaining requests are low
      if (core.remaining < 10) {
        return {
          canProceed: true,
          message: t('github.api.rate.limit.warning', { remaining: core.remaining })
        };
      }

      return { canProceed: true };
    } catch (error) {
      // If unable to get rate limit info, allow to continue (might be network issue)
      return { canProceed: true };
    }
  }

  // Check rate limit before each API call
  private async beforeApiCall(): Promise<boolean> {
    const rateCheck = await this.checkRateLimit();
    
    if (!rateCheck.canProceed) {
      new Notice(rateCheck.message || t('github.api.rate.limit.notice'), 8000);
      return false;
    }

    if (rateCheck.message && rateCheck.message.includes('⚠️')) {
      new Notice(rateCheck.message, 5000);
    }

    return true;
  }

  private handleGitHubError(error: any): { message: string; isRetryable: boolean } {
    // Check if it's a GitHub API error
    if (error.status) {
      switch (error.status) {
        case 401:
          return {
            message: t('github.api.token.invalid'),
            isRetryable: false
          };
        
        case 403:
          // Check if it's rate limit
          if (error.response?.headers && error.response.headers['x-ratelimit-remaining'] === '0') {
            const resetTime = error.response.headers['x-ratelimit-reset'];
            const resetDate = new Date(parseInt(resetTime) * 1000);
            const waitMinutes = Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60));
            
            return {
              message: t('github.api.rate.limit.hourly', { minutes: waitMinutes }),
              isRetryable: true
            };
          } else {
            return {
              message: t('github.api.access.denied'),
              isRetryable: false
            };
          }
        
        case 404:
          return {
            message: t('github.api.resource.not.found'),
            isRetryable: false
          };
        
        case 409:
          return {
            message: t('github.api.file.conflict.detailed'),
            isRetryable: false
          };
        
        case 422:
          return {
            message: t('github.api.invalid.request'),
            isRetryable: false
          };
        
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            message: t('github.api.server.error.detailed'),
            isRetryable: true
          };
        
        default:
          return {
            message: t('github.api.error.with.status', { status: error.status, message: error.message || 'Unknown error' }),
            isRetryable: false
          };
      }
    }
    
          // Network error
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        message: t('github.api.network.failed'),
        isRetryable: true
      };
    }
    
          // Timeout error
    if (error.code === 'ETIMEDOUT') {
      return {
        message: t('github.api.timeout.detailed'),
        isRetryable: true
      };
    }
    
          // Other errors
    return {
      message: t('github.api.operation.failed', { message: error.message || 'Unknown error' }),
      isRetryable: false
    };
  }

  private showErrorNotice(errorInfo: { message: string; isRetryable: boolean }) {
    const notice = new Notice(errorInfo.message, errorInfo.isRetryable ? 8000 : 5000);
    
    // If it's a retryable error, add retry hint
    if (errorInfo.isRetryable) {
      setTimeout(() => {
        new Notice(t('github.api.retry.hint'), 3000);
      }, 1000);
    }
  }

  public parseRepositoryUrl(url: string): { owner: string; repo: string; path: string } | null {
    // console.log('Parsing repository URL:', url);
    
    if (!url) {
      console.error('URL is empty');
      return null;
    }

    // Remove leading and trailing spaces
    const cleanUrl = url.trim();
    // console.log('Cleaned URL:', cleanUrl);

    // Support two formats:
    // 1. https://github.com/username/repo/path (standard GitHub URL)
    // 2. username/repo/path (short format)
    
    let match;
    
    // Try full GitHub URL format
    match = cleanUrl.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/(.*))?$/);
    if (match) {
      const result = {
        owner: match[1],
        repo: match[2],
        path: match[3] || '',
      };
              // console.log('Parse result (standard GitHub URL):', result);
      return result;
    }
    
          // Try short format username/repo/path
    match = cleanUrl.match(/^([^\/]+)\/([^\/]+)(?:\/(.*))?$/);
    if (match) {
      const result = {
        owner: match[1],
        repo: match[2],
        path: match[3] || '',
      };
              // console.log('Parse result (short format):', result);
      return result;
    }

          console.error('Unable to parse URL format:', cleanUrl);
      console.error('Supported formats:');
      console.error('1. https://github.com/username/repo/path (standard format)');
      console.error('2. username/repo/path (short format)');
    
    return null;
  }

  /**
   * Test GitHub token and repository access
   */
  async testConnection(repositoryUrl: string): Promise<SyncResult & { repoInfo?: { owner: string; repo: string; path: string } }> {
    // First test URL parsing
    const repoInfo = this.parseRepositoryUrl(repositoryUrl);
    if (!repoInfo) {
      return { success: false, message: t('github.api.invalid.url.format') };
    }

    // Check rate limit
    if (!(await this.beforeApiCall())) {
      return { success: false, message: t('github.api.rate.limit.exceeded.short') };
    }

    try {
      // Test token validity by getting user info
      const userResponse = await this.octokit.rest.users.getAuthenticated();
      
      // Test repository access
      const repoResponse = await this.octokit.rest.repos.get({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
      });

      // Test if we can access the specific path (if provided)
      if (repoInfo.path) {
        try {
          await this.octokit.rest.repos.getContent({
            owner: repoInfo.owner,
            repo: repoInfo.repo,
            path: repoInfo.path,
          });
        } catch (error) {
          // Path doesn't exist, but that's okay - we can create it
          if (error.status !== 404) {
            throw error;
          }
        }
      }

      return { 
        success: true, 
        message: t('github.api.connection.test.success', { 
          user: userResponse.data.login,
          repo: `${repoInfo.owner}/${repoInfo.repo}`,
          permissions: repoResponse.data.permissions?.push ? 'read/write' : 'read-only'
        }),
        repoInfo 
      };
    } catch (error) {
      console.error('GitHub connection test failed:', error);
      const errorInfo = this.handleGitHubError(error);
      return { success: false, message: errorInfo.message };
    }
  }

  async uploadFile(repositoryUrl: string, filePath: string, content: string): Promise<SyncResult> {
    const repoInfo = this.parseRepositoryUrl(repositoryUrl);
    if (!repoInfo) {
      return { success: false, message: t('github.api.invalid.url.format') };
    }

    // Check rate limit
    if (!(await this.beforeApiCall())) {
      return { success: false, message: t('github.api.rate.limit.exceeded.short') };
    }

    try {
      const fullPath = repoInfo.path ? `${repoInfo.path}/${filePath}` : filePath;
      
      // First try to get the current SHA of the file (if it exists)
      let sha: string | undefined;
      try {
        const { data } = await this.octokit.rest.repos.getContent({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          path: fullPath,
        });

        if ('sha' in data) {
          sha = data.sha;
        }
              } catch (error) {
          // File doesn't exist, this is normal
        }

              // Upload or update file
      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        path: fullPath,
        message: `Update ${filePath}`,
        content: Buffer.from(content, 'utf8').toString('base64'),
        sha: sha,
      });

              return { success: true, message: t('github.api.file.upload.success') };
    } catch (error) {
      console.error('File upload failed:', error);
      const errorInfo = this.handleGitHubError(error);
      this.showErrorNotice(errorInfo);
      return { success: false, message: errorInfo.message };
    }
  }

  async downloadFile(repositoryUrl: string, filePath: string): Promise<SyncResult & { content?: string }> {
    const repoInfo = this.parseRepositoryUrl(repositoryUrl);
    if (!repoInfo) {
      return { success: false, message: t('github.api.invalid.url.format') };
    }

    // Check rate limit
    if (!(await this.beforeApiCall())) {
      return { success: false, message: t('github.api.rate.limit.exceeded.short') };
    }

    try {
      const fullPath = repoInfo.path ? `${repoInfo.path}/${filePath}` : filePath;
      
      const { data } = await this.octokit.rest.repos.getContent({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        path: fullPath,
      });

      if ('content' in data) {
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        return { success: true, message: '文件下载成功', content };
      } else {
        return { success: false, message: '指定路径不是文件' };
      }
    } catch (error) {
      console.error('File download failed:', error);
      const errorInfo = this.handleGitHubError(error);
      this.showErrorNotice(errorInfo);
      return { success: false, message: errorInfo.message };
    }
  }

  async downloadAllFiles(repositoryUrl: string): Promise<SyncResult & { files?: Array<{ path: string; content: string }> }> {
    const repoInfo = this.parseRepositoryUrl(repositoryUrl);
    if (!repoInfo) {
      return { success: false, message: t('github.api.invalid.url.format') };
    }

    // Check rate limit
    if (!(await this.beforeApiCall())) {
      return { success: false, message: t('github.api.rate.limit.exceeded.short') };
    }

    try {
      const files = await this.getAllFilesRecursively(repoInfo.owner, repoInfo.repo, repoInfo.path);
      const downloadedFiles: Array<{ path: string; content: string }> = [];

      for (const file of files) {
        if (file.type === 'file') {
          try {
            const { data } = await this.octokit.rest.repos.getContent({
              owner: repoInfo.owner,
              repo: repoInfo.repo,
              path: file.path,
            });

            if ('content' in data) {
              const content = Buffer.from(data.content, 'base64').toString('utf8');
              // Remove repository path prefix, keep only relative path
              const relativePath = repoInfo.path ? file.path.replace(`${repoInfo.path}/`, '') : file.path;
              downloadedFiles.push({ path: relativePath, content });
            }
          } catch (error) {
            console.warn(`跳过文件 ${file.path}:`, error);
          }
        }
      }

              return { success: true, message: t('github.api.all.files.download.success'), files: downloadedFiles };
    } catch (error) {
      console.error('Download all files failed:', error);
      const errorInfo = this.handleGitHubError(error);
      this.showErrorNotice(errorInfo);
      return { success: false, message: errorInfo.message };
    }
  }

  private async getAllFilesRecursively(owner: string, repo: string, path: string): Promise<GitHubFile[]> {
    const allFiles: GitHubFile[] = [];

    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });

      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.type === 'file') {
            allFiles.push(item as GitHubFile);
          } else if (item.type === 'dir') {
            const subFiles = await this.getAllFilesRecursively(owner, repo, item.path);
            allFiles.push(...subFiles);
          }
        }
      }
    } catch (error) {
              console.error(`Failed to get directory content ${path}:`, error);
    }

    return allFiles;
  }

  async getFileLastModified(repositoryUrl: string, filePath: string): Promise<{ success: boolean; lastModified?: string; exists: boolean }> {
    const repoInfo = this.parseRepositoryUrl(repositoryUrl);
    if (!repoInfo) {
      return { success: false, exists: false };
    }

    // For status bar queries, we do lightweight rate limit checking
    if (this.rateLimitInfo && this.rateLimitInfo.remaining === 0) {
      return { success: false, exists: false };
    }

    try {
      const fullPath = repoInfo.path ? `${repoInfo.path}/${filePath}` : filePath;
      
      // Get file's commit history, only get the latest one
      const { data } = await this.octokit.rest.repos.listCommits({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        path: fullPath,
        per_page: 1,
      });

      if (data.length > 0) {
        const lastCommit = data[0];
        return { 
          success: true, 
          exists: true,
          lastModified: lastCommit.commit.committer?.date || lastCommit.commit.author?.date 
        };
      } else {
        return { success: true, exists: false };
      }
    } catch (error) {
      console.error('Failed to get file last modified time:', error);
              // For status bar queries, we don't show error notifications, only log in console
      const errorInfo = this.handleGitHubError(error);
      return { success: false, exists: false };
    }
  }
} 