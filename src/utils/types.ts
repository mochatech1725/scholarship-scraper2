export interface Scholarship {
  id: string;
  name: string;
  deadline: string; // ISO date string
  url: string;
  description: string;
  eligibility: string;
  organization: string;
  academicLevel: string;
  geographicRestrictions: string;
  targetType: 'need' | 'merit' | 'both';
  ethnicity: string;
  gender: string;
  minAward: number;
  maxAward: number;
  renewable: boolean;
  country: string;
  applyUrl: string;
  isActive: boolean;
  essayRequired: boolean;
  recommendationsRequired: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  source: string; // website name
  jobId: string; // batch job that created this record
}

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