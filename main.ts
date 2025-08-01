import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, Menu, TFolder } from 'obsidian';

// Extended types for better type safety
interface ExtendedApp extends App {
	setting: {
		open(): void;
		openTabById(id: string): void;
	};
}

interface ExtendedEditor extends Editor {
	containerEl?: HTMLElement;
}
import { GitSyncSettings, DEFAULT_SETTINGS, SyncResult, CosConfig, ImagePasteContext, CosProviderConfig } from './types';
import { GitHubService } from './github-service';
import { setLanguage, t, getSupportedLanguages, getActualLanguage } from './i18n-simple';
import { FileCacheService } from './file-cache';
import { CosService, parseImagePath } from './cos-service';

// Debug logging function - only logs in development mode
function debugLog(...args: any[]): void {
	// Only log in development mode (when plugin is loaded from file system)
	if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
		console.log('[Git Folder Sync]', ...args);
	}
}

export default class GitSyncPlugin extends Plugin {
	settings: GitSyncSettings;
	githubService: GitHubService;
	fileCacheService: FileCacheService;
	ribbonIconEl: HTMLElement | null = null;
	statusBarEl: HTMLElement | null = null;
	currentFile: TFile | null = null;
	private fileModifyTimeout: NodeJS.Timeout | null = null;
	private isProcessingImagePaste: boolean = false;

	async onload() {
		await this.loadSettings();
		
		// Initialize language settings
		setLanguage(this.settings.language);
		
		this.githubService = new GitHubService(this.settings.githubToken);
		this.fileCacheService = new FileCacheService();

		// Add ribbon icon based on settings
		this.updateRibbonIcon();

		// Add status bar
		this.statusBarEl = this.addStatusBarItem();
		this.statusBarEl.addClass('git-sync-status-bar');

		// Listen for file switching events
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.updateStatusBar();
			})
		);

		// Listen for file open events
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				this.currentFile = file;
				this.updateStatusBar();
			})
		);

		// Listen for file content modification events
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				// Only handle markdown files that are currently open
				if (file.path.endsWith('.md') && this.currentFile && file.path === this.currentFile.path) {
					debugLog(`Detected file modification: ${file.path}`);
					// Type conversion to TFile
					if (file instanceof TFile) {
						this.onFileContentModified(file);
					}
				}
			})
		);

		// Listen for paste events to handle image uploads
		// Use capture phase to intercept events before Obsidian's handlers
		this.registerDomEvent(document, 'paste', this.handlePasteEvent.bind(this), { capture: true });
		
		// Also listen on the workspace container to catch events that might bypass document listener
		this.registerDomEvent(document.body, 'paste', this.handlePasteEvent.bind(this), { capture: true });

		// Add sync button to note editing interface
		this.addCommand({
			id: 'show-sync-menu',
			name: t('command.show.sync.menu'),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.showSyncMenu(editor, view);
			}
		});

		// Add editor right-click menu
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				menu.addItem((item) => {
					item
						.setTitle(t('plugin.name'))
						.setIcon('sync')
						.onClick(async () => {
							this.showSyncMenu(editor, view);
						});
				});
			})
		);

		// Add settings page
		this.addSettingTab(new GitSyncSettingTab(this.app, this));

		// Initial status bar update
		this.updateStatusBar();
	}

	onunload() {
		// Clean up timers
		if (this.fileModifyTimeout) {
			clearTimeout(this.fileModifyTimeout);
			this.fileModifyTimeout = null;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.githubService.updateToken(this.settings.githubToken);
		// Update language settings
		setLanguage(this.settings.language);
		// Update ribbon icon display state
		this.updateRibbonIcon();
	}

	private updateRibbonIcon() {
		// Remove existing button
		if (this.ribbonIconEl) {
			this.ribbonIconEl.remove();
			this.ribbonIconEl = null;
		}

		// Add button based on settings
		if (this.settings.showRibbonIcon) {
							this.ribbonIconEl = this.addRibbonIcon('settings', t('settings.title'), (evt: MouseEvent) => {
				// Directly open plugin settings interface
				(this.app as ExtendedApp).setting.open();
				(this.app as ExtendedApp).setting.openTabById(this.manifest.id);
			});
		}
	}

	private showSyncMenu(editor: Editor, view: MarkdownView) {
		const menu = new Menu();
		
		menu.addItem((item) => {
			item
				.setTitle(t('actions.sync.current.to.remote'))
				.setIcon('upload')
				.onClick(async () => {
					await this.syncCurrentFileToRemote(view.file);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle(t('actions.pull.remote.to.current'))
				.setIcon('download')
				.onClick(async () => {
					await this.pullRemoteToCurrentFile(view.file);
				});
		});

		const rect = (editor as ExtendedEditor).containerEl?.getBoundingClientRect();
		if (rect) {
			menu.showAtPosition({ x: rect.right - 100, y: rect.top + 50 });
		} else {
					// If unable to get editor position, show at mouse position
		menu.showAtMouseEvent(new MouseEvent('click'));
		}
	}

	async syncCurrentFileToRemote(file: TFile): Promise<void> {
		if (!this.settings.githubToken || !this.settings.repositoryUrl) {
			new Notice(t('settings.github.token.or.repo.not.configured'));
			return;
		}

		try {
			const content = await this.app.vault.read(file);
			const result = await this.githubService.uploadFile(
				this.settings.repositoryUrl,
				file.path,
				content
			);

			if (result.success) {
				new Notice(t('sync.success', { filename: file.name }));
				
				// Update cache - file synced to remote
				await this.fileCacheService.updateFileCache(
					file.path,
					file.path,
					new Date().toISOString(), // Use current time as last modified time
					'', // SHA value can be obtained from upload result later
					true, // Published
					this.app.vault
				);
			} else {
				new Notice(t('sync.failed', { message: result.message }));
			}
		} catch (error) {
			console.error('File sync failed:', error);
			new Notice(t('sync.error'));
		}
	}

	async pullRemoteToCurrentFile(file: TFile): Promise<void> {
		if (!this.settings.githubToken || !this.settings.repositoryUrl) {
			new Notice(t('settings.github.token.or.repo.not.configured'));
			return;
		}

		try {
			const result = await this.githubService.downloadFile(
				this.settings.repositoryUrl,
				file.path
			);

			if (result.success && result.content) {
				await this.app.vault.modify(file, result.content);
				new Notice(t('pull.success', { filename: file.name }));
				
				// Update cache - file synced from remote
				await this.fileCacheService.updateFileCache(
					file.path,
					file.path,
					new Date().toISOString(), // Use current time as last modified time
					'', // SHA value can be obtained from download result later
					true, // Published
					this.app.vault
				);
			} else {
				new Notice(t('pull.failed', { message: result.message }));
			}
		} catch (error) {
			console.error('File pull failed:', error);
			new Notice(t('pull.error'));
		}
	}

	async initializeRepository(): Promise<SyncResult> {
		if (!this.isVaultEmpty()) {
			return { success: false, message: t('vault.not.empty') };
		}

		try {
			const result = await this.githubService.downloadAllFiles(this.settings.repositoryUrl);
			if (result.success && result.files) {
				for (const file of result.files) {
					await this.createFileInVault(file.path, file.content || '');
					
					// Update cache - file initialized from remote
					await this.fileCacheService.updateFileCache(
						file.path,
						file.path,
						new Date().toISOString(), // Use current time as last modified time
						'', // SHA value can be obtained from download result later
						true, // Published
						this.app.vault
					);
				}
				
				// Refresh status bar display
				setTimeout(() => this.updateStatusBar(), 2000);
				
				return { success: true, message: t('repo.init.success'), filesProcessed: result.files.length };
			}
			return { success: false, message: result.message };
		} catch (error) {
			return { success: false, message: t('repo.init.failed', { error: error.message }) };
		}
	}

	async forceSyncRemoteToLocal(): Promise<SyncResult> {
		try {
			const result = await this.githubService.downloadAllFiles(this.settings.repositoryUrl);
			if (result.success && result.files) {
				for (const file of result.files) {
					await this.createFileInVault(file.path, file.content || '');
					
					// Update cache - file synced from remote
					await this.fileCacheService.updateFileCache(
						file.path,
						file.path,
						new Date().toISOString(), // Use current time as last modified time
						'', // SHA value can be obtained from download result later
						true, // Published
						this.app.vault
					);
				}
				
				// Refresh status bar display
				setTimeout(() => this.updateStatusBar(), 2000);
				
				return { success: true, message: t('force.sync.remote.to.local.success'), filesProcessed: result.files.length };
			}
			return { success: false, message: result.message };
		} catch (error) {
			return { success: false, message: t('force.sync.remote.to.local.failed', { error: error.message }) };
		}
	}

	async forceSyncLocalToRemote(): Promise<SyncResult> {
		try {
			const files = this.getAllVaultFiles();
			debugLog('Found files:', files.map(f => f.path));
			
			if (files.length === 0) {
				return { success: false, message: t('no.syncable.files.in.vault') };
			}

			let processed = 0;
			let failed = 0;

			for (const file of files) {
				try {
					const content = await this.app.vault.read(file);
					const result = await this.githubService.uploadFile(
						this.settings.repositoryUrl,
						file.path,
						content
					);
					
					if (result.success) {
						processed++;
						debugLog(`Successfully synced file: ${file.path}`);
						
						// Update cache immediately - file synced to remote
						await this.fileCacheService.updateFileCache(
							file.path,
							file.path,
							new Date().toISOString(), // Use current time as last modified time
							'', // SHA value can be obtained from upload result later
							true, // Published
							this.app.vault
						);
					} else {
						failed++;
						console.error(`File sync failed: ${file.path}`, result.message);
					}
				} catch (error) {
					failed++;
					console.error(`Failed to read or sync file: ${file.path}`, error);
				}
			}

			const message = failed > 0 
				? t('force.sync.local.to.remote.success', { processed, failed })
				: t('force.sync.local.to.remote.success.no.failures');

			// Refresh status bar display
			setTimeout(() => this.updateStatusBar(), 2000);

			return { success: true, message, filesProcessed: processed };
		} catch (error) {
			console.error('Force sync failed:', error);
			return { success: false, message: t('force.sync.local.to.remote.failed', { error: error.message }) };
		}
	}

	private isVaultEmpty(): boolean {
		const files = this.app.vault.getFiles();
		return files.filter(file => !file.path.startsWith(this.app.vault.configDir)).length === 0;
	}

	private getAllVaultFiles(): TFile[] {
		const allFiles = this.app.vault.getFiles();
		debugLog('All files in vault:', allFiles.map(f => f.path));
		
		// Filter out files in config folder and local image path (if configured)
		const filteredFiles = allFiles.filter(file => {
			// Always exclude Obsidian config folder
			if (file.path.startsWith(this.app.vault.configDir)) {
				return false;
			}
			
			// Exclude local image path if keepLocalImages is enabled and localImagePath is set
			if (this.settings.keepLocalImages && this.settings.localImagePath) {
				const normalizedImagePath = this.settings.localImagePath.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
				if (normalizedImagePath && file.path.startsWith(normalizedImagePath + '/')) {
					debugLog(`Excluding file from sync (in image directory): ${file.path}`);
					return false;
				}
			}
			
			return true;
		});
		
		debugLog('Filtered files:', filteredFiles.map(f => f.path));
		
		return filteredFiles;
	}

	private async createFileInVault(path: string, content: string): Promise<void> {
		const folderPath = path.substring(0, path.lastIndexOf('/'));
		if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
			await this.app.vault.createFolder(folderPath);
		}

		const existingFile = this.app.vault.getAbstractFileByPath(path);
		if (existingFile instanceof TFile) {
			await this.app.vault.modify(existingFile, content);
		} else {
			await this.app.vault.create(path, content);
		}
	}

	private async updateStatusBar() {
		if (!this.statusBarEl) return;

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || !activeFile.path.endsWith('.md')) {
			this.statusBarEl.empty();
			this.statusBarEl.removeClass('visible');
			this.statusBarEl.addClass('hidden');
			return;
		}

		this.currentFile = activeFile;
		this.statusBarEl.removeClass('hidden');
			this.statusBarEl.addClass('visible');
		this.statusBarEl.empty();

		// Create status text
		const statusText = this.statusBarEl.createEl('span', {
			cls: 'git-sync-status-text',
			text: t('status.bar.checking')
		});

		// Create sync button
		const syncButton = this.statusBarEl.createEl('button', {
			cls: 'git-sync-status-button',
			text: t('status.bar.sync')
		});

		// Check file remote status
		if (this.settings.githubToken && this.settings.repositoryUrl) {
			try {
				// First check cache
				const cache = this.fileCacheService.getFileCache(activeFile.path);
				
				if (cache) {
					// Use cached data
					debugLog(`Using cached data to display file status: ${activeFile.path}`);
					
					if (cache.isPublished) {
						const date = new Date(cache.lastModified);
						let statusMsg = t('status.bar.last.modified', { date: this.formatDate(date) });
						
																	// Use isSynced status from cache directly, no need to recalculate hash
				if (!cache.isSynced) {
						statusMsg += ` (${t('status.bar.local.modified')})`;
						statusText.addClass('modified');
					} else {
						statusMsg += ` (${t('status.bar.synced')})`;
						statusText.addClass('synced');
					}
						
						statusText.textContent = statusMsg;
					} else {
						statusText.textContent = t('status.bar.not.published');
						statusText.addClass('not-published');
					}
					
					// Asynchronously update cache if it's about to expire
					if (!this.fileCacheService.isCacheValid(cache, 4 * 60 * 1000)) { // Start async refresh after 4 minutes
						this.refreshFileCache(activeFile.path).catch(console.error);
					}
				} else {
					// No cache, need to fetch from GitHub
					debugLog(`No cache, fetching file status from GitHub: ${activeFile.path}`);
					await this.fetchAndCacheFileStatus(activeFile.path, statusText);
				}
			} catch (error) {
				console.error('Failed to update status bar:', error);
				statusText.textContent = t('status.bar.check.failed');
			}
		} else {
			statusText.textContent = t('status.bar.not.configured');
		}

		// Add button click event
		syncButton.addEventListener('click', (e) => {
			e.stopPropagation();
			this.showSyncMenuForStatusBar(activeFile);
		});
	}

	/**
	 * Handle file content modification events (with debounce)
	 */
	private async onFileContentModified(file: TFile) {
		// Clear previous timer
		if (this.fileModifyTimeout) {
			clearTimeout(this.fileModifyTimeout);
		}

		// Set debounce, execute after 2000ms
		this.fileModifyTimeout = setTimeout(async () => {
			try {
				// Get current file cache
				const cache = this.fileCacheService.getFileCache(file.path);
				if (!cache) {
					// No cache, update status bar directly
					this.updateStatusBar();
					return;
				}

				// Check if file was actually modified
				const content = await this.app.vault.read(file);
				const currentHash = FileCacheService.calculateContentHash(content);
				
				if (currentHash !== cache.contentHash) {
					debugLog(`File content modified: ${file.path}`);
					
					// Update content hash and sync status in cache
					const updatedCache = {
						...cache,
						contentHash: currentHash,
						isSynced: false, // Mark as not synced
						cacheTime: Date.now()
					};
					
					this.fileCacheService.setFileCache(file.path, updatedCache);
					
					// Update status bar display immediately
					this.updateStatusBar();
				}
			} catch (error) {
				console.error('Failed to handle file modification event:', error);
			}
		}, 2000);
	}

	/**
	 * Fetch file status from GitHub and cache it
	 */
	private async fetchAndCacheFileStatus(filePath: string, statusText: HTMLElement) {
		try {
			// Check rate limit status first
			const rateLimitCheck = await this.githubService.checkRateLimit();
			
			if (!rateLimitCheck.canProceed) {
				statusText.textContent = t('status.bar.rate.limit', { minutes: rateLimitCheck.waitMinutes });
				return;
			}

			const result = await this.githubService.getFileLastModified(
				this.settings.repositoryUrl,
				filePath
			);

			if (result.success) {
				if (result.exists && result.lastModified) {
					const date = new Date(result.lastModified);
					statusText.textContent = t('status.bar.last.modified', { date: this.formatDate(date) });
					statusText.addClass('normal');
					
					// Update cache
					await this.fileCacheService.updateFileCache(
						filePath,
						filePath, // GitHub path same as local path
						result.lastModified,
						'', // SHA value temporarily empty, can be obtained from other APIs later
						true,
						this.app.vault
					);
				} else {
					statusText.textContent = t('status.bar.not.published');
					statusText.addClass('not-published');
					
					// Cache unpublished status
					await this.fileCacheService.updateFileCache(
						filePath,
						filePath,
						'',
						'',
						false,
						this.app.vault
					);
				}
			} else {
				statusText.textContent = t('status.bar.check.failed');
			}
		} catch (error) {
			console.error('Failed to fetch file status:', error);
			statusText.textContent = t('status.bar.check.failed');
		}
	}

	/**
	 * Asynchronously refresh file cache
	 */
	private async refreshFileCache(filePath: string) {
		try {
			debugLog(`Asynchronously refreshing file cache: ${filePath}`);
			
			// Lightweight rate limit check - temporarily skip, let GitHub API handle rate limits itself

			const result = await this.githubService.getFileLastModified(
				this.settings.repositoryUrl,
				filePath
			);

			if (result.success) {
				await this.fileCacheService.updateFileCache(
					filePath,
					filePath,
					result.lastModified || '',
					'', // SHA value temporarily empty
					result.exists || false,
					this.app.vault
				);
				debugLog(`File cache refreshed: ${filePath}`);
			}
		} catch (error) {
			console.error('Failed to refresh file cache:', error);
		}
	}

	private showSyncMenuForStatusBar(file: TFile) {
		const menu = new Menu();
		
		menu.addItem((item) => {
			item
				.setTitle(t('actions.sync.current.to.remote'))
				.setIcon('upload')
				.onClick(async () => {
					await this.syncCurrentFileToRemote(file);
					// Update status bar
					setTimeout(() => this.updateStatusBar(), 1000);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle(t('actions.pull.remote.to.current'))
				.setIcon('download')
				.onClick(async () => {
					await this.pullRemoteToCurrentFile(file);
					// Update status bar
					setTimeout(() => this.updateStatusBar(), 1000);
				});
		});

		// Show menu near status bar button
		const rect = this.statusBarEl?.getBoundingClientRect();
		if (rect) {
			menu.showAtPosition({ x: rect.left, y: rect.top - 10 });
		}
	}

	private formatDate(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			return t('date.today');
		} else if (diffDays === 1) {
			return t('date.yesterday');
		} else if (diffDays < 7) {
			return t('date.days.ago', { days: diffDays });
		} else {
			return date.toLocaleDateString('zh-CN');
		}
	}

	/**
	 * Handle paste events for image upload
	 */
	async handlePasteEvent(event: ClipboardEvent): Promise<void> {
		// Only handle paste events in markdown editor
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || !this.currentFile) {
			return;
		}

		// Check if clipboard contains files
		const clipboardData = event.clipboardData;
		if (!clipboardData || !clipboardData.files || clipboardData.files.length === 0) {
			return;
		}

		// Check if there are any image files in clipboard
		const imageFiles: File[] = [];
		for (let i = 0; i < clipboardData.files.length; i++) {
			const file = clipboardData.files[i];
			if (file.type.startsWith('image/')) {
				imageFiles.push(file);
			}
		}

		// If no image files, let Obsidian handle it normally
		if (imageFiles.length === 0) {
			return;
		}

		// If image processing is disabled, let Obsidian handle it normally
		if (!this.settings.enableImageProcessing) {
			return;
		}

		// If image processing is enabled, we take control immediately
		// Prevent default paste behavior as early as possible
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();

		// Set flag to indicate image paste is being processed
		this.isProcessingImagePaste = true;

		// Check if COS is configured for upload
		const cosConfigured = this.isCosConfigured();

		// Process each image file
		for (const file of imageFiles) {
			try {
				if (cosConfigured) {
					// Upload to COS and insert CDN link
					await this.handleImageUpload(file, activeView.editor);
				} else if (this.settings.keepLocalImages && this.settings.localImagePath) {
					// Only save locally and insert local link
					await this.handleLocalImageOnly(file, activeView.editor);
				} else {
					// Show notice that configuration is needed
					new Notice(t('cos.upload.no.config'));
				}
			} catch (error) {
				console.error('Error handling image:', error);
				new Notice(t('cos.upload.failed', { error: error.message }));
			}
		}

		// Reset flag after processing all images
		this.isProcessingImagePaste = false;
	}

	/**
	 * Get current COS configuration
	 */
	getCurrentCosConfig(): CosProviderConfig {
		return this.settings.cosConfigs[this.settings.cosProvider];
	}

	/**
	 * Update current COS configuration
	 */
	updateCurrentCosConfig(updates: Partial<CosProviderConfig>): void {
		const currentConfig = this.getCurrentCosConfig();
		Object.assign(currentConfig, updates);
	}

	/**
	 * Clear current COS configuration
	 */
	clearCurrentCosConfig(): void {
		const emptyConfig: CosProviderConfig = {
			secretId: '',
			secretKey: '',
			bucket: '',
			endpoint: '',
			cdnUrl: '',
			region: ''
		};
		this.settings.cosConfigs[this.settings.cosProvider] = emptyConfig;
	}

	/**
	 * Check if COS is properly configured
	 */
	private isCosConfigured(): boolean {
		const currentConfig = this.getCurrentCosConfig();
		const requiredFields = [
			currentConfig.secretId,
			currentConfig.secretKey,
			currentConfig.bucket,
			currentConfig.region // Region is required for all providers
		];

		// Add provider-specific required fields
		if (this.settings.cosProvider === 'cloudflare') {
			requiredFields.push(currentConfig.endpoint); // Endpoint only required for Cloudflare R2
		}

		return requiredFields.every(field => field && field.trim().length > 0);
	}

	/**
	 * Handle single image upload
	 */
	private async handleImageUpload(file: File, editor: Editor): Promise<void> {
		// Generate unique filename
		const timestamp = Date.now();
		const extension = file.name.split('.').pop() || 'png';
		const fileName = `image-${timestamp}.${extension}`;

		// Parse upload path
		const remotePath = parseImagePath(this.settings.imageUploadPath, {
			currentFilePath: this.currentFile!.path,
			fileName: fileName
		});

		// Create placeholder text
		const placeholder = t('cos.paste.placeholder', { filename: fileName });
		const cursorPos = editor.getCursor();
		
		// Insert placeholder at cursor position
		editor.replaceRange(placeholder, cursorPos);
		
		// Show upload notification
		const uploadNotice = new Notice(t('cos.upload.uploading'), 0);

		try {
			// Create COS configuration
			const currentConfig = this.getCurrentCosConfig();
			const cosConfig: CosConfig = {
				provider: this.settings.cosProvider,
				secretId: currentConfig.secretId,
				secretKey: currentConfig.secretKey,
				bucket: currentConfig.bucket,
				endpoint: currentConfig.endpoint,
				cdnUrl: currentConfig.cdnUrl,
				region: currentConfig.region
			};

			// Upload to COS
			const cosService = new CosService(cosConfig);
			const uploadResult = await cosService.uploadFile(file, remotePath);

			if (uploadResult.success && uploadResult.url) {
				// Replace placeholder with actual image link
				const imageMarkdown = `![${fileName}](${uploadResult.url})`;
				const currentContent = editor.getValue();
				const updatedContent = currentContent.replace(placeholder, imageMarkdown);
				editor.setValue(updatedContent);

				// Save local copy if enabled
				if (this.settings.keepLocalImages && this.settings.localImagePath) {
					await this.saveLocalImageCopy(file, fileName);
				}

				// Hide upload notification and show success
				uploadNotice.hide();
				new Notice(t('cos.upload.success'));

				debugLog('Image uploaded successfully:', uploadResult.url);
			} else {
				throw new Error(uploadResult.message || 'Upload failed');
			}
		} catch (error) {
			// Remove placeholder on error
			const currentContent = editor.getValue();
			const updatedContent = currentContent.replace(placeholder, '');
			editor.setValue(updatedContent);

			// Hide upload notification and show error
			uploadNotice.hide();
			new Notice(t('cos.upload.failed', { error: error.message }));
			
			console.error('Image upload failed:', error);
			throw error; // Re-throw to be handled by the caller
		}
	}

	/**
	 * Handle local image storage only (when COS is not configured)
	 */
	private async handleLocalImageOnly(file: File, editor: Editor): Promise<void> {
		// Generate unique filename
		const timestamp = Date.now();
		const extension = file.name.split('.').pop() || 'png';
		const fileName = `image-${timestamp}.${extension}`;

		try {
			// Save image locally using the configured local path
			const localPath = parseImagePath(this.settings.localImagePath, {
				currentFilePath: this.currentFile!.path,
				fileName: fileName
			});

			// Create directory if it doesn't exist
			const dirPath = localPath.substring(0, localPath.lastIndexOf('/'));
			if (dirPath) {
				try {
					await this.app.vault.createFolder(dirPath);
				} catch (error) {
					// Folder might already exist, ignore error
				}
			}

			// Convert File to ArrayBuffer
			const arrayBuffer = await file.arrayBuffer();
			
			// Save file to vault
			await this.app.vault.createBinary(localPath, arrayBuffer);

			// Insert image link at cursor position
			const imageMarkdown = `![${fileName}](${localPath})`;
			const cursorPos = editor.getCursor();
			editor.replaceRange(imageMarkdown, cursorPos);

			new Notice(t('cos.upload.success'));
			debugLog('Image saved locally:', localPath);
		} catch (error) {
			new Notice(t('cos.upload.failed', { error: error.message }));
			console.error('Local image save failed:', error);
		}
	}

	/**
	 * Save image copy locally if enabled
	 */
	private async saveLocalImageCopy(file: File, fileName: string): Promise<void> {
		try {
			const localPath = parseImagePath(this.settings.localImagePath, {
				currentFilePath: this.currentFile!.path,
				fileName: fileName
			});

			// Create directory if it doesn't exist
			const dirPath = localPath.substring(0, localPath.lastIndexOf('/'));
			if (dirPath) {
				try {
					await this.app.vault.createFolder(dirPath);
				} catch (error) {
					// Folder might already exist, ignore error
				}
			}

			// Convert File to ArrayBuffer
			const arrayBuffer = await file.arrayBuffer();
			
			// Save file to vault
			await this.app.vault.createBinary(localPath, arrayBuffer);
			
			debugLog('Local image copy saved:', localPath);
		} catch (error) {
			console.warn('Failed to save local image copy:', error);
		}
	}
}

class GitSyncSettingTab extends PluginSettingTab {
	plugin: GitSyncPlugin;

	constructor(app: App, plugin: GitSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: t('settings.title') });

		// Language setting - put at the beginning
		new Setting(containerEl)
			.setName(t('settings.language.name'))
			.setDesc(t('settings.language.desc'))
			.addDropdown(dropdown => {
				const languages = getSupportedLanguages();
				languages.forEach(lang => {
					dropdown.addOption(lang.value, lang.label);
				});
				dropdown.setValue(this.plugin.settings.language);
				dropdown.onChange(async (value) => {
					this.plugin.settings.language = value as 'zh' | 'en' | 'auto';
					await this.plugin.saveSettings();
					// Re-render settings interface
					this.display();
				});
			});

		new Setting(containerEl)
			.setName(t('settings.github.token.name'))
			.setDesc(t('settings.github.token.desc'))
			.addText(text => text
				.setPlaceholder(t('settings.github.token.placeholder'))
				.setValue(this.plugin.settings.githubToken)
				.onChange(async (value) => {
					this.plugin.settings.githubToken = value;
					await this.plugin.saveSettings();
				}));

		let pathInfoEl: HTMLElement;
		new Setting(containerEl)
			.setName(t('settings.github.repo.name'))
			.setDesc(t('settings.github.repo.desc'))
			.addText(text => text
				.setPlaceholder(t('settings.github.repo.placeholder'))
				.setValue(this.plugin.settings.repositoryUrl)
				.onChange(async (value) => {
					this.plugin.settings.repositoryUrl = value;
					this.updatePathInfo(pathInfoEl, value);
					await this.plugin.saveSettings();
				}));

		// Add path description display area
		pathInfoEl = containerEl.createEl('div', { 
			cls: 'setting-item-description git-sync-path-info',
			text: this.getPathInfoText(this.plugin.settings.repositoryUrl)
		});

		// Test repository URL button - put below repository path
		new Setting(containerEl)
			.setName(t('settings.test.url.name'))
			.setDesc(t('settings.test.url.desc'))
			.addButton(button => button
				.setButtonText(t('settings.test.url.button'))
				.onClick(async () => {
					if (!this.plugin.settings.repositoryUrl) {
						new Notice(t('notice.url.required'));
						return;
					}

					if (!this.plugin.settings.githubToken) {
						new Notice(t('notice.token.required'));
						return;
					}

					// Set loading state
					button.setButtonText(t('settings.test.url.loading'));
					button.setDisabled(true);

					try {
						debugLog('=== Testing GitHub Connection ===');
						debugLog('Input URL:', this.plugin.settings.repositoryUrl);
						
						// Test connection (includes URL parsing, token validation, and repository access)
						const testResult = await this.plugin.githubService.testConnection(this.plugin.settings.repositoryUrl);
						
						if (testResult.success) {
							debugLog('Connection test successful:', testResult);
							new Notice(testResult.message, 8000);
						} else {
							debugLog('Connection test failed:', testResult.message);
							new Notice(testResult.message, 6000);
						}
					} catch (error) {
						debugLog('Connection test error:', error);
						new Notice(t('github.api.operation.failed', { message: error.message }), 6000);
					} finally {
						// Reset button state
						button.setButtonText(t('settings.test.url.button'));
						button.setDisabled(false);
					}
				}));

		// Sidebar button display toggle
		new Setting(containerEl)
			.setName(t('settings.ribbon.name'))
			.setDesc(t('settings.ribbon.desc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showRibbonIcon)
				.onChange(async (value) => {
					this.plugin.settings.showRibbonIcon = value;
					await this.plugin.saveSettings();
				}));

		// Image processing main section
		containerEl.createEl('h2', { 
			text: t('settings.image.section.title'),
			cls: 'git-sync-section-title' 
		});

		// Enable image processing toggle
		new Setting(containerEl)
			.setName(t('settings.image.enable.name'))
			.setDesc(t('settings.image.enable.desc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableImageProcessing)
				.onChange(async (value) => {
					this.plugin.settings.enableImageProcessing = value;
					await this.plugin.saveSettings();
					// Re-render to show/hide image processing settings
					this.display();
				}));

		// Only show image processing settings if enabled
		if (this.plugin.settings.enableImageProcessing) {
			// Cloud provider settings subsection
			containerEl.createEl('h3', { 
				text: t('settings.cos.provider.section.title'),
				cls: 'git-sync-subsection-title' 
			});

			// Cloud storage provider
			new Setting(containerEl)
				.setName(t('settings.cos.provider.name'))
				.setDesc(t('settings.cos.provider.desc'))
				.addDropdown(dropdown => {
					dropdown.addOption('aliyun', t('settings.cos.provider.aliyun'));
					dropdown.addOption('tencent', t('settings.cos.provider.tencent'));
					dropdown.addOption('aws', t('settings.cos.provider.aws'));
					dropdown.addOption('cloudflare', t('settings.cos.provider.cloudflare'));
					
					dropdown.setValue(this.plugin.settings.cosProvider);
					dropdown.onChange(async (value) => {
						this.plugin.settings.cosProvider = value as 'aliyun' | 'tencent' | 'aws' | 'cloudflare';
						await this.plugin.saveSettings();
						// Re-render settings to show/hide region field and load saved config
						this.display();
					});
				});

			// Get current config for the selected provider
			const currentConfig = this.plugin.getCurrentCosConfig();

			// Secret ID
			new Setting(containerEl)
				.setName(t('settings.cos.secret.id.name') + ' *')
				.setDesc(t('settings.cos.secret.id.desc'))
				.addText(text => text
					.setPlaceholder(t('settings.cos.secret.id.placeholder'))
					.setValue(currentConfig.secretId)
					.onChange(async (value) => {
						this.plugin.updateCurrentCosConfig({ secretId: value });
						await this.plugin.saveSettings();
					}));

			// Secret Key
			new Setting(containerEl)
				.setName(t('settings.cos.secret.key.name') + ' *')
				.setDesc(t('settings.cos.secret.key.desc'))
				.addText(text => text
					.setPlaceholder(t('settings.cos.secret.key.placeholder'))
					.setValue(currentConfig.secretKey)
					.onChange(async (value) => {
						this.plugin.updateCurrentCosConfig({ secretKey: value });
						await this.plugin.saveSettings();
					}));

			// Bucket
			new Setting(containerEl)
				.setName(t('settings.cos.bucket.name') + ' *')
				.setDesc(t('settings.cos.bucket.desc'))
				.addText(text => text
					.setPlaceholder(t('settings.cos.bucket.placeholder'))
					.setValue(currentConfig.bucket)
					.onChange(async (value) => {
						this.plugin.updateCurrentCosConfig({ bucket: value });
						await this.plugin.saveSettings();
					}));

			// Region (required for all providers)
			new Setting(containerEl)
				.setName(t('settings.cos.region.name') + ' *')
				.setDesc(t('settings.cos.region.desc'))
				.addText(text => text
					.setPlaceholder(t('settings.cos.region.placeholder'))
					.setValue(currentConfig.region)
					.onChange(async (value) => {
						this.plugin.updateCurrentCosConfig({ region: value });
						await this.plugin.saveSettings();
					}));

			// Endpoint (only for Cloudflare R2)
			if (this.plugin.settings.cosProvider === 'cloudflare') {
				new Setting(containerEl)
					.setName(t('settings.cos.endpoint.name') + ' *')
					.setDesc(t('settings.cos.endpoint.desc'))
					.addText(text => text
						.setPlaceholder(t('settings.cos.endpoint.placeholder'))
						.setValue(currentConfig.endpoint)
						.onChange(async (value) => {
							this.plugin.updateCurrentCosConfig({ endpoint: value });
							await this.plugin.saveSettings();
						}));
			}

			// CDN URL
			new Setting(containerEl)
				.setName(t('settings.cos.cdn.name'))
				.setDesc(t('settings.cos.cdn.desc'))
				.addText(text => text
					.setPlaceholder(t('settings.cos.cdn.placeholder'))
					.setValue(currentConfig.cdnUrl)
					.onChange(async (value) => {
						this.plugin.updateCurrentCosConfig({ cdnUrl: value });
						await this.plugin.saveSettings();
					}));

			// Clear current configuration button
			new Setting(containerEl)
				.setName(t('settings.cos.clear.name'))
				.setDesc(t('settings.cos.clear.desc'))
				.addButton(button => button
					.setButtonText(t('settings.cos.clear.button'))
					.setWarning()
					.onClick(async () => {
						this.plugin.clearCurrentCosConfig();
						await this.plugin.saveSettings();
						new Notice(t('settings.cos.clear.success'));
						// Re-render to show cleared fields
						this.display();
					}));

			// Test COS configuration
			new Setting(containerEl)
				.setName(t('settings.cos.test.name'))
				.setDesc(t('settings.cos.test.desc'))
				.addButton(button => button
					.setButtonText(t('settings.cos.test.button'))
					.onClick(async () => {
						// Validate required fields based on provider
						const requiredFields = [
							currentConfig.secretId,
							currentConfig.secretKey,
							currentConfig.bucket,
							currentConfig.region // Region is required for all providers
						];

						// Add provider-specific required fields
						if (this.plugin.settings.cosProvider === 'cloudflare') {
							requiredFields.push(currentConfig.endpoint); // Endpoint only required for Cloudflare R2
						}

						if (requiredFields.some(field => !field.trim())) {
							new Notice(t('cos.error.config.invalid'));
							return;
						}

						// Set loading state
						button.setButtonText(t('settings.cos.test.loading'));
						button.setDisabled(true);

						try {
							const cosConfig = {
								provider: this.plugin.settings.cosProvider,
								secretId: currentConfig.secretId,
								secretKey: currentConfig.secretKey,
								bucket: currentConfig.bucket,
								endpoint: currentConfig.endpoint,
								cdnUrl: currentConfig.cdnUrl,
								region: currentConfig.region
							};

							const cosService = new (await import('./cos-service')).CosService(cosConfig);
							const result = await cosService.testConnection();

							if (result.success) {
								new Notice(t('cos.test.success'));
							} else {
								new Notice(t('cos.test.failed', { error: result.message }));
							}
						} catch (error) {
							console.error('COS test error:', error);
							new Notice(t('cos.test.failed', { error: error.message }));
						} finally {
							button.setButtonText(t('settings.cos.test.button'));
							button.setDisabled(false);
						}
					}));

			// Image upload settings subsection
			containerEl.createEl('h3', { 
				text: t('settings.image.upload.section.title'),
				cls: 'git-sync-subsection-title' 
			});

			// Keep images locally
			new Setting(containerEl)
				.setName(t('settings.cos.keep.local.name'))
				.setDesc(t('settings.cos.keep.local.desc'))
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.keepLocalImages)
					.onChange(async (value) => {
						this.plugin.settings.keepLocalImages = value;
						await this.plugin.saveSettings();
						// Re-render to show/hide local path setting
						this.display();
					}));

			// Local storage path (only when keepLocalImages is true)
			if (this.plugin.settings.keepLocalImages) {
				new Setting(containerEl)
					.setName(t('settings.cos.local.path.name'))
					.setDesc(t('settings.cos.local.path.desc'))
					.addText(text => text
						.setPlaceholder(t('settings.cos.local.path.placeholder'))
						.setValue(this.plugin.settings.localImagePath)
						.onChange(async (value) => {
							this.plugin.settings.localImagePath = value;
							await this.plugin.saveSettings();
						}));
			}

			// Upload path template
			new Setting(containerEl)
				.setName(t('settings.cos.upload.path.name'))
				.setDesc(t('settings.cos.upload.path.desc'))
				.addText(text => text
					.setPlaceholder(t('settings.cos.upload.path.placeholder'))
					.setValue(this.plugin.settings.imageUploadPath)
					.onChange(async (value) => {
						this.plugin.settings.imageUploadPath = value;
						await this.plugin.saveSettings();
					}));
		}



		// Danger zone title
		containerEl.createEl('h2', { 
			text: t('settings.danger.zone.title'),
			cls: 'danger-zone'
		});

		// Initialize repository
		new Setting(containerEl)
			.setName(t('settings.init.name'))
			.setDesc(t('settings.init.desc'))
			.addButton(button => {
				const isVaultEmpty = this.isVaultEmpty();
				button
					.setButtonText(t('settings.init.button'))
					.setDisabled(!isVaultEmpty)
					.onClick(async () => {
						if (!this.plugin.settings.githubToken || !this.plugin.settings.repositoryUrl) {
							new Notice(t('notice.config.required'));
							return;
						}

						button.setButtonText(t('settings.init.loading'));
						button.setDisabled(true);
						
						try {
							const result = await this.plugin.initializeRepository();
							if (result.success) {
								new Notice(t('notice.result.with.count', { message: result.message, count: result.filesProcessed }));
							} else {
								new Notice(result.message);
							}
						} catch (error) {
							new Notice(t('notice.init.error'));
						} finally {
							button.setButtonText(t('settings.init.button'));
							button.setDisabled(!this.isVaultEmpty());
						}
					});
				
				if (isVaultEmpty) {
					button.setCta();
				}
			});

		// Force sync remote to local
		new Setting(containerEl)
			.setName(t('settings.sync.remote.to.local.name'))
			.setDesc(t('settings.sync.remote.to.local.desc'))
			.addButton(button => button
				.setButtonText(t('settings.sync.remote.to.local.button'))
				.setWarning()
				.onClick(async () => {
					if (!this.plugin.settings.githubToken || !this.plugin.settings.repositoryUrl) {
						new Notice(t('notice.config.required'));
						return;
					}

					button.setButtonText(t('settings.sync.remote.to.local.loading'));
					button.setDisabled(true);
					
					try {
						const result = await this.plugin.forceSyncRemoteToLocal();
						if (result.success) {
							new Notice(t('notice.result.with.count', { message: result.message, count: result.filesProcessed }));
						} else {
							new Notice(result.message);
						}
					} catch (error) {
						new Notice(t('notice.sync.error'));
					} finally {
						button.setButtonText(t('settings.sync.remote.to.local.button'));
						button.setDisabled(false);
					}
				}));

		// Force sync local to remote
		new Setting(containerEl)
			.setName(t('settings.sync.local.to.remote.name'))
			.setDesc(t('settings.sync.local.to.remote.desc'))
			.addButton(button => button
				.setButtonText(t('settings.sync.local.to.remote.button'))
				.setWarning()
				.onClick(async () => {
					if (!this.plugin.settings.githubToken || !this.plugin.settings.repositoryUrl) {
						new Notice(t('notice.config.required'));
						return;
					}

					button.setButtonText(t('settings.sync.local.to.remote.loading'));
					button.setDisabled(true);
					
					try {
						const result = await this.plugin.forceSyncLocalToRemote();
						if (result.success) {
							new Notice(t('notice.result.with.count', { message: result.message, count: result.filesProcessed }));
						} else {
							new Notice(result.message);
						}
					} catch (error) {
						new Notice(t('notice.sync.error'));
					} finally {
						button.setButtonText(t('settings.sync.local.to.remote.button'));
						button.setDisabled(false);
					}
				}));

		// Clear file cache
		new Setting(containerEl)
			.setName(t('settings.clear.cache.name'))
			.setDesc(t('settings.clear.cache.desc'))
			.addButton(button => button
				.setButtonText(t('settings.clear.cache.button'))
				.onClick(async () => {
					try {
						const stats = this.plugin.fileCacheService.getCacheStats();
						this.plugin.fileCacheService.clearCache();
						new Notice(t('notice.cache.cleared', { count: stats.totalFiles }));
					} catch (error) {
						new Notice(t('notice.cache.clear.error'));
					}
				}));

		// Sponsor title
		containerEl.createEl('h2', { 
			text: t('settings.sponsor.section.title'),
			cls: 'sponsor'
		});

		// Sponsor section
		const sponsorSection = containerEl.createEl('div', { cls: 'setting-item' });
		const sponsorInfo = sponsorSection.createEl('div', { cls: 'setting-item-info' });
		sponsorInfo.createEl('div', { 
			cls: 'setting-item-name', 
			text: t('settings.sponsor.name') 
		});
		sponsorInfo.createEl('div', { 
			cls: 'setting-item-description', 
			text: t('settings.sponsor.desc') 
		});
		
		const sponsorControl = sponsorSection.createEl('div', { 
			cls: getActualLanguage() === 'zh' ? 'setting-item-control git-sync-sponsor-control' : 'setting-item-control'
		});
		
		// PayPal sponsor button
		const sponsorButton = sponsorControl.createEl('a', {
			cls: 'mod-cta git-sync-sponsor-button',
			text: t('settings.sponsor.button'),
			href: 'https://paypal.me/xheldoncao'
		});
		
		// Show China mainland donation channel if Chinese interface
		if (getActualLanguage() === 'zh') {
			// Display China mainland donation channel on new line
			const chinaSponsorContainer = sponsorControl.createEl('div', {
				cls: 'git-sync-china-sponsor'
			});
			chinaSponsorContainer.createEl('span', {
				text: t('settings.sponsor.china.label') + ': '
			});
			const chinaLink = chinaSponsorContainer.createEl('a', {
				text: 'https://www.xheldon.com/donate/',
				href: 'https://www.xheldon.com/donate/'
			});
		}
	}

	private isVaultEmpty(): boolean {
		const files = this.app.vault.getFiles();
		return files.filter(file => !file.path.startsWith(this.app.vault.configDir)).length === 0;
	}

	private updatePathInfo(el: HTMLElement, value: string) {
		if (el) {
			el.empty();
			el.createEl('span', { text: this.getPathInfoText(value) });
		}
	}

		private getPathInfoText(value: string): string {
		if (!value) {
			return t('path.info.empty');
		}

		// Use GitHub service parsing method
		const parseResult = this.plugin.githubService.parseRepositoryUrl(value);
		
		if (parseResult) {
			let pathInfo = t('path.info.sync.to', { owner: parseResult.owner, repo: parseResult.repo });
			if (parseResult.path) {
				pathInfo += t('path.info.folder', { path: parseResult.path });
			} else {
				pathInfo += t('path.info.root');
			}
			return pathInfo;
		}
		
		return t('path.info.error');
	}
}