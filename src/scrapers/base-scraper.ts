import { ScrapingResult } from '../utils/types';
import { createHash } from 'crypto';
import { ScraperUtils, ScrapingMetadata } from '../utils/scraper-utils';
import { TextUtils } from '../utils/helper';
import { S3Utils, RawDataMetadata } from '../utils/s3-utils';
import { MySQLDatabase, createDatabaseFromEnv } from '../utils/mysql-config';

export abstract class BaseScraper implements ScraperUtils {
  protected db: MySQLDatabase;
  protected s3Utils: S3Utils;
  protected jobId: string;
  protected environment: string;

  constructor(
    scholarshipsTable: string, // Keep for backward compatibility
    jobsTable: string, // Keep for backward compatibility
    jobId: string,
    environment: string,
    rawDataBucket?: string
  ) {
    // Initialize database connection (will be set in initialize method)
    this.db = null as any;
    this.jobId = jobId;
    this.environment = environment;
    
    // Initialize S3 utils if bucket is provided
    if (rawDataBucket) {
      this.s3Utils = new S3Utils({ bucketName: rawDataBucket });
    }
  }

  protected async initialize(): Promise<void> {
    if (!this.db) {
      this.db = await createDatabaseFromEnv();
      await this.db.connect();
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

  protected generateScholarshipId(scholarship: any): string {
    // Create a unique ID based on name, organization, and deadline
    const content = `${scholarship.name}-${scholarship.organization}-${scholarship.deadline}`;
    return createHash('md5').update(content).digest('hex');
  }

  protected isDeadlineExpired(deadline: string): boolean {
    if (!deadline) {
      return false; // No deadline means not expired
    }

    const deadlineLower = deadline.toLowerCase();
    
    // Skip validation for rolling deadlines or no deadline specified
    if (deadlineLower.includes('rolling') || 
        deadlineLower.includes('no deadline') || 
        deadlineLower.includes('ongoing') ||
        deadlineLower.includes('continuous') ||
        deadlineLower.includes('open')) {
      return false;
    }

    try {
      // Parse the deadline date
      const deadlineDate = new Date(deadline);
      
      // Check if the date is valid
      if (isNaN(deadlineDate.getTime())) {
        console.warn(`Invalid deadline format: ${deadline}`);
        return false; // Don't filter out invalid dates, let them pass through
      }

      // Compare with current date (end of day for deadline)
      const now = new Date();
      const deadlineEndOfDay = new Date(deadlineDate);
      deadlineEndOfDay.setHours(23, 59, 59, 999); // End of the deadline day

      return deadlineEndOfDay < now;
    } catch (error) {
      console.warn(`Error parsing deadline "${deadline}":`, error);
      return false; // Don't filter out unparseable dates, let them pass through
    }
  }

  protected async checkDuplicate(scholarship: any): Promise<boolean> {
    try {
      await this.initialize();
      const result = await this.db.queryOne(
        'SELECT scholarship_id FROM scholarships WHERE scholarship_id = ?',
        [scholarship.scholarship_id]
      );

      return !!result;
    } catch (error) {
      console.error('Error checking for duplicate:', error);
      return false;
    }
  }

  protected async saveScholarship(scholarship: any): Promise<boolean> {
    try {
      await this.initialize();
      const now = new Date().toISOString();
      const itemToSave = {
        ...scholarship,
        created_at: scholarship.created_at || now,
        updated_at: now
      };

      await this.db.insert('scholarships', itemToSave);
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

      // Note: Jobs table remains in DynamoDB for now
      // This method will need to be updated when we migrate jobs to MySQL
      console.log(`Job status update: ${status}`, metadata);
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
      await this.initialize();
      const websites = await this.db.query(
        'SELECT * FROM websites'
      );
      return websites;
    } catch (error) {
      console.error('Error getting websites from MySQL:', error);
      return [];
    }
  }

  protected async processScholarships(scholarships: any[]): Promise<{
    inserted: number;
    updated: number;
    errors: string[];
  }> {
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    // Filter out scholarships with expired deadlines
    const validScholarships = scholarships.filter(scholarship => {
      if (!scholarship.deadline) {
        return true; // Keep scholarships without deadlines (rolling, etc.)
      }
      
      const isExpired = this.isDeadlineExpired(scholarship.deadline);
      if (isExpired) {
        console.log(`Skipping expired scholarship: ${scholarship.name} (deadline: ${scholarship.deadline})`);
      }
      return !isExpired;
    });

    console.log(`Filtered ${scholarships.length - validScholarships.length} expired scholarships, processing ${validScholarships.length} valid scholarships`);

    for (const scholarship of validScholarships) {
      try {
        // Generate ID and add required fields
        const fullScholarship: any = {
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