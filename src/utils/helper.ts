import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface PageOffsetOptions {
  baseOffset?: number;
  useTimeBasedOffset?: boolean;
  useDayBasedOffset?: boolean;
}

export interface CleanTextOptions {
  quotes?: boolean;
  commas?: boolean;
  currencySymbol?: boolean;
}

const SCRAPING_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

function calculatePageOffset(options: PageOffsetOptions = {}): number {
  const {
    baseOffset = 0,
    useTimeBasedOffset = true,
    useDayBasedOffset = true
  } = options;

  let offset = baseOffset;

  if (useTimeBasedOffset) {
    const now = new Date();
    const hourOfDay = now.getHours();
    
    // Use different pages based on time to ensure variety
    let timeOffset = 0;
    if (hourOfDay < 6) timeOffset = 0;
    else if (hourOfDay < 12) timeOffset = 1;
    else if (hourOfDay < 18) timeOffset = 2;
    else timeOffset = 3;
    
    offset += timeOffset;
  }

  if (useDayBasedOffset) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    
    // Add some randomization based on day of week
    const dayOffset = dayOfWeek * 2;
    offset += dayOffset;
  }

  return offset;
}

function buildPageUrl(baseUrl: string, pageOffset: number): string {
  if (pageOffset > 0) {
    return `${baseUrl}?page=${pageOffset}`;
  }
  return baseUrl;
}

async function withRetry<T>(operation: () => Promise<T>, retries: number): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying operation, ${retries} attempts left`);
      
      // Use the helper functions to check error types
      const throttlingError = isThrottlingError(error);
      const timeoutError = isTimeoutError(error);
      
      // Use exponential backoff for throttling and timeout errors
      let delay = 2000; // Default delay
      if (throttlingError) {
        delay = Math.pow(2, 4 - retries) * 1000;
        console.log(`Waiting ${delay}ms before retry (throttling detected)`);
      } else if (timeoutError) {
        delay = Math.pow(2, 5 - retries) * 1000; // Longer delays for timeouts
        console.log(`Waiting ${delay}ms before retry (timeout detected)`);
      } else {
        console.log(`Waiting ${delay}ms before retry`);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retries - 1);
    }
    throw error;
  }
}



function formatDeadline(deadline: string): string {
  if (!deadline || deadline.toLowerCase().includes('no deadline') || deadline.toLowerCase().includes('rolling')) {
    return deadline;
  }
  
  const currentYear = new Date().getFullYear();
  
  // Check if deadline already has a year (4 digits)
  if (/\d{4}/.test(deadline)) {
    return deadline;
  }
  
  // TODO: Make this locale aware
  const monthPatterns = [
    /(january|jan)\s+(\d{1,2})/i,
    /(february|feb)\s+(\d{1,2})/i,
    /(march|mar)\s+(\d{1,2})/i,
    /(april|apr)\s+(\d{1,2})/i,
    /(may)\s+(\d{1,2})/i,
    /(june|jun)\s+(\d{1,2})/i,
    /(july|jul)\s+(\d{1,2})/i,
    /(august|aug)\s+(\d{1,2})/i,
    /(september|sept?)\s+(\d{1,2})/i,
    /(october|oct)\s+(\d{1,2})/i,
    /(november|nov)\s+(\d{1,2})/i,
    /(december|dec)\s+(\d{1,2})/i
  ];
  
  // Check for month + day patterns
  for (const pattern of monthPatterns) {
    const match = deadline.match(pattern);
    if (match) {
      const month = match[1];
      const day = match[2];
      return `${month} ${day}, ${currentYear}`;
    }
  }
  
  // Check for just month patterns
  const justMonthPatterns = [
    /^(january|jan)$/i,
    /^(february|feb)$/i,
    /^(march|mar)$/i,
    /^(april|apr)$/i,
    /^(may)$/i,
    /^(june|jun)$/i,
    /^(july|jul)$/i,
    /^(august|aug)$/i,
    /^(september|sept?)$/i,
    /^(october|oct)$/i,
    /^(november|nov)$/i,
    /^(december|dec)$/i
  ];
  
  for (const pattern of justMonthPatterns) {
    if (pattern.test(deadline.trim())) {
      return `${deadline.trim()}, ${currentYear}`;
    }
  }
  
  // Check for MM/DD patterns
  const mmddPattern = /^(\d{1,2})\/(\d{1,2})$/;
  const mmddMatch = deadline.match(mmddPattern);
  if (mmddMatch) {
    const month = parseInt(mmddMatch[1]);
    const day = parseInt(mmddMatch[2]);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${monthNames[month - 1]} ${day}, ${currentYear}`;
    }
  }
  
  return deadline;
}

function isDeadlineExpired(deadline: string): boolean {
  if (!deadline) {
    return false; // No deadline means not expired
  }

  const deadlineLower = deadline.toLowerCase();
  
  // Skip validation for rolling deadlines or no deadline specified
  if (deadlineLower.includes('rolling') || 
      deadlineLower.includes('no deadline') || 
      deadlineLower.includes('ongoing') ||
      deadlineLower.includes('continuous') ||
      deadlineLower.includes('open')) {
    return false;
  }

  try {
    // Parse the deadline date
    const deadlineDate = new Date(deadline);
    
    // Check if the date is valid
    if (isNaN(deadlineDate.getTime())) {
      console.warn(`Invalid deadline format: ${deadline}`);
      return false; // Don't filter out invalid dates, let them pass through
    }

    // Compare with current date (end of day for deadline)
    const now = new Date();
    const deadlineEndOfDay = new Date(deadlineDate);
    deadlineEndOfDay.setHours(23, 59, 59, 999); // End of the deadline day

    return deadlineEndOfDay < now;
  } catch (error) {
    console.warn(`Error parsing deadline "${deadline}":`, error);
    return false; // Don't filter out unparseable dates, let them pass through
  }
}

export interface CleanTextOptions {
  quotes?: boolean;
  commas?: boolean;
  currencySymbol?: boolean;
}

/**
 * Removes specified characters from text fields
 * @param text - The text to clean
 * @param options - Object specifying what to remove
 * @returns Cleaned text without specified characters
 */
function cleanText(text: string | undefined | null, options: CleanTextOptions = {}): string {
  if (!text) return '';
  
  const { quotes = false, commas = false, currencySymbol = false } = options;
  
  let cleaned = text;
  
  if (quotes) {
    cleaned = cleaned.replace(/['"]/g, '');
  }
  
  if (commas) {
    cleaned = cleaned.replace(/,/g, '');
  }
  // TODO: Use some currency library to clean the currency symbol
  if (currencySymbol) {
    // €, ¥, ₹, ₽, etc.
    cleaned = cleaned.replace(/[\$£€¥₹₽₩₪₦₨₫₱₲₴₵₸₺₻₼₽₾₿]/g, '');
  }
  
  return cleaned.trim();
}

/**
 * Cleans amount fields by removing currency symbols, commas, and other formatting
 * @param text - The amount text to clean
 * @returns Cleaned amount text
 */
function cleanAmount(text: string): string {
  if (!text) return '';
  
  let cleaned = text;
  
  // Remove currency symbols: $, £, €, ¥, ₹, ₽, ₩, ₪, ₦, ₨, ₫, ₱, ₲, ₴, ₵, ₸, ₺, ₻, ₼, ₽, ₾, ₿
  cleaned = cleaned.replace(/[\$£€¥₹₽₩₪₦₨₫₱₲₴₵₸₺₻₼₽₾₿]/g, '');
  
  // Remove commas from numbers
  cleaned = cleaned.replace(/,/g, '');
  
  // Remove quotes
  cleaned = cleaned.replace(/['"]/g, '');
  
  // Remove common words that aren't amounts
  cleaned = cleaned.replace(/\b(amount|varies|not specified|tbd|to be determined)\b/gi, '');
  
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Checks if an error is a timeout error
 * @param error - The error to check
 * @returns True if the error is a timeout error
 */
function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const errorMessage = error.message.toLowerCase();
  return errorMessage.includes('timeout') || 
         errorMessage.includes('timed out') ||
         errorMessage.includes('model has timed out') ||
         errorMessage.includes('request timeout');
}

/**
 * Checks if an error is a throttling error
 * @param error - The error to check
 * @returns True if the error is a throttling error
 */
function isThrottlingError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const errorMessage = error.message.toLowerCase();
  return errorMessage.includes('throttlingexception') || 
         errorMessage.includes('too many requests') ||
         errorMessage.includes('rate exceeded');
}

/**
 * Determines the target type based on scholarship criteria
 * @param text - The text to analyze (title, description, eligibility, etc.)
 * @returns Target type: 'Merit', 'Need', 'Both', or 'Not specified'
 */
function determineTargetType(text: string): string {
  if (!text) return 'Not specified';
  
  const lowerText = text.toLowerCase();
  
  // Check for FAFSA requirement (need-based indicator)
  const hasFafsa = lowerText.includes('fafsa') || lowerText.includes('free application for federal student aid');
  
  // Check for merit-based indicators
  const hasMerit = lowerText.includes('merit-based') || 
                   lowerText.includes('merit based') || 
                   lowerText.includes('academic merit') ||
                   lowerText.includes('gpa') ||
                   lowerText.includes('grade point average') ||
                   lowerText.includes('academic excellence') ||
                   lowerText.includes('achievement');
  
  // Check for need-based indicators
  const hasNeed = hasFafsa || 
                  lowerText.includes('need-based') || 
                  lowerText.includes('need based') ||
                  lowerText.includes('financial need') ||
                  lowerText.includes('financial hardship') ||
                  lowerText.includes('low income') ||
                  lowerText.includes('economic need');
  
  // Determine target type
  if (hasMerit && hasNeed) {
    return 'Both';
  } else if (hasMerit) {
    return 'Merit';
  } else if (hasNeed) {
    return 'Need';
  } else {
    return 'Not specified';
  }
}

/**
 * Extracts academic level keywords from text and returns them as a comma-separated string
 * @param text - The text to analyze
 * @returns Comma-separated string of academic level keywords found
 */
function extractAcademicLevel(text: string): string {
  if (!text) return '';
  
  const lowerText = text.toLowerCase();
  const academicKeywords: string[] = [];
  
  if (lowerText.includes('undergraduate') || lowerText.includes('undergrad')) {
    academicKeywords.push('undergraduate');
  }
  
  if (lowerText.includes('graduate') || lowerText.includes('grad')) {
    academicKeywords.push('graduate');
  }
  if (lowerText.includes('masters') || lowerText.includes('master') || lowerText.includes('ms') || lowerText.includes('ma')) {
    academicKeywords.push('masters');
  }
  if (lowerText.includes('doctorate') || lowerText.includes('doctoral') || lowerText.includes('phd') || lowerText.includes('ph.d')) {
    academicKeywords.push('doctorate');
  }
  if (lowerText.includes('freshman') || lowerText.includes('first year')) {
    academicKeywords.push('freshman');
  }
  if (lowerText.includes('sophomore') || lowerText.includes('second year')) {
    academicKeywords.push('sophomore');
  }
  if (lowerText.includes('junior') || lowerText.includes('third year')) {
    academicKeywords.push('junior');
  }
  if (lowerText.includes('senior') || lowerText.includes('fourth year')) {
    academicKeywords.push('senior');
  }
  if (lowerText.includes('high school') || lowerText.includes('secondary school')) {
    academicKeywords.push('high school');
  }
  if (lowerText.includes('college') && !lowerText.includes('graduate')) {
    academicKeywords.push('college');
  }
  if (lowerText.includes('university') && !lowerText.includes('graduate')) {
    academicKeywords.push('university');
  }
  
  return academicKeywords.join(', ');
}

/**
 * Extracts ethnicity keywords from text and returns them as a comma-separated string
 * @param text - The text to analyze
 * @returns Comma-separated string of ethnicity keywords found
 */
function extractEthnicity(text: string): string {
  if (!text) return '';
  
  const lowerText = text.toLowerCase();
  const ethnicityKeywords: string[] = [];
  
  if (lowerText.includes('african american') || lowerText.includes('black') || lowerText.includes('african-american')) {
    ethnicityKeywords.push('African American');
  }
  
  if (lowerText.includes('hispanic') || lowerText.includes('latino') || lowerText.includes('latina') || lowerText.includes('latinx')) {
    ethnicityKeywords.push('Hispanic');
  }
  
  if (lowerText.includes('asian') || lowerText.includes('asian american') || lowerText.includes('asian-american')) {
    ethnicityKeywords.push('Asian');
  }
  
  if (lowerText.includes('native american') || lowerText.includes('indigenous') || lowerText.includes('american indian') || lowerText.includes('alaska native')) {
    ethnicityKeywords.push('Native American');
  }
  
  if (lowerText.includes('pacific islander') || lowerText.includes('hawaiian') || lowerText.includes('polynesian')) {
    ethnicityKeywords.push('Pacific Islander');
  }
  
  if (lowerText.includes('white') || lowerText.includes('caucasian')) {
    ethnicityKeywords.push('White');
  }
  
  // Middle Eastern
  if (lowerText.includes('middle eastern') || lowerText.includes('arab') || lowerText.includes('arabic')) {
    ethnicityKeywords.push('Middle Eastern');
  }
  
  // Minority (general)
  if (lowerText.includes('minority') || lowerText.includes('underrepresented')) {
    ethnicityKeywords.push('Minority');
  }
  
  // International
  if (lowerText.includes('international') || lowerText.includes('foreign') || lowerText.includes('immigrant')) {
    ethnicityKeywords.push('International');
  }
  
  return ethnicityKeywords.join(', ');
}

/**
 * Extracts gender information from text
 * @param text - The text to analyze
 * @returns Gender: 'female', 'male', or undefined
 */
function extractGender(text: string): string | undefined {
  if (!text) return undefined;
  
  const lowerText = text.toLowerCase();
  
  // Only very explicit gender restrictions
  if (lowerText.includes('women only') || lowerText.includes('female only')) {
    return 'female';
  }
  
  if (lowerText.includes('men only') || lowerText.includes('male only')) {
    return 'male';
  }
  
  return undefined;
}

/**
 * Removes redundant phrases from text fields like eligibility and descriptions
 * @param text - The text to clean
 * @returns Cleaned text without redundant phrases
 */
function removeRedundantPhrases(text: string): string {
  if (!text) return text;
  
  let cleaned = text;
  
  // Remove common redundant phrases
  const redundantPhrases = [
    'Applicant must be',
    'Applicants must be',
    'Student must be',
    'Students must be',
    'Candidate must be',
    'Candidates must be',
    'The applicant must be',
    'The student must be',
    'The candidate must be',
    'Must be',
    'Should be',
    'Required to be',
    'Needs to be',
    'Has to be'
  ];
  
  redundantPhrases.forEach(phrase => {
    cleaned = cleaned.replace(new RegExp(phrase, 'gi'), '');
  });
  
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Truncates text to a specified maximum length, adding ellipsis if needed
 * @param text - The text to truncate
 * @param maxLength - Maximum length allowed
 * @returns Truncated text with ellipsis if needed
 */
function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  // Truncate to maxLength - 3 to account for ellipsis
  const truncated = text.substring(0, maxLength - 3).trim();
  return `${truncated}...`;
}

/**
 * Creates a unique scholarship ID
 * @returns A unique string identifier for scholarships
 */
function createScholarshipId(): string {
  return uuidv4();
}

/**
 * Ensures a string value is never empty for DynamoDB GSI keys
 * @param value - The string value to check
 * @param defaultValue - Default value to use if empty
 * @returns The value or default value
 */
function ensureNonEmptyString(value: string | undefined | null, defaultValue: string = 'unspecified'): string {
  return value && value.trim() !== '' ? value.trim() : defaultValue;
} 

/**
 * Cleans academic level text by removing the word 'study' (case-insensitive) and converting to lowercase
 * @param text - The academic level text to clean
 * @returns Cleaned academic level text in lowercase, or undefined if empty
 */
function cleanAcademicLevel(text: string): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/study/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
  return cleaned || undefined;
}

/**
 * Loads a JSON configuration file from the cdk/config directory
 * @param filename - The name of the JSON file (e.g., 'environments.json', 'tags.json')
 * @returns The parsed JSON content
 */
function loadConfigFile<T = any>(filename: string): T {
  try {
    // Get the project root directory (assuming this is called from src/)
    const projectRoot = path.resolve(__dirname, '../../');
    const configPath = path.join(projectRoot, 'cdk', 'config', filename);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    const fileContent = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error loading config file ${filename}:`, error);
    throw error;
  }
}

/**
 * Loads environment-specific configuration
 * @param environment - The environment name (e.g., 'dev', 'staging', 'prod')
 * @returns The environment configuration object
 */
function loadEnvironmentConfig(environment: string): any {
  const environments = loadConfigFile('environments.json');
  const envConfig = environments[environment];
  
  if (!envConfig) {
    throw new Error(`Environment configuration not found for: ${environment}`);
  }
  
  return envConfig;
}

/**
 * Loads all configuration files commonly used in the project
 * @param environment - The environment name
 * @returns Object containing all configuration data
 */
function loadAllConfigs(environment: string) {
  return {
    environment: loadEnvironmentConfig(environment),
    tags: loadConfigFile('tags.json'),
    iamPolicies: loadConfigFile('iam-policies.json'),
  };
}

/**
 * Validates that required configuration keys exist
 * @param config - The configuration object to validate
 * @param requiredKeys - Array of required configuration keys
 * @throws Error if any required keys are missing
 */
function validateConfig(config: any, requiredKeys: string[]): void {
  const missingKeys = requiredKeys.filter(key => !(key in config));
  if (missingKeys.length > 0) {
    throw new Error(`Missing required configuration keys: ${missingKeys.join(', ')}`);
  }
}

/**
 * Gets a nested configuration value using dot notation
 * @param config - The configuration object
 * @param path - Dot notation path (e.g., 'database.host')
 * @param defaultValue - Default value if path doesn't exist
 * @returns The configuration value or default
 */
function getConfigValue(config: any, path: string, defaultValue?: any): any {
  const keys = path.split('.');
  let current = config;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }
  
  return current;
}

/**
 * Merges multiple configuration objects with environment-specific overrides
 * @param baseConfig - Base configuration
 * @param environmentConfig - Environment-specific configuration
 * @returns Merged configuration object
 */
function mergeConfigs(baseConfig: any, environmentConfig: any): any {
  return {
    ...baseConfig,
    ...environmentConfig,
    // Deep merge for nested objects if needed
    ...(baseConfig.environment && environmentConfig.environment ? {
      environment: { ...baseConfig.environment, ...environmentConfig.environment }
    } : {})
  };
}

// Export grouped utilities
export const ScholarshipUtils = {
  determineTargetType,
  extractAcademicLevel,
  extractEthnicity,
  extractGender,
  createScholarshipId,
  cleanAcademicLevel,
  cleanAmount,
  formatDeadline,
  isDeadlineExpired
};

export const TextUtils = {
  cleanText,
  removeRedundantPhrases,
  truncateText,
  ensureNonEmptyString
};

export const NetworkUtils = {
  withRetry,
  isTimeoutError,
  isThrottlingError
};

export const ConfigUtils = {
  loadConfigFile,
  loadEnvironmentConfig,
  loadAllConfigs,
  validateConfig,
  getConfigValue,
  mergeConfigs
};

export const ScrapingUtils = {
  calculatePageOffset,
  buildPageUrl,
  SCRAPING_HEADERS
};

export const Helper = {
  ...ScholarshipUtils,
  ...TextUtils,
  ...NetworkUtils,
  ...ConfigUtils,
  ...ScrapingUtils
};

 