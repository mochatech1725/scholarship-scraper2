# Python Scholarship Scraper

A Python-based web scraper for discovering and storing college scholarship opportunities. This scraper can run locally for development and testing, or be deployed to AWS for production use.

## Features

- **Multiple Scraper Support**: Easy to add new scrapers for different scholarship websites
- **Local Development**: Run completely locally without AWS costs
- **Database Integration**: Store scholarships in MySQL database
- **Rate Limiting**: Respectful scraping with configurable rate limits
- **Error Handling**: Robust error handling and retry mechanisms
- **Flexible Architecture**: Switch between Python and TypeScript scrapers

## Scraper Strategy

The system uses a hybrid approach:
- **Production Scrapers**: CareerOneStop, CollegeScholarship, and General Search (AI-powered)
- **Python Scrapers**: Available for development and testing, can be deployed to production
- **TypeScript Scrapers**: Currently handle the main production workload
- **General Search**: Uses AWS Bedrock for intelligent, broad scholarship discovery

**Note**: FastWeb was removed as it requires login authentication, making it unsuitable for automated scraping.

## Quick Start

### 1. Set up Python Environment

```bash
# Navigate to the python-scraper directory
cd python-scraper

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Set up Local Database

```bash
# Install MySQL if you haven't already
# On macOS: brew install mysql
# On Ubuntu: sudo apt-get install mysql-server

# Start MySQL service
# On macOS: brew services start mysql
# On Ubuntu: sudo systemctl start mysql

# Create database and tables
mysql -u root -p < setup_local_db.sql
```

### 3. Configure Environment

```bash
# Copy example environment file
cp env.example .env

# Edit .env file with your database credentials
nano .env
```

### 4. Test the Setup

```bash
# Check if everything is set up correctly
python main.py --setup

# List available scrapers
python main.py --list

# Run a single scraper (when available)
python main.py --scraper careeronestop

# Run all scrapers
python main.py --all
```

## Usage

### Command Line Interface

```bash
# Show help
python main.py --help

# List available scrapers
python main.py --list

# Run specific scraper (when available)
python main.py --scraper careeronestop

# Run all scrapers
python main.py --all

# Run in different environment
python main.py --scraper fastweb --environment dev
```

### Programmatic Usage

```python
from scraper_factory import run_scraper, list_available_scrapers

# List available scrapers
scrapers = list_available_scrapers()
print(f"Available scrapers: {scrapers}")

# Run a scraper
result = run_scraper('fastweb', environment='local')
if result.success:
    print(f"Found {len(result.scholarships)} scholarships")
else:
    print(f"Errors: {result.errors}")
```

## Architecture

### Core Components

1. **BaseScraper**: Abstract base class providing common functionality
2. **ScraperFactory**: Factory pattern for creating different scrapers
3. **ScraperOrchestrator**: Manages multiple scrapers
4. **Scholarship Types**: Data structures matching the TypeScript interface

### Scraper Types

- **Python Scrapers**: Run locally, better for development and testing
- **TypeScript Scrapers**: Run in AWS, better for production deployment

### Database Schema

The scraper uses a MySQL database with the following tables:

- `scholarships`: Main scholarship data
- `jobs`: Scraping job tracking
- `websites`: Website configuration

## Adding New Scrapers

### 1. Create Scraper Class

```python
from base_scraper import BaseScraper
from scholarship_types import ScrapingResult

class MyNewScraper(BaseScraper):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.base_url = "https://example.com"
    
    def scrape(self) -> ScrapingResult:
        # Implement scraping logic here
        pass
```

### 2. Register Scraper

```python
from scraper_factory import ScraperFactory
from my_new_scraper import MyNewScraper

ScraperFactory.register_scraper('my_new_scraper', MyNewScraper)
```

### 3. Update Configuration

Add the scraper to the websites table:

```sql
INSERT INTO websites (website_id, name, url, enabled, scraper_type) 
VALUES ('my_new_scraper', 'My New Scraper', 'https://example.com', TRUE, 'python');
```

## Configuration

### Environment Variables

- `MYSQL_HOST`: MySQL server host (default: localhost)
- `MYSQL_PORT`: MySQL server port (default: 3306)
- `MYSQL_USER`: MySQL username (default: root)
- `MYSQL_PASSWORD`: MySQL password
- `MYSQL_DATABASE`: MySQL database name (default: scholarships)
- `SCRAPER_TYPE`: Type of scrapers to use (python/typescript)
- `RATE_LIMIT_CALLS_PER_SECOND`: Rate limiting (default: 1.0)

### Database Configuration

The scraper automatically creates the necessary database tables. You can customize the schema by modifying `setup_local_db.sql`.

## Development

### Running Tests

```bash
# Install test dependencies
pip install pytest

# Run tests
pytest
```

### Code Formatting

```bash
# Install formatting tools
pip install black flake8

# Format code
black .

# Check code style
flake8 .
```

### Adding Dependencies

```bash
# Add new dependency
pip install new-package

# Update requirements.txt
pip freeze > requirements.txt
```

## Deployment

### Local Development

The scraper is designed to run locally for development and testing. This avoids AWS costs while providing full functionality.

### AWS Deployment

For production deployment, the scraper can be integrated with the existing AWS infrastructure:

1. **Lambda Functions**: Use Python Lambda functions for scraping
2. **ECS Tasks**: Run scrapers in Docker containers
3. **Batch Jobs**: Process large scraping tasks
4. **RDS MySQL**: Store data in AWS (same database technology as local)

## Troubleshooting

### Common Issues

1. **MySQL Connection Failed**
   - Check if MySQL is running
   - Verify credentials in `.env` file
   - Ensure database exists

2. **Scraper Not Found**
   - Check if scraper is registered in `ScraperFactory`
   - Verify scraper name in command line

3. **Rate Limiting Issues**
   - Adjust `RATE_LIMIT_CALLS_PER_SECOND` in `.env`
   - Check website's robots.txt

4. **Permission Errors**
   - Ensure virtual environment is activated
   - Check file permissions

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
python main.py --scraper fastweb
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add your scraper implementation
4. Add tests
5. Submit a pull request

## License

This project is part of the Scholarship Scraper 2.0 system.
