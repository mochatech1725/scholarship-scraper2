import { CareerOneStopScraper } from '../scrapers/careeronestop-scraper';
import { CollegeScholarshipScraper } from '../scrapers/collegescholarship-scraper';
import { GeneralSearchScraper } from '../scrapers/general-search-scraper';
import { GumLoopScraper } from '../scrapers/gumloop-scraper';
import { ScrapingResult } from '../utils/types';

const WEBSITE = process.env.WEBSITE;
const JOB_ID = process.env.JOB_ID;
const ENVIRONMENT = process.env.ENVIRONMENT;
const SCHOLARSHIPS_TABLE = process.env.SCHOLARSHIPS_TABLE;
const JOBS_TABLE = process.env.JOBS_TABLE;

if (!ENVIRONMENT || !SCHOLARSHIPS_TABLE || !JOBS_TABLE) {
  console.error('Missing required environment variables:', {
    WEBSITE,
    JOB_ID,
    ENVIRONMENT,
    SCHOLARSHIPS_TABLE,
    JOBS_TABLE,
  });
  process.exit(1);
}

if (!WEBSITE || !JOB_ID) {
  console.error('Missing required environment variables for scraper job:', {
    WEBSITE,
    JOB_ID,
  });
  process.exit(1);
}

// TypeScript knows these are defined after the check above
const website = WEBSITE!;
const jobId = JOB_ID!;
const environment = ENVIRONMENT!;
const scholarshipsTable = SCHOLARSHIPS_TABLE!;
const jobsTable = JOBS_TABLE!;
const rawDataBucket = process.env.S3_RAW_DATA_BUCKET;

async function runScraper(): Promise<void> {
  console.log(`Starting scraper for website: ${website}, job ID: ${jobId}`);

  try {
    let scraper: any;
    let result: ScrapingResult;

    // Route to the appropriate scraper based on website parameter
    switch (website.toLowerCase()) {
      case 'careeronestop':
        scraper = new CareerOneStopScraper(
          scholarshipsTable,
          jobsTable,
          jobId,
          environment,
          rawDataBucket
        );
        break;

      case 'collegescholarship':
        scraper = new CollegeScholarshipScraper(
          scholarshipsTable,
          jobsTable,
          jobId,
          environment,
          rawDataBucket
        );
        break;

      case 'general_search':
        scraper = new GeneralSearchScraper(
          scholarshipsTable,
          jobsTable,
          jobId,
          environment,
          rawDataBucket
        );
        break;

      case 'gumloop':
        scraper = new GumLoopScraper(
          scholarshipsTable,
          jobsTable,
          jobId,
          environment,
          rawDataBucket
        );
        break;

      case 'college_scholarship_search':
        scraper = new GeneralSearchScraper(
          scholarshipsTable,
          jobsTable,
          jobId,
          environment,
          rawDataBucket
        );
        break;

      default:
        throw new Error(`Unknown website: ${website}`);
    }

    // Run the scraper
    result = await scraper.scrape();

    if (result.success) {
      console.log(`Scraping completed successfully for ${website}`);
      console.log(`Found ${result.scholarships.length} scholarships`);
      console.log(`Inserted: ${result.metadata.totalInserted}, Updated: ${result.metadata.totalUpdated}`);
      
      if (result.errors.length > 0) {
        console.warn(`Completed with ${result.errors.length} errors:`, result.errors);
      }
    } else {
      console.error(`Scraping failed for ${website}:`, result.errors);
      process.exit(1);
    }

  } catch (error) {
    console.error('Error running scraper:', error);
    process.exit(1);
  }
}

// Run the scraper
runScraper().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 