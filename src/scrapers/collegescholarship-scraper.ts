import { BaseScraper } from './base-scraper';
import { ScrapingResult } from '../utils/types';
import { Scholarship } from '../shared-types/scholarship.types';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { 
  ScrapingUtils, 
  NetworkUtils, 
  ScholarshipUtils, 
  TextUtils 
} from '../utils/helper';
import {
  MAX_SCHOLARSHIP_SEARCH_RESULTS,
  REQUEST_TIMEOUT_MS,
  MAX_RETRY_ATTEMPTS,
  COLLEGESCHOLARSHIPS_PAGE_OFFSET,
  COLLEGESCHOLARSHIPS_URL,
  AXIOS_GET_TIMEOUT,
  DESCRIPTION_MAX_LENGTH,
  ELIGIBILITY_MAX_LENGTH
} from '../utils/constants';

export class CollegeScholarshipScraper extends BaseScraper {
  private defaultOptions = {
    maxResults: Math.min(MAX_SCHOLARSHIP_SEARCH_RESULTS, 10), // Drastically reduce to 10 to ensure completion
    timeout: REQUEST_TIMEOUT_MS,
    retryAttempts: MAX_RETRY_ATTEMPTS,
    concurrentRequests: 2, // Reduce concurrent requests to 2
    requestDelay: 100, // Further reduce delay
    skipDetailFetching: true // Skip individual detail fetching to speed up
  };

  private async processScholarshipBatch(scholarshipPromises: Promise<Scholarship>[], batchSize: number = 3): Promise<Scholarship[]> {
    const results: Scholarship[] = [];
    
    for (let i = 0; i < scholarshipPromises.length; i += batchSize) {
      const batch = scholarshipPromises.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(scholarshipPromises.length / batchSize)} (${batch.length} scholarships)`);
      
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
      
      // Small delay between batches to be respectful
      if (i + batchSize < scholarshipPromises.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  async fetchScholarshipDetails(url: string): Promise<any> {
    try {
      const response = await axios.get(url, {
        headers: ScrapingUtils.SCRAPING_HEADERS,
        timeout: Math.min(AXIOS_GET_TIMEOUT, 10000) // Cap at 10 seconds to prevent hanging
      });
      const $ = cheerio.load(response.data);
      const details: any = {};
      
      // Extract detailed description
      const description = $('#description p').first().text().trim();
      if (description) {
        details.description = description;
      }
      
      // Extract details from the callout-details section
      $('#scholarship-view .callout-details dl dt').each((i, elem) => {
        const $dt = $(elem);
        const $dd = $dt.next('dd');
        const label = $dt.text().trim().toLowerCase();
        const value = $dd.text().trim();
        
        switch (label) {
          case 'deadline:':
            details.deadline = ScholarshipUtils.formatDeadline(value);
            break;
          case 'renewable':
            details.renewable = value.toLowerCase().includes('yes') || value.toLowerCase().includes('renewable');
            break;
          case 'min. award:':
            const minAmount = ScholarshipUtils.cleanAmount(value);
            details.min_award = parseFloat(minAmount) || 0;
            break;
          case 'max. award:':
            const maxAmount = ScholarshipUtils.cleanAmount(value);
            details.max_award = parseFloat(maxAmount) || 0;
            break;
        }
      });
      
      // Extract misc information
      $('#scholarship-view .callout-misc dl dt').each((i, elem) => {
        const $dt = $(elem);
        const $dd = $dt.next('dd');
        const label = $dt.text().trim().toLowerCase();
        const value = $dd.text().trim();
        
        switch (label) {
          case 'enrollment level:':
            details.academic_level = ScholarshipUtils.cleanAcademicLevel(value) || '';
            break;
          case 'country:':
            details.country = TextUtils.cleanText(value, { quotes: true });
            break;
          case 'major:':
            details.eligibility = TextUtils.cleanText(value, { quotes: true });
            break;
        }
      });
      
      const sponsorInfo = $('.sponsor p').text().trim();
      if (sponsorInfo) {
        details.organization = TextUtils.cleanText(sponsorInfo.split('\n')[0].trim(), { quotes: true });
      }
      
      const applyUrl = $('#description a[href*=".pdf"], #description a[href*="apply"], #description a[href*="application"]').attr('href');
      if (applyUrl) {
        details.apply_url = applyUrl;
      }
      
      return details;
    } catch (error) {
      console.error(`Error fetching details from ${url}:`, error);
      return {};
    }
  }

  async scrape(): Promise<ScrapingResult> {
    console.log('Starting CollegeScholarship scraping...');
    const opts = { ...this.defaultOptions };
    let scholarships: any[] = [];
    let errors: string[] = [];
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5; // Stop if 5 consecutive errors
    const startTime = Date.now();
    const maxProcessingTime = 50 * 60 * 1000; // 50 minutes max processing time
    
    try {
      await this.updateJobStatus('running', {
        recordsFound: 0,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        errors: [],
      });

      scholarships = await NetworkUtils.withRetry(async () => {
        const baseOffset = COLLEGESCHOLARSHIPS_PAGE_OFFSET;
        const pageOffset = ScrapingUtils.calculatePageOffset({ baseOffset });
        const searchUrl = ScrapingUtils.buildPageUrl(COLLEGESCHOLARSHIPS_URL, pageOffset);
        
        const response = await axios.get(searchUrl, {
          headers: ScrapingUtils.SCRAPING_HEADERS,
          timeout: opts.timeout
        });
        
        const $ = cheerio.load(response.data);
        const scholarshipPromises: Promise<any>[] = [];
        
        for (let i = 0; i < $('.row').length && consecutiveErrors < maxConsecutiveErrors && (Date.now() - startTime) < maxProcessingTime; i++) {
          const elem = $('.row')[i];
          const $row = $(elem);
          
          const $summary = $row.find('.scholarship-summary');
          const $description = $row.find('.scholarship-description');
          
          if ($summary.length > 0 && $description.length > 0) {
            let amount = $summary.find('.lead strong').text().trim() || 'Amount varies';
            amount = ScholarshipUtils.cleanAmount(amount);
            const min_award = parseFloat(amount) || 0;
            const max_award = min_award;
            
            const rawDeadline = $summary.find('p').last().find('strong').text().trim() || 'No deadline specified';
            
            const titleElement = $description.find('h4 a');
            const title = titleElement.text().trim();
            const link = titleElement.attr('href');
            const description = $description.find('p').not('.visible-xs').first().text().trim();
            
            const eligibilityItems: string[] = [];
            let academicLevelItems: string[] = [];
            let geographicRestrictionsItems: string[] = [];

            $description.find('ul.fa-ul li').each((j, li) => {
              const $li = $(li);
              const text = $li.find('.trim').text().trim();
              
              const $icon = $li.find('i');
              const iconClasses = $icon.attr('class') || '';
              if (text.length > 0 && !text.includes('No Geographic Restrictions')) {
                if (iconClasses.includes('fa-map-marker')) {
                  geographicRestrictionsItems.push(text);
                } else if (iconClasses.includes('fa-graduation-cap')) {
                  academicLevelItems.push(text);
                } else {
                  eligibilityItems.push(text);
                }
              }
            });
            
            const eligibility = eligibilityItems.join(' | ');
            const academicLevel = academicLevelItems.join(' | ');
            const geographicRestrictions = geographicRestrictionsItems.join(' | ');
            
            if (title && !title.includes('Find Scholarships') && scholarshipPromises.length < opts.maxResults) {
              const cleanName = TextUtils.cleanText(title, { quotes: true });
              const cleanDeadline = TextUtils.cleanText(ScholarshipUtils.formatDeadline(rawDeadline), { quotes: true });
              const rawDescription = TextUtils.cleanText(description || '', { quotes: true });
              const rawEligibility = TextUtils.cleanText(eligibility || '', { quotes: true });
              const cleanedAcademicLevel = ScholarshipUtils.cleanAcademicLevel(academicLevel || '') || '';
              const cleanGeographicRestrictions = TextUtils.cleanText(geographicRestrictions || '', { quotes: true });
              
              const targetTypeRaw = ScholarshipUtils.determineTargetType(`${title} ${description} ${eligibility}`);
              const target_type = (targetTypeRaw === 'Merit' ? 'merit' : targetTypeRaw === 'Need' ? 'need' : 'both') as 'need' | 'merit' | 'both';
              
              const ethnicity = ScholarshipUtils.extractEthnicity(`${title} ${description} ${eligibility}`);
              const gender = ScholarshipUtils.extractGender(`${title} ${description} ${eligibility}`);
              
              const scholarshipPromise = (async () => {
                                const scholarship: any = {
                  scholarship_id: ScholarshipUtils.createScholarshipId(),
                  name: cleanName,
                  deadline: cleanDeadline,
                  url: link || '',
                  description: TextUtils.truncateText(TextUtils.removeRedundantPhrases(rawDescription), DESCRIPTION_MAX_LENGTH),
                  eligibility: TextUtils.truncateText(TextUtils.removeRedundantPhrases(rawEligibility), ELIGIBILITY_MAX_LENGTH),
                  source: 'CollegeScholarships',
                  organization: '',
                  academic_level: cleanedAcademicLevel,
                  geographic_restrictions: cleanGeographicRestrictions || '',
                  target_type,
                  ethnicity: TextUtils.ensureNonEmptyString(ethnicity, 'unspecified'),
                  gender: TextUtils.ensureNonEmptyString(gender, 'unspecified'),
                  min_award,
                  max_award,
                  renewable: false,
                  country: 'US',
                  apply_url: '',
                  is_active: true,
                  essay_required: false,
                  recommendations_required: false,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                
                // Fetch detailed information if enabled and we have a valid URL (optimized)
                if (!this.defaultOptions.skipDetailFetching && link && link.startsWith('http') && consecutiveErrors < maxConsecutiveErrors) {
                  try {
                    const details = await this.fetchScholarshipDetails(link);
                    Object.assign(scholarship, details);
                    consecutiveErrors = 0; // Reset error counter on success
                    await new Promise(resolve => setTimeout(resolve, this.defaultOptions.requestDelay));
                  } catch (error) {
                    consecutiveErrors++;
                    console.warn(`Failed to fetch details for ${title} (error ${consecutiveErrors}/${maxConsecutiveErrors}): ${error instanceof Error ? error.message : error}`);
                    
                    if (consecutiveErrors >= maxConsecutiveErrors) {
                      console.warn('Too many consecutive errors, skipping remaining detail fetches');
                      // Continue without fetching details for this scholarship
                    }
                  }
                } else if (this.defaultOptions.skipDetailFetching) {
                  console.log(`Skipping detail fetch for ${title} (detail fetching disabled)`);
                }
                
                return scholarship;
              })();
              
              scholarshipPromises.push(scholarshipPromise);
            }
          }
        }
        
        console.log(`Processing ${scholarshipPromises.length} scholarships in batches of ${this.defaultOptions.concurrentRequests}...`);
        if ((Date.now() - startTime) > maxProcessingTime * 0.8) {
          console.warn('Approaching time limit, processing remaining scholarships without detail fetching');
        }
        const scholarships = await this.processScholarshipBatch(scholarshipPromises, this.defaultOptions.concurrentRequests);
        console.log(`Successfully processed ${scholarships.length} scholarships`);
        return scholarships.slice(0, opts.maxResults);
      }, opts.retryAttempts || 3);

      const { inserted, updated, errors: processErrors } = await this.processScholarships(scholarships);
      errors = errors.concat(processErrors);

      await this.updateJobStatus('completed', {
        recordsFound: scholarships.length,
        recordsProcessed: scholarships.length,
        recordsInserted: inserted,
        recordsUpdated: updated,
        errors,
      });

      return {
        success: true,
        scholarships,
        errors,
        metadata: {
          totalFound: scholarships.length,
          totalProcessed: scholarships.length,
          totalInserted: inserted,
          totalUpdated: updated,
        },
      };

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errMsg);
      
      await this.updateJobStatus('failed', {
        recordsFound: scholarships.length,
        recordsProcessed: scholarships.length,
        recordsInserted: 0,
        recordsUpdated: 0,
        errors,
      });

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
  }
} 