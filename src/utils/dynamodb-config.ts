import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

export interface WebsiteConfig {
  name: string;
  url?: string;
  type: 'api' | 'crawl' | 'discovery' | 'search';
  apiEndpoint?: string;
  apiKey?: string;
  crawlUrl?: string;
  enabled: boolean;
  scraperClass: string;
  selectors?: {
    scholarshipLinks: string;
    title: string;
    amount: string;
    deadline: string;
    description: string;
    organization: string;
  };
  discoveryConfig?: {
    seedUrls: string[];
    domainFilter: string;
    keywordFilter: string[];
    maxDepth: number;
    maxPages: number;
  };
  searchConfig?: {
    searchTerms: string[];
    maxResultsPerTerm: number;
    delayBetweenRequests: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SearchConfig {
  maxResultsPerTerm: number;
  delayBetweenRequests: number;
  userAgent: string;
  respectRobotsTxt: boolean;
}

export interface ScrapingConfig {
  websites: WebsiteConfig[];
  searchConfig: SearchConfig;
}

export class DynamoDBConfigLoader {
  private static docClient: DynamoDBDocumentClient;
  private static websitesTableName: string;

  static initialize(tableName: string): void {
    this.websitesTableName = tableName;
    const dynamoClient = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
  }

  static async loadWebsitesConfig(): Promise<ScrapingConfig> {
    if (!this.docClient || !this.websitesTableName) {
      throw new Error('DynamoDBConfigLoader not initialized. Call initialize() first.');
    }

    try {
      // Scan for all enabled websites
      const scanCommand = new ScanCommand({
        TableName: this.websitesTableName,
        FilterExpression: '#enabled = :enabled',
        ExpressionAttributeNames: {
          '#enabled': 'enabled'
        },
        ExpressionAttributeValues: {
          ':enabled': { BOOL: true }
        }
      });

      const response = await this.docClient.send(scanCommand);
      const websites = (response.Items || []) as unknown as WebsiteConfig[];

      // Default search config (could also be stored in DynamoDB if needed)
      const searchConfig: SearchConfig = {
        maxResultsPerTerm: 50,
        delayBetweenRequests: 2000,
        userAgent: 'Mozilla/5.0 (compatible; ScholarshipBot/1.0; +https://yourdomain.com/bot)',
        respectRobotsTxt: true
      };

      return {
        websites,
        searchConfig
      };
    } catch (error) {
      console.error('Error loading websites config from DynamoDB:', error);
      throw error;
    }
  }

  static async getWebsiteConfig(websiteName: string): Promise<WebsiteConfig | undefined> {
    if (!this.docClient || !this.websitesTableName) {
      throw new Error('DynamoDBConfigLoader not initialized. Call initialize() first.');
    }

    try {
      const getCommand = new GetCommand({
        TableName: this.websitesTableName,
        Key: {
          name: websiteName
        }
      });

      const response = await this.docClient.send(getCommand);
      return response.Item as unknown as WebsiteConfig | undefined;
    } catch (error) {
      console.error(`Error getting website config for ${websiteName}:`, error);
      throw error;
    }
  }

  static async getEnabledWebsites(): Promise<WebsiteConfig[]> {
    const config = await this.loadWebsitesConfig();
    return config.websites;
  }

  static async getWebsitesByType(type: 'api' | 'crawl' | 'discovery' | 'search'): Promise<WebsiteConfig[]> {
    const websites = await this.getEnabledWebsites();
    return websites.filter(website => website.type === type);
  }

  static async getSearchConfig(): Promise<SearchConfig> {
    const config = await this.loadWebsitesConfig();
    return config.searchConfig;
  }

  // Helper method to validate website configuration
  static validateWebsiteConfig(website: WebsiteConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!website.name) {
      errors.push('Website name is required');
    }

    if (!website.type) {
      errors.push('Website type is required');
    }

    if (!website.scraperClass) {
      errors.push('Scraper class is required');
    }

    // Type-specific validation
    switch (website.type) {
      case 'api':
        if (!website.apiEndpoint) {
          errors.push('API endpoint is required for API type websites');
        }
        if (!website.apiKey) {
          errors.push('API key is required for API type websites');
        }
        break;

      case 'crawl':
        if (!website.crawlUrl) {
          errors.push('Crawl URL is required for crawl type websites');
        }
        if (!website.selectors) {
          errors.push('Selectors are required for crawl type websites');
        }
        break;

      case 'discovery':
        if (!website.discoveryConfig) {
          errors.push('Discovery config is required for discovery type websites');
        }
        break;

      case 'search':
        if (!website.searchConfig) {
          errors.push('Search config is required for search type websites');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
} 