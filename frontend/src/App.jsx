import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Loader, Globe, Database, Shield, Settings, 
  TrendingUp, Clock, Star, X, ChevronLeft, ChevronRight,
  BarChart3, History as HistoryIcon, Moon, Sun, 
  ExternalLink, Bookmark, Filter, AlertCircle
} from 'lucide-react';

function App() {
  // State management
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('aggregation');
  const [languages, setLanguages] = useState(['en', 'it']);
  const [sources, setSources] = useState(['duckduckgo']);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMeta, setSearchMeta] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [sourceErrors, setSourceErrors] = useState(null);
  
  // New state for advanced features
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [maxResults, setMaxResults] = useState(50);
  const [activeView, setActiveView] = useState('search'); // search, history, analytics, saved
  const [darkMode, setDarkMode] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [relatedSearches, setRelatedSearches] = useState([]);
  const [savedSearches, setSavedSearches] = useState([]);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8005';

  const sourceOptions = [
    {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      icon: Globe,
      description: 'Real-time private search',
      enabled: true
    },
    {
      id: 'clearnet',
      name: 'Clearnet',
      icon: Database,
      description: 'In development',
      enabled: false
    },
    {
      id: 'deepweb',
      name: 'Deep Web',
      icon: Shield,
      description: 'Coming soon',
      enabled: false
    },
    {
      id: 'darkweb',
      name: 'Dark Web',
      icon: Shield,
      description: 'Coming soon',
      enabled: false
    }
  ];

  // Fetch suggestions as user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length >= 2) {
        try {
          const response = await fetch(`${API_URL}/api/suggestions?q=${encodeURIComponent(query)}`);
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        } catch (error) {
          console.error('Error fetching suggestions:', error);
        }
      } else {
        setSuggestions([]);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [query, API_URL]);

  // Fetch analytics when view changes
  useEffect(() => {
    if (activeView === 'analytics') {
      fetchAnalytics();
    } else if (activeView === 'history') {
      fetchHistory();
    } else if (activeView === 'saved') {
      fetchSavedSearches();
    }
  }, [activeView]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API_URL}/api/analytics?days=7`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/api/history?limit=50`);
      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchSavedSearches = async () => {
    try {
      const response = await fetch(`${API_URL}/api/saved-searches`);
      const data = await response.json();
      setSavedSearches(data.saved_searches || []);
    } catch (error) {
      console.error('Error fetching saved searches:', error);
    }
  };

  const handleSearch = async (e, searchQuery = query) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    if (sources.length === 0) {
      setErrorMessage('Select at least one source before searching.');
      return;
    }

    setIsSearching(true);
    setResults([]);
    setSearchMeta(null);
    setErrorMessage('');
    setSourceErrors(null);
    setCurrentPage(1);
    setActiveView('search');

    try {
      const response = await fetch(`${API_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          mode,
          languages,
          sources,
          max_results: maxResults,
          page: 1,
          page_size: pageSize
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.detail || 'Unexpected error during search.');
        return;
      }

      setResults(data.results || []);
      setSearchMeta({
        status: data.status,
        count: data.results_count,
        total: data.total_results,
        sources: data.requested_sources,
        duration: data.duration_ms,
        fromCache: data.from_cache,
        totalPages: data.total_pages
      });

      if (data.errors) {
        setSourceErrors(data.errors);
        if (!data.results || data.results.length === 0) {
          const humanReadable = Object.entries(data.errors)
            .map(([source, message]) => `${source}: ${message}`)
            .join(' · ');
          setErrorMessage(`No results available. Details: ${humanReadable}`);
        }
      }

      // Fetch related searches
      if (data.results && data.results.length > 0) {
        fetchRelatedSearches(searchQuery);
      }
    } catch (error) {
      setErrorMessage('Network error during search. Please try again later.');
    } finally {
      setIsSearching(false);
    }
  };

  const fetchRelatedSearches = async (searchQuery) => {
    try {
      const response = await fetch(`${API_URL}/api/related?query=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setRelatedSearches(data.related || []);
    } catch (error) {
      console.error('Error fetching related searches:', error);
    }
  };

  const loadPage = async (page) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`${API_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          mode,
          languages,
          sources,
          max_results: maxResults,
          page,
          page_size: pageSize
        })
      });

      const data = await response.json();
      if (response.ok) {
        setResults(data.results || []);
        setCurrentPage(page);
        setSearchMeta(prev => ({
          ...prev,
          count: data.results_count,
          fromCache: data.from_cache
        }));
      }
    } catch (error) {
      console.error('Error loading page:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const saveSearch = async () => {
    if (!query.trim()) return;
    
    try {
      const response = await fetch(`${API_URL}/api/saved-searches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          filters: { mode, languages, sources },
          name: query,
          tags: []
        })
      });
      
      if (response.ok) {
        alert('Search saved successfully!');
        fetchSavedSearches();
      }
    } catch (error) {
      console.error('Error saving search:', error);
    }
  };

  const toggleLanguage = (lang) => {
    setLanguages(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const toggleSource = (source) => {
    setSources(prev =>
      prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
    );
  };

  const themeClasses = darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900';
  const cardClasses = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputClasses = darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900';

  // Render different views
  const renderSearchView = () => (
    <>
      {/* Search Box */}
      <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6 mb-6`}>
        <form onSubmit={handleSearch}>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your search query..."
              disabled={isSearching}
              data-testid="search-input"
              className={`w-full px-6 py-4 text-lg border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50 ${inputClasses}`}
            />
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              data-testid="search-button"
              className="absolute right-2 top-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 font-medium shadow-lg"
            >
              {isSearching ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search size={18} />
                  Search
                </>
              )}
            </button>
          </div>
          
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className={`mt-2 ${cardClasses} border rounded-lg shadow-lg`}>
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuery(sug);
                    setSuggestions([]);
                    handleSearch(null, sug);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-blue-50 ${darkMode ? 'hover:bg-gray-700' : ''} first:rounded-t-lg last:rounded-b-lg`}
                >
                  <Search size={14} className="inline mr-2" />
                  {sug}
                </button>
              ))}
            </div>
          )}
        </form>
        
        {/* Quick actions */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={saveSearch}
            disabled={!query.trim()}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            <Bookmark size={16} />
            Save
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {errorMessage && (
        <div className="mb-4 p-4 border-2 border-red-200 bg-red-50 text-red-700 rounded-lg flex items-start gap-2">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {searchMeta && (
        <div className="mb-4 p-4 border-2 border-blue-200 bg-blue-50 text-blue-700 rounded-lg">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="font-semibold">Status: {searchMeta.status}</span>
            <span>Results: {searchMeta.total}</span>
            <span>Duration: {searchMeta.duration}ms</span>
            <span>Sources: {searchMeta.sources?.join(', ')}</span>
            {searchMeta.fromCache && <span className="text-green-600 font-semibold">⚡ From Cache</span>}
          </div>
        </div>
      )}

      {sourceErrors && results.length > 0 && (
        <div className="mb-4 p-3 border-2 border-yellow-200 bg-yellow-50 text-yellow-800 rounded-lg">
          {Object.entries(sourceErrors).map(([source, message]) => (
            <div key={source}>
              <span className="font-semibold">{source}:</span> {message}
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6`}>
        {results.length === 0 ? (
          <div className="text-center py-16">
            <Search size={64} className="mx-auto mb-4 opacity-30" />
            <p className="text-xl font-medium mb-2">No results yet</p>
            <p className="text-sm opacity-70">Start a search to see results</p>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((result, i) => (
              <div 
                key={i} 
                data-testid={`result-card-${i}`}
                className={`p-5 border-2 ${cardClasses} rounded-xl hover:border-blue-400 hover:shadow-lg transition-all duration-200`}
              >
                <div className="flex items-start gap-4">
                  {/* Favicon */}
                  {result.metadata?.favicon_url && (
                    <img 
                      src={result.metadata.favicon_url} 
                      alt="" 
                      className="w-6 h-6 mt-1 flex-shrink-0"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h3 className="text-lg font-bold mb-2 flex items-start gap-2">
                      <span className="text-sm font-normal opacity-50">#{i + 1}</span>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 flex items-center gap-2"
                      >
                        {result.title}
                        <ExternalLink size={16} className="flex-shrink-0" />
                      </a>
                    </h3>
                    
                    {/* Snippet */}
                    <p className="text-sm opacity-80 mb-3 leading-relaxed">{result.snippet}</p>
                    
                    {/* URL and Metadata */}
                    <div className="flex items-center gap-4 text-xs opacity-60 flex-wrap">
                      <span className="truncate">{result.metadata?.domain || result.url}</span>
                      <span>•</span>
                      <span>Score: {result.score?.toFixed(2)}</span>
                      <span>•</span>
                      <span className="capitalize">{result.source}</span>
                      {result.language && (
                        <>
                          <span>•</span>
                          <span className="uppercase">{result.language}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {searchMeta && searchMeta.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <div className="text-sm opacity-70">
              Page {currentPage} of {searchMeta.totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadPage(currentPage - 1)}
                disabled={currentPage === 1 || isSearching}
                className="px-4 py-2 border-2 rounded-lg disabled:opacity-30 hover:bg-blue-50 flex items-center gap-2"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <button
                onClick={() => loadPage(currentPage + 1)}
                disabled={currentPage === searchMeta.totalPages || isSearching}
                className="px-4 py-2 border-2 rounded-lg disabled:opacity-30 hover:bg-blue-50 flex items-center gap-2"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Related Searches */}
      {relatedSearches.length > 0 && (
        <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6 mt-6`}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp size={20} />
            Related Searches
          </h3>
          <div className="flex flex-wrap gap-2">
            {relatedSearches.map((rel, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(rel);
                  handleSearch(null, rel);
                }}
                className="px-4 py-2 border-2 rounded-full hover:bg-blue-50 hover:border-blue-400 text-sm"
              >
                {rel}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderHistoryView = () => (
    <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6`}>
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <HistoryIcon size={24} />
        Search History
      </h2>
      {history.length === 0 ? (
        <div className="text-center py-16 opacity-50">
          <Clock size={64} className="mx-auto mb-4" />
          <p>No search history yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item, idx) => (
            <div 
              key={idx}
              className="p-4 border-2 rounded-lg hover:border-blue-400 cursor-pointer"
              onClick={() => {
                setQuery(item.query);
                setActiveView('search');
                handleSearch(null, item.query);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold mb-1">{item.query}</p>
                  <div className="text-xs opacity-60 flex gap-4">
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                    <span>•</span>
                    <span>{item.results_count} results</span>
                    <span>•</span>
                    <span className="capitalize">{item.status}</span>
                  </div>
                </div>
                <Search size={16} className="opacity-30" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAnalyticsView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <BarChart3 size={24} />
        Analytics Dashboard
      </h2>
      
      {!analytics ? (
        <div className="text-center py-16">
          <Loader size={48} className="animate-spin mx-auto mb-4" />
          <p>Loading analytics...</p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6`}>
              <div className="text-sm opacity-60 mb-2">Total Searches</div>
              <div className="text-3xl font-bold">{analytics.total_searches}</div>
            </div>
            <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6`}>
              <div className="text-sm opacity-60 mb-2">Avg Duration</div>
              <div className="text-3xl font-bold">{analytics.avg_duration_ms}ms</div>
            </div>
            <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6`}>
              <div className="text-sm opacity-60 mb-2">Cache Hit Rate</div>
              <div className="text-3xl font-bold">{analytics.cache_stats?.hit_rate || '0%'}</div>
            </div>
            <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6`}>
              <div className="text-sm opacity-60 mb-2">Period</div>
              <div className="text-3xl font-bold">{analytics.period_days} days</div>
            </div>
          </div>

          {/* Top Queries */}
          <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6`}>
            <h3 className="text-lg font-bold mb-4">Top Queries</h3>
            <div className="space-y-2">
              {analytics.top_queries?.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{item.query}</span>
                  <span className="text-sm opacity-60">{item.count} searches</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          {analytics.searches_timeline && analytics.searches_timeline.length > 0 && (
            <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6`}>
              <h3 className="text-lg font-bold mb-4">Search Activity</h3>
              <div className="space-y-2">
                {analytics.searches_timeline.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <span className="text-sm opacity-60 w-24">{item.date}</span>
                    <div className="flex-1 bg-blue-100 rounded-full h-6 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full flex items-center justify-end px-2 text-xs text-white font-bold"
                        style={{width: `${(item.count / Math.max(...analytics.searches_timeline.map(t => t.count))) * 100}%`}}
                      >
                        {item.count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderSavedView = () => (
    <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6`}>
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Star size={24} />
        Saved Searches
      </h2>
      {savedSearches.length === 0 ? (
        <div className="text-center py-16 opacity-50">
          <Bookmark size={64} className="mx-auto mb-4" />
          <p>No saved searches yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {savedSearches.map((item, idx) => (
            <div 
              key={idx}
              className="p-4 border-2 rounded-lg hover:border-blue-400"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold mb-1">{item.query}</p>
                  <div className="text-xs opacity-60">
                    Saved on {new Date(item.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setQuery(item.query);
                    setActiveView('search');
                    handleSearch(null, item.query);
                  }}
                  className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                >
                  Search
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen ${themeClasses} transition-colors duration-200`}>
      {/* Header */}
      <header className={`${cardClasses} border-b-2 shadow-lg sticky top-0 z-50`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">DW</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">DeepWeb Search</h1>
                <p className="text-sm opacity-60">Advanced Multi-Source Intelligence</p>
              </div>
            </div>
            
            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveView('search')}
                className={`px-4 py-2 rounded-lg ${activeView === 'search' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
              >
                <Search size={18} className="inline mr-1" />
                Search
              </button>
              <button
                onClick={() => setActiveView('history')}
                className={`px-4 py-2 rounded-lg ${activeView === 'history' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
              >
                <HistoryIcon size={18} className="inline mr-1" />
                History
              </button>
              <button
                onClick={() => setActiveView('analytics')}
                className={`px-4 py-2 rounded-lg ${activeView === 'analytics' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
              >
                <BarChart3 size={18} className="inline mr-1" />
                Analytics
              </button>
              <button
                onClick={() => setActiveView('saved')}
                className={`px-4 py-2 rounded-lg ${activeView === 'saved' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
              >
                <Star size={18} className="inline mr-1" />
                Saved
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar Filters */}
          {showFilters && activeView === 'search' && (
            <aside className="col-span-12 lg:col-span-3 space-y-4">
              {/* Mode Selection */}
              <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-4`}>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Filter size={16} />
                  Mode
                </h3>
                <div className="space-y-2">
                  {['aggregation', 'crawling', 'hybrid'].map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`w-full p-2 rounded-lg border-2 text-left text-sm ${mode === m ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                    >
                      <span className="capitalize font-medium">{m}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Languages */}
              <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-4`}>
                <h3 className="text-sm font-bold mb-3">Languages</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { code: 'en', name: 'EN' },
                    { code: 'it', name: 'IT' },
                    { code: 'es', name: 'ES' },
                    { code: 'ru', name: 'RU' }
                  ].map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => toggleLanguage(lang.code)}
                      className={`px-3 py-1 rounded-full border-2 text-sm font-medium ${languages.includes(lang.code) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200'}`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sources */}
              <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-4`}>
                <h3 className="text-sm font-bold mb-3">Sources</h3>
                <div className="space-y-2">
                  {sourceOptions.map(option => {
                    const Icon = option.icon;
                    const isActive = sources.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => option.enabled && toggleSource(option.id)}
                        disabled={!option.enabled}
                        className={`w-full p-3 rounded-lg border-2 text-left flex items-start gap-2 text-sm ${isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} ${option.enabled ? 'hover:border-blue-300' : 'opacity-50 cursor-not-allowed'}`}
                      >
                        <Icon size={16} className="mt-0.5" />
                        <div>
                          <span className="block font-semibold">{option.name}</span>
                          <span className="block text-xs opacity-60">{option.description}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Max Results */}
              <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-4`}>
                <h3 className="text-sm font-bold mb-3">Max Results</h3>
                <select
                  value={maxResults}
                  onChange={(e) => setMaxResults(Number(e.target.value))}
                  className={`w-full p-2 border-2 rounded-lg ${inputClasses}`}
                >
                  <option value={10}>10 results</option>
                  <option value={20}>20 results</option>
                  <option value={50}>50 results</option>
                  <option value={100}>100 results</option>
                </select>
              </div>
            </aside>
          )}

          {/* Main Content */}
          <main className={`col-span-12 ${showFilters && activeView === 'search' ? 'lg:col-span-9' : 'lg:col-span-12'}`}>
            {activeView === 'search' && renderSearchView()}
            {activeView === 'history' && renderHistoryView()}
            {activeView === 'analytics' && renderAnalyticsView()}
            {activeView === 'saved' && renderSavedView()}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;