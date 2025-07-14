import { BaseScraper } from './base-scraper';
import { ScrapingResult, Scholarship } from '../utils/types';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  calculatePageOffset,
  buildPageUrl,
  SCRAPING_HEADERS,
  withRetry,
  formatDeadline,
  cleanText,
  removeRedundantPhrases,
  truncateText,
  cleanAcademicLevel,
  cleanAmount,
  determineTargetType,
  extractEthnicity,
  extractGender,
  createScholarshipId
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
    maxResults: MAX_SCHOLARSHIP_SEARCH_RESULTS,
    timeout: REQUEST_TIMEOUT_MS,
    retryAttempts: MAX_RETRY_ATTEMPTS
  };

  async fetchScholarshipDetails(url: string): Promise<Partial<Scholarship>> {
    try {
      const response = await axios.get(url, {
        headers: SCRAPING_HEADERS,
        timeout: AXIOS_GET_TIMEOUT
      });
      const $ = cheerio.load(response.data);
      const details: Partial<Scholarship> = {};
      
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
            details.deadline = formatDeadline(value);
            break;
          case 'renewable':
            details.renewable = value.toLowerCase().includes('yes') || value.toLowerCase().includes('renewable');
            break;
          case 'min. award:':
            const minAmount = cleanAmount(value);
            details.minAward = parseFloat(minAmount) || 0;
            break;
          case 'max. award:':
            const maxAmount = cleanAmount(value);
            details.maxAward = parseFloat(maxAmount) || 0;
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
            details.academicLevel = cleanAcademicLevel(value) || '';
            break;
          case 'country:':
            details.country = cleanText(value, { quotes: true });
            break;
          case 'major:':
            details.eligibility = cleanText(value, { quotes: true });
            break;
        }
      });
      
      const sponsorInfo = $('.sponsor p').text().trim();
      if (sponsorInfo) {
        details.organization = cleanText(sponsorInfo.split('\n')[0].trim(), { quotes: true });
      }
      
      const applyUrl = $('#description a[href*=".pdf"], #description a[href*="apply"], #description a[href*="application"]').attr('href');
      if (applyUrl) {
        details.applyUrl = applyUrl;
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
    let scholarships: Scholarship[] = [];
    let errors: string[] = [];
    
    try {
      await this.updateJobStatus('running', {
        recordsFound: 0,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        errors: [],
      });

      scholarships = await withRetry(async () => {
        const baseOffset = COLLEGESCHOLARSHIPS_PAGE_OFFSET;
        const pageOffset = calculatePageOffset({ baseOffset });
        const searchUrl = buildPageUrl(COLLEGESCHOLARSHIPS_URL, pageOffset);
        
        const response = await axios.get(searchUrl, {
          headers: SCRAPING_HEADERS,
          timeout: opts.timeout
        });
        
        const $ = cheerio.load(response.data);
        const scholarshipPromises: Promise<Scholarship>[] = [];
        
        for (let i = 0; i < $('.row').length; i++) {
          const elem = $('.row')[i];
          const $row = $(elem);
          
          const $summary = $row.find('.scholarship-summary');
          const $description = $row.find('.scholarship-description');
          
          if ($summary.length > 0 && $description.length > 0) {
            let amount = $summary.find('.lead strong').text().trim() || 'Amount varies';
            amount = cleanAmount(amount);
            const minAward = parseFloat(amount) || 0;
            const maxAward = minAward;
            
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
            
            if (title && !title.includes('Find Scholarships')) {
              const cleanName = cleanText(title, { quotes: true });
              const cleanDeadline = cleanText(formatDeadline(rawDeadline), { quotes: true });
              const rawDescription = cleanText(description || '', { quotes: true });
              const rawEligibility = cleanText(eligibility || '', { quotes: true });
              const cleanedAcademicLevel = cleanAcademicLevel(academicLevel || '') || '';
              const cleanGeographicRestrictions = cleanText(geographicRestrictions || '', { quotes: true });
              
              const targetTypeRaw = determineTargetType(`${title} ${description} ${eligibility}`);
              const targetType = (targetTypeRaw === 'Merit' ? 'merit' : targetTypeRaw === 'Need' ? 'need' : 'both') as 'need' | 'merit' | 'both';
              
              const ethnicity = extractEthnicity(`${title} ${description} ${eligibility}`);
              const gender = extractGender(`${title} ${description} ${eligibility}`);
              
              const scholarshipPromise = (async () => {
                const scholarship: Scholarship = {
                  id: createScholarshipId(),
                  name: cleanName,
                  deadline: cleanDeadline,
                  url: link || '',
                  description: truncateText(removeRedundantPhrases(rawDescription), DESCRIPTION_MAX_LENGTH),
                  eligibility: truncateText(removeRedundantPhrases(rawEligibility), ELIGIBILITY_MAX_LENGTH),
                  source: 'CollegeScholarships',
                  organization: '',
                  academicLevel: cleanedAcademicLevel,
                  geographicRestrictions: cleanGeographicRestrictions || '',
                  targetType,
                  ethnicity: ethnicity || '',
                  gender: gender || '',
                  minAward,
                  maxAward,
                  renewable: false,
                  country: 'US',
                  applyUrl: '',
                  isActive: true,
                  essayRequired: false,
                  recommendationsRequired: false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  jobId: '',
                };
                
                // Fetch detailed information if we have a valid URL
                if (link && link.startsWith('http')) {
                  try {
                    const details = await this.fetchScholarshipDetails(link);
                    Object.assign(scholarship, details);
                    await new Promise(resolve => setTimeout(resolve, 500));
                  } catch (error) {
                    errors.push(`Failed to fetch details for ${title}: ${error instanceof Error ? error.message : error}`);
                  }
                }
                
                return scholarship;
              })();
              
              scholarshipPromises.push(scholarshipPromise);
            }
          }
        }
        
        const scholarships = await Promise.all(scholarshipPromises);
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