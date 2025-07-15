import { BaseScraper } from './base-scraper';
import { ScrapingResult, Scholarship } from '../utils/types';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { 
  AWS_BEDROCK_MODEL_ID, 
  MAX_SCHOLARSHIP_SEARCH_RESULTS,
  DESCRIPTION_MAX_LENGTH,
  ELIGIBILITY_MAX_LENGTH,
  AWS_BEDROCK_VERSION
} from '../utils/constants';
import { TextUtils, ScholarshipUtils, ConfigUtils } from '../utils/helper';
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

export class GumLoopDiscoveryScraper extends BaseScraper {
  private bedrockClient: BedrockRuntimeClient;
  private rateLimiter: RateLimiter;
  private gumloopBaseUrl: string;

  constructor(
    scholarshipsTable: string,
    jobsTable: string,
    jobId: string,
    environment: string
  ) {
    super(scholarshipsTable, jobsTable, jobId, environment);
    this.bedrockClient = new BedrockRuntimeClient({});
    this.rateLimiter = new RateLimiter(1); // 1 call per second for discovery crawling
    
    // Load GumLoop configuration
    const gumloopConfig = ConfigUtils.loadConfigFile('websites.json').gumloopConfig;
    this.gumloopBaseUrl = gumloopConfig.baseUrl;
  }

  async scrape(): Promise<ScrapingResult> {
    console.log('Starting GumLoop discovery scraping for new scholarship opportunities...');
    
    try {
      await this.updateJobStatus('running', {
        recordsFound: 0,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        errors: [],
      });

      // Load discovery configuration
      const websitesConfig = ConfigUtils.loadConfigFile('websites.json');
      const discoveryConfig = websitesConfig.websites.find(
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
      console.error('Error in GumLoop discovery scraper:', error);
      
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
    const gumloopConfig = ConfigUtils.loadConfigFile('websites.json').gumloopConfig;
    
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
    
    // Check for scholarship-related keywords in content
    const scholarshipKeywords = ['scholarship', 'financial aid', 'grant', 'award', 'fellowship', 'tuition assistance'];
    const contentMatches = scholarshipKeywords.filter(keyword => content.includes(keyword)).length;
    score += contentMatches * 0.3;
    
    // Check for keywords in URL
    const urlMatches = scholarshipKeywords.filter(keyword => url.includes(keyword)).length;
    score += urlMatches * 0.4;
    
    // Check for keywords in title
    const titleMatches = scholarshipKeywords.filter(keyword => title.includes(keyword)).length;
    score += titleMatches * 0.3;
    
    // Bonus for specific patterns
    if (content.includes('apply') && content.includes('deadline')) score += 0.2;
    if (content.includes('eligibility') || content.includes('requirements')) score += 0.2;
    if (content.includes('amount') || content.includes('award')) score += 0.2;
    
    // Penalty for irrelevant content
    if (content.includes('login') || content.includes('sign up')) score -= 0.3;
    if (content.includes('shopping cart') || content.includes('checkout')) score -= 0.3;
    
    return Math.max(0, Math.min(1, score)); // Clamp between 0 and 1
  }

  private filterRelevantPages(results: GumLoopDiscoveryResult[], config: GumLoopDiscoveryConfig): GumLoopDiscoveryResult[] {
    // Sort by relevance score and take top results
    const sortedResults = results
      .filter(result => result.relevanceScore >= 0.4) // Minimum relevance threshold
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, config.maxPages);
    
    console.log(`Filtered ${results.length} results down to ${sortedResults.length} relevant pages`);
    
    return sortedResults;
  }

  private async analyzeDiscoveryContent(discoveryResults: GumLoopDiscoveryResult[]): Promise<Partial<Scholarship>[]> {
    const scholarships: Partial<Scholarship>[] = [];
    
    // Process results in batches to avoid overwhelming Bedrock
    const batchSize = 3; // Smaller batch size for discovery content
    for (let i = 0; i < discoveryResults.length; i += batchSize) {
      const batch = discoveryResults.slice(i, i + batchSize);
      
      try {
        const batchScholarships = await this.analyzeDiscoveryBatchWithAI(batch);
        scholarships.push(...batchScholarships);
        
        // Rate limiting for AI calls
        await this.rateLimiter.waitForNextCall();
        
      } catch (error) {
        console.error(`Error analyzing discovery batch ${i / batchSize + 1}:`, error);
        continue;
      }
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
        console.error(`Error extracting scholarship from ${result.url}:`, error);
        continue;
      }
    }
    
    return scholarships;
  }

  private async extractScholarshipFromDiscovery(discoveryResult: GumLoopDiscoveryResult): Promise<Partial<Scholarship> | null> {
    const prompt = `Analyze this discovered page content and determine if it contains scholarship information. If it does, extract the details. Return only a JSON object with these fields:

Content to analyze:
${discoveryResult.content.substring(0, 3000)} // Truncated for token limits

URL: ${discoveryResult.url}
Title: ${discoveryResult.title}
Relevance Score: ${discoveryResult.relevanceScore}

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
        id: ScholarshipUtils.createScholarshipId(),
        name: TextUtils.cleanText(extractedData.title || '', { quotes: true }),
        deadline: TextUtils.cleanText(extractedData.deadline || '', { quotes: true }),
        url: discoveryResult.url,
        description: TextUtils.truncateText(TextUtils.cleanText(extractedData.description || '', { quotes: true }), DESCRIPTION_MAX_LENGTH),
        eligibility: TextUtils.truncateText(TextUtils.cleanText(extractedData.eligibility || '', { quotes: true }), ELIGIBILITY_MAX_LENGTH),
        source: 'GumLoop Discovery',
        organization: TextUtils.cleanText(extractedData.organization || '', { quotes: true }),
        academicLevel: ScholarshipUtils.cleanAcademicLevel(extractedData.academicLevel || '') || '',
        geographicRestrictions: TextUtils.cleanText(extractedData.geographicRestrictions || '', { quotes: true }),
        targetType: (extractedData.targetType as 'need' | 'merit' | 'both') || 'both',
        ethnicity: TextUtils.ensureNonEmptyString(extractedData.ethnicity, 'unspecified'),
        gender: TextUtils.ensureNonEmptyString(extractedData.gender, 'unspecified'),
        minAward: parseFloat(ScholarshipUtils.cleanAmount(extractedData.amount || '0')) || 0,
        maxAward: parseFloat(ScholarshipUtils.cleanAmount(extractedData.amount || '0')) || 0,
        renewable: extractedData.renewable || false,
        country: extractedData.country || 'US',
        isActive: true,
        essayRequired: false,
        recommendationsRequired: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobId: this.jobId,
      };
      
      return scholarship;
      
    } catch (error) {
      console.error('Error in AI extraction from discovery:', error);
      return null;
    }
  }
} 