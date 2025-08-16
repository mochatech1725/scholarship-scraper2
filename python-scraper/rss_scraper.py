#!/usr/bin/env python3
"""
RSS/API Scraper - Uses RSS feeds and APIs for efficient data collection
"""

import os
import logging
import requests
import time
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
from base_scraper import BaseScraper
from scholarship_types import Scholarship, ScrapingResult, ScrapingMetadata

logger = logging.getLogger(__name__)


class RSSScraper(BaseScraper):
    """Scraper that uses RSS feeds and APIs for efficient data collection"""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        })
        
        # RSS feeds and APIs for scholarship data
        self.data_sources = [
            {
                'name': 'FastWeb RSS',
                'url': 'https://www.fastweb.com/rss/scholarships.xml',
                'type': 'rss'
            },
            {
                'name': 'Scholarships.com RSS',
                'url': 'https://www.scholarships.com/rss/scholarships.xml',
                'type': 'rss'
            },
            {
                'name': 'College Board API',
                'url': 'https://api.collegeboard.org/scholarships',
                'type': 'api',
                'headers': {
                    'Authorization': f"Bearer {os.getenv('COLLEGE_BOARD_API_KEY', '')}"
                }
            }
        ]
    
    def scrape(self) -> ScrapingResult:
        """Main scraping method"""
        logger.info("Starting RSS/API scraping...")
        
        try:
            # Update job status
            self.update_job_status('running', ScrapingMetadata())
            
            scholarships = []
            errors = []
            
            # Collect from each data source
            for source in self.data_sources:
                try:
                    logger.info(f"Collecting from {source['name']}")
                    
                    if source['type'] == 'rss':
                        source_scholarships = self._scrape_rss_feed(source['url'])
                    elif source['type'] == 'api':
                        source_scholarships = self._scrape_api(source['url'], source.get('headers', {}))
                    else:
                        continue
                    
                    scholarships.extend(source_scholarships)
                    logger.info(f"Found {len(source_scholarships)} scholarships from {source['name']}")
                    
                    # Add delay between sources
                    time.sleep(2)
                    
                except Exception as e:
                    error_msg = f"Error collecting from {source['name']}: {str(e)}"
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
            error_msg = f"RSS/API scraper failed: {str(e)}"
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
    
    def _scrape_rss_feed(self, url: str) -> List[Scholarship]:
        """Scrape RSS feed for scholarships"""
        scholarships = []
        
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # Parse RSS XML
            root = ET.fromstring(response.content)
            
            # Find all item elements (RSS entries)
            for item in root.findall('.//item'):
                try:
                    scholarship = self._parse_rss_item(item)
                    if scholarship:
                        scholarships.append(scholarship)
                except Exception as e:
                    logger.warning(f"Error parsing RSS item: {str(e)}")
                    continue
            
            logger.info(f"Found {len(scholarships)} scholarships from RSS feed")
            
        except Exception as e:
            logger.error(f"Error scraping RSS feed {url}: {str(e)}")
        
        return scholarships
    
    def _scrape_api(self, url: str, headers: Dict[str, str]) -> List[Scholarship]:
        """Scrape API for scholarships"""
        scholarships = []
        
        try:
            response = self.session.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Parse API response (structure may vary)
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict) and 'scholarships' in data:
                items = data['scholarships']
            elif isinstance(data, dict) and 'results' in data:
                items = data['results']
            else:
                items = [data]
            
            for item in items:
                try:
                    scholarship = self._parse_api_item(item)
                    if scholarship:
                        scholarships.append(scholarship)
                except Exception as e:
                    logger.warning(f"Error parsing API item: {str(e)}")
                    continue
            
            logger.info(f"Found {len(scholarships)} scholarships from API")
            
        except Exception as e:
            logger.error(f"Error scraping API {url}: {str(e)}")
        
        return scholarships
    
    def _parse_rss_item(self, item) -> Optional[Scholarship]:
        """Parse RSS item into scholarship object"""
        try:
            # Extract basic information from RSS item
            title = item.find('title')
            title_text = title.text if title is not None else "Unknown Scholarship"
            
            description = item.find('description')
            description_text = description.text if description is not None else None
            
            link = item.find('link')
            url = link.text if link is not None else None
            
            # Extract additional information from description or other fields
            organization = self._extract_organization_from_text(description_text or title_text)
            
            # Create scholarship object
            scholarship = Scholarship(
                scholarship_id=self._generate_scholarship_id(title_text, organization),
                title=title_text[:200],
                description=description_text[:500] if description_text else None,
                organization=organization,
                url=url,
                source="RSS Feed",
                country="US",
                active=True,
                created_at=time.time(),
                updated_at=time.time()
            )
            
            return scholarship
            
        except Exception as e:
            logger.error(f"Error parsing RSS item: {str(e)}")
            return None
    
    def _parse_api_item(self, item: Dict[str, Any]) -> Optional[Scholarship]:
        """Parse API item into scholarship object"""
        try:
            # Extract information from API response
            title = item.get('title') or item.get('name') or "Unknown Scholarship"
            description = item.get('description') or item.get('summary')
            url = item.get('url') or item.get('link')
            organization = item.get('organization') or item.get('sponsor') or item.get('provider')
            
            # Extract amount information
            amount = item.get('amount') or item.get('award_amount')
            min_award = None
            max_award = None
            if amount:
                if isinstance(amount, dict):
                    min_award = amount.get('min')
                    max_award = amount.get('max')
                else:
                    min_award = max_award = float(amount) if amount else None
            
            # Create scholarship object
            scholarship = Scholarship(
                scholarship_id=self._generate_scholarship_id(title, organization or "Unknown"),
                title=title[:200],
                description=description[:500] if description else None,
                organization=organization,
                url=url,
                source="API",
                country="US",
                active=True,
                created_at=time.time(),
                updated_at=time.time(),
                min_award=min_award,
                max_award=max_award
            )
            
            return scholarship
            
        except Exception as e:
            logger.error(f"Error parsing API item: {str(e)}")
            return None
    
    def _extract_organization_from_text(self, text: str) -> str:
        """Extract organization name from text"""
        if not text:
            return "Unknown Organization"
        
        # Simple extraction - look for common patterns
        org_keywords = ['university', 'college', 'foundation', 'institute', 'association', 'corporation']
        words = text.lower().split()
        
        for i, word in enumerate(words):
            if word in org_keywords and i > 0:
                return words[i-1].title()
        
        return "Unknown Organization"
    
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
