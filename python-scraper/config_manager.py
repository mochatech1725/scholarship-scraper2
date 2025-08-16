import os
import logging
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv
import pymysql

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv('.env.local')


class ConfigManager:
    """Manages configuration for scraper selection and settings"""
    
    def __init__(self, environment: str = "local"):
        self.environment = environment
        self.db_connection = None
    
    def get_db_connection(self):
        """Get database connection for configuration queries"""
        if self.db_connection is None or not self.db_connection.open:
            # Use RDS MySQL for cloud deployment, local MySQL for development
            if self.environment != "local":
                # RDS MySQL configuration
                host = os.getenv('RDS_MYSQL_HOST', os.getenv('MYSQL_HOST', 'localhost'))
                port = int(os.getenv('RDS_MYSQL_PORT', os.getenv('MYSQL_PORT', '3306')))
                user = os.getenv('RDS_MYSQL_USER', os.getenv('MYSQL_USER', 'root'))
                password = os.getenv('RDS_MYSQL_PASSWORD', os.getenv('MYSQL_PASSWORD', ''))
                database = os.getenv('RDS_MYSQL_DATABASE', os.getenv('MYSQL_DATABASE', 'scholarships'))
            else:
                # Local MySQL configuration
                host = os.getenv('MYSQL_HOST', 'localhost')
                port = int(os.getenv('MYSQL_PORT', '3306'))
                user = os.getenv('MYSQL_USER', 'root')
                password = os.getenv('MYSQL_PASSWORD', '')
                database = os.getenv('MYSQL_DATABASE', 'scholarships')
            
            self.db_connection = pymysql.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                database=database,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
        return self.db_connection
    
    def close_db_connection(self):
        """Close database connection"""
        if self.db_connection and self.db_connection.open:
            self.db_connection.close()
    
    def get_scraper_type(self, website: str) -> str:
        """Get the scraper type (python/typescript) for a specific website"""
        cursor = None
        try:
            # First check environment variable
            env_scraper_type = os.getenv('SCRAPER_TYPE', '').lower()
            if env_scraper_type in ['python', 'typescript']:
                logger.info(f"Using scraper type from environment: {env_scraper_type}")
                return env_scraper_type
            
            # Then check database configuration
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT scraper_type FROM websites WHERE website_id = %s AND enabled = TRUE",
                (website,)
            )
            
            result = cursor.fetchone()
            if result:
                scraper_type = result['scraper_type']
                logger.info(f"Using scraper type from database for {website}: {scraper_type}")
                return scraper_type
            
            # Default to Python for local development
            if self.environment == "local":
                logger.info(f"No configuration found for {website}, defaulting to Python scraper")
                return "python"
            else:
                logger.info(f"No configuration found for {website}, defaulting to TypeScript scraper")
                return "typescript"
                
        except Exception as e:
            logger.error(f"Error getting scraper type for {website}: {e}")
            # Default based on environment
            return "python" if self.environment == "local" else "typescript"
        finally:
            if cursor:
                cursor.close()
    
    def get_enabled_websites(self, scraper_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get list of enabled websites, optionally filtered by scraper type"""
        cursor = None
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            if scraper_type:
                cursor.execute(
                    "SELECT * FROM websites WHERE enabled = TRUE AND scraper_type = %s",
                    (scraper_type,)
                )
            else:
                cursor.execute("SELECT * FROM websites WHERE enabled = TRUE")
            
            websites = cursor.fetchall()
            logger.info(f"Found {len(websites)} enabled websites")
            return websites
            
        except Exception as e:
            logger.error(f"Error getting enabled websites: {e}")
            return []
        finally:
            if cursor:
                cursor.close()
    
    def update_website_config(self, website_id: str, config: Dict[str, Any]) -> bool:
        """Update website configuration"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # Build update query
            set_clauses = []
            values = []
            
            for key, value in config.items():
                if key in ['name', 'url', 'enabled', 'scraper_type', 'config']:
                    set_clauses.append(f"{key} = %s")
                    values.append(value)
            
            if not set_clauses:
                logger.warning("No valid configuration fields provided")
                return False
            
            values.append(website_id)
            query = f"UPDATE websites SET {', '.join(set_clauses)} WHERE website_id = %s"
            
            cursor.execute(query, values)
            conn.commit()
            
            logger.info(f"Updated configuration for website: {website_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating website configuration: {e}")
            return False
        finally:
            cursor.close()
    
    def get_global_config(self) -> Dict[str, Any]:
        """Get global configuration settings"""
        config = {
            'environment': self.environment,
            'scraper_type': os.getenv('SCRAPER_TYPE', 'python'),
            'max_scholarships_per_scraper': int(os.getenv('MAX_SCHOLARSHIPS_PER_SCRAPER', '50')),
            'scraping_delay_seconds': float(os.getenv('SCRAPING_DELAY_SECONDS', '2')),
            'max_retry_attempts': int(os.getenv('MAX_RETRY_ATTEMPTS', '3')),
            'request_timeout_seconds': int(os.getenv('REQUEST_TIMEOUT_SECONDS', '30')),
            'rate_limit_calls_per_second': float(os.getenv('RATE_LIMIT_CALLS_PER_SECOND', '1.0')),
            'log_level': os.getenv('LOG_LEVEL', 'INFO'),
            'debug': os.getenv('DEBUG', 'false').lower() == 'true'
        }
        
        return config
    
    def set_scraper_type_for_website(self, website_id: str, scraper_type: str) -> bool:
        """Set the scraper type for a specific website"""
        return self.update_website_config(website_id, {'scraper_type': scraper_type})
    
    def enable_website(self, website_id: str, enabled: bool = True) -> bool:
        """Enable or disable a website"""
        return self.update_website_config(website_id, {'enabled': enabled})
    
    def get_website_config(self, website_id: str) -> Optional[Dict[str, Any]]:
        """Get configuration for a specific website"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute("SELECT * FROM websites WHERE website_id = %s", (website_id,))
            result = cursor.fetchone()
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting website configuration: {e}")
            return None
        finally:
            cursor.close()


# Convenience functions
def get_scraper_type(website: str, environment: str = "local") -> str:
    """Get scraper type for a website"""
    config_manager = ConfigManager(environment)
    try:
        return config_manager.get_scraper_type(website)
    finally:
        config_manager.close_db_connection()


def get_enabled_websites(scraper_type: Optional[str] = None, environment: str = "local") -> List[Dict[str, Any]]:
    """Get enabled websites"""
    config_manager = ConfigManager(environment)
    try:
        return config_manager.get_enabled_websites(scraper_type)
    finally:
        config_manager.close_db_connection()


def set_scraper_type(website_id: str, scraper_type: str, environment: str = "local") -> bool:
    """Set scraper type for a website"""
    config_manager = ConfigManager(environment)
    try:
        return config_manager.set_scraper_type_for_website(website_id, scraper_type)
    finally:
        config_manager.close_db_connection()


def get_global_config(environment: str = "local") -> Dict[str, Any]:
    """Get global configuration"""
    config_manager = ConfigManager(environment)
    try:
        return config_manager.get_global_config()
    finally:
        config_manager.close_db_connection()
