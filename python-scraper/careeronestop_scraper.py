#!/usr/bin/env python3
"""
CareerOneStop Scraper - Python Version
Scrapes scholarships from CareerOneStop.org using BeautifulSoup
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


class CareerOneStopScraper(BaseScraper):
    """CareerOneStop.org scraper using BeautifulSoup"""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.base_url = "https://www.careeronestop.org"
        self.search_url = "https://www.careeronestop.org/Toolkit/Training/find-scholarships.aspx"
        self.session = requests.Session()
        
        # No longer using keyword-by-keyword approach - using efficient broad search
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
        logger.info("Starting CareerOneStop scraping...")
        
        try:
            # Update job status
            self.update_job_status('running', ScrapingMetadata())
            
            scholarships = []
            errors = []
            
            # Use efficient approach - search with broad terms
            logger.info("Using efficient broad search approach")
            
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
                    time.sleep(2)  # Be respectful to the server
                    
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
            error_msg = f"CareerOneStop scraper failed: {str(e)}"
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
            params = {
                'keyword': 'scholarship',  # Use broad search term
                'page': page
            }
            
            response = self.session.get(self.search_url, params=params, timeout=30)
            response.raise_for_status()
            
            # Store raw HTML
            self._store_raw_data(f"careeronestop_page_{page}.html", response.text, 'text/html')
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find scholarship listings - use table structure like TypeScript version
            scholarship_elements = soup.find_all('table')
            if not scholarship_elements:
                # Fallback to other selectors
                scholarship_elements = soup.find_all('div', class_='scholarship-item') or \
                                     soup.find_all('div', class_='result-item') or \
                                     soup.find_all('tr', class_='scholarship-row')
            
            # Parse table rows like TypeScript version
            for table in scholarship_elements:
                rows = table.find_all('tr')
                for row in rows:
                    try:
                        scholarship = self._parse_table_row(row)
                        if scholarship:
                            scholarships.append(scholarship)
                    except Exception as e:
                        logger.warning(f"Error parsing table row: {str(e)}")
                        continue
            
            logger.info(f"Found {len(scholarships)} scholarships on page {page}")
            
        except Exception as e:
            logger.error(f"Error scraping page {page}: {str(e)}")
        
        return scholarships
    
    def _parse_table_row(self, row) -> Optional[Scholarship]:
        """Parse a table row like the TypeScript version"""
        try:
            cells = row.find_all('td')
            if len(cells) < 5:
                return None
            
            # Extract cells like TypeScript version
            name_cell = cells[0]
            level_cell = cells[1]
            type_cell = cells[2]
            amount_cell = cells[3]
            deadline_cell = cells[4]
            
            # Check if it's a scholarship (like TypeScript version)
            award_type = type_cell.get_text(strip=True)
            if 'scholarship' not in award_type.lower():
                return None
            
            # Extract title from link
            link = name_cell.find('a')
            if not link:
                return None
            
            title = link.get_text(strip=True)
            if not title or title == 'Award Name':
                return None
            
            # Extract organization from name cell text
            organization_text = name_cell.get_text()
            import re
            org_match = re.search(r'Organization:\s*(.+?)(?:\n|<br>|Purposes:)', organization_text, re.IGNORECASE)
            organization = org_match.group(1).strip() if org_match else ''
            
            # Extract purposes/description
            purposes_match = re.search(r'Purposes:\s*(.+?)$', organization_text, re.IGNORECASE)
            purposes = purposes_match.group(1).strip() if purposes_match else ''
            
            # Extract URL
            detail_link = link.get('href')
            full_url = ''
            if detail_link:
                if detail_link.startswith('http'):
                    full_url = detail_link
                else:
                    full_url = f"https://www.careeronestop.org{detail_link}"
            
            # Extract academic level
            import re
            academic_level = re.sub(r'\s+', ' ', level_cell.get_text(strip=True))
            
            # Extract amount
            amount_text = amount_cell.get_text(strip=True)
            if not amount_text:
                amount_text = 'Amount not specified'
            
            min_award, max_award = self._parse_amount(amount_text)
            
            # Extract deadline
            raw_deadline = deadline_cell.get_text(strip=True)
            if not raw_deadline:
                raw_deadline = 'No deadline specified'
            
            deadline = self._clean_text(raw_deadline)
            
            # Create description
            if purposes:
                description = purposes[:500]  # Limit description
            else:
                description = f"Scholarship offered by {organization or 'CareerOneStop database'}"
            
            # Clean text
            clean_title = self._clean_text(title)
            clean_organization = self._clean_text(organization)
            clean_description = self._clean_text(description)[:500]
            
            # Create scholarship object
            scholarship = Scholarship(
                scholarship_id=self._generate_scholarship_id(clean_title, clean_organization),
                title=clean_title[:200],
                description=clean_description,
                organization=clean_organization,
                url=full_url,
                source="CareerOneStop",
                country="US",
                active=True,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                min_award=min_award,
                max_award=max_award,
                deadline=deadline,
                academic_level=academic_level[:50]  # Limit academic level length
            )
            
            return scholarship
            
        except Exception as e:
            logger.error(f"Error parsing table row: {str(e)}")
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
