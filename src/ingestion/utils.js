import { createHash } from "node:crypto";

export function nowIso() {
  return new Date().toISOString();
}

export function generateRunId() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `ING-${stamp}-${suffix}`;
}

export function generateId(prefix) {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${suffix}`;
}

export function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

// ─── Section-aware chunking ───────────────────────────────────────────────────

// Markers emitted by pdf_to_text.py
const PAGE_MARKER_RE = /^\[(?:Page \d+|Table \d+\.\d+|Detected Tables: \d+)\]$/;

// Common insurance policy section headings — conservative list to avoid
// false positives (short sentences that happen to start with these words).
const SECTION_HEADING_RE =
  /^(?:Waiting Period|Basic Plan|Rider(?:\s+Description)?|Policy Benefit|Death Benefit|Sum Assured|Exclusion|Definition|Premium|Surrender|Bonus|Dividend|Guarantee|Important Noti(?:ce|ce)|Important Note|Declaration|Acknowledgement|Coverage|Maturity|Critical Illness|Policy Owner|Disability|Accidental|Investment|Fund|Charges?|Fees?|Top.?[Uu]p|Withdrawal|Free Look|Nomination|Assignment|Reinstatement|Claims?)[^\n]{0,60}$/i;

function isHeadingLine(line) {
  const t = line.trim();
  if (!t) return false;
  if (PAGE_MARKER_RE.test(t)) return true;
  // Heading: short, no table prefix, no trailing period (not a sentence end)
  return (
    t.length <= 70 &&
    !t.startsWith("|") &&
    !t.startsWith("-") &&
    !t.endsWith(".") &&
    !t.endsWith(",") &&
    SECTION_HEADING_RE.test(t)
  );
}

// Split a page block into sub-blocks at heading boundaries.
// Tables (markdown pipe rows) are never split.
function splitBlockAtHeadings(text) {
  const lines = text.split("\n");
  const blocks = [];
  let current = [];
  let inTable = false;

  for (const line of lines) {
    const t = line.trim();
    const isTableRow = t.startsWith("|");

    if (isTableRow) {
      inTable = true;
      current.push(line);
      continue;
    }

    if (inTable && t) {
      inTable = false;
    }

    if (!inTable && current.length > 0 && isHeadingLine(t)) {
      const block = current.join("\n").trim();
      if (block) blocks.push(block);
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    const block = current.join("\n").trim();
    if (block) blocks.push(block);
  }

  return blocks.filter((b) => b.trim());
}

// Top-level split at [Page N] boundaries, then at headings within each page.
function splitIntoSectionBlocks(text) {
  // Split keeping the [Page N] marker with the block that follows it
  const pageBlocks = text.split(/(?=\[Page \d+\])/);
  const blocks = [];
  for (const block of pageBlocks) {
    if (!block.trim()) continue;
    blocks.push(...splitBlockAtHeadings(block));
  }
  return blocks;
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function chunkBySections(
  text,
  { minTokens = 200, targetTokens = 650, maxTokens = 800, overlapTokens = 120 } = {},
) {
  const sections = splitIntoSectionBlocks(text);
  const chunks = [];
  let buffer = "";

  const flush = () => {
    const b = buffer.trim();
    if (b) chunks.push(b);
    buffer = "";
  };

  for (const section of sections) {
    const secWords = countWords(section);
    const bufWords = countWords(buffer);

    // Section alone is oversized — sub-chunk it with token splitter
    if (secWords > maxTokens) {
      const combined = buffer ? `${buffer}\n\n${section}` : section;
      buffer = "";
      const sub = chunkByTokens(combined, {
        minTokens,
        targetTokens,
        maxTokens,
        overlapTokens,
      });
      if (sub.length > 1) {
        for (const s of sub.slice(0, -1)) chunks.push(s);
        buffer = sub[sub.length - 1];
      } else {
        buffer = sub[0] ?? "";
      }
      continue;
    }

    // Adding section would overflow target — flush first
    if (bufWords > 0 && bufWords + secWords > targetTokens) {
      if (bufWords >= minTokens) flush();
    }

    buffer = buffer ? `${buffer}\n\n${section}` : section;
  }

  flush();
  return chunks;
}

// ─── Line-based chunking ──────────────────────────────────────────────────────

function chunkByLines(text, linesPerChunk) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const chunks = [];
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    chunks.push(lines.slice(i, i + linesPerChunk).join("\n"));
  }
  return chunks;
}

function chunkByTokens(text, { minTokens, targetTokens, maxTokens, overlapTokens }) {
  const tokens = text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return [];
  }

  const chunks = [];
  let index = 0;
  while (index < tokens.length) {
    const remaining = tokens.length - index;
    let windowSize = Math.min(maxTokens, remaining);
    if (windowSize < minTokens && remaining > minTokens) {
      windowSize = minTokens;
    }
    if (windowSize > targetTokens && remaining > maxTokens) {
      windowSize = targetTokens;
    }

    chunks.push(tokens.slice(index, index + windowSize).join(" "));

    if (index + windowSize >= tokens.length) {
      break;
    }
    const step = Math.max(1, windowSize - overlapTokens);
    index += step;
  }

  return chunks;
}

export function chunkText(
  text,
  {
    mode = "line",
    linesPerChunk = 5,
    minTokens = 500,
    targetTokens = 650,
    maxTokens = 800,
    overlapTokens = 120,
  } = {},
) {
  if (mode === "section") {
    return chunkBySections(text, {
      minTokens,
      targetTokens,
      maxTokens,
      overlapTokens,
    });
  }
  if (mode === "token") {
    return chunkByTokens(text, {
      minTokens,
      targetTokens,
      maxTokens,
      overlapTokens,
    });
  }
  return chunkByLines(text, linesPerChunk);
}
