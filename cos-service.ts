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
        
        // Debug logging removed for production
        
        // Convert File to ArrayBuffer for requestUrl
        const fileBuffer = await file.arrayBuffer();
        
        const response = await requestUrl({
            url: url,
            method: 'PUT',
            headers: {
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
        
        console.log('Aliyun OSS signature debug:', {
            method,
            path,
            date,
            contentType,
            stringToSign: stringToSign.replace(/\n/g, '\\n'),
            bucket: this.config.bucket,
            region: this.config.region
        });
        
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(this.config.secretKey),
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
        const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
        
        console.log('Generated Aliyun signature:', signatureBase64.substring(0, 20) + '...');
        
        return signatureBase64;
    }

    /**
     * Generate signature for Tencent COS
     */
    private async generateTencentSignature(method: string, path: string, date: string, contentType?: string): Promise<string> {
        // Tencent COS signature v5 implementation according to official documentation
        const now = Math.floor(Date.now() / 1000);
        const expireTime = now + 3600; // 1 hour expiry
        const keyTime = `${now};${expireTime}`;
        
        console.log('Tencent signature debug:', {
            method,
            path,
            keyTime,
            secretId: this.config.secretId.substring(0, 8) + '...',
            bucket: this.config.bucket,
            region: this.config.region
        });
        
        // Step 1: Generate SignKey using HMAC-SHA1(SecretKey, KeyTime)
        const signKey = await this.hmacSha1(this.config.secretKey, keyTime);
        
        // Step 2: Generate HttpString
        const httpMethod = method.toLowerCase();
        const uriPathname = `/${path}`;
        const httpParameters = ''; // No query parameters for PUT
        const httpHeaders = `host=${this.config.bucket}.cos.${this.config.region}.myqcloud.com`;
        const httpString = `${httpMethod}\n${uriPathname}\n${httpParameters}\n${httpHeaders}\n`;
        
        // Step 3: Generate StringToSign
        const httpStringSha1 = await this.sha1Hash(httpString);
        const stringToSign = `sha1\n${keyTime}\n${httpStringSha1}\n`;
        
        // Step 4: Generate Signature using HMAC-SHA1(SignKey, StringToSign)
        const signature = await this.hmacSha1(signKey, stringToSign);
        
        // Step 5: Generate Authorization header
        const authorization = `q-sign-algorithm=sha1&q-ak=${this.config.secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=host&q-url-param-list=&q-signature=${signature}`;
        
        console.log('Generated authorization:', authorization.substring(0, 100) + '...');
        
        return authorization;
    }
    
    /**
     * HMAC-SHA1 implementation
     */
    private async hmacSha1(key: string, data: string): Promise<string> {
        const encoder = new TextEncoder();
        const keyBuffer = encoder.encode(key);
        const dataBuffer = encoder.encode(data);
        
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    
    /**
     * SHA1 hash implementation
     */
    private async sha1Hash(data: string): Promise<string> {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-1', dataBuffer);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    
    /**
     * SHA256 hash implementation
     */
    private async sha256Hash(data: string): Promise<string> {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    
    /**
     * HMAC-SHA256 implementation (returns hex string)
     */
    private async hmacSha256Hex(key: ArrayBuffer, data: string): Promise<string> {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            key,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    
    /**
     * HMAC-SHA256 implementation (returns ArrayBuffer)
     */
    private async hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            key,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        return await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
    }
    
    /**
     * Generate AWS signature key
     */
    private async getAWSSignatureKey(secretKey: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
        const encoder = new TextEncoder();
        const kDate = await this.hmacSha256(encoder.encode(`AWS4${secretKey}`), dateStamp);
        const kRegion = await this.hmacSha256(kDate, region);
        const kService = await this.hmacSha256(kRegion, service);
        const kSigning = await this.hmacSha256(kService, 'aws4_request');
        return kSigning;
    }

    /**
     * Generate signature for AWS S3 V4
     */
    private async generateAWSSignature(method: string, path: string, date: Date, contentType?: string): Promise<{ headers: Record<string, string> }> {
        const isoDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const dateStamp = isoDate.substring(0, 8);
        const service = 's3';
        const algorithm = 'AWS4-HMAC-SHA256';
        
        // Step 1: Create canonical request
        const host = `${this.config.bucket}.s3.${this.config.region}.amazonaws.com`;
        const canonicalUri = `/${path}`;
        const canonicalQueryString = '';
        const canonicalHeaders = `host:${host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${isoDate}\n`;
        const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
        const payloadHash = 'UNSIGNED-PAYLOAD';
        
        const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
        
        // Step 2: Create string to sign
        const credentialScope = `${dateStamp}/${this.config.region}/${service}/aws4_request`;
        const canonicalRequestHash = await this.sha256Hash(canonicalRequest);
        const stringToSign = `${algorithm}\n${isoDate}\n${credentialScope}\n${canonicalRequestHash}`;
        
        // Step 3: Calculate signature
        const signingKey = await this.getAWSSignatureKey(this.config.secretKey, dateStamp, this.config.region, service);
        const signature = await this.hmacSha256Hex(signingKey, stringToSign);
        
        console.log('AWS S3 signature debug:', {
            method,
            path,
            bucket: this.config.bucket,
            region: this.config.region,
            canonicalRequest: canonicalRequest.substring(0, 100) + '...',
            stringToSign: stringToSign.substring(0, 100) + '...',
            signature: signature.substring(0, 16) + '...'
        });
        
        const headers = {
            'X-Amz-Date': isoDate,
            'X-Amz-Content-Sha256': payloadHash,
            'Authorization': `${algorithm} Credential=${this.config.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
        };
        
        return { headers };
    }

    /**
     * Generate signature for Cloudflare R2 (S3 compatible)
     */
    private async generateCloudflareSignature(method: string, path: string, date: Date, contentType?: string): Promise<{ headers: Record<string, string> }> {
        // Cloudflare R2 uses AWS S3 V4 signature with 'auto' region
        const isoDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const dateStamp = isoDate.substring(0, 8);
        const service = 's3';
        const algorithm = 'AWS4-HMAC-SHA256';
        const region = 'auto'; // Cloudflare R2 uses 'auto' as region
        
        // Step 1: Create canonical request
        const host = new URL(this.config.endpoint).host;
        const canonicalUri = `/${path}`;
        const canonicalQueryString = '';
        const canonicalHeaders = `host:${host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${isoDate}\n`;
        const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
        const payloadHash = 'UNSIGNED-PAYLOAD';
        
        const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
        
        // Step 2: Create string to sign
        const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
        const canonicalRequestHash = await this.sha256Hash(canonicalRequest);
        const stringToSign = `${algorithm}\n${isoDate}\n${credentialScope}\n${canonicalRequestHash}`;
        
        // Step 3: Calculate signature
        const signingKey = await this.getAWSSignatureKey(this.config.secretKey, dateStamp, region, service);
        const signature = await this.hmacSha256Hex(signingKey, stringToSign);
        
        console.log('Cloudflare R2 signature debug:', {
            method,
            path,
            endpoint: this.config.endpoint,
            host,
            canonicalRequest: canonicalRequest.substring(0, 100) + '...',
            stringToSign: stringToSign.substring(0, 100) + '...',
            signature: signature.substring(0, 16) + '...'
        });
        
        const headers = {
            'X-Amz-Date': isoDate,
            'X-Amz-Content-Sha256': payloadHash,
            'Authorization': `${algorithm} Credential=${this.config.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
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