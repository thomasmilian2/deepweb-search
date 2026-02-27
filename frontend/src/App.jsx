import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Loader, Globe, Database, Shield, Settings,
  TrendingUp, Clock, Star, ChevronLeft, ChevronRight,
  BarChart3, History as HistoryIcon, Moon, Sun,
  ExternalLink, Bookmark, Filter, AlertCircle,
  LogIn, LogOut, UserCircle, X,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8005';

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function getToken() {
  return localStorage.getItem('auth_token');
}

function setToken(token) {
  localStorage.setItem('auth_token', token);
}

function clearToken() {
  localStorage.removeItem('auth_token');
}

// Fetch wrapper: injects Bearer token and auto-logs-out on 401.
async function authFetch(url, options = {}, onUnauthorized = null) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    if (onUnauthorized) onUnauthorized();
  }

  return response;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  // Search state
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('aggregation');
  const [languages, setLanguages] = useState(['en', 'it']);
  const [sources, setSources] = useState(['duckduckgo']);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMeta, setSearchMeta] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [sourceErrors, setSourceErrors] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [maxResults, setMaxResults] = useState(50);

  // UI state
  const [activeView, setActiveView] = useState('search');
  const [darkMode, setDarkMode] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [relatedSearches, setRelatedSearches] = useState([]);
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [savedSearches, setSavedSearches] = useState([]);

  // Auth state
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Auth actions
  // -------------------------------------------------------------------------

  const handleUnauthorized = useCallback(() => {
    setCurrentUser(null);
    setShowAuthModal(true);
  }, []);

  // Validate stored token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setCurrentUser(data);
        else clearToken();
      })
      .catch(() => clearToken());
  }, []);

  const openAuthModal = (mode = 'login') => {
    setAuthMode(mode);
    setAuthError('');
    setAuthUsername('');
    setAuthPassword('');
    setShowAuthModal(true);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      let response;

      if (authMode === 'register') {
        response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: authUsername, password: authPassword }),
        });
      } else {
        // OAuth2 form format
        const form = new URLSearchParams();
        form.append('username', authUsername);
        form.append('password', authPassword);
        response = await fetch(`${API_URL}/auth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form,
        });
      }

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.detail || 'Authentication failed.');
        return;
      }

      setToken(data.access_token);

      // Fetch user profile
      const meRes = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const me = await meRes.json();
      setCurrentUser(me);
      setShowAuthModal(false);
    } catch {
      setAuthError('Network error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setCurrentUser(null);
    setHistory([]);
    setAnalytics(null);
    setSavedSearches([]);
    setActiveView('search');
  };

  // -------------------------------------------------------------------------
  // Protected view navigation
  // -------------------------------------------------------------------------

  const navigateTo = (view) => {
    const protectedViews = ['history', 'analytics', 'saved'];
    if (protectedViews.includes(view) && !currentUser) {
      openAuthModal('login');
      return;
    }
    setActiveView(view);
  };

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await authFetch(
        `${API_URL}/api/analytics?days=7`,
        {},
        handleUnauthorized
      );
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  }, [handleUnauthorized]);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await authFetch(
        `${API_URL}/api/history?limit=50`,
        {},
        handleUnauthorized
      );
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  }, [handleUnauthorized]);

  const fetchSavedSearches = useCallback(async () => {
    try {
      const response = await authFetch(
        `${API_URL}/api/saved-searches`,
        {},
        handleUnauthorized
      );
      if (response.ok) {
        const data = await response.json();
        setSavedSearches(data.saved_searches || []);
      }
    } catch (err) {
      console.error('Error fetching saved searches:', err);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    if (activeView === 'analytics' && currentUser) fetchAnalytics();
    else if (activeView === 'history' && currentUser) fetchHistory();
    else if (activeView === 'saved' && currentUser) fetchSavedSearches();
  }, [activeView, currentUser, fetchAnalytics, fetchHistory, fetchSavedSearches]);

  // Suggestions debounce
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }

    const id = setTimeout(async () => {
      try {
        const r = await fetch(`${API_URL}/api/suggestions?q=${encodeURIComponent(query)}`);
        const d = await r.json();
        setSuggestions(d.suggestions || []);
      } catch { /* silent */ }
    }, 300);

    return () => clearTimeout(id);
  }, [query]);

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

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
      const response = await authFetch(`${API_URL}/api/search`, {
        method: 'POST',
        body: JSON.stringify({ query: searchQuery, mode, languages, sources, max_results: maxResults, page: 1, page_size: pageSize }),
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
        totalPages: data.total_pages,
      });

      if (data.errors) {
        setSourceErrors(data.errors);
        if (!data.results?.length) {
          setErrorMessage(
            `No results. ${Object.entries(data.errors).map(([s, m]) => `${s}: ${m}`).join(' · ')}`
          );
        }
      }

      if (data.results?.length) fetchRelatedSearches(searchQuery);
    } catch {
      setErrorMessage('Network error. Please try again later.');
    } finally {
      setIsSearching(false);
    }
  };

  const fetchRelatedSearches = async (searchQuery) => {
    try {
      const r = await fetch(`${API_URL}/api/related?query=${encodeURIComponent(searchQuery)}`);
      const d = await r.json();
      setRelatedSearches(d.related || []);
    } catch { /* silent */ }
  };

  const loadPage = async (page) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const response = await authFetch(`${API_URL}/api/search`, {
        method: 'POST',
        body: JSON.stringify({ query, mode, languages, sources, max_results: maxResults, page, page_size: pageSize }),
      });
      const data = await response.json();
      if (response.ok) {
        setResults(data.results || []);
        setCurrentPage(page);
        setSearchMeta((prev) => ({ ...prev, count: data.results_count, fromCache: data.from_cache }));
      }
    } catch (err) {
      console.error('Error loading page:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const saveSearch = async () => {
    if (!query.trim()) return;
    if (!currentUser) { openAuthModal('login'); return; }

    try {
      const response = await authFetch(`${API_URL}/api/saved-searches`, {
        method: 'POST',
        body: JSON.stringify({ query, filters: { mode, languages, sources }, name: query, tags: [] }),
      }, handleUnauthorized);

      if (response.ok) fetchSavedSearches();
    } catch (err) {
      console.error('Error saving search:', err);
    }
  };

  const deleteSavedSearch = async (savedId) => {
    try {
      await authFetch(
        `${API_URL}/api/saved-searches/${savedId}`,
        { method: 'DELETE' },
        handleUnauthorized
      );
      setSavedSearches((prev) => prev.filter((s) => s.saved_id !== savedId));
    } catch (err) {
      console.error('Error deleting saved search:', err);
    }
  };

  const toggleLanguage = (lang) =>
    setLanguages((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]));

  const toggleSource = (source) =>
    setSources((prev) => (prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]));

  // -------------------------------------------------------------------------
  // Theme
  // -------------------------------------------------------------------------

  const themeClasses = darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900';
  const cardClasses  = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputClasses = darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900';
  const hoverNav     = darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100';

  const sourceOptions = [
    { id: 'duckduckgo', name: 'DuckDuckGo', icon: Globe,     description: 'Real-time private search', enabled: true  },
    { id: 'clearnet',   name: 'Clearnet',   icon: Database,  description: 'In development',           enabled: false },
    { id: 'deepweb',    name: 'Deep Web',   icon: Shield,    description: 'Coming soon',              enabled: false },
    { id: 'darkweb',    name: 'Dark Web',   icon: Shield,    description: 'Coming soon',              enabled: false },
  ];

  // -------------------------------------------------------------------------
  // Auth Modal
  // -------------------------------------------------------------------------

  const renderAuthModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`${cardClasses} rounded-2xl shadow-2xl border-2 p-8 w-full max-w-md mx-4`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            {authMode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          <button onClick={() => setShowAuthModal(false)} className={`p-2 rounded-lg ${hoverNav}`}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              placeholder="your_username"
              required
              minLength={3}
              className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none ${inputClasses}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder={authMode === 'register' ? 'Minimum 8 characters' : '••••••••'}
              required
              minLength={authMode === 'register' ? 8 : 1}
              className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none ${inputClasses}`}
            />
          </div>

          {authError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {authLoading ? <Loader size={18} className="animate-spin" /> : <LogIn size={18} />}
            {authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm opacity-70">
          {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
            className="text-blue-500 hover:underline font-medium"
          >
            {authMode === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------

  const renderLoginPrompt = (message) => (
    <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-16 text-center`}>
      <UserCircle size={64} className="mx-auto mb-4 opacity-30" />
      <p className="text-xl font-semibold mb-2">{message}</p>
      <p className="text-sm opacity-60 mb-6">Please sign in to access this section.</p>
      <button
        onClick={() => openAuthModal('login')}
        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold flex items-center gap-2 mx-auto"
      >
        <LogIn size={18} />
        Sign In
      </button>
    </div>
  );

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
              {isSearching ? <><Loader size={18} className="animate-spin" />Searching...</> : <><Search size={18} />Search</>}
            </button>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className={`mt-2 ${cardClasses} border rounded-lg shadow-lg`}>
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { setQuery(sug); setSuggestions([]); handleSearch(null, sug); }}
                  className={`w-full text-left px-4 py-2 ${hoverNav} first:rounded-t-lg last:rounded-b-lg`}
                >
                  <Search size={14} className="inline mr-2" />{sug}
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
            {currentUser ? 'Save' : 'Save (login required)'}
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
            <div key={source}><span className="font-semibold">{source}:</span> {message}</div>
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
                  {result.metadata?.favicon_url && (
                    <img src={result.metadata.favicon_url} alt="" className="w-6 h-6 mt-1 flex-shrink-0" onError={(e) => (e.target.style.display = 'none')} />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold mb-2 flex items-start gap-2">
                      <span className="text-sm font-normal opacity-50">#{i + 1}</span>
                      <a href={result.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 flex items-center gap-2">
                        {result.title}
                        <ExternalLink size={16} className="flex-shrink-0" />
                      </a>
                    </h3>
                    <p className="text-sm opacity-80 mb-3 leading-relaxed">{result.snippet}</p>
                    <div className="flex items-center gap-4 text-xs opacity-60 flex-wrap">
                      <span className="truncate">{result.metadata?.domain || result.url}</span>
                      <span>•</span>
                      <span>Score: {result.score?.toFixed(2)}</span>
                      <span>•</span>
                      <span className="capitalize">{result.source}</span>
                      {result.language && <><span>•</span><span className="uppercase">{result.language}</span></>}
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
            <div className="text-sm opacity-70">Page {currentPage} of {searchMeta.totalPages}</div>
            <div className="flex gap-2">
              <button onClick={() => loadPage(currentPage - 1)} disabled={currentPage === 1 || isSearching} className="px-4 py-2 border-2 rounded-lg disabled:opacity-30 hover:bg-blue-50 flex items-center gap-2">
                <ChevronLeft size={16} />Previous
              </button>
              <button onClick={() => loadPage(currentPage + 1)} disabled={currentPage === searchMeta.totalPages || isSearching} className="px-4 py-2 border-2 rounded-lg disabled:opacity-30 hover:bg-blue-50 flex items-center gap-2">
                Next<ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Related Searches */}
      {relatedSearches.length > 0 && (
        <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6 mt-6`}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><TrendingUp size={20} />Related Searches</h3>
          <div className="flex flex-wrap gap-2">
            {relatedSearches.map((rel, idx) => (
              <button key={idx} onClick={() => { setQuery(rel); handleSearch(null, rel); }} className="px-4 py-2 border-2 rounded-full hover:bg-blue-50 hover:border-blue-400 text-sm">
                {rel}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderHistoryView = () => {
    if (!currentUser) return renderLoginPrompt('Sign in to view your search history');
    return (
      <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6`}>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><HistoryIcon size={24} />Search History</h2>
        {history.length === 0 ? (
          <div className="text-center py-16 opacity-50"><Clock size={64} className="mx-auto mb-4" /><p>No search history yet</p></div>
        ) : (
          <div className="space-y-3">
            {history.map((item, idx) => (
              <div key={idx} className="p-4 border-2 rounded-lg hover:border-blue-400 cursor-pointer" onClick={() => { setQuery(item.query); setActiveView('search'); handleSearch(null, item.query); }}>
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
  };

  const renderAnalyticsView = () => {
    if (!currentUser) return renderLoginPrompt('Sign in to view analytics');
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 size={24} />Analytics Dashboard</h2>
        {!analytics ? (
          <div className="text-center py-16"><Loader size={48} className="animate-spin mx-auto mb-4" /><p>Loading analytics...</p></div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Searches', value: analytics.total_searches },
                { label: 'Avg Duration',   value: `${analytics.avg_duration_ms}ms` },
                { label: 'Cache Hit Rate', value: analytics.cache_stats?.hit_rate || '0%' },
                { label: 'Period',         value: `${analytics.period_days} days` },
              ].map(({ label, value }) => (
                <div key={label} className={`${cardClasses} rounded-xl shadow-lg border-2 p-6`}>
                  <div className="text-sm opacity-60 mb-2">{label}</div>
                  <div className="text-3xl font-bold">{value}</div>
                </div>
              ))}
            </div>

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

            {analytics.searches_timeline?.length > 0 && (
              <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6`}>
                <h3 className="text-lg font-bold mb-4">Search Activity</h3>
                <div className="space-y-2">
                  {analytics.searches_timeline.map((item, idx) => {
                    const max = Math.max(...analytics.searches_timeline.map((t) => t.count));
                    return (
                      <div key={idx} className="flex items-center gap-4">
                        <span className="text-sm opacity-60 w-24">{item.date}</span>
                        <div className="flex-1 bg-blue-100 rounded-full h-6 overflow-hidden">
                          <div className="bg-blue-500 h-full flex items-center justify-end px-2 text-xs text-white font-bold" style={{ width: `${(item.count / max) * 100}%` }}>
                            {item.count}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderSavedView = () => {
    if (!currentUser) return renderLoginPrompt('Sign in to view your saved searches');
    return (
      <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-6`}>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Star size={24} />Saved Searches</h2>
        {savedSearches.length === 0 ? (
          <div className="text-center py-16 opacity-50"><Bookmark size={64} className="mx-auto mb-4" /><p>No saved searches yet</p></div>
        ) : (
          <div className="space-y-3">
            {savedSearches.map((item, idx) => (
              <div key={idx} className="p-4 border-2 rounded-lg hover:border-blue-400">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold mb-1">{item.query}</p>
                    <div className="text-xs opacity-60">Saved on {new Date(item.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => { setQuery(item.query); setActiveView('search'); handleSearch(null, item.query); }} className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
                      Search
                    </button>
                    <button onClick={() => deleteSavedSearch(item.saved_id)} className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Layout
  // -------------------------------------------------------------------------

  return (
    <div className={`min-h-screen ${themeClasses} transition-colors duration-200`}>
      {/* Auth Modal */}
      {showAuthModal && renderAuthModal()}

      {/* Header */}
      <header className={`${cardClasses} border-b-2 shadow-lg sticky top-0 z-40`}>
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

            <div className="flex items-center gap-2">
              {/* Navigation */}
              {[
                { view: 'search',    icon: Search,      label: 'Search'    },
                { view: 'history',   icon: HistoryIcon, label: 'History'   },
                { view: 'analytics', icon: BarChart3,   label: 'Analytics' },
                { view: 'saved',     icon: Star,        label: 'Saved'     },
              ].map(({ view, icon: Icon, label }) => (
                <button
                  key={view}
                  onClick={() => navigateTo(view)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-1 text-sm font-medium ${activeView === view ? 'bg-blue-500 text-white' : hoverNav}`}
                >
                  <Icon size={16} />{label}
                </button>
              ))}

              {/* Theme + Filters */}
              <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-lg ${hoverNav}`}>
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-lg ${hoverNav}`}>
                <Settings size={20} />
              </button>

              {/* Auth */}
              <div className="ml-2 border-l pl-3 flex items-center gap-2">
                {currentUser ? (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <UserCircle size={20} className="text-blue-500" />
                      <span className="font-medium hidden sm:inline">{currentUser.username}</span>
                    </div>
                    <button onClick={handleLogout} className={`p-2 rounded-lg ${hoverNav} text-red-500`} title="Sign out">
                      <LogOut size={20} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openAuthModal('login')}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:from-blue-700 hover:to-purple-700"
                  >
                    <LogIn size={16} />Sign In
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar Filters */}
          {showFilters && activeView === 'search' && (
            <aside className="col-span-12 lg:col-span-3 space-y-4">
              <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-4`}>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Filter size={16} />Mode</h3>
                <div className="space-y-2">
                  {['aggregation', 'crawling', 'hybrid'].map((m) => (
                    <button key={m} onClick={() => setMode(m)} className={`w-full p-2 rounded-lg border-2 text-left text-sm ${mode === m ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                      <span className="capitalize font-medium">{m}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-4`}>
                <h3 className="text-sm font-bold mb-3">Languages</h3>
                <div className="flex flex-wrap gap-2">
                  {[{ code: 'en', name: 'EN' }, { code: 'it', name: 'IT' }, { code: 'es', name: 'ES' }, { code: 'ru', name: 'RU' }].map((lang) => (
                    <button key={lang.code} onClick={() => toggleLanguage(lang.code)} className={`px-3 py-1 rounded-full border-2 text-sm font-medium ${languages.includes(lang.code) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200'}`}>
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-4`}>
                <h3 className="text-sm font-bold mb-3">Sources</h3>
                <div className="space-y-2">
                  {sourceOptions.map((option) => {
                    const Icon = option.icon;
                    const isActive = sources.includes(option.id);
                    return (
                      <button key={option.id} onClick={() => option.enabled && toggleSource(option.id)} disabled={!option.enabled}
                        className={`w-full p-3 rounded-lg border-2 text-left flex items-start gap-2 text-sm ${isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} ${option.enabled ? 'hover:border-blue-300' : 'opacity-50 cursor-not-allowed'}`}>
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

              <div className={`${cardClasses} rounded-xl shadow-lg border-2 p-4`}>
                <h3 className="text-sm font-bold mb-3">Max Results</h3>
                <select value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))} className={`w-full p-2 border-2 rounded-lg ${inputClasses}`}>
                  {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} results</option>)}
                </select>
              </div>
            </aside>
          )}

          {/* Main Content */}
          <main className={`col-span-12 ${showFilters && activeView === 'search' ? 'lg:col-span-9' : 'lg:col-span-12'}`}>
            {activeView === 'search'    && renderSearchView()}
            {activeView === 'history'   && renderHistoryView()}
            {activeView === 'analytics' && renderAnalyticsView()}
            {activeView === 'saved'     && renderSavedView()}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
