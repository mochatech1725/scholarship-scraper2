import * as fs from 'fs';
import * as path from 'path';
import { ENVIRONMENT, SEARCH_TERMS, USER_AGENT, SCRAPING_DELAY_MS, MAX_SCHOLARSHIP_SEARCH_RESULTS } from './constants';

export interface EnvironmentConfig {
  environment: string;
  region: string;
  maxAzs: number;
  natGateways: number;
  batchMaxVcpus: number;
  dynamoBillingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
  logRetentionDays: number;
  scrapingSchedule: string;
}

export interface WebsiteConfig {
  name: string;
  url: string;
  type: 'api' | 'scrape' | 'search';
  apiEndpoint?: string;
  apiKey?: string;
  enabled: boolean;
  scraperClass: string;
  searchTerms?: string[];
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

export class ConfigLoader {
  private static configPath = path.join(__dirname, '../../cdk/config');

  static loadEnvironmentConfig(environment: string): EnvironmentConfig {
    const configPath = path.join(this.configPath, 'environments.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config[environment];
  }

  static loadWebsitesConfig(): ScrapingConfig {
    const configPath = path.join(this.configPath, 'websites.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  static loadTagsConfig(): any {
    const configPath = path.join(this.configPath, 'tags.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  static loadIamPoliciesConfig(): any {
    const configPath = path.join(this.configPath, 'iam-policies.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  static getWebsiteConfig(websiteName: string): WebsiteConfig | undefined {
    const config = this.loadWebsitesConfig();
    return config.websites.find(w => w.name === websiteName);
  }

  static getSearchConfig(): SearchConfig {
    const config = this.loadWebsitesConfig();
    return config.searchConfig;
  }
} 