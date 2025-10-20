from typing import Optional, Any, Dict
from datetime import datetime, timedelta
import hashlib
import json

class CacheService:
    def __init__(self, ttl_seconds: int = 3600):
        self.cache: Dict[str, tuple[Any, datetime]] = {}
        self.ttl_seconds = ttl_seconds
        self.hits = 0
        self.misses = 0
    
    def _generate_key(self, query: str, sources: list, languages: list, max_results: int) -> str:
        """Generate a unique cache key based on search parameters"""
        data = f"{query}:{','.join(sorted(sources))}:{','.join(sorted(languages))}:{max_results}"
        return hashlib.md5(data.encode()).hexdigest()
    
    def get(self, query: str, sources: list, languages: list, max_results: int) -> Optional[Any]:
        """Retrieve cached results if they exist and are not expired"""
        key = self._generate_key(query, sources, languages, max_results)
        
        if key in self.cache:
            value, timestamp = self.cache[key]
            if datetime.utcnow() - timestamp < timedelta(seconds=self.ttl_seconds):
                self.hits += 1
                return value
            else:
                # Expired, remove it
                del self.cache[key]
        
        self.misses += 1
        return None
    
    def set(self, query: str, sources: list, languages: list, max_results: int, value: Any):
        """Store results in cache"""
        key = self._generate_key(query, sources, languages, max_results)
        self.cache[key] = (value, datetime.utcnow())
        
        # Simple cleanup: if cache is too large, remove oldest entries
        if len(self.cache) > 1000:
            self.cleanup_old_entries()
    
    def cleanup_old_entries(self):
        """Remove expired entries from cache"""
        now = datetime.utcnow()
        expired_keys = [
            key for key, (_, timestamp) in self.cache.items()
            if now - timestamp >= timedelta(seconds=self.ttl_seconds)
        ]
        for key in expired_keys:
            del self.cache[key]
    
    def clear(self):
        """Clear all cache"""
        self.cache.clear()
        self.hits = 0
        self.misses = 0
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0
        return {
            "entries": len(self.cache),
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": f"{hit_rate:.2f}%",
            "ttl_seconds": self.ttl_seconds
        }

# Global cache instance
cache = CacheService(ttl_seconds=1800)  # 30 minutes default