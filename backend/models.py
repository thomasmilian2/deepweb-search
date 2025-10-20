from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime
from uuid import uuid4

class SearchRequest(BaseModel):
    query: str
    mode: str = "aggregation"
    languages: List[str] = Field(default_factory=lambda: ["en", "it"])
    sources: List[str] = Field(default_factory=lambda: ["duckduckgo"])
    max_results: int = Field(default=20, ge=1, le=100)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=10, ge=1, le=50)

class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str
    source: str
    language: str
    score: float = 1.0
    metadata: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class SearchRecord(BaseModel):
    search_id: str = Field(default_factory=lambda: str(uuid4()))
    query: str
    mode: str
    languages: List[str]
    sources: List[str]
    status: str
    results_count: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    duration_ms: Optional[float] = None
    user_ip: Optional[str] = None

class QueryAnalysis(BaseModel):
    query: str
    language: str
    intent: str
    complexity: str
    keywords: List[str]
    entities: List[str] = []
    suggested_sources: List[str]
    suggested_mode: str
    is_technical: bool
    is_sensitive: bool
    sentiment: Optional[str] = None

class SavedSearch(BaseModel):
    saved_id: str = Field(default_factory=lambda: str(uuid4()))
    query: str
    filters: Dict[str, Any] = {}
    name: Optional[str] = None
    tags: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_executed: Optional[datetime] = None