-- MySQL Migration Script for Scholarship Scraper
-- Creates the scholarships and websites tables with proper structure

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS scholarships_dev;
USE scholarships_dev;

-- Drop tables if they exist (for clean migration)
DROP TABLE IF EXISTS scholarships;
DROP TABLE IF EXISTS websites;

-- Create scholarships table
CREATE TABLE scholarships (
  id VARCHAR(255) NOT NULL,
  name VARCHAR(500) NOT NULL,
  deadline VARCHAR(100),
  url TEXT,
  description TEXT,
  eligibility TEXT,
  organization VARCHAR(255),
  org_website TEXT,
  academic_level VARCHAR(100),
  geographic_restrictions TEXT,
  target_type ENUM('need', 'merit', 'both') DEFAULT 'both',
  ethnicity VARCHAR(100) DEFAULT 'unspecified',
  gender VARCHAR(50) DEFAULT 'unspecified',
  min_award DECIMAL(10,2) DEFAULT 0,
  max_award DECIMAL(10,2) DEFAULT 0,
  renewable BOOLEAN DEFAULT FALSE,
  country VARCHAR(50) DEFAULT 'US',
  apply_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  essay_required BOOLEAN DEFAULT FALSE,
  recommendations_required BOOLEAN DEFAULT FALSE,
  source VARCHAR(100),
  job_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Primary key
  PRIMARY KEY (id),
  
  -- Indexes for common queries
  INDEX idx_deadline (deadline),
  INDEX idx_organization (organization),
  INDEX idx_org_website (org_website(255)),
  INDEX idx_academic_level (academic_level),
  INDEX idx_target_type (target_type),
  INDEX idx_ethnicity (ethnicity),
  INDEX idx_gender (gender),
  INDEX idx_country (country),
  INDEX idx_source (source),
  INDEX idx_job_id (job_id),
  INDEX idx_created_at (created_at),
  INDEX idx_updated_at (updated_at),
  
  -- Composite indexes for common query patterns
  INDEX idx_deadline_target_type (deadline, target_type),
  INDEX idx_academic_level_target_type (academic_level, target_type),
  INDEX idx_organization_deadline (organization, deadline),
  
  -- Full-text search index
  FULLTEXT idx_search (name, description, eligibility, organization, org_website)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create websites table
CREATE TABLE websites (
  name VARCHAR(100) NOT NULL,
  url VARCHAR(500),
  type ENUM('api', 'crawl', 'search', 'discovery') NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  scraper_class VARCHAR(100),
  
  -- API-specific fields
  api_endpoint VARCHAR(500),
  api_key VARCHAR(255),
  
  -- Crawl-specific fields
  crawl_url VARCHAR(500),
  selectors JSON,
  
  -- Search-specific fields
  search_config JSON,
  
  -- Discovery-specific fields
  discovery_config JSON,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Primary key
  PRIMARY KEY (name),
  
  -- Indexes
  INDEX idx_type (type),
  INDEX idx_enabled (enabled),
  INDEX idx_scraper_class (scraper_class),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create views for common queries
CREATE OR REPLACE VIEW active_scholarships AS
SELECT * FROM scholarships 
WHERE is_active = TRUE 
  AND (deadline IS NULL OR deadline = '' OR deadline LIKE '%rolling%' OR deadline LIKE '%ongoing%' OR deadline LIKE '%continuous%' OR deadline LIKE '%open%' OR deadline > CURDATE());

CREATE OR REPLACE VIEW scholarships_by_type AS
SELECT 
  target_type,
  COUNT(*) as total_count,
  COUNT(CASE WHEN deadline > CURDATE() OR deadline IS NULL OR deadline = '' OR deadline LIKE '%rolling%' THEN 1 END) as active_count,
  AVG(max_award) as avg_max_award,
  SUM(max_award) as total_award_pool
FROM scholarships 
WHERE is_active = TRUE
GROUP BY target_type;

-- Insert sample data for testing
INSERT INTO websites (name, url, type, enabled, scraper_class, crawl_url, selectors) VALUES
('collegescholarship', 'https://www.collegescholarships.org', 'crawl', TRUE, 'CollegeScholarshipScraper', 'https://www.collegescholarships.org/scholarships/', 
  '{"scholarshipLinks": ".scholarship-description h4 a", "title": ".scholarship-description h4 a", "amount": ".scholarship-summary .lead strong", "deadline": ".scholarship-summary p:last-child strong", "description": ".scholarship-description p:first-child", "organization": ".sponsor p"}'),

('careeronestop', 'https://www.careeronestop.org', 'crawl', TRUE, 'GumLoopScraper', 'https://www.careeronestop.org/scholarships',
  '{"scholarshipLinks": "a[href*=\"/scholarship/\"]", "title": "h1, h2, .scholarship-title", "amount": ".amount, .award-amount", "deadline": ".deadline, .due-date", "description": ".description, .summary", "organization": ".organization, .sponsor"}'),

('college_scholarship_search', NULL, 'search', TRUE, 'GeneralSearchScraper', NULL,
  '{"searchTerms": ["college scholarships 2025", "university scholarships for students", "undergraduate scholarship opportunities", "merit-based college scholarships", "need-based financial aid scholarships", "academic excellence scholarships", "first-generation college student scholarships", "minority student scholarships", "women in STEM scholarships", "engineering student scholarships", "business student scholarships", "arts and humanities scholarships", "community service scholarships", "leadership scholarships for college", "athletic scholarships for college students", "international student scholarships USA", "transfer student scholarships", "graduate school scholarships", "PhD funding opportunities", "fellowship programs for students"], "maxResultsPerTerm": 30, "delayBetweenRequests": 3000, "searchEngine": "google", "includeNews": false, "includeForums": false, "dateRange": "past_year"}'),

('general_search', NULL, 'search', TRUE, 'GeneralSearchScraper', NULL,
  '{"searchTerms": ["scholarship opportunities 2025", "student financial aid programs", "academic scholarship programs", "merit-based financial aid", "need-based scholarship programs", "undergraduate funding opportunities", "graduate student funding", "fellowship opportunities", "research grant opportunities", "academic excellence awards"], "maxResultsPerTerm": 25, "delayBetweenRequests": 2500, "searchEngine": "google", "includeNews": false, "includeForums": false, "dateRange": "past_year"}');

-- Show table structure
DESCRIBE scholarships;
DESCRIBE websites;

-- Show indexes
SHOW INDEX FROM scholarships;
SHOW INDEX FROM websites;

-- Show views
SHOW FULL TABLES WHERE Table_type = 'VIEW';

-- Show sample data
SELECT * FROM websites WHERE enabled = TRUE;

-- Create applications table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS applications (
  id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  scholarship_id VARCHAR(255) NOT NULL,
  organization VARCHAR(255),
  org_website TEXT,
  status ENUM('draft', 'submitted', 'approved', 'rejected', 'withdrawn') DEFAULT 'draft',
  submitted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Primary key
  PRIMARY KEY (id),
  
  -- Foreign keys
  INDEX idx_user_id (user_id),
  INDEX idx_scholarship_id (scholarship_id),
  INDEX idx_organization (organization),
  INDEX idx_status (status),
  INDEX idx_submitted_at (submitted_at),
  INDEX idx_created_at (created_at),
  
  -- Composite indexes for common query patterns
  INDEX idx_user_status (user_id, status),
  INDEX idx_scholarship_status (scholarship_id, status),
  INDEX idx_organization_status (organization, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Show applications table structure
DESCRIBE applications; 