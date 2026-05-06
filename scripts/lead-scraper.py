"""
Firesky Lead Scraper
--------------------
Searches for potential water tank leads using Serper, scrapes the top 5 results,
and sends the raw text to the Sky AI /api/process-lead endpoint for extraction
and automatic enquiry creation.

Requirements:
    pip install requests beautifulsoup4

Environment variables:
    SERPER_API_KEY      — get from serper.dev
    PROCESS_LEAD_URL    — e.g. https://fireskyops.tech/api/process-lead
    LIVE_DATA_API_KEY   — same key set on the server

Usage:
    python lead-scraper.py
    python lead-scraper.py "borehole pump installation Pretoria"
"""

import os
import sys
import json
import time
import requests
from bs4 import BeautifulSoup

SERPER_API_KEY = os.environ.get("SERPER_API_KEY", "")
PROCESS_LEAD_URL = os.environ.get("PROCESS_LEAD_URL", "https://8ecb1f4e-ef9e-4071-ac41-fe2eaf8e0001-00-qwr3ijk7dpmj.kirk.replit.dev/api/process-lead")
LIVE_DATA_API_KEY = os.environ.get("LIVE_DATA_API_KEY", "")

DEFAULT_QUERIES = [
    # Gumtree wanted ads
    'site:gumtree.co.za "water tank" "wanted"',
    'site:gumtree.co.za "JoJo tank" "looking for"',
    'site:gumtree.co.za "water tank" "need" OR "looking"',
    'site:gumtree.co.za "borehole pump" "wanted"',
    'site:gumtree.co.za "water storage" "wanted"',
    # Forum and community posts
    'site:mybroadband.co.za "water tank" "quote" OR "install"',
    'site:buildit.co.za "water tank" "quote"',
    '"looking for" "water tank" "quote" South Africa',
    '"need a quote" "water tank" South Africa',
    '"please quote" "water tank" South Africa',
    '"looking for supplier" "water tank" South Africa',
    # Facebook-indexed posts
    'site:facebook.com "water tank" "wanted" South Africa',
    'site:facebook.com "JoJo tank" "looking for" South Africa',
    # Property and farm forums
    '"need water tank" farm South Africa',
    '"need JoJo tank" South Africa',
    '"require water tank" South Africa quote',
    '"borehole pump" "quote" site:za',
    '"water pump" "need quote" South Africa',
    # Classifieds and Q&A
    'site:olx.co.za "water tank" OR "JoJo tank"',
    '"anyone know" "water tank" "South Africa"',
    '"recommend" "water tank supplier" South Africa',
    '"water tank installer" "quote" Johannesburg OR Pretoria OR Cape Town OR Bloemfontein',
    '"JoJo tank" "install" "quote" Free State OR Northern Cape OR North West',
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}


def search_serper(query: str, num: int = 5) -> list[dict]:
    """Return top N organic results from Serper."""
    if not SERPER_API_KEY:
        print("ERROR: SERPER_API_KEY not set")
        sys.exit(1)

    resp = requests.post(
        "https://google.serper.dev/search",
        headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
        json={"q": query, "gl": "za", "hl": "en", "num": num},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("organic", [])[:num]


def scrape_page(url: str, timeout: int = 10) -> str:
    """Fetch a URL and return stripped plain text."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        text = soup.get_text(separator="\n")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return "\n".join(lines)
    except Exception as exc:
        print(f"  ⚠  Could not scrape {url}: {exc}")
        return ""


def send_to_sky(text: str, source: str) -> dict:
    """POST scraped text to the process-lead endpoint."""
    if not LIVE_DATA_API_KEY:
        print("ERROR: LIVE_DATA_API_KEY not set")
        sys.exit(1)

    resp = requests.post(
        PROCESS_LEAD_URL,
        headers={"x-api-key": LIVE_DATA_API_KEY, "Content-Type": "application/json"},
        json={"text": text, "source": source},
        timeout=30,
    )
    return resp.json()


def run(query: str) -> None:
    print(f"\n🔍  Searching: {query}")
    results = search_serper(query)

    if not results:
        print("  No results found.")
        return

    for i, result in enumerate(results, 1):
        url = result.get("link", "")
        title = result.get("title", "")
        print(f"\n[{i}/{len(results)}] {title}\n    {url}")

        text = scrape_page(url)
        if len(text) < 50:
            print("  ⚠  Page too short or blocked — skipping")
            continue

        print(f"  Scraped {len(text)} chars — sending to Sky AI...")
        result_data = send_to_sky(text, source=url)

        status = result_data.get("status", "unknown")
        if status == "created":
            customer = result_data.get("customer", {})
            enquiry = result_data.get("enquiry", {})
            confidence = result_data.get("confidence", "?")
            print(f"  ✅ Created — Customer: {customer.get('name')} (id={customer.get('id')})")
            print(f"              Enquiry:  {enquiry.get('title')} (id={enquiry.get('id')})")
            print(f"              Confidence: {confidence}")
        elif status == "skipped":
            print(f"  ⏭  Skipped — {result_data.get('reason', 'no reason given')}")
        else:
            print(f"  ❌ Unexpected response: {json.dumps(result_data, indent=2)}")

        time.sleep(1)


if __name__ == "__main__":
    queries = sys.argv[1:] if len(sys.argv) > 1 else DEFAULT_QUERIES

    print("=" * 60)
    print("  Firesky Lead Scraper")
    print(f"  Endpoint: {PROCESS_LEAD_URL}")
    print("=" * 60)

    for q in queries:
        run(q)

    print("\n✅  Done.")
