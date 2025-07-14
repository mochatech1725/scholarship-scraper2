import { CareerOneScraper } from '../scrapers/careerone-scraper';
import { CollegeScholarshipScraper } from '../scrapers/collegescholarship-scraper';
// import { GeneralSearchScraper } from '../scrapers/general-search-scraper';
import { ConfigLoader } from '../utils/config';
import { 
  ENVIRONMENT,
  SCHOLARSHIPS_TABLE, 
  JOBS_TABLE, 
  BEDROCK_MODEL_ID,
  SEARCH_TERMS,
  USER_AGENT,
  SCRAPING_DELAY_MS,
  MAX_SCHOLARSHIP_SEARCH_RESULTS
} from '../utils/constants';

async function main() {
  console.log('Starting scholarship scraping batch job...');
  
  const website = process.env.WEBSITE;
  const jobId = process.env.JOB_ID;
  const environment = ENVIRONMENT;
  const scholarshipsTable = SCHOLARSHIPS_TABLE;
  const jobsTable = JOBS_TABLE;

  if (!website || !jobId) {
    throw new Error('Missing required environment variables: WEBSITE or JOB_ID');
  }

  // Load website configuration
  const websiteConfig = ConfigLoader.getWebsiteConfig(website);

  console.log(`Processing website: ${website}`);
  console.log(`Job ID: ${jobId}`);
  console.log(`Environment: ${environment}`);
  console.log(`Website config:`, websiteConfig);

  try {
    let scraper;
    
    switch (website) {
      case 'careerone':
        scraper = new CareerOneScraper(scholarshipsTable, jobsTable, jobId, environment);
        break;
      case 'collegescholarship':
        scraper = new CollegeScholarshipScraper(scholarshipsTable, jobsTable, jobId, environment);
        break;
      case 'general_search':
        // TODO: Implement GeneralSearchScraper
        throw new Error('GeneralSearchScraper not yet implemented');
        break;
      default:
        throw new Error(`Unknown website: ${website}`);
    }

    const result = await scraper.scrape();
    
    console.log('Scraping completed:', {
      success: result.success,
      scholarshipsFound: result.scholarships.length,
      errors: result.errors.length,
      metadata: result.metadata,
    });

    if (!result.success) {
      process.exit(1);
    }

  } catch (error) {
    console.error('Fatal error in batch job:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 