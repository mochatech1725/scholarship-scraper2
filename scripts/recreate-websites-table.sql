use scholarships_dev;
-- Drop the existing websites table if it exists
DROP TABLE IF EXISTS websites;
-- Create the websites table with proper structure
CREATE TABLE websites (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500),
    type ENUM('crawl', 'search') NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    scraper_class VARCHAR(255) NOT NULL,
    crawl_url VARCHAR(500),
    selectors JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
);
-- Insert the website data
INSERT INTO websites (name, url, type, enabled, scraper_class, crawl_url, selectors) VALUES
('collegescholarship', 'https://www.collegescholarships.org', 'crawl', TRUE, 'CollegeScholarshipScraper', 'https://www.collegescholarships.org/scholarships/', 
  '{"scholarshipLinks": ".scholarship-description h4 a", "title": ".scholarship-description h4 a", "amount": ".scholarship-summary .lead strong", "deadline": ".scholarship-summary p:last-child strong", "description": ".scholarship-description p:first-child", "organization": ".sponsor p"}'),
('careeronestop', 'https://www.careeronestop.org', 'crawl', TRUE, 'GumLoopScraper', 'https://www.careeronestop.org/scholarships',
  '{"scholarshipLinks": "a[href*=\\"/scholarship/\\"]", "title": "h1, h2, .scholarship-title", "amount": ".amount, .award-amount", "deadline": ".deadline, .due-date", "description": ".description, .summary", "organization": ".organization, .sponsor"}'),
('college_scholarship_search', NULL, 'search', TRUE, 'GeneralSearchScraper', NULL,
  '{"searchTerms": ["college scholarships 2025", "university scholarships for students", "undergraduate scholarship opportunities", "merit-based college scholarships", "need-based financial aid scholarships", "academic excellence scholarships", "first-generation college student scholarships", "minority student scholarships", "women in STEM scholarships", "engineering student scholarships", "business student scholarships", "arts and humanities scholarships", "community service scholarships", "leadership scholarships for college", "athletic scholarships for college students", "international student scholarships USA", "transfer student scholarships", "graduate school scholarships", "PhD funding opportunities", "fellowship programs for students"], "maxResultsPerTerm": 30, "delayBetweenRequests": 3000, "searchEngine": "google", "includeNews": false, "includeForums": false, "dateRange": "past_year"}'),
('general_search', NULL, 'search', TRUE, 'GeneralSearchScraper', NULL,
  '{"searchTerms": ["scholarship opportunities 2025", "student financial aid programs", "academic scholarship programs", "merit-based financial aid", "need-based scholarship programs", "undergraduate funding opportunities", "graduate student funding", "fellowship opportunities", "research grant opportunities", "academic excellence awards"], "maxResultsPerTerm": 25, "delayBetweenRequests": 2500, "searchEngine": "google", "includeNews": false, "includeForums": false, "dateRange": "past_year"}');
-- Verify the table structure
DESCRIBE websites;
-- Show the inserted data
SELECT * FROM websites;