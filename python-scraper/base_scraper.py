import os
import time
import logging
import uuid
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime
import pymysql
from tenacity import retry, stop_after_attempt, wait_exponential
import boto3
from dotenv import load_dotenv

from scholarship_types import Scholarship, ScrapingResult, ScrapingMetadata

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RateLimiter:
    """Simple rate limiter for API calls"""
    
    def __init__(self, calls_per_second: float = 1.0):
        self.calls_per_second = calls_per_second
        self.last_call_time = 0
    
    def wait(self):
        """Wait if necessary to respect rate limits"""
        current_time = time.time()
        time_since_last_call = current_time - self.last_call_time
        min_interval = 1.0 / self.calls_per_second
        
        if time_since_last_call < min_interval:
            sleep_time = min_interval - time_since_last_call
            time.sleep(sleep_time)
        
        self.last_call_time = time.time()


class BaseScraper(ABC):
    """Base class for all Python scrapers"""
    
    def __init__(self, 
                 scholarships_table: str = "",
                 jobs_table: str = "",
                 job_id: str = "",
                 environment: str = "local",
                 raw_data_bucket: Optional[str] = None):
        self.scholarships_table = scholarships_table
        self.jobs_table = jobs_table
        self.job_id = job_id
        self.environment = environment
        self.raw_data_bucket = raw_data_bucket
        
        # Initialize rate limiter
        self.rate_limiter = RateLimiter(calls_per_second=1.0)
        
        # Database connection
        self.db_connection = None
        
        # AWS clients (for cloud deployment)
        if environment != "local":
            self.s3_client = boto3.client('s3')
            # Note: RDS MySQL is accessed via PyMySQL, not boto3
    
    def get_db_connection(self):
        """Get database connection for local development or RDS"""
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
    
    def create_scholarship_id(self) -> str:
        """Generate a unique scholarship ID"""
        return f"sch_{uuid.uuid4().hex[:16]}"
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    def save_scholarship(self, scholarship: Scholarship) -> bool:
        """Save scholarship to database"""
        try:
            if self.environment == "local":
                return self._save_to_local_db(scholarship)
            else:
                return self._save_to_aws_db(scholarship)
        except Exception as e:
            logger.error(f"Error saving scholarship: {e}")
            raise
    
    def _save_to_local_db(self, scholarship: Scholarship) -> bool:
        """Save scholarship to local MySQL database"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Ensure scholarship has required fields
            if not scholarship.scholarship_id:
                scholarship.scholarship_id = self.create_scholarship_id()
            
            if not scholarship.created_at:
                scholarship.created_at = datetime.now()
            
            scholarship.updated_at = datetime.now()
            
            # Convert to dict for database insertion
            data = scholarship.to_dict()
            
            # Check if scholarship already exists
            cursor.execute(
                "SELECT scholarship_id FROM scholarships WHERE scholarship_id = %s",
                (scholarship.scholarship_id,)
            )
            
            if cursor.fetchone():
                # Update existing scholarship
                placeholders = ', '.join([f"{k} = %s" for k in data.keys() if k != 'scholarship_id'])
                values = [v for k, v in data.items() if k != 'scholarship_id']
                values.append(scholarship.scholarship_id)
                
                query = f"UPDATE scholarships SET {placeholders} WHERE scholarship_id = %s"
                cursor.execute(query, values)
                logger.info(f"Updated scholarship: {scholarship.title}")
            else:
                # Insert new scholarship
                placeholders = ', '.join(['%s'] * len(data))
                columns = ', '.join(data.keys())
                query = f"INSERT INTO scholarships ({columns}) VALUES ({placeholders})"
                cursor.execute(query, list(data.values()))
                logger.info(f"Inserted scholarship: {scholarship.title}")
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            cursor.close()
    
    def _save_to_aws_db(self, scholarship: Scholarship) -> bool:
        """Save scholarship to database (local MySQL or AWS RDS MySQL)"""
        try:
            # Use the same MySQL logic for both local and cloud
            # since both now use MySQL instead of DynamoDB
            return self._save_to_local_db(scholarship)
            
        except Exception as e:
            if self.environment == "local":
                logger.error(f"Local MySQL error: {e}")
            else:
                logger.error(f"AWS RDS MySQL error: {e}")
            raise
    
    def save_scholarship(self, scholarship: Scholarship) -> bool:
        """Save scholarship to appropriate database based on environment"""
        if self.environment == "local":
            logger.debug(f"Saving to local MySQL: {scholarship.title}")
            return self._save_to_local_db(scholarship)
        else:
            logger.debug(f"Saving to AWS RDS MySQL: {scholarship.title}")
            return self._save_to_aws_db(scholarship)
    
    def update_job_status(self, status: str, metadata: ScrapingMetadata):
        """Update job status (placeholder for cloud deployment)"""
        logger.info(f"Job status update: {status} - {metadata}")
        # In local mode, just log the status
        # In cloud mode, this would update DynamoDB
    
    def clean_text(self, text: str, max_length: Optional[int] = None) -> str:
        """Clean and truncate text"""
        if not text:
            return ""
        
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        # Truncate if needed
        if max_length and len(text) > max_length:
            text = text[:max_length-3] + "..."
        
        return text
    
    def extract_amount(self, text: str) -> Optional[float]:
        """Extract monetary amount from text"""
        import re
        
        if not text:
            return None
        
        # Look for dollar amounts
        pattern = r'\$?([0-9,]+(?:\.[0-9]{2})?)'
        matches = re.findall(pattern, text)
        
        if matches:
            # Take the largest amount found
            amounts = [float(match.replace(',', '')) for match in matches]
            return max(amounts)
        
        return None
    
    @abstractmethod
    def scrape(self) -> ScrapingResult:
        """Main scraping method to be implemented by subclasses"""
        pass
    
    def run(self) -> ScrapingResult:
        """Main entry point for running the scraper"""
        logger.info(f"Starting {self.__class__.__name__}")
        
        try:
            # Update job status to running
            self.update_job_status('running', ScrapingMetadata())
            
            # Perform scraping
            result = self.scrape()
            
            # Update job status to completed
            self.update_job_status('completed', result.metadata)
            
            logger.info(f"Scraping completed successfully. Found {len(result.scholarships)} scholarships")
            return result
            
        except Exception as e:
            logger.error(f"Scraping failed: {e}")
            
            # Update job status to failed
            self.update_job_status('failed', ScrapingMetadata(errors=[str(e)]))
            
            return ScrapingResult(
                success=False,
                scholarships=[],
                errors=[str(e)],
                metadata={'total_found': 0, 'total_processed': 0, 'total_inserted': 0, 'total_updated': 0}
            )
        finally:
            self.close_db_connection()
