import asyncio
from typing import List, Dict, Any
from urllib.parse import urlparse, parse_qs, unquote
import re

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


def _extract_domain(url: str) -> str:
    """Extract domain from URL for metadata"""
    try:
        parsed = urlparse(url)
        return parsed.netloc.replace('www.', '')
    except:
        return ""


async def search_duckduckgo(
    query: str,
    *,
    languages: List[str],
    max_results: int = 20,
    timeout_seconds: int = 15,
    retry_count: int = 2,
) -> List[Dict[str, Any]]:
    """
    Retrieve organic search results from DuckDuckGo's HTML endpoint.

    Args:
        query: The search terms.
        languages: Preferred languages (best effort; DDG does not expose
            per-result language, so we tag the first requested language).
        max_results: Maximum number of results to return (increased to 20 default).
        timeout_seconds: HTTP request timeout.
        retry_count: Number of retries on failure.

    Returns:
        A list of dictionaries with title, url, snippet, source, language and metadata.
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

    # Retry logic
    for attempt in range(retry_count + 1):
        try:
            async with aiohttp.ClientSession(headers=headers) as session:
                async with session.get(
                    DUCKDUCKGO_HTML_ENDPOINT,
                    params=params,
                    timeout=timeout_seconds,
                ) as response:
                    response.raise_for_status()
                    html = await response.text()
            
            # If successful, break out of retry loop
            break
            
        except asyncio.TimeoutError as exc:
            if attempt == retry_count:
                raise RuntimeError("DuckDuckGo request timed out after retries") from exc
            await asyncio.sleep(1)  # Wait before retry
        except aiohttp.ClientError as exc:
            if attempt == retry_count:
                raise RuntimeError(f"DuckDuckGo request failed: {exc}") from exc
            await asyncio.sleep(1)

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

        # Extract domain for metadata
        domain = _extract_domain(url)
        
        # Build metadata
        metadata = {
            "domain": domain,
            "favicon_url": f"https://www.google.com/s2/favicons?domain={domain}&sz=32",
            "position": len(results) + 1,
            "has_snippet": bool(snippet)
        }

        results.append(
            {
                "title": title,
                "url": url,
                "snippet": snippet,
                "source": "duckduckgo",
                "language": primary_language,
                "metadata": metadata,
                "score": 1.0  # Will be recalculated by ranking service
            }
        )

        if len(results) >= max_results:
            break

    return results