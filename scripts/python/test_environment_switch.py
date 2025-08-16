#!/usr/bin/env python3
"""
Test script to demonstrate environment switching between local MySQL and AWS RDS
"""

import os
import sys
import logging
from dotenv import load_dotenv

# Add the python-scraper directory to Python path
script_dir = os.path.dirname(os.path.abspath(__file__))
python_scraper_dir = os.path.join(script_dir, '..', '..', 'python-scraper')
sys.path.insert(0, python_scraper_dir)

from scraper_factory import run_scraper
from scholarship_types import ScrapingResult

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_local_mode():
    """Test running in local mode (saves to local MySQL)"""
    logger.info("=== TESTING LOCAL MODE ===")
    logger.info("Environment: local")
    logger.info("Database: Local MySQL")
    logger.info("Expected behavior: Save scholarships to local MySQL database")
    
    try:
        result = run_scraper(
            scraper_name="general",
            environment="local",
            job_id="test_local"
        )
        
        if result.success:
            logger.info(f"✅ Local mode test successful!")
            logger.info(f"   Found: {len(result.scholarships)} scholarships")
            logger.info(f"   Inserted: {result.metadata.get('total_inserted', 0)}")
            logger.info(f"   Updated: {result.metadata.get('total_updated', 0)}")
        else:
            logger.error(f"❌ Local mode test failed!")
            for error in result.errors:
                logger.error(f"   Error: {error}")
                
    except Exception as e:
        logger.error(f"❌ Local mode test exception: {e}")


def test_cloud_mode():
    """Test running in cloud mode (saves to AWS RDS MySQL)"""
    logger.info("=== TESTING CLOUD MODE ===")
    logger.info("Environment: prod")
    logger.info("Database: AWS RDS MySQL")
    logger.info("Expected behavior: Save scholarships to AWS RDS MySQL database")
    
    try:
        result = run_scraper(
            scraper_name="general",
            environment="prod",
            job_id="test_cloud"
        )
        
        if result.success:
            logger.info(f"✅ Cloud mode test successful!")
            logger.info(f"   Found: {len(result.scholarships)} scholarships")
            logger.info(f"   Inserted: {result.metadata.get('total_inserted', 0)}")
            logger.info(f"   Updated: {result.metadata.get('total_updated', 0)}")
        else:
            logger.error(f"❌ Cloud mode test failed!")
            for error in result.errors:
                logger.error(f"   Error: {error}")
                
    except Exception as e:
        logger.error(f"❌ Cloud mode test exception: {e}")


def show_environment_info():
    """Show current environment configuration"""
    logger.info("=== ENVIRONMENT CONFIGURATION ===")
    
    # Local MySQL settings
    logger.info("Local MySQL Settings:")
    logger.info(f"   Host: {os.getenv('MYSQL_HOST', 'localhost')}")
    logger.info(f"   Port: {os.getenv('MYSQL_PORT', '3306')}")
    logger.info(f"   User: {os.getenv('MYSQL_USER', 'root')}")
    logger.info(f"   Database: {os.getenv('MYSQL_DATABASE', 'scholarships')}")
    
    # AWS RDS settings
    logger.info("AWS RDS MySQL Settings:")
    logger.info(f"   Host: {os.getenv('RDS_MYSQL_HOST', 'NOT SET')}")
    logger.info(f"   Port: {os.getenv('RDS_MYSQL_PORT', '3306')}")
    logger.info(f"   User: {os.getenv('RDS_MYSQL_USER', 'NOT SET')}")
    logger.info(f"   Database: {os.getenv('RDS_MYSQL_DATABASE', 'scholarships')}")


def main():
    """Main test function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Test environment switching')
    parser.add_argument('--mode', choices=['local', 'cloud', 'both', 'info'], 
                       default='info', help='Test mode to run')
    
    args = parser.parse_args()
    
    if args.mode == 'info':
        show_environment_info()
    elif args.mode == 'local':
        test_local_mode()
    elif args.mode == 'cloud':
        test_cloud_mode()
    elif args.mode == 'both':
        show_environment_info()
        test_local_mode()
        test_cloud_mode()


if __name__ == "__main__":
    main()
