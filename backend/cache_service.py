import os
import hashlib
import json
import redis.asyncio as aioredis
from typing import Optional, Any, Dict

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DEFAULT_TTL = int(os.getenv("CACHE_TTL_SECONDS", "1800"))  # 30 minuti


class CacheService:
    def __init__(self, ttl_seconds: int = DEFAULT_TTL):
        self.ttl_seconds = ttl_seconds
        self._client: Optional[aioredis.Redis] = None
        self.hits = 0
        self.misses = 0

    async def init(self, redis_url: str = REDIS_URL):
        self._client = aioredis.from_url(
            redis_url, encoding="utf-8", decode_responses=True
        )

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None

    def _generate_key(self, query: str, sources: list, languages: list, max_results: int) -> str:
        data = f"{query}:{','.join(sorted(sources))}:{','.join(sorted(languages))}:{max_results}"
        return f"search:{hashlib.md5(data.encode()).hexdigest()}"

    async def get(self, query: str, sources: list, languages: list, max_results: int) -> Optional[Any]:
        if self._client is None:
            self.misses += 1
            return None
        key = self._generate_key(query, sources, languages, max_results)
        raw = await self._client.get(key)
        if raw is None:
            self.misses += 1
            return None
        self.hits += 1
        return json.loads(raw)

    async def set(self, query: str, sources: list, languages: list, max_results: int, value: Any):
        if self._client is None:
            return
        key = self._generate_key(query, sources, languages, max_results)
        await self._client.setex(key, self.ttl_seconds, json.dumps(value, default=str))

    async def get_stats(self) -> Dict[str, Any]:
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0
        stats: Dict[str, Any] = {
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": f"{hit_rate:.2f}%",
            "ttl_seconds": self.ttl_seconds,
            "backend": "redis",
        }
        if self._client:
            try:
                info = await self._client.info("stats")
                stats["keyspace_hits"] = info.get("keyspace_hits", 0)
                stats["keyspace_misses"] = info.get("keyspace_misses", 0)
                stats["entries"] = await self._client.dbsize()
            except Exception:
                stats["entries"] = "unavailable"
        return stats


# Istanza globale — inizializzata all'avvio dell'app
cache = CacheService(ttl_seconds=DEFAULT_TTL)
