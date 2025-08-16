from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class TargetType(str, Enum):
    NEED = "need"
    MERIT = "merit"
    BOTH = "both"


class AcademicLevel(str, Enum):
    UNDERGRADUATE = "undergraduate"
    GRADUATE = "graduate"
    DOCTORAL = "doctoral"
    BOTH = "both"


@dataclass
class Scholarship:
    """Python equivalent of the TypeScript Scholarship interface"""
    scholarship_id: Optional[str] = None
    title: str = ""
    description: Optional[str] = None
    organization: Optional[str] = None
    orga_website: Optional[str] = None
    target_type: Optional[str] = None
    min_award: Optional[float] = None
    max_award: Optional[float] = None
    deadline: Optional[str] = None
    eligibility: Optional[str] = None
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    academic_level: Optional[str] = None
    essay_required: Optional[bool] = None
    recommendation_required: Optional[bool] = None
    renewable: Optional[bool] = None
    geographic_restrictions: Optional[str] = None
    apply_url: Optional[str] = None
    url: Optional[str] = None
    source: Optional[str] = None
    country: Optional[str] = None
    active: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database storage"""
        result = {}
        for field, value in self.__dict__.items():
            if value is not None:
                if isinstance(value, datetime):
                    result[field] = value.isoformat()
                else:
                    result[field] = value
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Scholarship':
        """Create Scholarship from dictionary"""
        # Handle datetime fields
        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'].replace('Z', '+00:00'))
        if 'updated_at' in data and isinstance(data['updated_at'], str):
            data['updated_at'] = datetime.fromisoformat(data['updated_at'].replace('Z', '+00:00'))
        
        return cls(**data)


@dataclass
class ScrapingResult:
    """Result of a scraping operation"""
    success: bool
    scholarships: List[Scholarship]
    errors: List[str]
    metadata: Dict[str, Any]


@dataclass
class ScrapingMetadata:
    """Metadata about scraping operation"""
    records_found: int = 0
    records_processed: int = 0
    records_inserted: int = 0
    records_updated: int = 0
    errors: List[str] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []
