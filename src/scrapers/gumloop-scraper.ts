import { BaseScraper } from './base-scraper';
import { ScrapingResult, Scholarship } from '../utils/types';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { 
  AWS_BEDROCK_MODEL_ID, 
  DESCRIPTION_MAX_LENGTH,
  ELIGIBILITY_MAX_LENGTH,
  AWS_BEDROCK_VERSION
} from '../utils/constants';
import { TextUtils, ScholarshipUtils, ConfigUtils } from '../utils/helper';
import { RateLimiter } from './RateLimiter';

interface GumLoopCrawlResult {
  url: string;
  title: string;
  content: string;
  links: string[];
  timestamp: string;
  metadata: {
    statusCode: number;
    loadTime: number;
    wordCount: number;
  };
}

interface GumLoopWebsite {
  name: string;
  url: string;
  type: 'crawl';
  crawlUrl: string;
  selectors: {
    scholarshipLinks: string;
    title?: string;
    amount?: string;
    deadline?: string;
    description?: string;
    organization?: string;
  };
  enabled: boolean;
}

export class GumLoopScraper extends BaseScraper {
  private bedrockClient: BedrockRuntimeClient;
  private rateLimiter: RateLimiter;
  private gumloopBaseUrl: string;

  constructor(
    scholarshipsTable: string,
    jobsTable: string,
    jobId: string,
    environment: string,
    rawDataBucket?: string
  ) {
    super(scholarshipsTable, jobsTable, jobId, environment, rawDataBucket);
    this.bedrockClient = new BedrockRuntimeClient({});
    this.rateLimiter = new RateLimiter(2); // 2 calls per second for GumLoop API
    
    // Load GumLoop configuration
    const gumloopConfig = ConfigUtils.loadConfigFile('scraper-config.json').gumloopConfig;
    this.gumloopBaseUrl = gumloopConfig.baseUrl;
  }

  async scrape(): Promise<ScrapingResult> {
    console.log('Starting GumLoop scraping for known scholarship websites...');
    
    try {
      await this.updateJobStatus('running', {
        recordsFound: 0,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        errors: [],
      });

      // Load website configuration from DynamoDB
      const websites = await this.getWebsitesFromDynamoDB();
      const crawlWebsites = websites.filter(
        (site: any) => site.type === 'crawl' && site.enabled
      ) as GumLoopWebsite[];

      // Crawl each website
      const allCrawlResults: GumLoopCrawlResult[] = [];
      for (const website of crawlWebsites) {
        try {
          console.log(`Crawling ${website.name}...`);
          const results = await this.crawlWebsite(website);
          allCrawlResults.push(...results);
          
          // Rate limiting between websites
          await this.rateLimiter.waitForNextCall();
          
        } catch (error) {
          console.error(`Error crawling ${website.name}:`, error);
          continue;
        }
      }

      // Use AI to analyze and extract scholarship data
      const scholarships = await this.analyzeCrawledContent(allCrawlResults);

      // Process scholarships
      const { inserted, updated, errors } = await this.processScholarships(scholarships);

      await this.updateJobStatus('completed', {
        recordsFound: scholarships.length,
        recordsProcessed: scholarships.length,
        recordsInserted: inserted,
        recordsUpdated: updated,
        errors,
      });

      return {
        success: true,
        scholarships: scholarships as Scholarship[],
        errors,
        metadata: {
          totalFound: scholarships.length,
          totalProcessed: scholarships.length,
          totalInserted: inserted,
          totalUpdated: updated,
        },
      };

    } catch (error) {
      console.error('Error in GumLoop scraper:', error);
      
      await this.updateJobStatus('failed', {
        recordsFound: 0,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });

      return {
        success: false,
        scholarships: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        metadata: {
          totalFound: 0,
          totalProcessed: 0,
          totalInserted: 0,
          totalUpdated: 0,
        },
      };
    }
  }

  private async crawlWebsite(website: GumLoopWebsite): Promise<GumLoopCrawlResult[]> {
    const crawlResults: GumLoopCrawlResult[] = [];
    
    try {
      // Start crawl job with GumLoop
      const crawlJob = await this.startGumLoopCrawl(website);
      
      // Wait for crawl to complete
      const results = await this.waitForCrawlCompletion(crawlJob.id);
      
      // Process results
      for (const result of results) {
        if (this.isScholarshipPage(result, website)) {
          crawlResults.push(result);
        }
      }
      
      console.log(`Found ${crawlResults.length} scholarship pages on ${website.name}`);
      
    } catch (error) {
      console.error(`Error crawling ${website.name}:`, error);
    }
    
    return crawlResults;
  }

  private async startGumLoopCrawl(website: GumLoopWebsite): Promise<{ id: string }> {
    const requestBody = {
      startUrl: website.crawlUrl,
      maxPages: 50,
      followLinks: true,
      extractLinks: true,
      extractText: true,
      extractMetadata: true,
      rateLimit: {
        requestsPerSecond: 2,
        maxConcurrent: 5
      },
      filters: {
        allowedDomains: [new URL(website.url).hostname],
        blockedDomains: ['facebook.com', 'twitter.com', 'linkedin.com'],
        allowedPaths: ['/scholarship', '/financial-aid', '/grants', '/awards'],
        blockedPaths: ['/login', '/signup', '/cart', '/checkout']
      }
    };

    const response = await fetch(`${this.gumloopBaseUrl}/crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`GumLoop API error: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    
    // Store raw API request and response in S3
    await this.storeRawData(
      `${this.gumloopBaseUrl}/crawl`,
      JSON.stringify({ request: requestBody, response: responseData }, null, 2),
      'application/json',
      {
        status: 'success',
        contentType: 'application/json',
        size: JSON.stringify(responseData).length,
      }
    );

    return responseData;
  }

  private async waitForCrawlCompletion(jobId: string): Promise<GumLoopCrawlResult[]> {
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes with 10-second intervals
    
    while (attempts < maxAttempts) {
      const response = await fetch(`${this.gumloopBaseUrl}/crawl/${jobId}`, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`GumLoop API error: ${response.status} ${response.statusText}`);
      }

      const jobStatus = await response.json();
      
      if (jobStatus.status === 'completed') {
        const results = jobStatus.results || [];
        
        // Store crawl results in S3
        await this.storeRawData(
          `${this.gumloopBaseUrl}/crawl/${jobId}`,
          JSON.stringify({ jobId, status: jobStatus.status, results }, null, 2),
          'application/json',
          {
            status: 'success',
            contentType: 'application/json',
            size: JSON.stringify(results).length,
          }
        );
        
        return results;
      } else if (jobStatus.status === 'failed') {
        throw new Error(`GumLoop crawl failed: ${jobStatus.error}`);
      }
      
      // Wait 10 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 10000));
      attempts++;
    }
    
    throw new Error('GumLoop crawl timed out');
  }

  private isScholarshipPage(result: any, website: GumLoopWebsite): boolean {
    const content = result.content?.toLowerCase() || '';
    const url = result.url?.toLowerCase() || '';
    
    // Check if URL contains scholarship-related keywords
    const scholarshipKeywords = ['scholarship', 'financial-aid', 'award', 'tuition assistance'];
    const hasScholarshipUrl = scholarshipKeywords.some(keyword => url.includes(keyword));
    
    // Check if content contains scholarship-related keywords
    const hasScholarshipContent = scholarshipKeywords.some(keyword => content.includes(keyword));
    
    // Check if it's a scholarship listing page
    const isListingPage = content.includes('apply') && 
                         (content.includes('deadline') || content.includes('amount') || content.includes('eligibility'));
    
    return hasScholarshipUrl || (hasScholarshipContent && isListingPage);
  }

  private async analyzeCrawledContent(crawlResults: GumLoopCrawlResult[]): Promise<Partial<Scholarship>[]> {
    const scholarships: Partial<Scholarship>[] = [];
    
    // Process results in batches to avoid overwhelming Bedrock
    const batchSize = 5;
    for (let i = 0; i < crawlResults.length; i += batchSize) {
      const batch = crawlResults.slice(i, i + batchSize);
      
      try {
        const batchScholarships = await this.analyzeBatchWithAI(batch);
        scholarships.push(...batchScholarships);
        
        // Rate limiting for AI calls
        await this.rateLimiter.waitForNextCall();
        
      } catch (error) {
        console.error(`Error analyzing batch ${i / batchSize + 1}:`, error);
        continue;
      }
    }
    
    return scholarships;
  }

  private async analyzeBatchWithAI(crawlResults: GumLoopCrawlResult[]): Promise<Partial<Scholarship>[]> {
    const scholarships: Partial<Scholarship>[] = [];
    
    for (const result of crawlResults) {
      try {
        const scholarship = await this.extractScholarshipWithAI(result);
        if (scholarship) {
          scholarships.push(scholarship);
        }
      } catch (error) {
        console.error(`Error extracting scholarship from ${result.url}:`, error);
        continue;
      }
    }
    
    return scholarships;
  }

  private async extractScholarshipWithAI(crawlResult: GumLoopCrawlResult): Promise<Partial<Scholarship> | null> {
    const prompt = `Analyze this scholarship page content and extract scholarship information. Return only a JSON object with these fields:

Content to analyze:
${crawlResult.content.substring(0, 3000)} // Truncated for token limits

Extract and return JSON with these fields:
{
  "title": "Scholarship name",
  "organization": "Sponsoring organization",
  "amount": "Award amount (number or range)",
  "deadline": "Application deadline",
  "description": "Brief description",
  "eligibility": "Key eligibility criteria",
  "academicLevel": "undergraduate/graduate/doctoral",
  "targetType": "merit/need/both",
  "ethnicity": "specific ethnicity if mentioned",
  "gender": "specific gender if mentioned",
  "geographicRestrictions": "location limitations",
  "renewable": true/false,
  "country": "country of eligibility"
}

If no scholarship information is found, return null.`;

    const payload = {
      anthropic_version: AWS_BEDROCK_VERSION,
      max_tokens: 1000,
      temperature: 0.1, // Lower temperature for more consistent extraction
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId: AWS_BEDROCK_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload)
    });

    try {
      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const content = responseBody.content?.[0]?.text || '';
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      
      const extractedData = JSON.parse(jsonMatch[0]);
      
      // Transform to Scholarship format
      const scholarship: Partial<Scholarship> = {
        title: TextUtils.cleanText(extractedData.title || '', { quotes: true }),
        deadline: TextUtils.cleanText(extractedData.deadline || '', { quotes: true }),
        url: crawlResult.url,
        description: TextUtils.truncateText(TextUtils.cleanText(extractedData.description || '', { quotes: true }), DESCRIPTION_MAX_LENGTH),
        eligibility: TextUtils.truncateText(TextUtils.cleanText(extractedData.eligibility || '', { quotes: true }), ELIGIBILITY_MAX_LENGTH),
        source: 'GumLoop Crawling',
        organization: TextUtils.cleanText(extractedData.organization || '', { quotes: true }),
        academic_level: ScholarshipUtils.cleanAcademicLevel(extractedData.academic_level || '') || '',
        geographic_restrictions: TextUtils.cleanText(extractedData.geographic_restrictions || '', { quotes: true }),
        target_type: (extractedData.target_type as 'need' | 'merit' | 'both') || 'both',
        ethnicity: TextUtils.ensureNonEmptyString(extractedData.ethnicity, 'unspecified'),
        gender: TextUtils.ensureNonEmptyString(extractedData.gender, 'unspecified'),
        min_award: parseFloat(ScholarshipUtils.cleanAmount(extractedData.min_award || '0')) || 0,
        max_award: parseFloat(ScholarshipUtils.cleanAmount(extractedData.max_award || '0')) || 0,
        renewable: extractedData.renewable || false,
        country: extractedData.country || 'US',
        essay_required: false,
        recommendation_required: false
      };
      
      return scholarship;
      
    } catch (error) {
      console.error('Error in AI extraction:', error);
      return null;
    }
  }
} 