import { BaseScraper } from './base-scraper';
import { ScrapingResult, Scholarship } from '../utils/types';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { 
  AWS_BEDROCK_MODEL_ID, 
  DESCRIPTION_MAX_LENGTH,
  ELIGIBILITY_MAX_LENGTH,
} from '../utils/constants';
import { ConfigUtils } from '../utils/helper';
import { RateLimiter } from './RateLimiter';

interface GumLoopDiscoveryResult {
  url: string;
  title: string;
  content: string;
  links: string[];
  timestamp: string;
  metadata: {
    statusCode: number;
    loadTime: number;
    wordCount: number;
    domain: string;
    path: string;
  };
  relevanceScore: number;
}

interface GumLoopDiscoveryConfig {
  name: string;
  type: 'discovery';
  seedUrls: string[];
  domainFilter: string;
  keywordFilter: string[];
  maxDepth: number;
  maxPages: number;
  enabled: boolean;
}

export class DiscoveryCrawlScraper extends BaseScraper {
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
    this.rateLimiter = new RateLimiter(1); // 1 call per second for discovery crawling
    
    // Load GumLoop configuration
    const gumloopConfig = ConfigUtils.loadConfigFile('scraper-config.json').gumloopConfig;
    this.gumloopBaseUrl = gumloopConfig.baseUrl;
  }

  async scrape(): Promise<ScrapingResult> {
    console.log('Starting Discovery Crawl scraping for new scholarship opportunities...');
    
    try {
      await this.updateJobStatus('running', {
        recordsFound: 0,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        errors: [],
      });

      // Load discovery configuration from DynamoDB
      const websites = await this.getWebsitesFromDynamoDB();
      const discoveryConfig = websites.find(
        (site: any) => site.type === 'discovery' && site.enabled
      ) as GumLoopDiscoveryConfig;

      if (!discoveryConfig) {
        throw new Error('No discovery configuration found or enabled');
      }

      // Run discovery crawling
      const discoveryResults = await this.runDiscoveryCrawl(discoveryConfig);

      // Filter and score results
      const relevantResults = this.filterRelevantPages(discoveryResults, discoveryConfig);

      // Use AI to analyze and extract scholarship data
      const scholarships = await this.analyzeDiscoveryContent(relevantResults);

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
      console.error('Error in Discovery Crawl scraper:', error);
      
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

  private async runDiscoveryCrawl(config: GumLoopDiscoveryConfig): Promise<GumLoopDiscoveryResult[]> {
    const allResults: GumLoopDiscoveryResult[] = [];
    
    // Crawl each seed URL
    for (const seedUrl of config.seedUrls) {
      try {
        console.log(`Starting discovery crawl from seed URL: ${seedUrl}`);
        
        // Start discovery crawl job
        const crawlJob = await this.startDiscoveryCrawl(seedUrl, config);
        
        // Wait for crawl to complete
        const results = await this.waitForDiscoveryCompletion(crawlJob.id);
        
        // Process and score results
        const scoredResults = results.map(result => ({
          ...result,
          relevanceScore: this.calculateRelevanceScore(result, config)
        }));
        
        allResults.push(...scoredResults);
        
        // Rate limiting between seed URLs
        await this.rateLimiter.waitForNextCall();
        
      } catch (error) {
        console.error(`Error in discovery crawl from ${seedUrl}:`, error);
        continue;
      }
    }
    
    return allResults;
  }

  private async startDiscoveryCrawl(seedUrl: string, config: GumLoopDiscoveryConfig): Promise<{ id: string }> {
    const gumloopConfig = ConfigUtils.loadConfigFile('scraper-config.json').gumloopConfig;
    
    const response = await fetch(`${this.gumloopBaseUrl}/discovery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startUrl: seedUrl,
        maxPages: config.maxPages,
        maxDepth: config.maxDepth,
        followLinks: true,
        extractLinks: true,
        extractText: true,
        extractMetadata: true,
        rateLimit: {
          requestsPerSecond: 1,
          maxConcurrent: 3
        },
        filters: {
          allowedDomains: [gumloopConfig.discoverySettings.allowedDomains],
          blockedDomains: gumloopConfig.discoverySettings.blockedDomains,
          keywordPatterns: config.keywordFilter,
          allowedPaths: ['/scholarship', '/financial-aid', '/grants', '/awards', '/funding'],
          blockedPaths: ['/login', '/signup', '/cart', '/checkout', '/admin', '/private']
        },
        aiFiltering: {
          enabled: true,
          relevanceKeywords: config.keywordFilter,
          minRelevanceScore: 0.3
        }
      })
    });

    if (!response.ok) {
      throw new Error(`GumLoop discovery API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private async waitForDiscoveryCompletion(jobId: string): Promise<GumLoopDiscoveryResult[]> {
    let attempts = 0;
    const maxAttempts = 60; // 10 minutes with 10-second intervals
    
    while (attempts < maxAttempts) {
      const response = await fetch(`${this.gumloopBaseUrl}/discovery/${jobId}`, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`GumLoop discovery API error: ${response.status} ${response.statusText}`);
      }

      const jobStatus = await response.json();
      
      if (jobStatus.status === 'completed') {
        return jobStatus.results || [];
      } else if (jobStatus.status === 'failed') {
        throw new Error(`GumLoop discovery failed: ${jobStatus.error}`);
      }
      
      // Wait 10 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 10000));
      attempts++;
    }
    
    throw new Error('GumLoop discovery timed out');
  }

  private calculateRelevanceScore(result: any, config: GumLoopDiscoveryConfig): number {
    const content = result.content?.toLowerCase() || '';
    const url = result.url?.toLowerCase() || '';
    const title = result.title?.toLowerCase() || '';
    
    let score = 0;
    
    // Check for keyword matches
    for (const keyword of config.keywordFilter) {
      const keywordLower = keyword.toLowerCase();
      if (content.includes(keywordLower)) score += 0.2;
      if (url.includes(keywordLower)) score += 0.3;
      if (title.includes(keywordLower)) score += 0.4;
    }
    
    // Bonus for educational domains
    if (url.includes('.edu')) score += 0.2;
    
    // Bonus for scholarship-specific paths
    if (url.includes('/scholarship') || url.includes('/financial-aid')) score += 0.3;
    
    return Math.min(score, 1.0);
  }

  private filterRelevantPages(results: GumLoopDiscoveryResult[], config: GumLoopDiscoveryConfig): GumLoopDiscoveryResult[] {
    return results.filter(result => result.relevanceScore >= 0.3);
  }

  private async analyzeDiscoveryContent(discoveryResults: GumLoopDiscoveryResult[]): Promise<Partial<Scholarship>[]> {
    console.log(`Analyzing ${discoveryResults.length} discovery results with AI...`);
    
    const scholarships: Partial<Scholarship>[] = [];
    
    // Process in batches to avoid overwhelming the AI
    const batchSize = 5;
    for (let i = 0; i < discoveryResults.length; i += batchSize) {
      const batch = discoveryResults.slice(i, i + batchSize);
      const batchResults = await this.analyzeDiscoveryBatchWithAI(batch);
      scholarships.push(...batchResults);
      
      // Rate limiting between batches
      await this.rateLimiter.waitForNextCall();
    }
    
    return scholarships;
  }

  private async analyzeDiscoveryBatchWithAI(discoveryResults: GumLoopDiscoveryResult[]): Promise<Partial<Scholarship>[]> {
    const scholarships: Partial<Scholarship>[] = [];
    
    for (const result of discoveryResults) {
      try {
        const scholarship = await this.extractScholarshipFromDiscovery(result);
        if (scholarship) {
          scholarships.push(scholarship);
        }
      } catch (error) {
        console.error(`Error analyzing discovery result ${result.url}:`, error);
      }
    }
    
    return scholarships;
  }

  private async extractScholarshipFromDiscovery(discoveryResult: GumLoopDiscoveryResult): Promise<Partial<Scholarship> | null> {
    const prompt = `Extract scholarship information from the following webpage content. If this is not a scholarship page, return null.

URL: ${discoveryResult.url}
Title: ${discoveryResult.title}
Content: ${discoveryResult.content.substring(0, 2000)}

Extract the following fields if available:
- name: Scholarship name
- description: Brief description (max ${DESCRIPTION_MAX_LENGTH} characters)
- eligibility: Eligibility requirements (max ${ELIGIBILITY_MAX_LENGTH} characters)
- organization: Organization offering the scholarship
- deadline: Application deadline (ISO date format)
- minAward: Minimum award amount (number)
- maxAward: Maximum award amount (number)
- applyUrl: URL to apply
- academicLevel: Undergraduate, Graduate, etc.
- targetType: need, merit, or both

Return as JSON object or null if not a scholarship page.`;

    try {
      const response = await this.bedrockClient.send(new InvokeModelCommand({
        modelId: AWS_BEDROCK_MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          prompt: prompt,
          max_tokens: 1000,
          temperature: 0.1,
          top_p: 0.9,
        }),
      }));

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const extractedText = responseBody.completions[0].text.trim();
      
      if (extractedText.toLowerCase().includes('null')) {
        return null;
      }
      
      const scholarshipData = JSON.parse(extractedText);
      
      return {
        ...scholarshipData,
        source: 'discovery_crawl',
        jobId: this.jobId,
        url: discoveryResult.url,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
    } catch (error) {
      console.error('Error extracting scholarship from discovery result:', error);
      return null;
    }
  }
} 