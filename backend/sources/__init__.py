"""
Source adapters for external search providers.
"""

from .duckduckgo import search_duckduckgo
from .google import search_google

__all__ = ["search_duckduckgo", "search_google"]
