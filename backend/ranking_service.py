from typing import List, Dict, Any
from datetime import datetime
import re

class RankingService:
    """Service to rank and score search results"""
    
    def rank_results(self, results: List[Dict[str, Any]], query: str) -> List[Dict[str, Any]]:
        """Rank results based on various signals"""
        query_lower = query.lower()
        query_keywords = set(re.findall(r'\b\w+\b', query_lower))
        
        # Score each result
        for result in results:
            score = self._calculate_score(result, query_keywords, query_lower)
            result['score'] = score
        
        # Sort by score (descending)
        ranked_results = sorted(results, key=lambda x: x.get('score', 0), reverse=True)
        
        return ranked_results
    
    def _calculate_score(self, result: Dict[str, Any], query_keywords: set, query_lower: str) -> float:
        """Calculate relevance score for a single result"""
        score = 0.0
        
        title = result.get('title', '').lower()
        snippet = result.get('snippet', '').lower()
        url = result.get('url', '').lower()
        
        # 1. Exact query match in title (highest weight)
        if query_lower in title:
            score += 10.0
        
        # 2. Query keywords in title
        title_words = set(re.findall(r'\b\w+\b', title))
        keyword_matches_title = len(query_keywords.intersection(title_words))
        score += keyword_matches_title * 3.0
        
        # 3. Exact query match in snippet
        if query_lower in snippet:
            score += 5.0
        
        # 4. Query keywords in snippet
        snippet_words = set(re.findall(r'\b\w+\b', snippet))
        keyword_matches_snippet = len(query_keywords.intersection(snippet_words))
        score += keyword_matches_snippet * 1.5
        
        # 5. Query keywords in URL
        url_words = set(re.findall(r'\b\w+\b', url))
        keyword_matches_url = len(query_keywords.intersection(url_words))
        score += keyword_matches_url * 1.0
        
        # 6. Domain authority (simple heuristic based on known domains)
        score += self._domain_authority_score(url)
        
        # 7. Title length penalty (very short or very long titles are penalized)
        title_length = len(title.split())
        if 3 <= title_length <= 15:
            score += 2.0
        elif title_length < 3 or title_length > 20:
            score -= 1.0
        
        # 8. Snippet quality (penalize very short snippets)
        snippet_length = len(snippet.split())
        if snippet_length > 15:
            score += 1.0
        elif snippet_length < 5:
            score -= 1.0
        
        # 9. Position bias (earlier results from source get slight boost)
        # This is already handled by source ordering, but we can add a small boost
        
        return max(score, 0.1)  # Minimum score of 0.1
    
    def _domain_authority_score(self, url: str) -> float:
        """Give bonus to well-known authoritative domains"""
        high_authority = [
            'wikipedia.org', 'github.com', 'stackoverflow.com',
            'medium.com', 'reddit.com', 'nytimes.com', 'bbc.com',
            'nature.com', 'sciencedirect.com', 'arxiv.org',
            'gov', 'edu', 'ac.uk'
        ]
        
        for domain in high_authority:
            if domain in url:
                return 3.0
        
        # HTTPS bonus
        if url.startswith('https://'):
            return 0.5
        
        return 0.0
    
    def deduplicate_results(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate results based on URL"""
        seen_urls = set()
        unique_results = []
        
        for result in results:
            url = result.get('url', '')
            # Normalize URL (remove trailing slash, www, etc.)
            normalized_url = self._normalize_url(url)
            
            if normalized_url not in seen_urls:
                seen_urls.add(normalized_url)
                unique_results.append(result)
        
        return unique_results
    
    def _normalize_url(self, url: str) -> str:
        """Normalize URL for deduplication"""
        url = url.lower()
        url = url.rstrip('/')
        url = url.replace('http://', '').replace('https://', '')
        url = url.replace('www.', '')
        return url

# Global ranking service instance
ranking_service = RankingService()