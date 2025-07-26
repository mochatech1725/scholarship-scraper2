import { Scholarship } from '../shared-types/scholarship.types';

export interface ScrapingJob {
  jobId: string;
  startTime: string; // ISO date string
  endTime?: string; // ISO date string
  status: 'pending' | 'running' | 'completed' | 'failed';
  website: string;
  recordsFound: number;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  errors: string[];
  environment: string;
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

export interface ScrapingResult {
  success: boolean;
  scholarships: Scholarship[];
  errors: string[];
  metadata: {
    totalFound: number;
    totalProcessed: number;
    totalInserted: number;
    totalUpdated: number;
  };
}

export { Scholarship }; 