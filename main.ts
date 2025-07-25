import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, Menu, TFolder } from 'obsidian';
import { GitSyncSettings, DEFAULT_SETTINGS, SyncResult } from './types';
import { GitHubService } from './github-service';
import { setLanguage, t, getSupportedLanguages, getActualLanguage } from './i18n-simple';
import { FileCacheService } from './file-cache';

export default class GitSyncPlugin extends Plugin {
	settings: GitSyncSettings;
	githubService: GitHubService;
	fileCacheService: FileCacheService;
	ribbonIconEl: HTMLElement | null = null;
	statusBarEl: HTMLElement | null = null;
	currentFile: TFile | null = null;
	private fileModifyTimeout: NodeJS.Timeout | null = null;

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
					console.log(`Detected file modification: ${file.path}`);
					// Type conversion to TFile
					if (file instanceof TFile) {
						this.onFileContentModified(file);
					}
				}
			})
		);

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
				(this.app as any).setting.open();
				(this.app as any).setting.openTabById(this.manifest.id);
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

		const rect = (editor as any).containerEl?.getBoundingClientRect();
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
			console.log('Found files:', files.map(f => f.path));
			
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
						console.log(`Successfully synced file: ${file.path}`);
						
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
		return files.filter(file => !file.path.startsWith('.obsidian')).length === 0;
	}

	private getAllVaultFiles(): TFile[] {
		const allFiles = this.app.vault.getFiles();
		console.log('All files in vault:', allFiles.map(f => f.path));
		
		// Filter out files in .obsidian folder
		const filteredFiles = allFiles.filter(file => !file.path.startsWith('.obsidian'));
		console.log('Filtered files:', filteredFiles.map(f => f.path));
		
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
			this.statusBarEl.style.display = 'none';
			return;
		}

		this.currentFile = activeFile;
		this.statusBarEl.style.display = 'flex';
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
					console.log(`Using cached data to display file status: ${activeFile.path}`);
					
					if (cache.isPublished) {
						const date = new Date(cache.lastModified);
						let statusMsg = t('status.bar.last.modified', { date: this.formatDate(date) });
						
											// Use isSynced status from cache directly, no need to recalculate hash
					if (!cache.isSynced) {
							statusMsg += ` (${t('status.bar.local.modified')})`;
							statusText.style.color = 'var(--color-orange)';
						} else {
							statusMsg += ` (${t('status.bar.synced')})`;
							statusText.style.color = 'var(--color-green)';
						}
						
						statusText.textContent = statusMsg;
					} else {
						statusText.textContent = t('status.bar.not.published');
						statusText.style.color = 'var(--text-muted)';
					}
					
					// Asynchronously update cache if it's about to expire
					if (!this.fileCacheService.isCacheValid(cache, 4 * 60 * 1000)) { // Start async refresh after 4 minutes
						this.refreshFileCache(activeFile.path).catch(console.error);
					}
				} else {
					// No cache, need to fetch from GitHub
					console.log(`No cache, fetching file status from GitHub: ${activeFile.path}`);
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
					console.log(`File content modified: ${file.path}`);
					
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
					statusText.style.color = 'var(--text-normal)';
					
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
					statusText.style.color = 'var(--text-muted)';
					
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
			console.log(`Asynchronously refreshing file cache: ${filePath}`);
			
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
				console.log(`File cache refreshed: ${filePath}`);
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

					console.log('=== Testing Repository URL ===');
					console.log('Input URL:', this.plugin.settings.repositoryUrl);
					
					// Test URL parsing
					const testResult = this.plugin.githubService.parseRepositoryUrl(this.plugin.settings.repositoryUrl);
					
					if (testResult) {
						console.log('URL parsing successful:', testResult);
						new Notice(`${t('notice.url.test.success')}\n${t('test.url.user')}: ${testResult.owner}\n${t('test.url.repo')}: ${testResult.repo}\n${t('test.url.path')}: ${testResult.path || t('test.url.root')}`, 6000);
					} else {
						console.log('URL parsing failed');
						new Notice(t('notice.url.test.failed'), 6000);
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

		// Save settings button - put below basic settings area
		const saveButtonContainer = containerEl.createEl('div', { 
			cls: 'git-sync-save-button-container' 
		});
		const saveButton = saveButtonContainer.createEl('button', {
			cls: 'mod-cta',
			text: t('settings.save.button')
		});
		saveButton.addEventListener('click', async () => {
			await this.plugin.saveSettings();
			new Notice(t('notice.settings.saved'));
		});

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
			cls: 'mod-cta',
			text: t('settings.sponsor.button'),
			href: 'https://paypal.me/xheldoncao'
		});
		sponsorButton.style.textDecoration = 'none';
		sponsorButton.style.padding = '6px 12px';
		sponsorButton.style.borderRadius = '3px';
		sponsorButton.style.display = 'inline-block';
		
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
			chinaLink.style.color = 'var(--text-accent)';
			chinaLink.style.textDecoration = 'none';
		}
	}

	private isVaultEmpty(): boolean {
		const files = this.app.vault.getFiles();
		return files.filter(file => !file.path.startsWith('.obsidian')).length === 0;
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