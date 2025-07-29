import { CosConfig, CosUploadResult } from './types';
import { t } from './i18n-simple';
import { requestUrl } from 'obsidian';

export class CosService {
    private config: CosConfig;

    constructor(config: CosConfig) {
        this.config = config;
    }

    /**
     * Upload file to COS
     */
    async uploadFile(file: File, remotePath: string): Promise<CosUploadResult> {
        try {
            switch (this.config.provider) {
                case 'aliyun':
                    return await this.uploadToAliyun(file, remotePath);
                case 'tencent':
                    return await this.uploadToTencent(file, remotePath);
                case 'aws':
                    return await this.uploadToAWS(file, remotePath);
                case 'cloudflare':
                    return await this.uploadToCloudflare(file, remotePath);
                default:
                    return {
                        success: false,
                        message: t('cos.error.unsupported.provider', { provider: this.config.provider })
                    };
            }
        } catch (error) {
            console.error('COS upload error:', error);
            return {
                success: false,
                message: t('cos.error.upload.failed', { error: error.message })
            };
        }
    }

    /**
     * Test COS configuration
     */
    async testConnection(): Promise<CosUploadResult> {
        try {
            // Create a small test file
            const testContent = 'test';
            const testFile = new File([testContent], 'test.txt', { type: 'text/plain' });
            const testPath = `test-${Date.now()}.txt`;

            const result = await this.uploadFile(testFile, testPath);
            
            if (result.success) {
                // Try to delete the test file after successful upload
                await this.deleteFile(testPath).catch(console.warn);
                return {
                    success: true,
                    message: t('cos.test.success')
                };
            }
            
            return result;
        } catch (error) {
            console.error('COS test connection error:', error);
            return {
                success: false,
                message: t('cos.test.failed', { error: error.message })
            };
        }
    }

    /**
     * Delete file from COS
     */
    private async deleteFile(remotePath: string): Promise<void> {
        switch (this.config.provider) {
            case 'aliyun':
                await this.deleteFromAliyun(remotePath);
                break;
            case 'tencent':
                await this.deleteFromTencent(remotePath);
                break;
            case 'aws':
                await this.deleteFromAWS(remotePath);
                break;
            case 'cloudflare':
                await this.deleteFromCloudflare(remotePath);
                break;
        }
    }

    /**
     * Upload to Aliyun OSS
     */
    private async uploadToAliyun(file: File, remotePath: string): Promise<CosUploadResult> {
        // For Aliyun OSS, construct endpoint from region
        const endpoint = `oss-${this.config.region}.aliyuncs.com`;
        const url = `https://${this.config.bucket}.${endpoint}/${remotePath}`;
        const date = new Date().toUTCString();
        
        // Generate signature for Aliyun OSS
        const signature = await this.generateAliyunSignature('PUT', remotePath, date, file.type);
        
        // Convert File to ArrayBuffer for requestUrl
        const fileBuffer = await file.arrayBuffer();
        
        const response = await requestUrl({
            url: url,
            method: 'PUT',
            headers: {
                'Date': date,
                'Content-Type': file.type,
                'Authorization': `OSS ${this.config.secretId}:${signature}`
            },
            body: fileBuffer
        });

        if (response.status >= 200 && response.status < 300) {
            const finalUrl = this.config.cdnUrl ? 
                `${this.config.cdnUrl}/${remotePath}` : url;
            
            return {
                success: true,
                message: t('cos.upload.success'),
                url: finalUrl,
                key: remotePath
            };
        } else {
            const errorText = response.text;
            return {
                success: false,
                message: t('cos.error.aliyun.upload.failed', { 
                    status: response.status, 
                    error: errorText 
                })
            };
        }
    }

    /**
     * Upload to Tencent COS
     */
    private async uploadToTencent(file: File, remotePath: string): Promise<CosUploadResult> {
        const url = `https://${this.config.bucket}.cos.${this.config.region}.myqcloud.com/${remotePath}`;
        const date = new Date().toUTCString();
        
        // Generate signature for Tencent COS
        const signature = await this.generateTencentSignature('PUT', remotePath, date, file.type);
        
        // Convert File to ArrayBuffer for requestUrl
        const fileBuffer = await file.arrayBuffer();
        
        const response = await requestUrl({
            url: url,
            method: 'PUT',
            headers: {
                'Date': date,
                'Content-Type': file.type,
                'Authorization': signature
            },
            body: fileBuffer
        });

        if (response.status >= 200 && response.status < 300) {
            const finalUrl = this.config.cdnUrl ? 
                `${this.config.cdnUrl}/${remotePath}` : url;
            
            return {
                success: true,
                message: t('cos.upload.success'),
                url: finalUrl,
                key: remotePath
            };
        } else {
            const errorText = response.text;
            return {
                success: false,
                message: t('cos.error.tencent.upload.failed', { 
                    status: response.status, 
                    error: errorText 
                })
            };
        }
    }

    /**
     * Upload to AWS S3
     */
    private async uploadToAWS(file: File, remotePath: string): Promise<CosUploadResult> {
        const url = `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${remotePath}`;
        const date = new Date();
        
        // Generate signature for AWS S3 (V4)
        const signature = await this.generateAWSSignature('PUT', remotePath, date, file.type);
        
        // Convert File to ArrayBuffer for requestUrl
        const fileBuffer = await file.arrayBuffer();
        
        const response = await requestUrl({
            url: url,
            method: 'PUT',
            headers: {
                'Content-Type': file.type,
                ...signature.headers
            },
            body: fileBuffer
        });

        if (response.status >= 200 && response.status < 300) {
            const finalUrl = this.config.cdnUrl ? 
                `${this.config.cdnUrl}/${remotePath}` : url;
            
            return {
                success: true,
                message: t('cos.upload.success'),
                url: finalUrl,
                key: remotePath
            };
        } else {
            const errorText = response.text;
            return {
                success: false,
                message: t('cos.error.aws.upload.failed', { 
                    status: response.status, 
                    error: errorText 
                })
            };
        }
    }

    /**
     * Upload to Cloudflare R2 (using S3 compatible API)
     */
    private async uploadToCloudflare(file: File, remotePath: string): Promise<CosUploadResult> {
        const url = `${this.config.endpoint}/${remotePath}`;
        const date = new Date();
        
        // Generate signature for Cloudflare R2 (S3 compatible)
        const signature = await this.generateCloudflareSignature('PUT', remotePath, date, file.type);
        
        // Convert File to ArrayBuffer for requestUrl
        const fileBuffer = await file.arrayBuffer();
        
        const response = await requestUrl({
            url: url,
            method: 'PUT',
            headers: {
                'Content-Type': file.type,
                ...signature.headers
            },
            body: fileBuffer
        });

        if (response.status >= 200 && response.status < 300) {
            const finalUrl = this.config.cdnUrl ? 
                `${this.config.cdnUrl}/${remotePath}` : url;
            
            return {
                success: true,
                message: t('cos.upload.success'),
                url: finalUrl,
                key: remotePath
            };
        } else {
            const errorText = response.text;
            return {
                success: false,
                message: t('cos.error.cloudflare.upload.failed', { 
                    status: response.status, 
                    error: errorText 
                })
            };
        }
    }

    /**
     * Delete from Aliyun OSS
     */
    private async deleteFromAliyun(remotePath: string): Promise<void> {
        const endpoint = `oss-${this.config.region}.aliyuncs.com`;
        const url = `https://${this.config.bucket}.${endpoint}/${remotePath}`;
        const date = new Date().toUTCString();
        const signature = await this.generateAliyunSignature('DELETE', remotePath, date);
        
        await requestUrl({
            url: url,
            method: 'DELETE',
            headers: {
                'Date': date,
                'Authorization': `OSS ${this.config.secretId}:${signature}`
            }
        });
    }

    /**
     * Delete from Tencent COS
     */
    private async deleteFromTencent(remotePath: string): Promise<void> {
        const url = `https://${this.config.bucket}.cos.${this.config.region}.myqcloud.com/${remotePath}`;
        const date = new Date().toUTCString();
        const signature = await this.generateTencentSignature('DELETE', remotePath, date);
        
        await requestUrl({
            url: url,
            method: 'DELETE',
            headers: {
                'Date': date,
                'Authorization': signature
            }
        });
    }

    /**
     * Delete from AWS S3
     */
    private async deleteFromAWS(remotePath: string): Promise<void> {
        const url = `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${remotePath}`;
        const date = new Date();
        const signature = await this.generateAWSSignature('DELETE', remotePath, date);
        
        await requestUrl({
            url: url,
            method: 'DELETE',
            headers: signature.headers
        });
    }

    /**
     * Delete from Cloudflare R2
     */
    private async deleteFromCloudflare(remotePath: string): Promise<void> {
        const url = `${this.config.endpoint}/${remotePath}`;
        const date = new Date();
        const signature = await this.generateCloudflareSignature('DELETE', remotePath, date);
        
        await requestUrl({
            url: url,
            method: 'DELETE',
            headers: signature.headers
        });
    }

    /**
     * Generate signature for Aliyun OSS
     */
    private async generateAliyunSignature(method: string, path: string, date: string, contentType?: string): Promise<string> {
        const stringToSign = `${method}\n\n${contentType || ''}\n${date}\n/${this.config.bucket}/${path}`;
        
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(this.config.secretKey),
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
        return btoa(String.fromCharCode(...new Uint8Array(signature)));
    }

    /**
     * Generate signature for Tencent COS
     */
    private async generateTencentSignature(method: string, path: string, date: string, contentType?: string): Promise<string> {
        // Simplified Tencent COS signature - in production, you might want to use their SDK
        const stringToSign = `${method}\n/${this.config.bucket}/${path}\n\ndate=${date}&host=${this.config.bucket}.cos.${this.config.region}.myqcloud.com`;
        
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(this.config.secretKey),
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
        const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
        
        return `q-sign-algorithm=sha1&q-ak=${this.config.secretId}&q-sign-time=0;32503651200&q-key-time=0;32503651200&q-header-list=date;host&q-url-param-list=&q-signature=${signatureB64}`;
    }

    /**
     * Generate signature for AWS S3 V4
     */
    private async generateAWSSignature(method: string, path: string, date: Date, contentType?: string): Promise<{ headers: Record<string, string> }> {
        const isoDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const dateStamp = isoDate.substring(0, 8);
        
        // This is a simplified implementation
        // In production, you should use AWS SDK or a complete V4 signature implementation
        const headers = {
            'X-Amz-Date': isoDate,
            'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
            'Authorization': `AWS4-HMAC-SHA256 Credential=${this.config.secretId}/${dateStamp}/${this.config.region}/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=placeholder`
        };
        
        return { headers };
    }

    /**
     * Generate signature for Cloudflare R2 (S3 compatible)
     */
    private async generateCloudflareSignature(method: string, path: string, date: Date, contentType?: string): Promise<{ headers: Record<string, string> }> {
        // Similar to AWS S3 V4 signature
        const isoDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, '');
        
        const headers = {
            'X-Amz-Date': isoDate,
            'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
            'Authorization': `AWS4-HMAC-SHA256 Credential=${this.config.secretId}/${isoDate.substring(0, 8)}/auto/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=placeholder`
        };
        
        return { headers };
    }
}

/**
 * Parse image upload path template
 */
export function parseImagePath(template: string, context: { 
    currentFilePath: string; 
    fileName: string; 
    date?: Date 
}): string {
    const date = context.date || new Date();
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Extract path components from current file path
    const pathParts = context.currentFilePath.split('/');
    const fileName = pathParts.pop()?.replace(/\.[^/.]+$/, '') || ''; // Remove extension
    const folderPath = pathParts.join('/');
    const folderName = pathParts[pathParts.length - 1] || '';
    
    // Use regex to replace placeholders in curly braces
    let result = template
        .replace(/\{YYYY\}/g, year)
        .replace(/\{MM\}/g, month)
        .replace(/\{DD\}/g, day)
        .replace(/\{PATH\}/g, folderPath)
        .replace(/\{FILENAME\}/g, fileName)
        .replace(/\{FOLDER\}/g, folderName);
    
    // Ensure the path ends with the image file name
    if (!result.endsWith('/')) {
        result += '/';
    }
    result += context.fileName;
    
    // Clean up the path (remove double slashes, etc.)
    result = result.replace(/\/+/g, '/').replace(/^\//, '');
    
    return result;
} 