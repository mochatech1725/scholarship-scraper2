import { BaseScraper } from './base-scraper';
import { ScrapingResult } from '../utils/types';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Scholarship } from '../shared-types/scholarship.types';
import { 
  AWS_BEDROCK_MODEL_ID,
  MAX_SCHOLARSHIP_SEARCH_RESULTS,
  DESCRIPTION_MAX_LENGTH,
  ELIGIBILITY_MAX_LENGTH,
  REQUEST_TIMEOUT_MS,
  MAX_RETRY_ATTEMPTS,
  AWS_BEDROCK_VERSION
} from '../utils/constants';
import { NetworkUtils, TextUtils, ScholarshipUtils } from '../utils/helper';
import { RateLimiter } from './RateLimiter';

export class GeneralSearchScraper extends BaseScraper {
  private bedrockClient: BedrockRuntimeClient;
  private rateLimiter: RateLimiter;

  constructor(
    scholarshipsTable: string,
    jobsTable: string,
    jobId: string,
    environment: string,
    rawDataBucket?: string
  ) {
    super(scholarshipsTable, jobsTable, jobId, environment, rawDataBucket);
    this.bedrockClient = new BedrockRuntimeClient({});
    this.rateLimiter = new RateLimiter(1); // 1 call per second
  }

  async scrape(): Promise<ScrapingResult> {
    console.log('Starting general search scraping with Bedrock...');
    
    try {
      // Update job status to running
      await this.updateJobStatus('running', {
        recordsFound: 0,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        errors: [],
      });

      // Get scholarships using Bedrock AI
      const scholarships = await this.getBedrockScholarships();

      // Process scholarships
      const { inserted, updated, errors } = await this.processScholarships(scholarships);

      // Update job status to completed
      await this.updateJobStatus('completed', {
        recordsFound: scholarships.length,
        recordsProcessed: scholarships.length,
        recordsInserted: inserted,
        recordsUpdated: updated,
        errors,
      });

      return {
        success: true,
        scholarships: scholarships as Scholarship[],
        errors,
        metadata: {
          totalFound: scholarships.length,
          totalProcessed: scholarships.length,
          totalInserted: inserted,
          totalUpdated: updated,
        },
      };

    } catch (error) {
      console.error('Error in general search scraper:', error);
      
      await this.updateJobStatus('failed', {
        recordsFound: 0,
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });

      return {
        success: false,
        scholarships: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        metadata: {
          totalFound: 0,
          totalProcessed: 0,
          totalInserted: 0,
          totalUpdated: 0,
        },
      };
    }
  }

  private async getBedrockScholarships(): Promise<Partial<Scholarship>[]> {
    const allScholarships: Partial<Scholarship>[] = [];
    
    // Get multiple search focuses for variety
    const searchFocuses = this.getSearchFocuses();
    const maxScholarshipsPerFocus = Math.ceil(MAX_SCHOLARSHIP_SEARCH_RESULTS / searchFocuses.length);
    
    console.log(`Bedrock will search for ${searchFocuses.length} different focuses, max ${maxScholarshipsPerFocus} scholarships per focus`);
    
    // Add overall timeout to prevent hanging
    const overallTimeout = new Promise<any[]>((_, reject) => { // Changed to any[]
      setTimeout(() => reject(new Error('Bedrock function overall timeout')), 300000); // 5 minutes
    });
    
    const searchPromise = this.performSearch(searchFocuses, maxScholarshipsPerFocus, allScholarships);
    
    try {
      return await Promise.race([searchPromise, overallTimeout]);
    } catch (error) {
      console.error('Bedrock function timed out or failed:', error);
      return allScholarships; // Return whatever we have so far
    }
  }
  
  private async performSearch(searchFocuses: string[], maxScholarshipsPerFocus: number, allScholarships: Partial<Scholarship>[]): Promise<Partial<Scholarship>[]> {
    for (const searchFocus of searchFocuses) {
      try {
        const scholarships = await NetworkUtils.withRetry(async () => {
          return await this.getScholarshipsForFocus(searchFocus, maxScholarshipsPerFocus);
        }, MAX_RETRY_ATTEMPTS);
        
        allScholarships.push(...scholarships);
        console.log(`Found ${scholarships.length} scholarships for focus: ${searchFocus}`);
        
        // Add a longer delay between different search focuses
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.error(`Error getting scholarships for focus "${searchFocus}":`, error);
        console.log(`Skipping focus "${searchFocus}" and continuing with next focus`);
        continue; // Continue with next focus even if one fails
      }

    }

    const uniqueScholarships = this.removeDuplicates(allScholarships);
    const finalScholarships = uniqueScholarships.slice(0, MAX_SCHOLARSHIP_SEARCH_RESULTS);
    
    console.log(`Bedrock total unique scholarships found: ${finalScholarships.length}`);
    return finalScholarships;
  }

  private async getScholarshipsForFocus(searchFocus: string, maxResults: number): Promise<any[]> { // Changed to any[]
    // Wait for rate limiter before making API call
    await this.rateLimiter.waitForNextCall();
    
    const userMessage = this.buildSearchPrompt(searchFocus, maxResults);

    const payload = {
      anthropic_version: AWS_BEDROCK_VERSION,
      max_tokens: 4000,
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: userMessage
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId: AWS_BEDROCK_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload)
    });

    try {
      console.log(`Making Bedrock API call for focus: ${searchFocus}`);
      
      // Add timeout to the request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT_MS);
      });
      
      const responsePromise = this.bedrockClient.send(command);
      
      const response = await Promise.race([responsePromise, timeoutPromise]) as any;
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      const scholarshipsData = this.parseAIResponse(responseBody);
      
      // Convert to Scholarship format with better field mapping
      if (Array.isArray(scholarshipsData)) {
        return scholarshipsData.map((scholarship: any) => {
          // Clean all text fields before creating scholarship object
          const cleanTitle = TextUtils.cleanText(String(scholarship.title || scholarship.name || scholarship.scholarship_name || 'Scholarship'), { quotes: true });
          const cleanDeadline = TextUtils.cleanText(String(scholarship.deadline || scholarship.application_deadline || 'Various deadlines'), { quotes: true });
          const rawDescription = TextUtils.cleanText(String(scholarship.description || scholarship.purpose || 'No description available'), { quotes: true });
          const cleanDescription = TextUtils.truncateText(TextUtils.removeRedundantPhrases(rawDescription), DESCRIPTION_MAX_LENGTH);
          const cleanOrganization = TextUtils.cleanText(String(scholarship.organization || scholarship.sponsor || scholarship.institution || ''), { quotes: true });
          const cleanGeographicRestrictions = TextUtils.cleanText(String(scholarship.geographic_restrictions || scholarship.location || scholarship.region || ''), { quotes: true });
          const cleanMinAward = ScholarshipUtils.cleanAmount(String(scholarship.min_amount || scholarship.amount || scholarship.award_amount || 'Amount varies'));
          const cleanMaxAward = ScholarshipUtils.cleanAmount(String(scholarship.max_amount || scholarship.amount || scholarship.award_amount || 'Amount varies'));
          const cleanRenewable = TextUtils.cleanText(String(scholarship.renewable || ''), { quotes: true });
          const cleanCountry = TextUtils.cleanText(String(scholarship.country || scholarship.nationality || ''), { quotes: true });
          const cleanApplyUrl = TextUtils.cleanText(String(scholarship.apply_url || scholarship.application_url || scholarship.url || ''), { quotes: true });
          
          const rawEligibility = String(scholarship.eligibility || scholarship.requirements || scholarship.qualifications || 'Eligibility requirements vary');
          const cleanEligibility = TextUtils.truncateText(TextUtils.removeRedundantPhrases(TextUtils.cleanText(rawEligibility, { quotes: true })), ELIGIBILITY_MAX_LENGTH);
          
          const allText = `${scholarship.title || ''} ${scholarship.description || ''} ${rawEligibility} ${scholarship.academic_level || ''} ${scholarship.level_of_study || ''} ${scholarship.education_level || ''}`;
          const extractedAcademicLevel = ScholarshipUtils.extractAcademicLevel(allText);
          const cleanedAcademicLevel = ScholarshipUtils.cleanAcademicLevel(extractedAcademicLevel);
          
          const combinedEligibility = extractedAcademicLevel 
            ? `${cleanEligibility}${cleanEligibility ? ' | ' : ''}${extractedAcademicLevel}`
            : cleanEligibility;
          
          const targetType = ScholarshipUtils.determineTargetType(`${scholarship.title || ''} ${scholarship.description || ''} ${rawEligibility}`);
          
          const ethnicity = ScholarshipUtils.extractEthnicity(`${scholarship.title || ''} ${scholarship.description || ''} ${rawEligibility}`);
          const gender = ScholarshipUtils.extractGender(`${scholarship.title || ''} ${scholarship.description || ''} ${rawEligibility}`);
          
          const scholarshipObj: any = {
            scholarship_id: ScholarshipUtils.createScholarshipId(),
            name: cleanTitle,
            deadline: cleanDeadline,
            url: scholarship.url || scholarship.website || scholarship.application_url || '',
            description: cleanDescription,
            eligibility: combinedEligibility,
            source: 'Bedrock AI',
            organization: cleanOrganization,
            academic_level: cleanedAcademicLevel,
            geographic_restrictions: cleanGeographicRestrictions,
            target_type: (targetType as 'need' | 'merit' | 'both'),
            ethnicity: TextUtils.ensureNonEmptyString(ethnicity, 'unspecified'),
            gender: TextUtils.ensureNonEmptyString(gender, 'unspecified'),
            min_award: parseFloat(cleanMinAward.toString()) || 0,
            max_award: parseFloat(cleanMaxAward.toString()) || 0,
            renewable: cleanRenewable.toLowerCase().includes('true') || cleanRenewable.toLowerCase().includes('yes'),
            country: cleanCountry || 'US',
            apply_url: cleanApplyUrl,
            is_active: true,
            essay_required: false,
            recommendations_required: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          return scholarshipObj;
        });
      }
      
      return [];
    } catch (error) {
      // Enhanced error logging for different types of errors
      if (error instanceof Error) {
        if (NetworkUtils.isThrottlingError(error)) {
          console.error(`Bedrock throttling error for focus "${searchFocus}":`, error.message);
          console.log('This error will be handled by the retry mechanism with exponential backoff');
        } else if (NetworkUtils.isTimeoutError(error)) {
          console.error(`Bedrock timeout error for focus "${searchFocus}":`, error.message);
          console.log('This error will be handled by the retry mechanism with exponential backoff');
        } else {
          console.error(`Bedrock API error for focus "${searchFocus}":`, error.message);
        }
      }
      throw error; // Re-throw to be handled by withRetry
    }
  }

  private removeDuplicates(scholarships: any[]): any[] { // Changed to any[]
    const seen = new Set<string>();
    return scholarships.filter(scholarship => {
      const key = `${scholarship.name?.toLowerCase()}-${scholarship.organization?.toLowerCase() || 'unknown'}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private getSearchFocuses(): string[] {
    return [
      'STEM scholarships for college students',
      'minority scholarships',
      'merit-based scholarships',
      'need-based financial aid',
      'graduate school scholarships',
      'undergraduate scholarships',
      'athletic scholarships',
      'women scholarships',
      'first-generation college student scholarships',
      'community service scholarships'
    ];
  }

  private buildSearchPrompt(searchFocus: string, maxResults: number): string {
    console.log(`Bedrock searching for: ${searchFocus}`);
    
    return `Find ${maxResults} ${searchFocus}. For each scholarship, provide:

- title: Scholarship name
- organization: Sponsoring organization
- url: Scholarship page link
- description: Brief description (1-2 sentences)
- minAmount: Minimum award amount
- maxAmount: Maximum award amount
- eligibility: Key eligibility criteria
- academicLevel: undergraduate/graduate/doctoral
- geographicRestrictions: Location limitations
- deadline: Application deadline
- renewable: true/false
- country: Country of eligibility
- applyUrl: Application link
- source: Information source

Focus on active, accessible scholarships with clear application processes. Return as JSON array.`;
  }

  private parseAIResponse(responseBody: any): any {
    try {
      // Extract the content text from the Claude 3 format
      const content = responseBody.content?.[0]?.text || responseBody.completion || '';
      
      // Try to extract JSON from the response
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/\[[\s\S]*\]/) || 
                       content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
      
      // If no JSON found, return the raw content
      return { rawResponse: content };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return { rawResponse: responseBody.content?.[0]?.text || responseBody.completion || 'Unable to parse response' };
    }
  }
} 