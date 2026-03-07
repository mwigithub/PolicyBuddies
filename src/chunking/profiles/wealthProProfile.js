export const WEALTH_PRO_PROFILE_ID = "wealth-pro-ii";

const TABLE_HEADER_PATTERN = /^\[Table\s+[^\]]+\]/i;
const TABLE_STOP_PATTERN = /^\[(Table|Page)\s+[^\]]+\]/i;
const FORMULA_PATTERN =
  /(=\s*|higher of|lower of|calculated by|multiply(?:ing|ied)?|multiplied by|% of|rate of return|shall be calculated|bonus.*formula|bonus.*calculated)/i;
const CRITICAL_ILLNESS_TABLE_PATTERN =
  /table\s*1\s*:\s*40\s*covered\s*critical\s*illnesses/i;

export function chunkTextByLines(content, linesPerChunk = 5) {
  const lines = String(content ?? "").split("\n");
  const chunks = [];
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    const start = i + 1;
    const end = Math.min(lines.length, i + linesPerChunk);
    const text = lines.slice(i, end).join("\n").trim();
    if (!text) {
      continue;
    }
    chunks.push({
      chunkIndex: chunks.length + 1,
      lineStart: start,
      lineEnd: end,
      text,
      kind: "text",
    });
  }
  return chunks;
}

export function chunkTables(content) {
  const lines = String(content ?? "").split("\n");
  const chunks = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!TABLE_HEADER_PATTERN.test(lines[i].trim())) {
      continue;
    }
    const start = i;
    const tableLines = [lines[i].trim()];
    let seenTableRow = false;
    let end = i;
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      const trimmed = line.trim();
      if (TABLE_STOP_PATTERN.test(trimmed)) {
        break;
      }
      if (trimmed.includes("|")) {
        seenTableRow = true;
        tableLines.push(trimmed);
        end = j;
        continue;
      }
      if (!seenTableRow && trimmed) {
        tableLines.push(trimmed);
        end = j;
        continue;
      }
      if (seenTableRow) {
        break;
      }
    }
    const text = tableLines.join("\n").trim();
    if (!text) {
      continue;
    }
    chunks.push({
      chunkIndex: chunks.length + 1,
      lineStart: start + 1,
      lineEnd: end + 1,
      text,
      kind: "table",
    });
  }
  return chunks;
}

export function chunkFormulas(content) {
  const lines = String(content ?? "").split("\n");
  const chunks = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? "";
    if (!line || !FORMULA_PATTERN.test(line)) {
      continue;
    }
    const start = Math.max(0, i - 2);
    const end = Math.min(lines.length - 1, i + 6);
    const text = lines.slice(start, end + 1).join("\n").trim();
    if (!text) {
      continue;
    }
    chunks.push({
      chunkIndex: chunks.length + 1,
      lineStart: start + 1,
      lineEnd: end + 1,
      text,
      kind: "formula",
    });
  }
  return chunks;
}

export function chunkCriticalIllnessList(content) {
  const lines = String(content ?? "").split("\n");
  const chunks = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!CRITICAL_ILLNESS_TABLE_PATTERN.test(lines[i])) {
      continue;
    }
    const start = i;
    const end = Math.min(lines.length - 1, i + 180);
    const text = lines.slice(start, end + 1).join("\n").trim();
    if (!text) {
      continue;
    }
    chunks.push({
      chunkIndex: chunks.length + 1,
      lineStart: start + 1,
      lineEnd: end + 1,
      text,
      kind: "critical_illness_list",
    });
  }
  return chunks;
}

