import { CareerOneStopScraper } from '../scrapers/careeronestop-scraper';
import { CollegeScholarshipScraper } from '../scrapers/collegescholarship-scraper';
import { GeneralSearchScraper } from '../scrapers/general-search-scraper';
import { GumLoopScraper } from '../scrapers/gumloop-scraper';
import { ScrapingResult } from '../utils/types';

const WEBSITE = process.env.WEBSITE;
const JOB_ID = process.env.JOB_ID;
const ENVIRONMENT = process.env.ENVIRONMENT;
const JOBS_TABLE = process.env.JOBS_TABLE;

if (!ENVIRONMENT || !JOBS_TABLE) {
  console.error('Missing required environment variables:', {
    WEBSITE,
    JOB_ID,
    ENVIRONMENT,
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
const job_id = JOB_ID!;
const environment = ENVIRONMENT!;
const jobsTable = JOBS_TABLE!;
const rawDataBucket = process.env.S3_RAW_DATA_BUCKET;

async function runScraper(): Promise<void> {
  console.log(`Starting scraper for website: ${website}, job ID: ${job_id}`);

  try {
    let scraper: any;
    let result: ScrapingResult;

    // Route to the appropriate scraper based on website parameter
    switch (website.toLowerCase()) {
      case 'careeronestop':
        scraper = new CareerOneStopScraper(
          '', // scholarshipsTable - no longer used
          jobsTable,
          job_id,
          environment,
          rawDataBucket
        );
        break;

      case 'collegescholarship':
        scraper = new CollegeScholarshipScraper(
          '', // scholarshipsTable - no longer used
          jobsTable,
          job_id,
          environment,
          rawDataBucket
        );
        break;

      case 'general_search':
        scraper = new GeneralSearchScraper(
          '', // scholarshipsTable - no longer used
          jobsTable,
          job_id,
          environment,
          rawDataBucket
        );
        break;

      case 'gumloop':
        scraper = new GumLoopScraper(
          '', // scholarshipsTable - no longer used
          jobsTable,
          job_id,
          environment,
          rawDataBucket
        );
        break;

      default:
        throw new Error(`Unknown website: ${website}`);
    }

    result = await scraper.scrape();
    console.log('Scraping completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error running scraper:', error);
    process.exit(1);
  }
}

runScraper(); 