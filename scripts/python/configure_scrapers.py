#!/usr/bin/env python3
"""
Configuration script for managing scraper settings
"""

# type: ignore

import os
import sys
import argparse
import logging
from typing import Optional
from dotenv import load_dotenv

# Add the python-scraper directory to Python path
python_scraper_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'python-scraper'))
sys.path.insert(0, python_scraper_path)

# Change working directory to python-scraper for relative imports
os.chdir(python_scraper_path)

from config_manager import (
    ConfigManager, 
    get_scraper_type, 
    set_scraper_type, 
    get_enabled_websites,
    get_global_config
)

# Load environment variables
load_dotenv('.env.local')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def show_current_config():
    """Show current configuration"""
    print("=== Current Configuration ===")
    
    # Global config
    config = get_global_config()
    print(f"Environment: {config['environment']}")
    print(f"Global Default Scraper Type: {config['scraper_type']}")
    print(f"Max Scholarships per Scraper: {config['max_scholarships_per_scraper']}")
    print(f"Rate Limit: {config['rate_limit_calls_per_second']} calls/second")
    print(f"Debug Mode: {config['debug']}")
    print()
    
    # Website configs
    print("=== Website Configurations ===")
    websites = get_enabled_websites()
    
    if not websites:
        print("No websites configured. Run setup_local_db.sql first.")
        return
    
    for website in websites:
        scraper_type = get_scraper_type(website['website_id'])
        status = "✓" if website['enabled'] else "✗"
        print(f"{status} {website['website_id']:20} | {scraper_type:10} | {website['name']}")
    
    print()


def set_global_scraper_type(scraper_type: str):
    """Set global scraper type"""
    if scraper_type not in ['python', 'typescript']:
        print(f"Error: Scraper type must be 'python' or 'typescript', got '{scraper_type}'")
        return False
    
    # Update .env file
    env_file = '.env'
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            lines = f.readlines()
        
        # Update or add SCRAPER_TYPE
        updated = False
        for i, line in enumerate(lines):
            if line.startswith('SCRAPER_TYPE='):
                lines[i] = f'SCRAPER_TYPE={scraper_type}\n'
                updated = True
                break
        
        if not updated:
            lines.append(f'SCRAPER_TYPE={scraper_type}\n')
        
        with open(env_file, 'w') as f:
            f.writelines(lines)
        
        print(f"Updated .env file: SCRAPER_TYPE={scraper_type}")
        return True
    else:
        print("Error: .env file not found. Run setup.sh first.")
        return False


def set_website_scraper_type(website_id: str, scraper_type: str):
    """Set scraper type for a specific website"""
    if scraper_type not in ['python', 'typescript']:
        print(f"Error: Scraper type must be 'python' or 'typescript', got '{scraper_type}'")
        return False
    
    success = set_scraper_type(website_id, scraper_type)
    if success:
        print(f"Updated {website_id}: scraper_type = {scraper_type}")
    else:
        print(f"Error: Failed to update {website_id}")
    
    return success


def enable_website(website_id: str, enabled: bool = True):
    """Enable or disable a website"""
    config_manager = ConfigManager()
    try:
        success = config_manager.enable_website(website_id, enabled)
        if success:
            status = "enabled" if enabled else "disabled"
            print(f"Updated {website_id}: {status}")
        else:
            print(f"Error: Failed to update {website_id}")
        return success
    finally:
        config_manager.close_db_connection()


def add_website(website_id: str, name: str, url: str, scraper_type: str = 'python', enabled: bool = True):
    """Add a new website configuration"""
    if scraper_type not in ['python', 'typescript']:
        print(f"Error: Scraper type must be 'python' or 'typescript', got '{scraper_type}'")
        return False
    
    config_manager = ConfigManager()
    try:
        conn = config_manager.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO websites (website_id, name, url, enabled, scraper_type) 
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE 
                name = VALUES(name),
                url = VALUES(url),
                enabled = VALUES(enabled),
                scraper_type = VALUES(scraper_type)
        """, (website_id, name, url, enabled, scraper_type))
        
        conn.commit()
        print(f"Added/updated website: {website_id}")
        return True
        
    except Exception as e:
        print(f"Error adding website: {e}")
        return False
    finally:
        config_manager.close_db_connection()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Configure scraper settings')
    parser.add_argument('--show', '-s', 
                       action='store_true',
                       help='Show current configuration')
    parser.add_argument('--global-type', '-g',
                       choices=['python', 'typescript'],
                       help='Set global scraper type')
    parser.add_argument('--website-type', '-w',
                       metavar=('WEBSITE_ID', 'TYPE'),
                       nargs=2,
                       help='Set scraper type for specific website')
    parser.add_argument('--enable', '-e',
                       metavar='WEBSITE_ID',
                       help='Enable a website')
    parser.add_argument('--disable', '-d',
                       metavar='WEBSITE_ID',
                       help='Disable a website')
    parser.add_argument('--add', '-a',
                       metavar=('WEBSITE_ID', 'NAME', 'URL'),
                       nargs=3,
                       help='Add a new website')
    parser.add_argument('--add-with-type', '-t',
                       metavar=('WEBSITE_ID', 'NAME', 'URL', 'TYPE'),
                       nargs=4,
                       help='Add a new website with specific scraper type')
    
    args = parser.parse_args()
    
    # Show current configuration
    if args.show or not any([args.global_type, args.website_type, args.enable, args.disable, args.add, args.add_with_type]):
        show_current_config()
    
    # Set global scraper type
    if args.global_type:
        set_global_scraper_type(args.global_type)
    
    # Set website scraper type
    if args.website_type:
        website_id, scraper_type = args.website_type
        set_website_scraper_type(website_id, scraper_type)
    
    # Enable website
    if args.enable:
        enable_website(args.enable, True)
    
    # Disable website
    if args.disable:
        enable_website(args.disable, False)
    
    # Add website
    if args.add:
        website_id, name, url = args.add
        add_website(website_id, name, url)
    
    # Add website with type
    if args.add_with_type:
        website_id, name, url, scraper_type = args.add_with_type
        add_website(website_id, name, url, scraper_type)


if __name__ == "__main__":
    main()
