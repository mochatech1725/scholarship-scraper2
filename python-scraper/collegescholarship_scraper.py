#!/usr/bin/env python3
"""
CollegeScholarship Scraper - Python Version
Scrapes scholarships from CollegeScholarships.org using BeautifulSoup
"""

import os
import logging
import requests
import time
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from datetime import datetime
from base_scraper import BaseScraper
from scholarship_types import Scholarship, ScrapingResult, ScrapingMetadata

logger = logging.getLogger(__name__)


class CollegeScholarshipScraper(BaseScraper):
    """CollegeScholarships.org scraper using BeautifulSoup"""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.base_url = "https://www.collegescholarships.org"
        self.search_url = "https://www.collegescholarships.org/financial-aid/"
        self.session = requests.Session()
        

        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        })
    
    def scrape(self) -> ScrapingResult:
        """Main scraping method"""
        logger.info("Starting CollegeScholarship scraping...")
        
        try:
            # Update job status
            self.update_job_status('running', ScrapingMetadata())
            
            scholarships = []
            errors = []
            
            page = 1
            max_pages = 3  # Get more pages since we're not searching multiple keywords
            
            while page <= max_pages:
                try:
                    logger.info(f"Scraping page {page}")
                    page_scholarships = self._scrape_page(page)
                    scholarships.extend(page_scholarships)
                    
                    if not page_scholarships:
                        logger.info(f"No more scholarships found on page {page}")
                        break
                    
                    page += 1
                    time.sleep(3)  # Be respectful to the server
                    
                except Exception as e:
                    error_msg = f"Error scraping page {page}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    break
            
            # Remove duplicates
            unique_scholarships = self._remove_duplicates(scholarships)
            
            # Process and save scholarships
            inserted = 0
            updated = 0
            process_errors = []
            
            for scholarship in unique_scholarships:
                try:
                    if self.save_scholarship(scholarship):
                        inserted += 1
                    else:
                        updated += 1
                except Exception as e:
                    process_errors.append(f"Error saving scholarship {scholarship.title}: {str(e)}")
            
            errors.extend(process_errors)
            
            # Update job status
            self.update_job_status('completed', ScrapingMetadata(
                records_found=len(unique_scholarships),
                records_processed=len(unique_scholarships),
                records_inserted=inserted,
                records_updated=updated
            ))
            
            return ScrapingResult(
                success=True,
                scholarships=unique_scholarships,
                errors=errors,
                metadata={
                    'total_found': len(unique_scholarships),
                    'total_processed': len(unique_scholarships),
                    'total_inserted': inserted,
                    'total_updated': updated
                }
            )
            
        except Exception as e:
            error_msg = f"CollegeScholarship scraper failed: {str(e)}"
            logger.error(error_msg)
            
            self.update_job_status('failed', ScrapingMetadata(errors=[error_msg]))
            
            return ScrapingResult(
                success=False,
                scholarships=[],
                errors=[error_msg],
                metadata={
                    'total_found': 0,
                    'total_processed': 0,
                    'total_inserted': 0,
                    'total_updated': 0
                }
            )
    
    def _scrape_page(self, page: int) -> List[Scholarship]:
        """Scrape a single page of scholarships"""
        scholarships = []
        
        try:
            # Construct search URL with pagination
            if page == 1:
                url = self.search_url
            else:
                url = f"{self.search_url}?page={page}"
            
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # Store raw HTML
            self._store_raw_data(f"collegescholarship_page_{page}.html", response.text, 'text/html')
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find scholarship listings using TypeScript structure
            scholarship_elements = soup.find_all('div', class_='row')
            
            for element in scholarship_elements:
                try:
                    scholarship = self._parse_row_element(element)
                    if scholarship:
                        scholarships.append(scholarship)
                except Exception as e:
                    logger.warning(f"Error parsing row element: {str(e)}")
                    continue
            
            logger.info(f"Found {len(scholarships)} scholarships on page {page}")
            
        except Exception as e:
            logger.error(f"Error scraping page {page}: {str(e)}")
        
        return scholarships
    
    def _parse_row_element(self, element) -> Optional[Scholarship]:
        """Parse a row element like the TypeScript version"""
        try:
            # Find scholarship summary and description sections
            summary = element.find('div', class_='scholarship-summary')
            description = element.find('div', class_='scholarship-description')
            
            if not summary or not description:
                return None
            
            # Extract amount from summary (like TypeScript version)
            amount_element = summary.find('div', class_='lead')
            if amount_element:
                amount_text = amount_element.find('strong')
                amount = amount_text.get_text(strip=True) if amount_text else 'Amount varies'
            else:
                amount = 'Amount varies'
            
            min_award, max_award = self._parse_amount(amount)
            
            # Extract deadline from summary (like TypeScript version)
            deadline_element = summary.find_all('p')[-1] if summary.find_all('p') else None
            if deadline_element:
                deadline_strong = deadline_element.find('strong')
                raw_deadline = deadline_strong.get_text(strip=True) if deadline_strong else 'No deadline specified'
            else:
                raw_deadline = 'No deadline specified'
            
            # Extract title and link from description (like TypeScript version)
            title_element = description.find('h4')
            if title_element:
                link_element = title_element.find('a')
                if link_element:
                    title = link_element.get_text(strip=True)
                    link = link_element.get('href')
                else:
                    title = title_element.get_text(strip=True)
                    link = ''
            else:
                return None
            
            # Skip if title contains 'Find Scholarships' (like TypeScript version)
            if 'Find Scholarships' in title:
                return None
            
            # Extract description from description section (like TypeScript version)
            desc_paragraphs = description.find_all('p', class_=lambda x: x != 'visible-xs')
            description_text = ''
            if desc_paragraphs:
                description_text = desc_paragraphs[0].get_text(strip=True)
            
            # Extract eligibility items from ul.fa-ul li (like TypeScript version)
            eligibility_items = []
            academic_level_items = []
            geographic_restrictions_items = []
            
            ul_element = description.find('ul', class_='fa-ul')
            if ul_element:
                for li in ul_element.find_all('li'):
                    icon = li.find('i')
                    if icon:
                        icon_classes = icon.get('class', [])
                        text_element = li.find(class_='trim')
                        if text_element:
                            text = text_element.get_text(strip=True)
                            if text and 'No Geographic Restrictions' not in text:
                                if 'fa-map-marker' in icon_classes:
                                    geographic_restrictions_items.append(text)
                                elif 'fa-graduation-cap' in icon_classes:
                                    academic_level_items.append(text)
                                else:
                                    eligibility_items.append(text)
            
            # Join items like TypeScript version
            eligibility = ' | '.join(eligibility_items)
            academic_level = ' | '.join(academic_level_items)
            geographic_restrictions = ' | '.join(geographic_restrictions_items)
            
            # Clean text like TypeScript version
            clean_title = self._clean_text(title)
            clean_deadline = self._clean_text(raw_deadline)
            clean_description = self._clean_text(description_text)
            clean_eligibility = self._clean_text(eligibility)
            clean_geographic_restrictions = self._clean_text(geographic_restrictions)
            
            # Create scholarship object
            scholarship = Scholarship(
                scholarship_id=self._generate_scholarship_id(clean_title, "CollegeScholarships"),
                title=clean_title[:200],
                description=clean_description[:500] if clean_description else None,
                organization="",  # Will be filled by detail fetching if enabled
                url=link if link else "",
                source="CollegeScholarships",
                country="US",
                active=True,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                min_award=min_award,
                max_award=max_award,
                deadline=clean_deadline,
                eligibility=clean_eligibility[:500] if clean_eligibility else None,
                academic_level=academic_level[:50] if academic_level else None,
                geographic_restrictions=clean_geographic_restrictions
            )
            
            return scholarship
            
        except Exception as e:
            logger.error(f"Error parsing row element: {str(e)}")
            return None
    
    def _clean_text(self, text: str) -> str:
        """Clean text by removing extra whitespace and quotes"""
        if not text:
            return ""
        # Remove extra whitespace
        text = ' '.join(text.split())
        # Remove quotes if they wrap the entire text
        if text.startswith('"') and text.endswith('"'):
            text = text[1:-1]
        if text.startswith("'") and text.endswith("'"):
            text = text[1:-1]
        return text
    
    def _extract_text(self, element, selectors: List[str]) -> Optional[str]:
        """Extract text using multiple possible selectors"""
        for selector in selectors:
            found = element.select_one(selector)
            if found:
                text = found.get_text(strip=True)
                if text:
                    return text
        return None
    
    def _extract_url(self, element) -> Optional[str]:
        """Extract URL from element"""
        # Look for links
        link = element.find('a')
        if link and link.get('href'):
            href = link.get('href')
            if href.startswith('http'):
                return href
            else:
                return urljoin(self.base_url, href)
        return None
    
    def _parse_amount(self, amount_text: Optional[str]) -> tuple[Optional[float], Optional[float]]:
        """Parse amount text to extract min and max awards"""
        if not amount_text:
            return None, None
        
        try:
            # Remove common text and extract numbers
            import re
            numbers = re.findall(r'\$?([\d,]+)', amount_text.replace(',', ''))
            
            if len(numbers) >= 2:
                # Assume first is min, second is max
                return float(numbers[0]), float(numbers[1])
            elif len(numbers) == 1:
                # Single amount
                amount = float(numbers[0])
                return amount, amount
            else:
                return None, None
        except:
            return None, None
    
    def _generate_scholarship_id(self, title: str, organization: str) -> str:
        """Generate a unique scholarship ID"""
        import hashlib
        content = f"{title}-{organization}".lower()
        return hashlib.md5(content.encode()).hexdigest()[:16]
    
    def _remove_duplicates(self, scholarships: List[Scholarship]) -> List[Scholarship]:
        """Remove duplicate scholarships"""
        seen = set()
        unique = []
        
        for scholarship in scholarships:
            key = f"{scholarship.title.lower()}-{scholarship.organization.lower()}"
            if key not in seen:
                seen.add(key)
                unique.append(scholarship)
        
        return unique
    
    def _store_raw_data(self, filename: str, content: str, content_type: str):
        """Store raw data (placeholder for S3 storage)"""
        # In a real implementation, this would store to S3
        # For now, just log that we would store it
        logger.debug(f"Would store raw data: {filename} ({len(content)} bytes)")
