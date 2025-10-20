from typing import List, Dict, Any
import re
from langdetect import detect, LangDetectException

class QueryAnalyzer:
    """Analyze search queries to extract intent, keywords, and suggestions"""
    
    # Technical keywords
    TECHNICAL_KEYWORDS = {
        'api', 'sdk', 'library', 'framework', 'code', 'programming',
        'python', 'javascript', 'java', 'c++', 'database', 'sql',
        'algorithm', 'function', 'class', 'method', 'error', 'bug',
        'install', 'configuration', 'docker', 'kubernetes', 'git'
    }
    
    # Sensitive keywords
    SENSITIVE_KEYWORDS = {
        'password', 'hack', 'exploit', 'vulnerability', 'leak',
        'breach', 'illegal', 'piracy', 'crack', 'warez'
    }
    
    # Intent patterns
    INTENT_PATTERNS = {
        'how_to': [r'\bhow to\b', r'\bhow do i\b', r'\bhow can i\b', r'\bcome\b'],
        'what_is': [r'\bwhat is\b', r'\bwhat are\b', r'\bdefine\b', r'\bcosa è\b', r'\bcosa sono\b'],
        'where': [r'\bwhere\b', r'\bdove\b'],
        'when': [r'\bwhen\b', r'\bquando\b'],
        'why': [r'\bwhy\b', r'\bperché\b', r'\bperchè\b'],
        'comparison': [r'\bvs\b', r'\bversus\b', r'\bcompare\b', r'\bdifference\b', r'\bconfrontare\b'],
        'best': [r'\bbest\b', r'\btop\b', r'\bmigliore\b', r'\bmigliori\b'],
        'review': [r'\breview\b', r'\breviews\b', r'\brecensione\b', r'\brecensioni\b'],
        'buy': [r'\bbuy\b', r'\bpurchase\b', r'\bprice\b', r'\bcost\b', r'\bcomprare\b', r'\bprezzo\b'],
        'tutorial': [r'\btutorial\b', r'\bguide\b', r'\bguida\b'],
    }
    
    def analyze(self, query: str) -> Dict[str, Any]:
        """Perform comprehensive analysis of a search query"""
        query_lower = query.lower()
        
        # Detect language
        language = self._detect_language(query)
        
        # Extract keywords
        keywords = self._extract_keywords(query)
        
        # Detect intent
        intent = self._detect_intent(query_lower)
        
        # Determine complexity
        complexity = self._assess_complexity(query, keywords)
        
        # Check if technical or sensitive
        is_technical = self._is_technical(query_lower, keywords)
        is_sensitive = self._is_sensitive(query_lower, keywords)
        
        # Extract entities (simple version)
        entities = self._extract_entities(query)
        
        # Suggest sources based on analysis
        suggested_sources = self._suggest_sources(intent, is_technical, is_sensitive)
        
        # Suggest mode
        suggested_mode = "aggregation" if not is_technical else "crawling"
        
        # Sentiment analysis (basic)
        sentiment = self._detect_sentiment(query_lower)
        
        return {
            "query": query,
            "language": language,
            "intent": intent,
            "complexity": complexity,
            "keywords": keywords,
            "entities": entities,
            "suggested_sources": suggested_sources,
            "suggested_mode": suggested_mode,
            "is_technical": is_technical,
            "is_sensitive": is_sensitive,
            "sentiment": sentiment
        }
    
    def _detect_language(self, query: str) -> str:
        """Detect the language of the query"""
        try:
            lang = detect(query)
            return lang
        except LangDetectException:
            return "unknown"
    
    def _extract_keywords(self, query: str) -> List[str]:
        """Extract meaningful keywords from query"""
        # Remove common stop words
        stop_words = {'the', 'a', 'an', 'is', 'are', 'in', 'on', 'at', 'to', 'for',
                     'il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra'}
        
        # Split and clean
        words = re.findall(r'\b\w+\b', query.lower())
        keywords = [w for w in words if w not in stop_words and len(w) > 2]
        
        return keywords[:10]  # Limit to 10 keywords
    
    def _detect_intent(self, query_lower: str) -> str:
        """Detect the primary intent of the query"""
        for intent, patterns in self.INTENT_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, query_lower):
                    return intent
        
        # Check for question marks
        if '?' in query_lower:
            return 'question'
        
        return 'informational'
    
    def _assess_complexity(self, query: str, keywords: List[str]) -> str:
        """Assess query complexity"""
        word_count = len(query.split())
        
        if word_count <= 3:
            return 'simple'
        elif word_count <= 7:
            return 'moderate'
        else:
            return 'complex'
    
    def _is_technical(self, query_lower: str, keywords: List[str]) -> bool:
        """Check if query is technical"""
        query_words = set(query_lower.split())
        return bool(query_words.intersection(self.TECHNICAL_KEYWORDS))
    
    def _is_sensitive(self, query_lower: str, keywords: List[str]) -> bool:
        """Check if query contains sensitive content"""
        query_words = set(query_lower.split())
        return bool(query_words.intersection(self.SENSITIVE_KEYWORDS))
    
    def _extract_entities(self, query: str) -> List[str]:
        """Extract named entities (simplified version)"""
        # Look for capitalized words (proper nouns)
        entities = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', query)
        return list(set(entities))[:5]  # Limit to 5 entities
    
    def _suggest_sources(self, intent: str, is_technical: bool, is_sensitive: bool) -> List[str]:
        """Suggest appropriate sources based on analysis"""
        sources = ['duckduckgo']  # Always include DuckDuckGo
        
        if is_technical:
            sources.append('clearnet')
        
        if intent in ['tutorial', 'how_to']:
            sources.append('clearnet')
        
        return sources
    
    def _detect_sentiment(self, query_lower: str) -> str:
        """Detect sentiment (basic)"""
        positive_words = {'best', 'good', 'great', 'excellent', 'amazing', 'love', 
                         'migliore', 'ottimo', 'eccellente', 'fantastico'}
        negative_words = {'worst', 'bad', 'terrible', 'hate', 'awful', 'problem',
                         'peggiore', 'brutto', 'terribile', 'problema', 'errore'}
        
        words = set(query_lower.split())
        
        if words.intersection(positive_words):
            return 'positive'
        elif words.intersection(negative_words):
            return 'negative'
        else:
            return 'neutral'

# Global analyzer instance
query_analyzer = QueryAnalyzer()