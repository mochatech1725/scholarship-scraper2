import { BaseScraper } from './base-scraper';
import { ScrapingResult, Scholarship } from '../utils/types';
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
  CAREERONESTOP_PAGE_OFFSET,
  CAREERONESTOP_URL,
  AXIOS_GET_TIMEOUT,
  DESCRIPTION_MAX_LENGTH,
  ELIGIBILITY_MAX_LENGTH
} from '../utils/constants';

export class CareerOneStopScraper extends BaseScraper {
  private defaultOptions = {
    maxResults: MAX_SCHOLARSHIP_SEARCH_RESULTS,
    timeout: REQUEST_TIMEOUT_MS,
    retryAttempts: MAX_RETRY_ATTEMPTS
  };

  async fetchScholarshipDetails(url: string): Promise<Partial<Scholarship>> {
    try {
      const response = await axios.get(url, {
        headers: ScrapingUtils.SCRAPING_HEADERS,
        timeout: AXIOS_GET_TIMEOUT
      });
      
      // Store raw HTML in S3
      await this.storeRawData(url, response.data, 'text/html', {
        status: 'success',
        contentType: 'text/html',
        size: response.data.length,
      });
      
      const $ = cheerio.load(response.data);
      const details: Partial<Scholarship> = {};
      $('#scholarshipDetailContent table tr').each((i, elem) => {
        const $row = $(elem);
        const $label = $row.find('td').first();
        const $value = $row.find('td').last();
        const label = $label.text().trim().toLowerCase();
        const value = $value.text().trim();
        switch (label) {
          case 'organization':
            details.organization = value;
            break;
          case 'level of study':
            details.academicLevel = ScholarshipUtils.cleanAcademicLevel(value) || undefined;
            break;
          case 'qualifications':
            details.eligibility = value;
            break;
          case 'funds':
            const amount = ScholarshipUtils.cleanAmount(value);
            details.minAward = parseFloat(amount) || 0;
            details.maxAward = parseFloat(amount) || 0;
            break;
          case 'duration':
            const durationLower = value.toLowerCase();
            details.renewable = durationLower.includes('years') || durationLower.includes('annual') || durationLower.includes('renewable');
            break;
          case 'deadline':
            details.deadline = ScholarshipUtils.formatDeadline(value);
            break;
          case 'location':
          case 'geographic restrictions':
          case 'state':
          case 'region':
          case 'area':
            details.geographicRestrictions = value;
            break;
        }
      });
      const toApplyRow = $('#scholarshipDetailContent table tr').filter((i, elem) => {
        return $(elem).find('td').first().text().trim().toLowerCase() === 'to apply';
      });
      if (toApplyRow.length > 0) {
        const applyText = toApplyRow.find('td').last().text().trim();
        const urlMatch = applyText.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          details.applyUrl = urlMatch[1];
        }
      }
      const moreInfoRow = $('#scholarshipDetailContent table tr').filter((i, elem) => {
        return $(elem).find('td').first().text().trim().toLowerCase() === 'for more information';
      });
      if (moreInfoRow.length > 0) {
        const moreInfoLink = moreInfoRow.find('td').last().find('a').attr('href');
        if (moreInfoLink && !details.applyUrl) {
          details.applyUrl = moreInfoLink;
        }
      }
      return details;
    } catch (error) {
      console.error(`Error fetching details from ${url}:`, error);
      return {};
    }
  }

  async scrape(): Promise<ScrapingResult> {
    console.log('Starting CareerOneStop scraping...');
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
      scholarships = await NetworkUtils.withRetry(async () => {
        const baseOffset = CAREERONESTOP_PAGE_OFFSET;
        const pageOffset = ScrapingUtils.calculatePageOffset({ baseOffset });
        const searchUrl = ScrapingUtils.buildPageUrl(CAREERONESTOP_URL, pageOffset);
        const response = await axios.get(searchUrl, {
          headers: ScrapingUtils.SCRAPING_HEADERS,
          timeout: opts.timeout
        });
        
        // Store raw HTML in S3
        await this.storeRawData(searchUrl, response.data, 'text/html', {
          status: 'success',
          contentType: 'text/html',
          size: response.data.length,
        });
        
        const $ = cheerio.load(response.data);
        const scholarshipPromises: Promise<Scholarship>[] = [];
        $('table tr').each((i, elem) => {
          const $row = $(elem);
          const $cells = $row.find('td');
          if ($cells.length < 5) return;
          const $nameCell = $cells.eq(0);
          const $levelCell = $cells.eq(1);
          const $typeCell = $cells.eq(2);
          const $amountCell = $cells.eq(3);
          const $deadlineCell = $cells.eq(4);
          const awardType = $typeCell.text().trim();
          if (!awardType.toLowerCase().includes('scholarship')) return;
          const $link = $nameCell.find('a');
          const title = $link.text().trim() || $nameCell.find('.detailPageLink').text().trim();
          if (!title || title === 'Award Name') return;
          const organizationText = $nameCell.text();
          const orgMatch = organizationText.match(/Organization:\s*(.+?)(?:\n|<br>|Purposes:)/i);
          let organization = orgMatch ? orgMatch[1].trim() : '';
          if (organization) {
            organization = TextUtils.cleanText(organization.split('\n')[0].trim(), { quotes: true });
          }
          const purposesMatch = organizationText.match(/Purposes:\s*(.+?)$/i);
          const purposes = purposesMatch ? purposesMatch[1].trim() : '';
          const detailLink = $link.attr('href');
          const fullUrl = detailLink ? (detailLink.startsWith('http') ? detailLink : `https://www.careeronestop.org${detailLink}`) : '';
          const levelOfStudy = $levelCell.text().trim().replace(/\s+/g, ' ');
          let amount = $amountCell.find('.table-Numeric').text().trim() || $amountCell.text().trim() || 'Amount not specified';
          const minAward = ScholarshipUtils.cleanAmount(amount);
          const maxAward = minAward;
          const rawDeadline = $deadlineCell.text().trim() || 'No deadline specified';
          const deadline = TextUtils.cleanText(ScholarshipUtils.formatDeadline(rawDeadline), { quotes: true });
          let description = '';
          if (purposes) {
            description = TextUtils.truncateText(TextUtils.cleanText(purposes || '', { quotes: true }), DESCRIPTION_MAX_LENGTH);
          } else {
            description = `Scholarship offered by ${organization || 'CareerOneStop database'}`;
          }
          const cleanName = TextUtils.cleanText(title, { quotes: true });
          const cleanDeadline = TextUtils.cleanText(ScholarshipUtils.formatDeadline(deadline), { quotes: true });
          const cleanDescription = TextUtils.truncateText(TextUtils.cleanText(description, { quotes: true }), DESCRIPTION_MAX_LENGTH);
          const cleanOrganization = TextUtils.cleanText(organization || '', { quotes: true });
          const cleanedAcademicLevel = ScholarshipUtils.cleanAcademicLevel(levelOfStudy || '') || '';
          const targetTypeRaw = ScholarshipUtils.determineTargetType(`${title} ${description} ${purposes}`);
          const targetType = (targetTypeRaw === 'Merit' ? 'merit' : targetTypeRaw === 'Need' ? 'need' : 'both') as 'need' | 'merit' | 'both';
          const ethnicity = ScholarshipUtils.extractEthnicity(`${title} ${description} ${purposes}`);
          const gender = ScholarshipUtils.extractGender(`${title} ${description} ${purposes}`);
          const scholarshipPromise = (async () => {
            const scholarship: Scholarship = {
              id: ScholarshipUtils.createScholarshipId(),
              name: cleanName,
              deadline: cleanDeadline,
              url: fullUrl,
              description: TextUtils.truncateText(TextUtils.removeRedundantPhrases(cleanDescription), DESCRIPTION_MAX_LENGTH),
              eligibility: TextUtils.truncateText(TextUtils.removeRedundantPhrases(''), ELIGIBILITY_MAX_LENGTH),
              source: 'CareerOneStop',
              organization: cleanOrganization,
              academicLevel: cleanedAcademicLevel,
              geographicRestrictions: '', // CareerOneStop doesn't provide in main listing
              targetType: (TextUtils.ensureNonEmptyString(targetType, 'both') as 'need' | 'merit' | 'both'),
              ethnicity: TextUtils.ensureNonEmptyString(ethnicity, 'unspecified'),
              gender: TextUtils.ensureNonEmptyString(gender, 'unspecified'),
              minAward: parseFloat(minAward.toString()) || 0,
              maxAward: parseFloat(maxAward.toString()) || 0,
              renewable: false,
              country: 'United States',
              applyUrl: '',
              isActive: true,
              essayRequired: false,
              recommendationsRequired: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              jobId: this.jobId,
            };

            // Fetch additional details if URL is available
            if (fullUrl) {
              try {
                const details = await this.fetchScholarshipDetails(fullUrl);
                if (details.organization) {
                  scholarship.organization = details.organization;
                }
                if (details.academicLevel) {
                  scholarship.academicLevel = details.academicLevel;
                }
                if (details.eligibility) {
                  scholarship.eligibility = TextUtils.truncateText(
                    TextUtils.removeRedundantPhrases(details.eligibility), 
                    ELIGIBILITY_MAX_LENGTH
                  );
                }
                if (details.minAward && details.minAward > 0) {
                  scholarship.minAward = details.minAward;
                }
                if (details.maxAward && details.maxAward > 0) {
                  scholarship.maxAward = details.maxAward;
                }
                if (details.renewable !== undefined) {
                  scholarship.renewable = details.renewable;
                }
                if (details.deadline) {
                  scholarship.deadline = details.deadline;
                }
                if (details.geographicRestrictions) {
                  scholarship.geographicRestrictions = details.geographicRestrictions;
                }
                if (details.applyUrl) {
                  scholarship.applyUrl = details.applyUrl;
                }
              } catch (detailError) {
                console.warn(`Failed to fetch details for ${fullUrl}:`, detailError);
              }
            }

            return scholarship;
          })();
          scholarshipPromises.push(scholarshipPromise);
        });
        return Promise.all(scholarshipPromises);
      }, opts.retryAttempts);
    } catch (error) {
      console.error('Error during CareerOneStop scraping:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error during scraping');
    }

    // Process and store scholarships
    const processResult = await this.processScholarships(scholarships);
    
    const result: ScrapingResult = {
      success: errors.length === 0,
      scholarships,
      errors: [...errors, ...processResult.errors],
      metadata: {
        totalFound: scholarships.length,
        totalProcessed: scholarships.length,
        totalInserted: processResult.inserted,
        totalUpdated: processResult.updated,
      },
    };
    
    await this.updateJobStatus('completed', {
      recordsFound: result.metadata.totalFound,
      recordsProcessed: result.metadata.totalProcessed,
      recordsInserted: result.metadata.totalInserted,
      recordsUpdated: result.metadata.totalUpdated,
      errors: result.errors,
    });
    
    return result;
  }
} 