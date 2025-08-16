-- Setup script for local MySQL database
-- Run this script to create the necessary tables for the Python scraper

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS scholarships CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE scholarships;

-- Create scholarships table
CREATE TABLE IF NOT EXISTS scholarships (
    scholarship_id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    organization VARCHAR(255),
    orga_website VARCHAR(500),
    target_type VARCHAR(50),
    min_award DECIMAL(10,2),
    max_award DECIMAL(10,2),
    deadline VARCHAR(255),
    eligibility TEXT,
    gender VARCHAR(50),
    ethnicity VARCHAR(100),
    academic_level VARCHAR(50),
    essay_required BOOLEAN DEFAULT FALSE,
    recommendation_required BOOLEAN DEFAULT FALSE,
    renewable BOOLEAN DEFAULT FALSE,
    geographic_restrictions VARCHAR(255),
    apply_url VARCHAR(500),
    url VARCHAR(500),
    source VARCHAR(100),
    country VARCHAR(10) DEFAULT 'US',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for better performance
    INDEX idx_title (title(100)),
    INDEX idx_organization (organization),
    INDEX idx_source (source),
    INDEX idx_active (active),
    INDEX idx_created_at (created_at),
    INDEX idx_academic_level (academic_level),
    INDEX idx_target_type (target_type),
    INDEX idx_country (country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create jobs table for tracking scraping jobs
CREATE TABLE IF NOT EXISTS jobs (
    job_id VARCHAR(100) PRIMARY KEY,
    website VARCHAR(100) NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
    records_found INT DEFAULT 0,
    records_processed INT DEFAULT 0,
    records_inserted INT DEFAULT 0,
    records_updated INT DEFAULT 0,
    errors JSON,
    metadata JSON,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_website (website),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create websites table for configuration
CREATE TABLE IF NOT EXISTS websites (
    website_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500),
    enabled BOOLEAN DEFAULT TRUE,
    scraper_type ENUM('python', 'typescript') DEFAULT 'python',
    config JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_enabled (enabled),
    INDEX idx_scraper_type (scraper_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert some default website configurations
INSERT IGNORE INTO websites (website_id, name, url, enabled, scraper_type) VALUES
-- TypeScript scrapers (production)
('careeronestop', 'CareerOneStop', 'https://www.careeronestop.org', TRUE, 'typescript'),
('collegescholarship', 'CollegeScholarship.org', 'https://www.collegescholarships.org', TRUE, 'typescript'),
('general_search', 'General Search (AI)', 'https://bedrock.amazonaws.com', TRUE, 'typescript'),
-- Python scrapers (local development)
('careeronestop_python', 'CareerOneStop (Python)', 'https://www.careeronestop.org', TRUE, 'python'),
('collegescholarship_python', 'CollegeScholarship (Python)', 'https://www.collegescholarships.org', TRUE, 'python'),
('general', 'General Scraper', 'https://example.com', TRUE, 'python'),
('rss', 'RSS/API Scraper', 'https://example.com', TRUE, 'python');

-- Create a view for active scholarships
CREATE OR REPLACE VIEW active_scholarships AS
SELECT 
    scholarship_id,
    title,
    description,
    organization,
    min_award,
    max_award,
    deadline,
    eligibility,
    academic_level,
    target_type,
    source,
    country,
    created_at
FROM scholarships 
WHERE active = TRUE
ORDER BY created_at DESC;

-- Show table structure
DESCRIBE scholarships;
DESCRIBE jobs;
DESCRIBE websites;

-- Show sample data
SELECT COUNT(*) as total_scholarships FROM scholarships;
SELECT COUNT(*) as total_jobs FROM jobs;
SELECT * FROM websites;
