#!/usr/bin/env python3
"""
Main entry point for the Python scholarship scraper
"""

import os
import sys
import argparse
import logging
from typing import Optional
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraper_factory import ScraperOrchestrator, list_available_scrapers, run_scraper
from scholarship_types import ScrapingResult

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def setup_local_environment():
    """Set up local development environment"""
    logger.info("Setting up local development environment")
    
    # Check if MySQL is available (local or RDS)
    try:
        import pymysql
        
        # Try local MySQL first
        try:
            conn = pymysql.connect(
                host=os.getenv('MYSQL_HOST', 'localhost'),
                port=int(os.getenv('MYSQL_PORT', '3306')),
                user=os.getenv('MYSQL_USER', 'root'),
                password=os.getenv('MYSQL_PASSWORD', ''),
                charset='utf8mb4'
            )
            conn.close()
            logger.info("Local MySQL connection successful")
        except Exception as local_error:
            logger.warning(f"Local MySQL connection failed: {local_error}")
            
            # Try RDS MySQL
            try:
                conn = pymysql.connect(
                    host=os.getenv('RDS_MYSQL_HOST'),
                    port=int(os.getenv('RDS_MYSQL_PORT', '3306')),
                    user=os.getenv('RDS_MYSQL_USER'),
                    password=os.getenv('RDS_MYSQL_PASSWORD'),
                    charset='utf8mb4'
                )
                conn.close()
                logger.info("RDS MySQL connection successful")
            except Exception as rds_error:
                logger.warning(f"RDS MySQL connection failed: {rds_error}")
                logger.info("You may need to set up a local MySQL database or configure RDS credentials in your .env file")
                
    except ImportError:
        logger.error("PyMySQL not installed. Run: pip install pymysql")


def run_single_scraper(scraper_name: str, environment: str = "local") -> ScrapingResult:
    """Run a single scraper"""
    logger.info(f"Running scraper: {scraper_name}")
    
    result = run_scraper(
        scraper_name=scraper_name,
        environment=environment,
        job_id=f"local_{scraper_name}_{int(os.getpid())}"
    )
    
    if result.success:
        logger.info(f"Scraper {scraper_name} completed successfully")
        logger.info(f"Found {len(result.scholarships)} scholarships")
        logger.info(f"Inserted: {result.metadata.get('total_inserted', 0)}")
        logger.info(f"Updated: {result.metadata.get('total_updated', 0)}")
        
        if result.errors:
            logger.warning(f"Encountered {len(result.errors)} errors")
            for error in result.errors:
                logger.warning(f"  - {error}")
    else:
        logger.error(f"❌ Scraper '{scraper_name}' failed")
        if "Could not create scraper" in str(result.errors):
            logger.error(f"   💡 Try: python main.py --list")
            logger.error(f"   💡 Common scraper names:")
            logger.error(f"      - 'careerone' (CareerOneStop)")
            logger.error(f"      - 'college' (CollegeScholarship)")
            logger.error(f"      - 'general' (General scraper)")
            logger.error(f"      - 'rss' (RSS/API scraper)")
        for error in result.errors:
            logger.error(f"   Error: {error}")
    
    return result


def run_all_scrapers(environment: str = "local"):
    """Run all available scrapers"""
    logger.info("Running all available scrapers")
    
    orchestrator = ScraperOrchestrator(environment=environment)
    results = orchestrator.run_all_scrapers(
        job_id=f"local_all_{int(os.getpid())}"
    )
    
    total_scholarships = 0
    total_inserted = 0
    total_updated = 0
    total_errors = 0
    
    for scraper_name, result in results.items():
        logger.info(f"\n=== {scraper_name.upper()} ===")
        if result.success:
            logger.info(f"Success: {len(result.scholarships)} scholarships found")
            total_scholarships += len(result.scholarships)
            total_inserted += result.metadata.get('total_inserted', 0)
            total_updated += result.metadata.get('total_updated', 0)
        else:
            logger.error(f"Failed: {len(result.errors)} errors")
            total_errors += len(result.errors)
    
    logger.info(f"\n=== SUMMARY ===")
    logger.info(f"Total scholarships found: {total_scholarships}")
    logger.info(f"Total inserted: {total_inserted}")
    logger.info(f"Total updated: {total_updated}")
    logger.info(f"Total errors: {total_errors}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Python Scholarship Scraper',
        epilog="""
Examples:
  python main.py --scraper careerone --environment local
  python main.py --scraper college --environment local  
  python main.py --scraper general --environment local
  python main.py --list
  python main.py --all --environment local
        """
    )
    parser.add_argument('--scraper', '-s', 
                       help='Name of the scraper to run (e.g., careerone, college, general, rss)')
    parser.add_argument('--all', '-a', 
                       action='store_true',
                       help='Run all available scrapers')
    parser.add_argument('--list', '-l', 
                       action='store_true',
                       help='List all available scrapers')
    parser.add_argument('--environment', '-e', 
                       default='local',
                       choices=['local', 'dev', 'staging', 'prod'],
                       help='Environment to run in (default: local)')
    parser.add_argument('--setup', 
                       action='store_true',
                       help='Set up local development environment')
    
    args = parser.parse_args()
    
    # Set up local environment if requested
    if args.setup:
        setup_local_environment()
        return
    
    # List available scrapers
    if args.list:
        scrapers = list_available_scrapers()
        print("Available scrapers:")
        for scraper in scrapers:
            print(f"  - {scraper}")
        return
    
    # Run all scrapers
    if args.all:
        run_all_scrapers(args.environment)
        return
    
    # Run single scraper
    if args.scraper:
        run_single_scraper(args.scraper, args.environment)
        return
    
    # Default: show help
    parser.print_help()


if __name__ == "__main__":
    main()
