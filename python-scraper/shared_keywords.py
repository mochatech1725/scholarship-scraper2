#!/usr/bin/env python3
"""
Shared keywords for Python scrapers
Contains common search terms for different types of scholarships
"""

# Efficient search keywords - broader categories
SCHOLARSHIP_KEYWORDS = [
    'scholarship',  # General scholarships
    'college scholarship',  # Academic scholarships
    'financial aid',  # Broader financial assistance
    'grant',  # Grants and awards
    'fellowship',  # Fellowships
    'award'  # General awards
]

# Academic level keywords
ACADEMIC_LEVEL_KEYWORDS = [
    'undergraduate',
    'graduate',
    'doctoral',
    'masters',
    'phd',
    'bachelors',
    'associates',
    'high school',
    'community college',
    'university',
    'college'
]

# Field of study keywords
FIELD_OF_STUDY_KEYWORDS = [
    'STEM',
    'engineering',
    'computer science',
    'medical',
    'nursing',
    'business',
    'law',
    'education',
    'arts',
    'humanities',
    'social sciences',
    'natural sciences',
    'technology',
    'mathematics',
    'physics',
    'chemistry',
    'biology'
]

# Demographic keywords
DEMOGRAPHIC_KEYWORDS = [
    'women',
    'minority',
    'first generation',
    'veteran',
    'disability',
    'LGBTQ',
    'international student',
    'hispanic',
    'african american',
    'asian american',
    'native american',
    'pacific islander',
    'low income',
    'rural',
    'urban'
]

# Geographic keywords
GEOGRAPHIC_KEYWORDS = [
    'california',
    'new york',
    'texas',
    'florida',
    'illinois',
    'pennsylvania',
    'ohio',
    'georgia',
    'north carolina',
    'michigan',
    'new jersey',
    'virginia',
    'washington',
    'massachusetts',
    'indiana',
    'tennessee',
    'missouri',
    'maryland',
    'colorado',
    'wisconsin'
]

def get_keywords_by_category(category: str = 'all') -> list:
    """
    Get keywords by category
    
    Args:
        category: 'all', 'scholarship', 'academic', 'field', 'demographic', 'geographic'
    
    Returns:
        List of keywords for the specified category
    """
    if category == 'all':
        return SCHOLARSHIP_KEYWORDS
    elif category == 'scholarship':
        return SCHOLARSHIP_KEYWORDS
    elif category == 'academic':
        return ACADEMIC_LEVEL_KEYWORDS
    elif category == 'field':
        return FIELD_OF_STUDY_KEYWORDS
    elif category == 'demographic':
        return DEMOGRAPHIC_KEYWORDS
    elif category == 'geographic':
        return GEOGRAPHIC_KEYWORDS
    else:
        return SCHOLARSHIP_KEYWORDS

def get_combined_keywords(categories: list = None) -> list:
    """
    Get combined keywords from multiple categories
    
    Args:
        categories: List of categories to combine
    
    Returns:
        Combined list of keywords
    """
    if not categories:
        categories = ['scholarship']
    
    combined = []
    for category in categories:
        combined.extend(get_keywords_by_category(category))
    
    # Remove duplicates while preserving order
    seen = set()
    unique_keywords = []
    for keyword in combined:
        if keyword not in seen:
            seen.add(keyword)
            unique_keywords.append(keyword)
    
    return unique_keywords
