import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Environment Configuration
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
export const APP_DEBUG = process.env.APP_DEBUG === 'true';

// AWS Configuration
export const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';

// S3 Configuration
// Note: S3_RAW_DATA_BUCKET is set by CDK stack as environment variable


// API Configuration

// Bedrock Configuration
export const AWS_BEDROCK_MODEL_ID = process.env.AWS_BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';
export const AWS_BEDROCK_VERSION = process.env.AWS_BEDROCK_VERSION || 'bedrock-2023-05-31';

// Scraping Configuration
export const MAX_SCHOLARSHIP_SEARCH_RESULTS = parseInt(process.env.MAX_SCHOLARSHIP_SEARCH_RESULTS || '50', 10);
export const SCRAPING_DELAY_MS = parseInt(process.env.SCRAPING_DELAY_MS || '2000', 10);
export const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5', 10);

// Search Configuration
export const SEARCH_TERMS = [
  'college scholarship',
  'women\'s college scholarships',
  'minority scholarships',
  'LGBTQ scholarships',
  'military scholarships',
  'merit scholarships',
  'need based scholarships',
  'athletic scholarships',
  'community service scholarships'
];

// User Agent Configuration
export const USER_AGENT = process.env.USER_AGENT || 'Mozilla/5.0 (compatible; ScholarshipBot/1.0; +https://yourdomain.com/bot)';

// Timeout Configuration
export const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10);
export const BATCH_JOB_TIMEOUT_MINUTES = parseInt(process.env.BATCH_JOB_TIMEOUT_MINUTES || '60', 10);
export const LAMBDA_TIMEOUT_MINUTES = parseInt(process.env.LAMBDA_TIMEOUT_MINUTES || '5', 10);

// Error Handling Configuration
export const MAX_RETRY_ATTEMPTS = parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10);
export const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS || '1000', 10);

// CareerOneStop Scraper Specific
export const CAREERONESTOP_URL = process.env.CAREERONESTOP_URL || 'https://www.careeronestop.org/Toolkit/Training/find-scholarships.aspx';
export const CAREERONESTOP_PAGE_OFFSET = parseInt(process.env.CAREERONESTOP_PAGE_OFFSET || '0', 10);
export const COLLEGESCHOLARSHIPS_URL = process.env.COLLEGESCHOLARSHIPS_URL || 'https://www.collegescholarships.org/scholarships/';
export const COLLEGESCHOLARSHIPS_PAGE_OFFSET = parseInt(process.env.COLLEGESCHOLARSHIPS_PAGE_OFFSET || '0', 10);

export const AXIOS_GET_TIMEOUT = parseInt(process.env.AXIOS_GET_TIMEOUT || '15000', 10);

export const DESCRIPTION_MAX_LENGTH = parseInt(process.env.DESCRIPTION_MAX_LENGTH || '1000', 10);
export const ELIGIBILITY_MAX_LENGTH = parseInt(process.env.ELIGIBILITY_MAX_LENGTH || '1000', 10);

export const SCRAPING_HEADERS = {
  'User-Agent': process.env.USER_AGENT || 'Mozilla/5.0 (compatible; ScholarshipBot/1.0; +https://yourdomain.com/bot)',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

