#!/usr/bin/env python3

"""
PolicyBuddies API Client - Python Example

Usage:
    python3 scripts/api-client.py
"""

import requests
import json
import sys
import time
from typing import Optional, Dict, Any

API_URL = "http://localhost:3000"

# ANSI colors for output
class Colors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"


def api_call(endpoint: str, method: str = "GET", body: Optional[Dict] = None) -> Optional[Dict]:
    """Make an API call with error handling."""
    url = f"{API_URL}{endpoint}"
    print(f"\n{Colors.CYAN}► {method} {endpoint}{Colors.ENDC}")

    try:
        if method == "GET":
            response = requests.get(url)
        elif method == "POST":
            response = requests.post(url, json=body)
        else:
            response = requests.request(method, url, json=body)

        data = response.json()

        if not response.ok:
            print(f"{Colors.RED}✗ Error: {data.get('error', data.get('message'))}{Colors.ENDC}")
            return None

        print(f"{Colors.GREEN}✓ Success{Colors.ENDC}")
        print(json.dumps(data, indent=2))
        return data

    except requests.exceptions.ConnectionError:
        print(f"{Colors.RED}✗ Connection refused. Is the server running?{Colors.ENDC}")
        print(f"  Try: npm run api")
        return None
    except requests.exceptions.RequestException as e:
        print(f"{Colors.RED}✗ Network error: {str(e)}{Colors.ENDC}")
        return None


def test_health_check():
    """Test: Health Check"""
    print(f"\n{Colors.BOLD}{'═' * 35}{Colors.ENDC}")
    print(f"{Colors.BOLD}Test 1: Health Check{Colors.ENDC}")
    print(f"{Colors.BOLD}{'═' * 35}{Colors.ENDC}")
    api_call("/api/health")


def test_get_catalog():
    """Test: Get Catalog"""
    print(f"\n{Colors.BOLD}{'═' * 35}{Colors.ENDC}")
    print(f"{Colors.BOLD}Test 2: Get Catalog{Colors.ENDC}")
    print(f"{Colors.BOLD}{'═' * 35}{Colors.ENDC}")
    api_call("/api/catalog")


def test_get_config():
    """Test: Get Configuration"""
    print(f"\n{Colors.BOLD}{'═' * 35}{Colors.ENDC}")
    print(f"{Colors.BOLD}Test 3: Get Configuration{Colors.ENDC}")
    print(f"{Colors.BOLD}{'═' * 35}{Colors.ENDC}")
    api_call("/api/config")


def test_ingest_document():
    """Test: Ingest a Sample Document"""
    print(f"\n{Colors.BOLD}{'═' * 35}{Colors.ENDC}")
    print(f"{Colors.BOLD}Test 4: Ingest Document{Colors.ENDC}")
    print(f"{Colors.BOLD}{'═' * 35}{Colors.ENDC}")

    sample_content = """
# Wealth Pro II - Investment-Linked Insurance Product

## Product Overview
Wealth Pro II is an investment-linked insurance product that combines life insurance 
protection with investment opportunities.

## Investment Options
1. **Conservative Fund** - Lower risk, stable returns
2. **Balanced Fund** - Moderate risk and growth
3. **Growth Fund** - Higher risk, higher potential returns
4. **Dividend Fund** - Focus on dividend-paying assets

## Policy Features
- Flexible premium payments
- Annual bonuses based on performance
- Surrender flexibility after 5 years
- Death benefit up to 5x annual premium

## Underwriting
Applicants aged 18-75 can apply. Medical underwriting required for amounts exceeding $500,000.
"""

    result = api_call(
        "/api/ingest",
        "POST",
        {
            "filename": "wealth-pro-ii-sample.md",
            "content": sample_content,
            "metadata": {
                "productName": "Wealth Pro II",
                "jurisdiction": "SG",
                "versionLabel": "v1.0",
                "documentType": "product summary",
            },
        },
    )

    return result.get("documentVersionId") if result else None


def test_ask_question():
    """Test: Ask a Question"""
    print(f"\n{Colors.BOLD}{'═' * 35}{Colors.ENDC}")
    print(f"{Colors.BOLD}Test 5: Ask Question{Colors.ENDC}")
    print(f"{Colors.BOLD}{'═' * 35}{Colors.ENDC}")

    api_call(
        "/api/ask",
        "POST",
        {
            "question": "What are the investment options available in Wealth Pro II and what is their risk profile?",
            "topK": 3,
        },
    )


def test_conversation():
    """Test: Ask Multiple Questions (Conversation)"""
    print(f"\n{Colors.BOLD}{'═' * 35}{Colors.ENDC}")
    print(f"{Colors.BOLD}Test 6: Ask Follow-up Questions{Colors.ENDC}")
    print(f"{Colors.BOLD}{'═' * 35}{Colors.ENDC}")

    session_id = f"session_{int(time.time() * 1000)}"

    print(f"\n{Colors.YELLOW}Question 1: What is the minimum investment?{Colors.ENDC}")
    api_call(
        "/api/ask",
        "POST",
        {
            "question": "What is the minimum investment amount?",
            "topK": 3,
            "sessionId": session_id,
        },
    )

    print(f"\n{Colors.YELLOW}Question 2: Can I change my investment option later?{Colors.ENDC}")
    api_call(
        "/api/ask",
        "POST",
        {
            "question": "Can I change my investment option after purchase?",
            "topK": 3,
            "sessionId": session_id,
        },
    )


def test_error_handling():
    """Test: Error Handling"""
    print(f"\n{Colors.BOLD}{'═' * 35}{Colors.ENDC}")
    print(f"{Colors.BOLD}Test 7: Error Handling{Colors.ENDC}")
    print(f"{Colors.BOLD}{'═' * 35}{Colors.ENDC}")

    print(f"\n{Colors.YELLOW}Testing missing question parameter:{Colors.ENDC}")
    api_call("/api/ask", "POST", {})

    print(f"\n{Colors.YELLOW}Testing invalid endpoint:{Colors.ENDC}")
    api_call("/api/invalid-endpoint")


def run_all_tests():
    """Run all tests"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}")
    print("╔════════════════════════════════════════════╗")
    print("║  PolicyBuddies API Client - Test Suite    ║")
    print(f"║  Server: {API_URL:<30} ║")
    print("╚════════════════════════════════════════════╝")
    print(f"{Colors.ENDC}")

    # Check if server is running
    print("Connecting to server...")
    health = api_call("/api/health")

    if not health:
        print(
            f"{Colors.RED}✗ Cannot connect to server. Is it running?{Colors.ENDC}"
        )
        print(f"  Try: npm run api")
        sys.exit(1)

    # Run tests
    test_health_check()
    test_get_catalog()
    test_get_config()
    test_ingest_document()
    test_ask_question()
    test_conversation()
    test_error_handling()

    print(f"\n{Colors.HEADER}{Colors.BOLD}")
    print("╔════════════════════════════════════════════╗")
    print("║  ✓ All tests completed                    ║")
    print("╚════════════════════════════════════════════╝")
    print(f"{Colors.ENDC}\n")


if __name__ == "__main__":
    import time
    run_all_tests()
