import { Scholarship, ScrapingResult } from '../utils/types';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';
import { ScraperUtils, ScrapingMetadata } from '../utils/scraper-utils';
import { TextUtils } from '../utils/helper';
import { S3Utils, RawDataMetadata } from '../utils/s3-utils';

export abstract class BaseScraper implements ScraperUtils {
  protected dynamoClient: DynamoDBDocumentClient;
  protected s3Utils: S3Utils;
  protected scholarshipsTable: string;
  protected jobsTable: string;
  protected jobId: string;
  protected environment: string;

  constructor(
    scholarshipsTable: string,
    jobsTable: string,
    jobId: string,
    environment: string,
    rawDataBucket?: string
  ) {
    this.dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    this.scholarshipsTable = scholarshipsTable;
    this.jobsTable = jobsTable;
    this.jobId = jobId;
    this.environment = environment;
    
    // Initialize S3 utils if bucket is provided
    if (rawDataBucket) {
      this.s3Utils = new S3Utils({ bucketName: rawDataBucket });
    }
  }

  abstract scrape(): Promise<ScrapingResult>;

  /**
   * Store raw scraping data in S3
   */
  protected async storeRawData(
    url: string,
    content: string | Buffer,
    contentType: string = 'text/html',
    metadata?: Partial<RawDataMetadata>
  ): Promise<string | null> {
    if (!this.s3Utils) {
      console.warn('S3 utils not initialized, skipping raw data storage');
      return null;
    }

    try {
      const scraperName = this.constructor.name;
      const s3Key = await this.s3Utils.storeRawData(
        scraperName,
        url,
        content,
        contentType,
        metadata
      );
      console.log(`Stored raw data in S3: ${s3Key}`);
      return s3Key;
    } catch (error) {
      console.error('Error storing raw data in S3:', error);
      return null;
    }
  }

  /**
   * Store metadata about a scraping operation
   */
  protected async storeMetadata(
    url: string,
    metadata: RawDataMetadata
  ): Promise<string | null> {
    if (!this.s3Utils) {
      console.warn('S3 utils not initialized, skipping metadata storage');
      return null;
    }

    try {
      const scraperName = this.constructor.name;
      const s3Key = await this.s3Utils.storeMetadata(
        scraperName,
        url,
        metadata
      );
      console.log(`Stored metadata in S3: ${s3Key}`);
      return s3Key;
    } catch (error) {
      console.error('Error storing metadata in S3:', error);
      return null;
    }
  }

  protected generateScholarshipId(scholarship: Partial<Scholarship>): string {
    // Create a unique ID based on name, organization, and deadline
    const content = `${scholarship.name}-${scholarship.organization}-${scholarship.deadline}`;
    return createHash('md5').update(content).digest('hex');
  }

  protected async checkDuplicate(scholarship: Scholarship): Promise<boolean> {
    try {
      const result = await this.dynamoClient.send(new GetCommand({
        TableName: this.scholarshipsTable,
        Key: {
          id: scholarship.id,
          deadline: scholarship.deadline,
        },
      }));

      return !!result.Item;
    } catch (error) {
      console.error('Error checking for duplicate:', error);
      return false;
    }
  }

  protected async saveScholarship(scholarship: Scholarship): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const itemToSave = {
        ...scholarship,
        createdAt: scholarship.createdAt || now,
        updatedAt: now,
        jobId: this.jobId,
      };

      await this.dynamoClient.send(new PutCommand({
        TableName: this.scholarshipsTable,
        Item: itemToSave,
      }));

      return true;
    } catch (error) {
      console.error('Error saving scholarship:', error);
      return false;
    }
  }

  public async updateJobStatus(
    status: 'running' | 'completed' | 'failed',
    metadata: ScrapingMetadata
  ): Promise<void> {
    try {
      const endTime = status === 'completed' || status === 'failed' 
        ? new Date().toISOString() 
        : undefined;

      await this.dynamoClient.send(new PutCommand({
        TableName: this.jobsTable,
        Item: {
          jobId: this.jobId,
          startTime: new Date().toISOString(), // This should be the original start time
          endTime,
          status,
          website: this.constructor.name,
          recordsFound: metadata.recordsFound,
          recordsProcessed: metadata.recordsProcessed,
          recordsInserted: metadata.recordsInserted,
          recordsUpdated: metadata.recordsUpdated,
          errors: metadata.errors,
          environment: this.environment,
        },
      }));
    } catch (error) {
      console.error('Error updating job status:', error);
    }
  }

  protected parseEligibility(eligibilityText: string): {
    targetType: 'need' | 'merit' | 'both';
    ethnicity: string;
    gender: string;
    academicLevel: string;
    essayRequired: boolean;
    recommendationsRequired: boolean;
  } {
    const text = eligibilityText.toLowerCase();
    
    // Parse target type
    let targetType: 'need' | 'merit' | 'both' = 'both';
    if (text.includes('need-based') || text.includes('financial need')) {
      targetType = 'need';
    } else if (text.includes('merit') || text.includes('academic achievement')) {
      targetType = 'merit';
    }

    // Parse ethnicity
    const ethnicityKeywords = [
      'african american', 'hispanic', 'latino', 'asian', 'native american',
      'minority', 'diverse', 'multicultural'
    ];
    const ethnicity = ethnicityKeywords.find(keyword => text.includes(keyword)) || '';

    // Parse gender
    let gender = '';
    if (text.includes('women') || text.includes('female')) {
      gender = 'female';
    } else if (text.includes('men') || text.includes('male')) {
      gender = 'male';
    }

    // Parse academic level
    const academicKeywords = [
      'undergraduate', 'graduate', 'phd', 'masters', 'bachelors',
      'high school', 'community college'
    ];
    const academicLevel = academicKeywords.find(keyword => text.includes(keyword)) || '';

    // Parse requirements
    const essayRequired = text.includes('essay') || text.includes('personal statement');
    const recommendationsRequired = text.includes('recommendation') || text.includes('reference');

    return {
      targetType,
      ethnicity,
      gender,
      academicLevel,
      essayRequired,
      recommendationsRequired,
    };
  }

  protected async getWebsitesFromDynamoDB(): Promise<any[]> {
    try {
      const websitesTableName = process.env.WEBSITES_TABLE;
      
      if (!websitesTableName) {
        throw new Error('WEBSITES_TABLE environment variable is not set');
      }
      
      const scanCommand = new ScanCommand({
        TableName: websitesTableName,
        FilterExpression: '#enabled = :enabled',
        ExpressionAttributeNames: {
          '#enabled': 'enabled'
        },
        ExpressionAttributeValues: {
          ':enabled': true
        }
      });
      
      const scanResponse = await this.dynamoClient.send(scanCommand);
      return scanResponse.Items || [];
    } catch (error) {
      console.error('Error getting websites from DynamoDB:', error);
      return [];
    }
  }

  protected async processScholarships(scholarships: Partial<Scholarship>[]): Promise<{
    inserted: number;
    updated: number;
    errors: string[];
  }> {
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const scholarship of scholarships) {
      try {
        // Generate ID and add required fields
        const fullScholarship: Scholarship = {
          id: this.generateScholarshipId(scholarship),
          name: scholarship.name || '',
          deadline: scholarship.deadline || '',
          url: scholarship.url || '',
          description: scholarship.description || '',
          eligibility: scholarship.eligibility || '',
          organization: scholarship.organization || '',
          academicLevel: scholarship.academicLevel || '',
          geographicRestrictions: scholarship.geographicRestrictions || '',
          targetType: (scholarship.targetType || 'both') as 'need' | 'merit' | 'both',
                  ethnicity: TextUtils.ensureNonEmptyString(scholarship.ethnicity, 'unspecified'),
        gender: TextUtils.ensureNonEmptyString(scholarship.gender, 'unspecified'),
          minAward: scholarship.minAward || 0,
          maxAward: scholarship.maxAward || 0,
          renewable: scholarship.renewable || false,
          country: scholarship.country || 'US',
          applyUrl: scholarship.applyUrl || '',
          isActive: scholarship.isActive !== undefined ? scholarship.isActive : true,
          essayRequired: scholarship.essayRequired || false,
          recommendationsRequired: scholarship.recommendationsRequired || false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: this.constructor.name,
          jobId: this.jobId,
        };

        // Check for duplicates
        const isDuplicate = await this.checkDuplicate(fullScholarship);
        
        if (!isDuplicate) {
          const saved = await this.saveScholarship(fullScholarship);
          if (saved) {
            inserted++;
          } else {
            errors.push(`Failed to save scholarship: ${fullScholarship.name}`);
          }
        } else {
          updated++;
        }
      } catch (error) {
        errors.push(`Error processing scholarship: ${error}`);
      }
    }

    return { inserted, updated, errors };
  }
} 