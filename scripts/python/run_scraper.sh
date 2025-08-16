#!/bin/bash
# Simple script to run scrapers with the virtual environment activated

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the python-scraper directory (at project root)
cd "$SCRIPT_DIR/../../python-scraper"

# Activate virtual environment and run the scraper
source venv/bin/activate && python main.py "$@"
