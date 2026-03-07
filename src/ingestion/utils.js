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
