-- Scholarship Scraper Websites Table Population Script
-- This script can be run multiple times safely due to the primary key constraint
-- Run this after the DynamoDB table is created by CDK

-- Note: This is a reference SQL script. For DynamoDB, you'll need to use AWS CLI or SDK
-- to insert the data. The actual implementation will be in a separate script.

-- Table Structure (DynamoDB):
-- Table Name: scholarship-scraper-websites-{environment}
-- Primary Key: name (String)
-- Attributes: All website configuration data

-- Sample data based on current websites.json configuration

-- CollegeScholarship API Integration
INSERT INTO scholarship_scraper_websites (name, url, type, api_endpoint, api_key, enabled, scraper_class, created_at, updated_at)
VALUES (
    'collegescholarship',
    'https://collegescholarship.com',
    'api',
    'https://api.collegescholarship.com/scholarships',
    'ENV_VAR_COLLEGESCHOLARSHIP_API_KEY',
    true,
    'CollegeScholarshipScraper',
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE
    url = VALUES(url),
    type = VALUES(type),
    api_endpoint = VALUES(api_endpoint),
    api_key = VALUES(api_key),
    enabled = VALUES(enabled),
    scraper_class = VALUES(scraper_class),
    updated_at = NOW();


-- CareerOneStop Crawling
INSERT INTO scholarship_scraper_websites (name, url, type, crawl_url, enabled, scraper_class, selectors, created_at, updated_at)
VALUES (
    'careeronestop',
    'https://www.careeronestop.org',
    'crawl',
    'https://www.careeronestop.org/scholarships',
    true,
    'GumLoopScraper',
    '{"scholarshipLinks": "a[href*=\"/scholarship/\"]", "title": "h1, h2, .scholarship-title", "amount": ".amount, .award-amount", "deadline": ".deadline, .due-date", "description": ".description, .summary", "organization": ".organization, .sponsor"}',
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE
    url = VALUES(url),
    type = VALUES(type),
    crawl_url = VALUES(crawl_url),
    enabled = VALUES(enabled),
    scraper_class = VALUES(scraper_class),
    selectors = VALUES(selectors),
    updated_at = NOW();

-- Discovery Crawling
INSERT INTO scholarship_scraper_websites (name, type, enabled, scraper_class, discovery_config, created_at, updated_at)
VALUES (
    'discovery_crawl',
    'discovery',
    true,
    'GumLoopDiscoveryScraper',
    '{"seedUrls": ["https://www.harvard.edu/financial-aid/scholarships", "https://www.stanford.edu/admission-aid/financial-aid/scholarships", "https://www.mit.edu/admissions-aid/financial-aid/scholarships", "https://www.yale.edu/admissions-aid/financial-aid/scholarships", "https://www.princeton.edu/admission-aid/financial-aid/scholarships"], "domainFilter": ".edu", "keywordFilter": ["scholarship", "financial aid", "grant", "award"], "maxDepth": 3, "maxPages": 100}',
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE
    type = VALUES(type),
    enabled = VALUES(enabled),
    scraper_class = VALUES(scraper_class),
    discovery_config = VALUES(discovery_config),
    updated_at = NOW();

-- General Search (AI-powered)
INSERT INTO scholarship_scraper_websites (name, type, enabled, scraper_class, search_config, created_at, updated_at)
VALUES (
    'general_search',
    'search',
    true,
    'GeneralSearchScraper',
    '{"searchTerms": ["college scholarships", "university financial aid", "student grants", "academic awards", "merit scholarships", "need-based aid", "undergraduate scholarships", "graduate fellowships"], "maxResultsPerTerm": 50, "delayBetweenRequests": 2000}',
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE
    type = VALUES(type),
    enabled = VALUES(enabled),
    scraper_class = VALUES(scraper_class),
    search_config = VALUES(search_config),
    updated_at = NOW(); 