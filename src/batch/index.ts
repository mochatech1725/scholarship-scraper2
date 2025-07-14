import { CareerOneScraper } from '../scrapers/careerone-scraper';
import { CollegeScholarshipScraper } from '../scrapers/collegescholarship-scraper';
import { GeneralSearchScraper } from '../scrapers/general-search-scraper';
import { ScrapingResult } from '../utils/types';

// Get environment variables
const WEBSITE = process.env.WEBSITE;
const JOB_ID = process.env.JOB_ID;
const ENVIRONMENT = process.env.ENVIRONMENT;
const SCHOLARSHIPS_TABLE = process.env.SCHOLARSHIPS_TABLE;
const JOBS_TABLE = process.env.JOBS_TABLE;

if (!WEBSITE || !JOB_ID || !ENVIRONMENT || !SCHOLARSHIPS_TABLE || !JOBS_TABLE) {
  console.error('Missing required environment variables:', {
    WEBSITE,
    JOB_ID,
    ENVIRONMENT,
    SCHOLARSHIPS_TABLE,
    JOBS_TABLE,
  });
  process.exit(1);
}

// TypeScript knows these are defined after the check above
const website = WEBSITE!;
const jobId = JOB_ID!;
const environment = ENVIRONMENT!;
const scholarshipsTable = SCHOLARSHIPS_TABLE!;
const jobsTable = JOBS_TABLE!;

async function runScraper(): Promise<void> {
  console.log(`Starting scraper for website: ${website}, job ID: ${jobId}`);

  try {
    let scraper: any;
    let result: ScrapingResult;

    // Route to the appropriate scraper based on website parameter
    switch (website.toLowerCase()) {
      case 'careerone':
        scraper = new CareerOneScraper(
          scholarshipsTable,
          jobsTable,
          jobId,
          environment
        );
        break;

      case 'collegescholarship':
        scraper = new CollegeScholarshipScraper(
          scholarshipsTable,
          jobsTable,
          jobId,
          environment
        );
        break;

      case 'general_search':
        scraper = new GeneralSearchScraper(
          scholarshipsTable,
          jobsTable,
          jobId,
          environment
        );
        break;

      default:
        throw new Error(`Unknown website: ${website}`);
    }

    // Run the scraper
    result = await scraper.scrape();

    if (result.success) {
      console.log(`Scraping completed successfully for ${website}:`, {
        totalFound: result.metadata.totalFound,
        totalProcessed: result.metadata.totalProcessed,
        totalInserted: result.metadata.totalInserted,
        totalUpdated: result.metadata.totalUpdated,
        errors: result.errors.length,
      });
    } else {
      console.error(`Scraping failed for ${website}:`, result.errors);
      process.exit(1);
    }

  } catch (error) {
    console.error(`Error running scraper for ${website}:`, error);
    process.exit(1);
  }
}

// Run the scraper
runScraper().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 