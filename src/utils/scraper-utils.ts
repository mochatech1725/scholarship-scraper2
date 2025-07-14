import { ScrapingResult, Scholarship } from './types';

export interface ScrapingMetadata {
  recordsFound: number;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  errors: string[];
}

export interface ScraperUtils {
  updateJobStatus(
    status: 'running' | 'completed' | 'failed',
    metadata: ScrapingMetadata
  ): Promise<void>;
}

export class ScraperResultBuilder {
  static createSuccessResult(
    scholarships: Scholarship[],
    metadata: ScrapingMetadata
  ): ScrapingResult {
    return {
      success: true,
      scholarships,
      errors: metadata.errors,
      metadata: {
        totalFound: metadata.recordsFound,
        totalProcessed: metadata.recordsProcessed,
        totalInserted: metadata.recordsInserted,
        totalUpdated: metadata.recordsUpdated,
      },
    };
  }

  static createFailureResult(
    scholarships: Scholarship[],
    errors: string[]
  ): ScrapingResult {
    return {
      success: false,
      scholarships: [],
      errors,
      metadata: {
        totalFound: 0,
        totalProcessed: 0,
        totalInserted: 0,
        totalUpdated: 0,
      },
    };
  }

  static async handleScrapingResult(
    scraper: ScraperUtils,
    scholarships: Scholarship[],
    processResult: { inserted: number; updated: number; errors: string[] },
    additionalErrors: string[] = []
  ): Promise<ScrapingResult> {
    const allErrors = [...processResult.errors, ...additionalErrors];
    
    const metadata: ScrapingMetadata = {
      recordsFound: scholarships.length,
      recordsProcessed: scholarships.length,
      recordsInserted: processResult.inserted,
      recordsUpdated: processResult.updated,
      errors: allErrors,
    };

    await scraper.updateJobStatus('completed', metadata);
    
    return this.createSuccessResult(scholarships, metadata);
  }

  static async handleScrapingError(
    scraper: ScraperUtils,
    scholarships: Scholarship[],
    error: unknown,
    additionalErrors: string[] = []
  ): Promise<ScrapingResult> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const allErrors = [errorMessage, ...additionalErrors];
    
    const metadata: ScrapingMetadata = {
      recordsFound: scholarships.length,
      recordsProcessed: scholarships.length,
      recordsInserted: 0,
      recordsUpdated: 0,
      errors: allErrors,
    };

    await scraper.updateJobStatus('failed', metadata);
    
    return this.createFailureResult(scholarships, allErrors);
  }
} 