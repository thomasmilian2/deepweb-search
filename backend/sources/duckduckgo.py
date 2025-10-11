import asyncio
from typing import List, Dict, Any
from urllib.parse import urlparse, parse_qs, unquote

import aiohttp
from bs4 import BeautifulSoup

DUCKDUCKGO_HTML_ENDPOINT = "https://duckduckgo.com/html/"


def _extract_result_url(raw_href: str) -> str:
    """
    DuckDuckGo search results use redirect links like
    /l/?kh=1&uddg=<encoded_url>. This helper unwraps the
    actual destination when possible.
    """
    if not raw_href:
        return ""

    if raw_href.startswith("http://") or raw_href.startswith("https://"):
        return raw_href

    parsed = urlparse(raw_href)
    if parsed.path.startswith("/l/"):
        query = parse_qs(parsed.query)
        encoded = query.get("uddg", [])
        if encoded:
            return unquote(encoded[0])
    return raw_href


async def search_duckduckgo(
    query: str,
    *,
    languages: List[str],
    max_results: int = 5,
    timeout_seconds: int = 10,
) -> List[Dict[str, Any]]:
    """
    Retrieve organic search results from DuckDuckGo's HTML endpoint.

    Args:
        query: The search terms.
        languages: Preferred languages (best effort; DDG does not expose
            per-result language, so we tag the first requested language).
        max_results: Maximum number of results to return.
        timeout_seconds: HTTP request timeout.

    Returns:
        A list of dictionaries with title, url, snippet, source and language.
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/126.0.0.0 Safari/537.36"
        ),
    }
    params = {"q": query}
    primary_language = languages[0] if languages else "unknown"

    async with aiohttp.ClientSession(headers=headers) as session:
        try:
            async with session.get(
                DUCKDUCKGO_HTML_ENDPOINT,
                params=params,
                timeout=timeout_seconds,
            ) as response:
                response.raise_for_status()
                html = await response.text()
        except asyncio.TimeoutError as exc:
            raise RuntimeError("DuckDuckGo request timed out") from exc
        except aiohttp.ClientError as exc:
            raise RuntimeError(f"DuckDuckGo request failed: {exc}") from exc

    soup = BeautifulSoup(html, "html.parser")
    results: List[Dict[str, Any]] = []

    for result_node in soup.select(".result"):
        link = result_node.select_one(".result__a")
        if not link:
            continue

        title = link.get_text(strip=True)
        url = _extract_result_url(link.get("href", ""))

        snippet_node = result_node.select_one(".result__snippet")
        snippet = snippet_node.get_text(strip=True) if snippet_node else ""

        if not url:
            continue

        results.append(
            {
                "title": title,
                "url": url,
                "snippet": snippet,
                "source": "duckduckgo",
                "language": primary_language,
            }
        )

        if len(results) >= max_results:
            break

    return results
