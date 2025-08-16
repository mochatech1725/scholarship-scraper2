#!/bin/bash

echo "=== Python Scholarship Scraper Setup ==="
echo "This script will set up the Python scraper environment"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Python 3 is installed
print_status "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
print_status "Found Python version: $PYTHON_VERSION"

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    print_error "pip3 is not installed. Please install pip."
    exit 1
fi

# Create virtual environment
print_status "Creating virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    print_status "Virtual environment created"
else
    print_status "Virtual environment already exists"
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
print_status "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
print_status "Installing Python dependencies..."
pip install -r requirements.txt

# Check if MySQL is installed
print_status "Checking MySQL installation..."
if ! command -v mysql &> /dev/null; then
    print_warning "MySQL is not installed. You'll need to install it manually:"
    echo "  - macOS: brew install mysql"
    echo "  - Ubuntu: sudo apt-get install mysql-server"
    echo "  - Windows: Download from https://dev.mysql.com/downloads/mysql/"
    echo ""
    print_warning "Skipping database setup..."
else
    print_status "MySQL found"
    
    # Check if MySQL service is running
    if ! pgrep -x "mysqld" > /dev/null; then
        print_warning "MySQL service is not running. Please start it:"
        echo "  - macOS: brew services start mysql"
        echo "  - Ubuntu: sudo systemctl start mysql"
        echo "  - Windows: Start MySQL service from Services"
        echo ""
        print_warning "Skipping database setup..."
    else
        print_status "MySQL service is running"
        
        # Set up database
        print_status "Setting up database..."
        read -p "Enter MySQL root password (or press Enter if no password): " MYSQL_PASSWORD
        
        if [ -z "$MYSQL_PASSWORD" ]; then
            mysql -u root < setup_local_db.sql
        else
            mysql -u root -p"$MYSQL_PASSWORD" < setup_local_db.sql
        fi
        
        if [ $? -eq 0 ]; then
            print_status "Database setup completed"
        else
            print_error "Database setup failed"
        fi
    fi
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_status "Creating .env file..."
    cp env.example .env
    print_status ".env file created. Please edit it with your database credentials."
else
    print_status ".env file already exists"
fi

# Make main.py executable
chmod +x main.py

print_status ""
print_status "=== Setup Complete ==="
print_status ""
print_status "Next steps:"
print_status "1. Edit .env file with your database credentials"
print_status "2. Activate virtual environment: source venv/bin/activate"
print_status "3. Test setup: python main.py --setup"
print_status "4. List scrapers: python main.py --list"
print_status "5. Run a scraper: python main.py --scraper fastweb"
print_status ""
print_status "To switch between Python and TypeScript scrapers:"
print_status "- Set SCRAPER_TYPE=python in .env for Python scrapers"
print_status "- Set SCRAPER_TYPE=typescript in .env for TypeScript scrapers"
print_status "- Or configure per-website in the database"
print_status ""
print_status "Happy scraping!"
