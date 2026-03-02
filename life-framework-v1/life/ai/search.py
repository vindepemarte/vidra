"""Brave Search API wrapper for event discovery and research."""

from __future__ import annotations

import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"


class BraveSearch:
    """Lightweight wrapper around the Brave Search API."""

    def __init__(self) -> None:
        self.api_key = os.getenv("BRAVE_API_KEY")
        if not self.api_key:
            raise ValueError("BRAVE_API_KEY not set in .env")

    def search(self, query: str, count: int = 10) -> list[dict[str, Any]]:
        """Run a web search and return simplified results."""
        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": self.api_key,
        }
        params = {"q": query, "count": count}
        resp = httpx.get(BRAVE_SEARCH_URL, headers=headers, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        results = []
        for item in data.get("web", {}).get("results", []):
            results.append(
                {
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "description": item.get("description", ""),
                }
            )
        return results

    def discover_events(self, city: str, month: str, year: str) -> list[dict[str, Any]]:
        """Search for upcoming events in a city for a given month."""
        queries = [
            f"upcoming events {city} {month} {year}",
            f"fashion events {city} {month} {year}",
            f"concerts festivals {city} {month} {year}",
            f"art exhibitions {city} {month} {year}",
        ]
        all_results = []
        seen_urls = set()
        for q in queries:
            for r in self.search(q, count=5):
                if r["url"] not in seen_urls:
                    seen_urls.add(r["url"])
                    all_results.append(r)
        return all_results

    def research_topic(self, topic: str) -> str:
        """Search a topic and return a concatenated summary for LLM context."""
        results = self.search(topic, count=5)
        parts = []
        for r in results:
            parts.append(f"**{r['title']}**: {r['description']}")
        return "\n".join(parts)
