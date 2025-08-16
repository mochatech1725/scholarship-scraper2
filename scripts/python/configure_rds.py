#!/usr/bin/env python3
"""
RDS MySQL Configuration Helper
"""

import os
import sys
import argparse
import logging
from dotenv import load_dotenv

# Load environment variables from python-scraper directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', 'python-scraper', '.env'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_rds_connection():
    """Test RDS MySQL connection"""
    try:
        import pymysql
        
        # Get RDS configuration
        host = os.getenv('RDS_MYSQL_HOST')
        port = int(os.getenv('RDS_MYSQL_PORT', '3306'))
        user = os.getenv('RDS_MYSQL_USER')
        password = os.getenv('RDS_MYSQL_PASSWORD')
        database = os.getenv('RDS_MYSQL_DATABASE', 'scholarships')
        
        if not all([host, user, password]):
            print("❌ RDS configuration incomplete. Please set RDS_MYSQL_HOST, RDS_MYSQL_USER, and RDS_MYSQL_PASSWORD")
            return False
        
        print(f"Testing connection to {host}:{port}...")
        
        # Test connection
        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            charset='utf8mb4'
        )
        
        # Test database access
        cursor = conn.cursor()
        cursor.execute("SHOW DATABASES")
        databases = [row[0] for row in cursor.fetchall()]
        
        if database in databases:
            print(f"✅ Database '{database}' exists")
            
            # Test table access
            cursor.execute(f"USE {database}")
            cursor.execute("SHOW TABLES")
            tables = [row[0] for row in cursor.fetchall()]
            
            if 'scholarships' in tables:
                print("✅ Scholarships table exists")
                
                # Count records
                cursor.execute("SELECT COUNT(*) FROM scholarships")
                count = cursor.fetchone()[0]
                print(f"✅ Found {count} scholarships in database")
            else:
                print("⚠️  Scholarships table not found. Run setup_local_db.sql on RDS")
        else:
            print(f"⚠️  Database '{database}' not found. Create it first")
        
        cursor.close()
        conn.close()
        
        print("✅ RDS MySQL connection successful!")
        return True
        
    except ImportError:
        print("❌ PyMySQL not installed. Run: pip install pymysql")
        return False
    except Exception as e:
        print(f"❌ RDS connection failed: {e}")
        return False


def configure_rds():
    """Interactive RDS configuration"""
    print("=== RDS MySQL Configuration ===")
    print()
    
    # Get current values
    current_host = os.getenv('RDS_MYSQL_HOST', '')
    current_user = os.getenv('RDS_MYSQL_USER', '')
    current_database = os.getenv('RDS_MYSQL_DATABASE', 'scholarships')
    
    # Get new values
    host = input(f"RDS Endpoint [{current_host}]: ").strip() or current_host
    user = input(f"RDS Username [{current_user}]: ").strip() or current_user
    password = input("RDS Password: ").strip()
    database = input(f"Database Name [{current_database}]: ").strip() or current_database
    
    if not all([host, user, password]):
        print("❌ Host, username, and password are required")
        return False
    
    # Update .env file
    env_file = '.env'
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            lines = f.readlines()
        
        # Update or add RDS configuration
        config_updates = {
            'RDS_MYSQL_HOST': host,
            'RDS_MYSQL_USER': user,
            'RDS_MYSQL_PASSWORD': password,
            'RDS_MYSQL_DATABASE': database
        }
        
        for key, value in config_updates.items():
            updated = False
            for i, line in enumerate(lines):
                if line.startswith(f'{key}='):
                    lines[i] = f'{key}={value}\n'
                    updated = True
                    break
            
            if not updated:
                lines.append(f'{key}={value}\n')
        
        with open(env_file, 'w') as f:
            f.writelines(lines)
        
        print("✅ Updated .env file with RDS configuration")
        
        # Test connection
        print()
        print("Testing connection...")
        return test_rds_connection()
    else:
        print("❌ .env file not found. Run setup.sh first")
        return False


def setup_rds_database():
    """Set up database schema on RDS"""
    try:
        import pymysql
        
        # Get RDS configuration
        host = os.getenv('RDS_MYSQL_HOST')
        port = int(os.getenv('RDS_MYSQL_PORT', '3306'))
        user = os.getenv('RDS_MYSQL_USER')
        password = os.getenv('RDS_MYSQL_PASSWORD')
        database = os.getenv('RDS_MYSQL_DATABASE', 'scholarships')
        
        if not all([host, user, password]):
            print("❌ RDS configuration incomplete")
            return False
        
        print(f"Setting up database schema on {host}...")
        
        # Connect to RDS
        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            charset='utf8mb4'
        )
        
        cursor = conn.cursor()
        
        # Create database if it doesn't exist
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        print(f"✅ Database '{database}' ready")
        
        # Use the database
        cursor.execute(f"USE {database}")
        
        # Read and execute setup script
        setup_script = 'setup_local_db.sql'
        if os.path.exists(setup_script):
            with open(setup_script, 'r') as f:
                sql_commands = f.read()
            
            # Split into individual commands
            commands = [cmd.strip() for cmd in sql_commands.split(';') if cmd.strip()]
            
            for command in commands:
                if command and not command.startswith('--'):
                    try:
                        cursor.execute(command)
                        print(f"✅ Executed: {command[:50]}...")
                    except Exception as e:
                        print(f"⚠️  Command failed: {e}")
            
            conn.commit()
            print("✅ Database schema setup complete")
        else:
            print("❌ setup_local_db.sql not found")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Database setup failed: {e}")
        return False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Configure RDS MySQL for Python scraper')
    parser.add_argument('--test', '-t', 
                       action='store_true',
                       help='Test RDS connection')
    parser.add_argument('--configure', '-c', 
                       action='store_true',
                       help='Configure RDS settings interactively')
    parser.add_argument('--setup-db', '-s', 
                       action='store_true',
                       help='Set up database schema on RDS')
    
    args = parser.parse_args()
    
    if args.test:
        test_rds_connection()
    elif args.configure:
        configure_rds()
    elif args.setup_db:
        setup_rds_database()
    else:
        # Default: show help
        parser.print_help()
        print()
        print("Quick commands:")
        print("  python configure_rds.py --test      # Test RDS connection")
        print("  python configure_rds.py --configure # Configure RDS settings")
        print("  python configure_rds.py --setup-db  # Set up database schema")


if __name__ == "__main__":
    main()
