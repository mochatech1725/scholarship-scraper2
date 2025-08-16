# Python Scraper Integration

This document explains how to use the new Python scraper system alongside the existing TypeScript scrapers, and how to switch between them.

## Overview

The scholarship scraper now supports two types of scrapers:

1. **Python Scrapers**: Run locally for development and testing
2. **TypeScript Scrapers**: Run in AWS for production deployment

## Quick Start

### 1. Set up Python Scraper Environment

```bash
# Navigate to the python-scraper directory
cd python-scraper

# Run the automated setup script
./setup.sh
```

This script will:
- Create a Python virtual environment
- Install all dependencies
- Set up the local MySQL database
- Create configuration files

### 2. Configure Scraper Selection

You can control which scrapers to use in several ways:

#### Global Configuration (affects all scrapers)
```bash
# Set all scrapers to use Python
python configure_scrapers.py --global-type python

# Set all scrapers to use TypeScript
python configure_scrapers.py --global-type typescript
```

#### Per-Website Configuration
```bash
# Set specific website to use Python scraper
python configure_scrapers.py --website-type fastweb python

# Set specific website to use TypeScript scraper
python configure_scrapers.py --website-type collegescholarship typescript
```

#### Environment Variable
```bash
# Set in .env file
SCRAPER_TYPE=python  # or typescript
```

### 3. Run Scrapers

```bash
# Activate virtual environment
source venv/bin/activate

# List available scrapers
python main.py --list

# Run a specific scraper
python main.py --scraper fastweb

# Run all scrapers
python main.py --all

# Check current configuration
python configure_scrapers.py --show
```

## Configuration Management

### View Current Configuration

```bash
python configure_scrapers.py --show
```

This shows:
- Global scraper type setting
- Per-website scraper type settings
- Enabled/disabled websites
- Current environment settings

### Manage Websites

```bash
# Enable a website
python configure_scrapers.py --enable fastweb

# Disable a website
python configure_scrapers.py --disable collegescholarship

# Add a new website
python configure_scrapers.py --add mysite "My Site" https://mysite.com

# Add a new website with specific scraper type
python configure_scrapers.py --add-with-type mysite "My Site" https://mysite.com python
```

## Scraper Types Comparison

| Feature | Python Scrapers | TypeScript Scrapers |
|---------|----------------|-------------------|
| **Environment** | Local development | AWS cloud |
| **Cost** | Free (local) | AWS charges |
| **Setup** | Simple (setup.sh) | Complex (CDK) |
| **Dependencies** | Python packages | Node.js + AWS |
| **Scraping Power** | Excellent (BeautifulSoup, Selenium) | Good (Axios, Cheerio) |
| **Anti-Detection** | Advanced (undetected-chromedriver) | Basic |
| **Rate Limiting** | Configurable | Basic |
| **Error Handling** | Robust | Good |
| **Database** | Local MySQL | AWS RDS MySQL |
| **Deployment** | Local only | AWS infrastructure |

## When to Use Each Type

### Use Python Scrapers When:
- **Developing and testing** new scraping logic
- **Avoiding AWS costs** during development
- **Need advanced scraping features** (JavaScript rendering, anti-detection)
- **Working locally** without internet dependency
- **Prototyping** new scrapers quickly

### Use TypeScript Scrapers When:
- **Production deployment** is needed
- **Scalability** is important
- **Integration** with existing AWS infrastructure
- **Scheduled runs** are required
- **Team collaboration** on AWS-based workflows

## Architecture

### Python Scraper Components

```
python-scraper/
├── base_scraper.py          # Base class for all scrapers
├── fastweb_scraper.py       # Example scraper implementation
├── scraper_factory.py       # Factory for creating scrapers
├── config_manager.py        # Configuration management
├── scholarship_types.py     # Data structures
├── main.py                  # Command-line interface
├── configure_scrapers.py    # Configuration tool
├── setup.sh                 # Setup script
├── requirements.txt         # Python dependencies
├── setup_local_db.sql       # Database schema
└── README.md               # Detailed documentation
```

### Integration Points

The Python scraper system integrates with the existing TypeScript infrastructure through:

1. **Shared Database Schema**: Both systems use the same scholarship data structure
2. **Configuration Management**: Centralized configuration for scraper selection
3. **Factory Pattern**: Unified interface for creating scrapers
4. **Environment Detection**: Automatic selection based on environment

## Adding New Scrapers

### Python Scraper

1. **Create scraper class**:
```python
from base_scraper import BaseScraper
from scholarship_types import ScrapingResult

class MyNewScraper(BaseScraper):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.base_url = "https://example.com"
    
    def scrape(self) -> ScrapingResult:
        # Implement scraping logic
        pass
```

2. **Register scraper**:
```python
from scraper_factory import ScraperFactory
from my_new_scraper import MyNewScraper

ScraperFactory.register_scraper('my_new_scraper', MyNewScraper)
```

3. **Add to database**:
```bash
python configure_scrapers.py --add-with-type my_new_scraper "My New Scraper" https://example.com python
```

### TypeScript Scraper

1. Create scraper in `src/scrapers/`
2. Add to batch routing in `src/batch/index.ts`
3. Configure in database or CDK

## Cost Management

### Local Development (Free)
- Python scrapers run locally
- Local MySQL database
- No AWS charges
- Perfect for development and testing

### Production Deployment (AWS Costs)
- TypeScript scrapers run in AWS
- RDS MySQL storage
- Lambda/Batch execution
- CloudWatch monitoring

### Hybrid Approach
- Use Python scrapers for development
- Use TypeScript scrapers for production
- Switch between them using configuration

## Troubleshooting

### Common Issues

1. **MySQL Connection Failed**
   ```bash
   # Check if MySQL is running
   brew services list | grep mysql
   
   # Start MySQL if needed
   brew services start mysql
   ```

2. **Python Dependencies Missing**
   ```bash
   # Activate virtual environment
   source venv/bin/activate
   
   # Reinstall dependencies
   pip install -r requirements.txt
   ```

3. **Scraper Not Found**
   ```bash
   # Check available scrapers
   python main.py --list
   
   # Check configuration
   python configure_scrapers.py --show
   ```

4. **Permission Errors**
   ```bash
   # Make scripts executable
   chmod +x setup.sh configure_scrapers.py main.py
   ```

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=DEBUG

# Run scraper with verbose output
python main.py --scraper fastweb
```

## Migration Guide

### From TypeScript to Python

1. **Set up Python environment**:
   ```bash
   cd python-scraper
   ./setup.sh
   ```

2. **Configure scrapers**:
   ```bash
   python configure_scrapers.py --global-type python
   ```

3. **Test scrapers**:
   ```bash
   python main.py --scraper fastweb
   ```

### From Python to TypeScript

1. **Configure scrapers**:
   ```bash
   python configure_scrapers.py --global-type typescript
   ```

2. **Deploy to AWS**:
   ```bash
   npm run deploy:dev
   ```

## Best Practices

1. **Development Workflow**:
   - Use Python scrapers for development
   - Test thoroughly before switching to TypeScript
   - Use local database for quick iterations

2. **Configuration Management**:
   - Use per-website configuration for fine control
   - Document scraper type choices
   - Version control configuration changes

3. **Cost Optimization**:
   - Use Python scrapers for development
   - Use TypeScript scrapers only for production
   - Monitor AWS costs regularly

4. **Data Consistency**:
   - Both systems use the same data schema
   - Validate data before switching scrapers
   - Backup data before major changes

## Support

For issues with:
- **Python scrapers**: Check the `python-scraper/README.md`
- **TypeScript scrapers**: Check the main project documentation
- **Configuration**: Use `python configure_scrapers.py --help`
- **Setup**: Run `./setup.sh` and check output

## Next Steps

1. **Set up the Python environment** using `./setup.sh`
2. **Configure scraper types** based on your needs
3. **Test with a single scraper** before running all
4. **Add new scrapers** as needed
5. **Deploy to production** when ready

The Python scraper system provides a powerful, cost-effective alternative to the TypeScript scrapers while maintaining full compatibility with the existing infrastructure.
