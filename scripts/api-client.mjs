#!/usr/bin/env node

/**
 * PolicyBuddies API Client - Node.js Example
 * 
 * Usage:
 * npm run api              # Start server in one terminal
 * node scripts/api-client.mjs  # Run this in another
 */

const API_URL = process.env.API_URL || "http://localhost:3000";

/**
 * Fetch utility with error handling
 */
async function apiCall(endpoint, method = "GET", body = null) {
  const url = `${API_URL}${endpoint}`;
  console.log(`\n► ${method} ${endpoint}`);

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      console.error("✗ Error:", data.error || data.message);
      return null;
    }

    console.log("✓ Success");
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error("✗ Network error:", error.message);
    return null;
  }
}

/**
 * Test: Health Check
 */
async function testHealthCheck() {
  console.log("\n═══════════════════════════════");
  console.log("Test 1: Health Check");
  console.log("═══════════════════════════════");
  await apiCall("/api/health");
}

/**
 * Test: Get Catalog
 */
async function testGetCatalog() {
  console.log("\n═══════════════════════════════");
  console.log("Test 2: Get Catalog");
  console.log("═══════════════════════════════");
  await apiCall("/api/catalog");
}

/**
 * Test: Get Configuration
 */
async function testGetConfig() {
  console.log("\n═══════════════════════════════");
  console.log("Test 3: Get Configuration");
  console.log("═══════════════════════════════");
  await apiCall("/api/config");
}

/**
 * Test: Ingest a Sample Document
 */
async function testIngestDocument() {
  console.log("\n═══════════════════════════════");
  console.log("Test 4: Ingest Document");
  console.log("═══════════════════════════════");

  const sampleContent = `
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
`;

  const result = await apiCall("/api/ingest", "POST", {
    filename: "wealth-pro-ii-sample.md",
    content: sampleContent,
    metadata: {
      productName: "Wealth Pro II",
      jurisdiction: "SG",
      versionLabel: "v1.0",
      documentType: "product summary",
    },
  });

  return result?.documentVersionId;
}

/**
 * Test: Ask a Question
 */
async function testAskQuestion() {
  console.log("\n═══════════════════════════════");
  console.log("Test 5: Ask Question");
  console.log("═══════════════════════════════");

  await apiCall("/api/ask", "POST", {
    question:
      "What are the investment options available in Wealth Pro II and what is their risk profile?",
    topK: 3,
  });
}

/**
 * Test: Ask Multiple Questions (Conversation)
 */
async function testConversation() {
  console.log("\n═══════════════════════════════");
  console.log("Test 6: Ask Follow-up Questions");
  console.log("═══════════════════════════════");

  const sessionId = `session_${Date.now()}`;

  // First question
  console.log("\nQuestion 1: What is the minimum investment?");
  await apiCall("/api/ask", "POST", {
    question: "What is the minimum investment amount?",
    topK: 3,
    sessionId,
  });

  // Follow-up question
  console.log("\nQuestion 2: Can I change my investment option later?");
  await apiCall("/api/ask", "POST", {
    question: "Can I change my investment option after purchase?",
    topK: 3,
    sessionId,
  });
}

/**
 * Test: Error Handling
 */
async function testErrorHandling() {
  console.log("\n═══════════════════════════════");
  console.log("Test 7: Error Handling");
  console.log("═══════════════════════════════");

  console.log("\nTesting missing question parameter:");
  await apiCall("/api/ask", "POST", {});

  console.log("\nTesting invalid endpoint:");
  await apiCall("/api/invalid-endpoint");
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║  PolicyBuddies API Client - Test Suite    ║");
  console.log("║  Server: " + API_URL.padEnd(30) + "║");
  console.log("╚════════════════════════════════════════════╝");

  try {
    // Check if server is running
    console.log("\nConnecting to server...");
    const health = await apiCall("/api/health");

    if (!health) {
      console.error(
        "\n✗ Cannot connect to server. Is it running?\n  Try: npm run api"
      );
      process.exit(1);
    }

    // Run tests
    await testHealthCheck();
    await testGetCatalog();
    await testGetConfig();
    const docId = await testIngestDocument();
    await testAskQuestion();
    await testConversation();
    await testErrorHandling();

    console.log("\n╔════════════════════════════════════════════╗");
    console.log("║  ✓ All tests completed                    ║");
    console.log("╚════════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("✗ Test suite error:", error.message);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);
