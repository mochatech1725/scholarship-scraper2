import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface RawDataMetadata {
  url: string;
  timestamp: string;
  scraperName: string;
  status: 'success' | 'error';
  contentType: string;
  size: number;
  errorMessage?: string;
}

export interface S3StorageOptions {
  bucketName: string;
  region?: string;
}

export class S3Utils {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(options: S3StorageOptions) {
    this.bucketName = options.bucketName;
    this.s3Client = new S3Client({
      region: options.region || process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Store raw scraping data in S3
   */
  async storeRawData(
    scraperName: string,
    url: string,
    content: string | Buffer,
    contentType: string = 'text/html',
    metadata?: Partial<RawDataMetadata>
  ): Promise<string> {
    const timestamp = new Date().toISOString();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = timestamp.replace(/[:.]/g, '-');

    // Generate S3 key
    const s3Key = `${scraperName}/${year}/${month}/${day}/${time}-${this.generatePageId(url)}.html`;

    // Prepare metadata
    const fullMetadata: RawDataMetadata = {
      url,
      timestamp,
      scraperName,
      status: 'success',
      contentType,
      size: Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content),
      ...metadata,
    };

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: content,
      ContentType: contentType,
      Metadata: {
        'scraper-name': scraperName,
        'source-url': url,
        'timestamp': timestamp,
        'status': fullMetadata.status,
        'content-type': contentType,
        'size': fullMetadata.size.toString(),
        ...(fullMetadata.errorMessage && { 'error-message': fullMetadata.errorMessage }),
      },
    });

    await this.s3Client.send(command);
    return s3Key;
  }

  /**
   * Store metadata about a scraping operation
   */
  async storeMetadata(
    scraperName: string,
    url: string,
    metadata: RawDataMetadata
  ): Promise<string> {
    const timestamp = new Date().toISOString();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = timestamp.replace(/[:.]/g, '-');

    const s3Key = `${scraperName}/${year}/${month}/${day}/${time}-${this.generatePageId(url)}-metadata.json`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: JSON.stringify(metadata, null, 2),
      ContentType: 'application/json',
    });

    await this.s3Client.send(command);
    return s3Key;
  }

  /**
   * Retrieve raw data from S3
   */
  async getRawData(s3Key: string): Promise<{ content: string; metadata: Record<string, string> }> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error(`No content found for key: ${s3Key}`);
    }

    const content = await response.Body.transformToString();
    return {
      content,
      metadata: response.Metadata || {},
    };
  }

  /**
   * Delete raw data from S3
   */
  async deleteRawData(s3Key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    await this.s3Client.send(command);
  }

  /**
   * Generate a presigned URL for temporary access
   */
  async getPresignedUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Generate a unique page ID from URL
   */
  private generatePageId(url: string): string {
    const urlHash = this.hashString(url);
    return urlHash.substring(0, 8);
  }

  /**
   * Simple hash function for URLs
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get S3 key for a specific scraper and date
   */
  static generateS3Key(scraperName: string, url: string, timestamp?: string): string {
    const date = timestamp ? new Date(timestamp) : new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = date.toISOString().replace(/[:.]/g, '-');
    
    const urlHash = S3Utils.hashString(url).substring(0, 8);
    return `${scraperName}/${year}/${month}/${day}/${time}-${urlHash}.html`;
  }

  /**
   * Static hash function
   */
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
} 