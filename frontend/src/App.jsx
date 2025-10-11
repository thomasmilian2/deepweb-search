import React, { useState } from 'react';
import { Search, Loader, Globe, Database, Shield, Settings } from 'lucide-react';

function App() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('aggregation');
  const [languages, setLanguages] = useState(['en', 'it']);
  const [sources, setSources] = useState(['duckduckgo']);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [searchMeta, setSearchMeta] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [sourceErrors, setSourceErrors] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8005';
  const MAX_RESULTS = 5;

  const sourceOptions = [
    {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      icon: Globe,
      description: 'Motore di ricerca privato in tempo reale',
      enabled: true
    },
    {
      id: 'clearnet',
      name: 'Clearnet (demo)',
      icon: Database,
      description: 'In sviluppo',
      enabled: false
    },
    {
      id: 'deepweb',
      name: 'Deep Web',
      icon: Shield,
      description: 'In roadmap',
      enabled: false
    },
    {
      id: 'darkweb',
      name: 'Dark Web',
      icon: Shield,
      description: 'In roadmap',
      enabled: false
    }
  ];

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (sources.length === 0) {
      setErrorMessage('Seleziona almeno una fonte prima di avviare la ricerca.');
      return;
    }

    setIsSearching(true);
    setResults([]);
    setSearchMeta(null);
    setErrorMessage('');
    setSourceErrors(null);

    try {
      const response = await fetch(`${API_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          mode,
          languages,
          sources,
          max_results: MAX_RESULTS
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.detail || 'Errore imprevisto durante la ricerca.');
        return;
      }

      setResults(data.results || []);
      setSearchMeta({
        status: data.status,
        count: data.results_count,
        sources: data.requested_sources
      });

      if (data.errors) {
        setSourceErrors(data.errors);
        if (!data.results || data.results.length === 0) {
          const humanReadable = Object.entries(data.errors)
            .map(([source, message]) => `${source}: ${message}`)
            .join(' · ');
          setErrorMessage(`Nessun risultato disponibile. Dettagli: ${humanReadable}`);
        }
      }
    } catch (error) {
      setErrorMessage('Errore di rete durante la ricerca. Riprova più tardi.');
    } finally {
      setIsSearching(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b-2 border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">DW</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">DeepWeb Search</h1>
                <p className="text-sm text-gray-600">Multi-source intelligent search</p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {showSettings && (
            <aside className="col-span-12 lg:col-span-4 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-3">Modalità</h3>
                <div className="space-y-2">
                  {['aggregation', 'crawling', 'hybrid'].map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`w-full p-3 rounded-lg border-2 text-left ${
                        mode === m ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <span className="font-medium capitalize">{m}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-3">Lingue</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { code: 'en', name: 'English' },
                    { code: 'it', name: 'Italiano' },
                    { code: 'es', name: 'Español' },
                    { code: 'ru', name: 'Русский' }
                  ].map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => toggleLanguage(lang.code)}
                      className={`px-4 py-2 rounded-full border-2 ${
                        languages.includes(lang.code)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200'
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-3">Fonti</h3>
                <div className="space-y-3">
                  {sourceOptions.map(option => {
                    const Icon = option.icon;
                    const isActive = sources.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => option.enabled && toggleSource(option.id)}
                        disabled={!option.enabled}
                        className={`w-full p-4 rounded-lg border-2 text-left flex items-start gap-3 ${
                          isActive
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200'
                        } ${option.enabled ? 'hover:border-blue-300' : 'opacity-50 cursor-not-allowed'}`}
                      >
                        <Icon size={20} />
                        <div>
                          <span className="block font-semibold">{option.name}</span>
                          <span className="block text-xs text-gray-500">{option.description}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          )}

          <main className={`col-span-12 ${showSettings ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-6`}>
            <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6">
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Inserisci la tua ricerca..."
                    disabled={isSearching}
                    className="w-full px-6 py-4 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                  />
                  <button
                    type="submit"
                    disabled={isSearching || !query.trim()}
                    className="absolute right-2 top-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSearching ? (
                      <>
                        <Loader size={18} className="animate-spin" />
                        Ricerca...
                      </>
                    ) : (
                      <>
                        <Search size={18} />
                        Cerca
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6">
              {errorMessage && (
                <div className="mb-4 p-3 border border-red-200 bg-red-50 text-sm text-red-700 rounded-lg">
                  {errorMessage}
                </div>
              )}

              {searchMeta && (
                <div className="mb-4 p-3 border border-blue-200 bg-blue-50 text-sm text-blue-700 rounded-lg">
                  <div className="flex flex-wrap gap-3">
                    <span className="font-semibold">Stato: {searchMeta.status}</span>
                    <span>Risultati: {searchMeta.count}</span>
                    <span>Fonti: {searchMeta.sources?.join(', ') || '—'}</span>
                  </div>
                </div>
              )}

              {sourceErrors && results.length > 0 && (
                <div className="mb-4 p-3 border border-yellow-200 bg-yellow-50 text-sm text-yellow-800 rounded-lg">
                  {Object.entries(sourceErrors).map(([source, message]) => (
                    <div key={source}>
                      <span className="font-semibold">{source}:</span> {message}
                    </div>
                  ))}
                </div>
              )}

              {results.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">Nessun risultato ancora.</p>
                  <p className="text-sm mt-2">Avvia una ricerca per vedere i risultati.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {results.map((result, i) => (
                    <div key={i} className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300">
                      <div className="flex items-start gap-3">
                        <span className="text-sm font-semibold text-gray-500">#{i + 1}</span>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {result.title}
                          </h3>
                          <p className="text-sm text-gray-600 mb-2">{result.snippet}</p>
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {result.url}
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
