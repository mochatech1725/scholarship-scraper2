import os
import logging
from typing import Dict, Type, Optional
from abc import ABC

from base_scraper import BaseScraper
from careeronestop_scraper import CareerOneStopScraper
from collegescholarship_scraper import CollegeScholarshipScraper
from general_scraper import GeneralScraper
from rss_scraper import RSSScraper
from scholarship_types import ScrapingResult
from config_manager import get_scraper_type

logger = logging.getLogger(__name__)


class ScraperFactory:
    """Factory for creating scrapers based on configuration"""
    
    # Registry of available scrapers
    _scrapers: Dict[str, Type[BaseScraper]] = {
        'careeronestop': CareerOneStopScraper,
        'careeronestop_python': CareerOneStopScraper,
        'careerone': CareerOneStopScraper,  # Alias for easier typing
        'collegescholarship': CollegeScholarshipScraper,
        'collegescholarship_python': CollegeScholarshipScraper,
        'collegescholarship': CollegeScholarshipScraper,  # Alias for easier typing
        'general': GeneralScraper,
        'rss': RSSScraper,
        # Add more Python scrapers here as they're created
    }
    
    @classmethod
    def register_scraper(cls, name: str, scraper_class: Type[BaseScraper]):
        """Register a new scraper"""
        cls._scrapers[name] = scraper_class
        logger.info(f"Registered scraper: {name}")
    
    @classmethod
    def get_available_scrapers(cls) -> list:
        """Get list of available scraper names"""
        return list(cls._scrapers.keys())
    
    @classmethod
    def create_scraper(cls, 
                      scraper_name: str,
                      scholarships_table: str = "",
                      jobs_table: str = "",
                      job_id: str = "",
                      environment: str = "local",
                      raw_data_bucket: Optional[str] = None) -> Optional[BaseScraper]:
        """Create a scraper instance"""
        
        # Get the scraper type from configuration
        scraper_type = get_scraper_type(scraper_name, environment)
        logger.info(f"Scraper type for {scraper_name}: {scraper_type}")
        
        # Check if it's a Python scraper
        if scraper_type == "python" and scraper_name.lower() in cls._scrapers:
            scraper_class = cls._scrapers[scraper_name.lower()]
            logger.info(f"Creating Python scraper: {scraper_name}")
            return scraper_class(
                scholarships_table=scholarships_table,
                jobs_table=jobs_table,
                job_id=job_id,
                environment=environment,
                raw_data_bucket=raw_data_bucket
            )
        
        # Check if it's a TypeScript scraper
        elif scraper_type == "typescript":
            logger.info(f"Creating TypeScript scraper: {scraper_name}")
            return cls._create_typescript_scraper(
                scraper_name=scraper_name,
                scholarships_table=scholarships_table,
                jobs_table=jobs_table,
                job_id=job_id,
                environment=environment,
                raw_data_bucket=raw_data_bucket
            )
        
        else:
            available_scrapers = list(cls._scrapers.keys())
            logger.error(f"❌ Unknown scraper: '{scraper_name}'")
            logger.error(f"   Available scrapers: {', '.join(available_scrapers)}")
            logger.error(f"   Try: python main.py --list")
            logger.error(f"   Or use one of these common names:")
            logger.error(f"     - 'careerone' (alias for careeronestop_python)")
            logger.error(f"     - 'collegescholarship' (alias for collegescholarship_python)")
            logger.error(f"     - 'general' (general scraper)")
            logger.error(f"     - 'rss' (RSS/API scraper)")
            return None
    
    @classmethod
    def _create_typescript_scraper(cls, **kwargs):
        """Create TypeScript scraper (placeholder for cloud deployment)"""
        # This would be implemented to call the TypeScript scrapers
        # For now, return None to indicate TypeScript scrapers aren't available locally
        logger.warning("TypeScript scrapers are not available in local mode")
        return None


class ScraperOrchestrator:
    """Orchestrates multiple scrapers"""
    
    def __init__(self, environment: str = "local"):
        self.environment = environment
        self.factory = ScraperFactory()
    
    def run_scraper(self, 
                   scraper_name: str,
                   scholarships_table: str = "",
                   jobs_table: str = "",
                   job_id: str = "",
                   raw_data_bucket: Optional[str] = None) -> ScrapingResult:
        """Run a specific scraper"""
        
        scraper = self.factory.create_scraper(
            scraper_name=scraper_name,
            scholarships_table=scholarships_table,
            jobs_table=jobs_table,
            job_id=job_id,
            environment=self.environment,
            raw_data_bucket=raw_data_bucket
        )
        
        if scraper is None:
            return ScrapingResult(
                success=False,
                scholarships=[],
                errors=[f"Could not create scraper: {scraper_name}"],
                metadata={'total_found': 0, 'total_processed': 0, 'total_inserted': 0, 'total_updated': 0}
            )
        
        return scraper.run()
    
    def run_all_scrapers(self, 
                        scholarships_table: str = "",
                        jobs_table: str = "",
                        job_id: str = "",
                        raw_data_bucket: Optional[str] = None) -> Dict[str, ScrapingResult]:
        """Run all available scrapers"""
        
        results = {}
        available_scrapers = self.factory.get_available_scrapers()
        
        for scraper_name in available_scrapers:
            logger.info(f"Running scraper: {scraper_name}")
            result = self.run_scraper(
                scraper_name=scraper_name,
                scholarships_table=scholarships_table,
                jobs_table=jobs_table,
                job_id=job_id,
                raw_data_bucket=raw_data_bucket
            )
            results[scraper_name] = result
        
        return results


# Convenience functions for easy access
def get_scraper(scraper_name: str, **kwargs) -> Optional[BaseScraper]:
    """Get a scraper instance"""
    return ScraperFactory.create_scraper(scraper_name, **kwargs)


def run_scraper(scraper_name: str, **kwargs) -> ScrapingResult:
    """Run a scraper and return results"""
    scraper = get_scraper(scraper_name, **kwargs)
    if scraper:
        return scraper.run()
    else:
        return ScrapingResult(
            success=False,
            scholarships=[],
            errors=[f"Could not create scraper: {scraper_name}"],
            metadata={'total_found': 0, 'total_processed': 0, 'total_inserted': 0, 'total_updated': 0}
        )


def list_available_scrapers() -> list:
    """List all available scrapers"""
    return ScraperFactory.get_available_scrapers()
