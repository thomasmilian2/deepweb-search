import asyncio
import math
import os
from typing import Any, Dict, List
from urllib.parse import urlparse

import aiohttp

GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1"

# Language code map: our language code → Google lr parameter
_LANG_MAP: Dict[str, str] = {
    "it": "lang_it",
    "en": "lang_en",
    "fr": "lang_fr",
    "de": "lang_de",
    "es": "lang_es",
    "pt": "lang_pt",
}


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


async def search_google(
    query: str,
    *,
    languages: List[str],
    max_results: int = 10,
    timeout_seconds: int = 10,
) -> List[Dict[str, Any]]:
    """
    Retrieve organic search results via Google Custom Search JSON API.

    Requires environment variables:
        GOOGLE_API_KEY  — API key from Google Cloud Console
        GOOGLE_CSE_ID   — Custom Search Engine ID

    Google CSE returns max 10 results per request; this adapter
    issues multiple requests (up to 10 pages) to honour max_results.
    Free tier: 100 queries/day.
    """
    api_key = os.getenv("GOOGLE_API_KEY", "")
    cse_id = os.getenv("GOOGLE_CSE_ID", "")

    if not api_key or not cse_id:
        raise RuntimeError(
            "Google search requires GOOGLE_API_KEY and GOOGLE_CSE_ID environment variables"
        )

    primary_language = languages[0] if languages else "en"
    lr_param = _LANG_MAP.get(primary_language, f"lang_{primary_language}")

    # CSE API returns 10 results per page, max 100 total (start 1-91)
    capped = min(max_results, 100)
    pages_needed = math.ceil(capped / 10)

    results: List[Dict[str, Any]] = []

    async with aiohttp.ClientSession() as session:
        for page in range(pages_needed):
            if len(results) >= capped:
                break

            start_index = page * 10 + 1  # Google uses 1-based index
            num = min(10, capped - len(results))

            params: Dict[str, Any] = {
                "key": api_key,
                "cx": cse_id,
                "q": query,
                "start": start_index,
                "num": num,
                "lr": lr_param,
            }

            try:
                async with session.get(
                    GOOGLE_CSE_ENDPOINT,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=timeout_seconds),
                ) as response:
                    if response.status == 429:
                        raise RuntimeError("Google CSE quota exceeded (429)")
                    if response.status == 400:
                        data = await response.json()
                        msg = data.get("error", {}).get("message", "bad request")
                        raise RuntimeError(f"Google CSE error: {msg}")
                    response.raise_for_status()
                    data = await response.json()
            except aiohttp.ClientError as exc:
                raise RuntimeError(f"Google CSE request failed: {exc}") from exc

            items = data.get("items", [])
            if not items:
                break  # No more results available

            for position, item in enumerate(items, start=len(results) + 1):
                url = item.get("link", "")
                if not url:
                    continue

                domain = _extract_domain(url)
                thumbnail = (
                    item.get("pagemap", {})
                    .get("cse_thumbnail", [{}])[0]
                    .get("src", "")
                )

                results.append({
                    "title": item.get("title", ""),
                    "url": url,
                    "snippet": item.get("snippet", "").replace("\n", " "),
                    "source": "google",
                    "language": primary_language,
                    "metadata": {
                        "domain": domain,
                        "favicon_url": f"https://www.google.com/s2/favicons?domain={domain}&sz=32",
                        "position": position,
                        "has_snippet": bool(item.get("snippet")),
                        "thumbnail": thumbnail,
                        "display_link": item.get("displayLink", domain),
                    },
                    "score": 1.0,
                })

            # If Google returned fewer items than requested, no more pages exist
            if len(items) < num:
                break

    return results
