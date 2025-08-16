#!/usr/bin/env python3
"""
Efficient Scraper - Uses broader search terms and website-specific approaches
"""

import os
import logging
import requests
import time
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from base_scraper import BaseScraper
from scholarship_types import Scholarship, ScrapingResult, ScrapingMetadata

logger = logging.getLogger(__name__)


class GeneralScraper(BaseScraper):
    """General scraper that uses broader search terms"""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.base_url = "https://www.careeronestop.org"
        self.search_url = "https://www.careeronestop.org/Toolkit/Training/find-scholarships.aspx"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        })
        
        # Use only 2-3 broad search terms
        self.search_keywords = ['scholarship', 'financial aid', 'grant']
    
    def scrape(self) -> ScrapingResult:
        """Main scraping method"""
        logger.info("Starting general scraping...")
        
        try:
            # Update job status
            self.update_job_status('running', ScrapingMetadata())
            
            scholarships = []
            errors = []
            
            # Search for each broad keyword
            for keyword in self.search_keywords:
                keyword = keyword.strip()
                logger.info(f"Searching for keyword: {keyword}")
                
                try:
                    keyword_scholarships = self._search_broad_keyword(keyword)
                    scholarships.extend(keyword_scholarships)
                    logger.info(f"Found {len(keyword_scholarships)} scholarships for '{keyword}'")
                    
                    # Add delay between keywords
                    time.sleep(2)
                    
                except Exception as e:
                    error_msg = f"Error searching for '{keyword}': {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    continue
            
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
            error_msg = f"General scraper failed: {str(e)}"
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
    
    def _search_broad_keyword(self, keyword: str) -> List[Scholarship]:
        """Search using a broad keyword and get more results per search"""
        scholarships = []
        
        try:
            # Use broader search parameters
            params = {
                'keyword': keyword,
                'page': 1,
                'limit': 50  # Get more results per page
            }
            
            response = self.session.get(self.search_url, params=params, timeout=30)
            response.raise_for_status()
            
            # Store raw HTML
            self._store_raw_data(f"efficient_{keyword}_page_1.html", response.text, 'text/html')
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find all scholarship listings with broader selectors
            scholarship_elements = soup.find_all(['div', 'tr', 'li'], class_=lambda x: x and any(term in x.lower() for term in ['scholarship', 'award', 'grant', 'result', 'item']))
            
            for element in scholarship_elements:
                try:
                    scholarship = self._parse_scholarship_element(element)
                    if scholarship:
                        scholarships.append(scholarship)
                except Exception as e:
                    logger.warning(f"Error parsing scholarship element: {str(e)}")
                    continue
            
            logger.info(f"Found {len(scholarships)} scholarships for keyword '{keyword}'")
            
        except Exception as e:
            logger.error(f"Error searching for keyword '{keyword}': {str(e)}")
        
        return scholarships
    
    def _parse_scholarship_element(self, element) -> Optional[Scholarship]:
        """Parse a single scholarship element with broader selectors"""
        try:
            # Extract basic information with broader selectors
            title = self._extract_text(element, ['h1', 'h2', 'h3', 'h4', 'h5', 'strong', 'b', '.title', '.name', '.scholarship-title'])
            if not title:
                return None
            
            # Extract organization
            organization = self._extract_text(element, ['.organization', '.sponsor', '.company', '.provider'])
            
            # Extract amount with broader patterns
            amount_text = self._extract_text(element, ['.amount', '.award', '.funds', '.value', 'strong', 'b'])
            min_award, max_award = self._parse_amount(amount_text)
            
            # Extract deadline
            deadline = self._extract_text(element, ['.deadline', '.due-date', '.application-deadline', '.date'])
            
            # Extract description
            description = self._extract_text(element, ['.description', '.summary', '.details', 'p'])
            
            # Extract URL
            url = self._extract_url(element)
            
            # Create scholarship object
            scholarship = Scholarship(
                scholarship_id=self._generate_scholarship_id(title, organization or "Unknown"),
                title=title[:200],  # Limit title length
                description=description[:500] if description else None,  # Limit description
                organization=organization,
                url=url,
                source="Efficient Scraper",
                country="US",
                active=True,
                created_at=time.time(),
                updated_at=time.time(),
                min_award=min_award,
                max_award=max_award,
                deadline=deadline
            )
            
            return scholarship
            
        except Exception as e:
            logger.error(f"Error parsing scholarship element: {str(e)}")
            return None
    
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
        content = f"{title}-{organization or 'Unknown'}".lower()
        return hashlib.md5(content.encode()).hexdigest()[:16]
    
    def _remove_duplicates(self, scholarships: List[Scholarship]) -> List[Scholarship]:
        """Remove duplicate scholarships"""
        seen = set()
        unique = []
        
        for scholarship in scholarships:
            key = f"{scholarship.title.lower()}-{(scholarship.organization or 'Unknown').lower()}"
            if key not in seen:
                seen.add(key)
                unique.append(scholarship)
        
        return unique
    
    def _store_raw_data(self, filename: str, content: str, content_type: str):
        """Store raw data (placeholder for S3 storage)"""
        # In a real implementation, this would store to S3
        # For now, just log that we would store it
        logger.debug(f"Would store raw data: {filename} ({len(content)} bytes)")
