import { evaluateFormula } from "../../simulation/formulaEngine.js";
import { findFormula, loadFormulaBundle } from "../../simulation/formulaRegistry.js";

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeMatchText(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueStrings(values) {
  const set = new Set();
  for (const value of values) {
    const normalized = normalizeMatchText(value);
    if (!normalized) {
      continue;
    }
    set.add(normalized);
  }
  return [...set];
}

function findMappedProductKeys(text, mappings) {
  const normalizedText = normalizeMatchText(text);
  if (!normalizedText || !Array.isArray(mappings) || mappings.length === 0) {
    return [];
  }
  const hits = new Set();
  for (const item of mappings) {
    const productKey = String(item.productKey ?? "").trim();
    if (!productKey) {
      continue;
    }
    const aliases = uniqueStrings([...(item.productNames ?? []), ...(item.aliases ?? [])]);
    if (
      aliases.some(
        (alias) =>
          normalizedText === alias ||
          normalizedText.includes(` ${alias} `) ||
          normalizedText.startsWith(`${alias} `) ||
          normalizedText.endsWith(` ${alias}`),
      )
    ) {
      hits.add(productKey);
    }
  }
  return [...hits];
}

function resolveFormulaProductSelection({ question, evidence, config }) {
  const routing = config.formulaProductRouting ?? {};
  const mappings = Array.isArray(routing.mappings) ? routing.mappings : [];
  const evidenceProductNames = uniqueStrings(
    (Array.isArray(evidence) ? evidence : [])
      .map((item) => item.productName)
      .filter(Boolean),
  );
  const questionMatches = findMappedProductKeys(question, mappings);
  if (questionMatches.length === 1) {
    return { productKey: questionMatches[0], source: "question" };
  }
  if (questionMatches.length > 1) {
    return {
      productKey: null,
      source: "question",
      reason: "ambiguous",
      candidates: questionMatches,
    };
  }

  const evidenceMatches = new Set();
  for (const name of evidenceProductNames) {
    for (const productKey of findMappedProductKeys(name, mappings)) {
      evidenceMatches.add(productKey);
    }
  }
  if (evidenceMatches.size === 1) {
    return { productKey: [...evidenceMatches][0], source: "evidence" };
  }
  if (evidenceMatches.size > 1) {
    return {
      productKey: null,
      source: "evidence",
      reason: "ambiguous",
      candidates: [...evidenceMatches],
    };
  }

  const configuredKey = String(config.formulaProductKey ?? "").trim();
  if (configuredKey) {
    return { productKey: configuredKey, source: "runtime-config" };
  }

  const defaultKey = String(routing.defaultProductKey ?? "").trim();
  if (defaultKey) {
    return { productKey: defaultKey, source: "routing-default" };
  }

  return { productKey: null, source: "none" };
}

function tokenize(text) {
  return normalize(text)
    .split(/\W+/)
    .filter((token) => token.length >= 3);
}

function uniqueLines(evidence) {
  const seen = new Set();
  const output = [];
  for (const item of evidence) {
    for (const line of item.text.split("\n").map((line) => line.trim()).filter(Boolean)) {
      const key = normalize(line);
      if (!seen.has(key)) {
        seen.add(key);
        output.push(line);
      }
    }
  }
  return output;
}

function rankLines(question, lines) {
  const qTokens = tokenize(question);
  return lines
    .map((line) => {
      const tokens = new Set(tokenize(line));
      let overlap = 0;
      for (const token of qTokens) {
        if (tokens.has(token)) {
          overlap += 1;
        }
      }
      const compact = line.replace(/\s+/g, " ").trim();
      const isSeparator = /^\|\s*-+/.test(compact);
      const isGenericTableTitle =
        compact.toLowerCase() === "| policy illustration | | | | | | |" ||
        compact.toLowerCase() === "| policy illustration | | | | | |";
      const hasNumbers = /\d/.test(compact);
      const numericDensity = (compact.match(/\d/g) ?? []).length;
      return {
        line,
        overlap,
        isMetadata: line.includes(":"),
        isSeparator,
        isGenericTableTitle,
        hasNumbers,
        numericDensity,
      };
    })
    .sort((a, b) => {
      if (b.overlap !== a.overlap) {
        return b.overlap - a.overlap;
      }
      if (a.isSeparator !== b.isSeparator) {
        return Number(a.isSeparator) - Number(b.isSeparator);
      }
      if (a.isGenericTableTitle !== b.isGenericTableTitle) {
        return Number(a.isGenericTableTitle) - Number(b.isGenericTableTitle);
      }
      if (a.hasNumbers !== b.hasNumbers) {
        return Number(b.hasNumbers) - Number(a.hasNumbers);
      }
      if (b.numericDensity !== a.numericDensity) {
        return b.numericDensity - a.numericDensity;
      }
      if (a.isMetadata !== b.isMetadata) {
        return Number(a.isMetadata) - Number(b.isMetadata);
      }
      return 0;
    });
}

function extractTableExcerpt(evidence, maxLines = 10) {
  const tableChunk = evidence.find(
    (item) => item.chunkKind === "table" || item.text.includes("|"),
  );
  if (!tableChunk) {
    return [];
  }

  return tableChunk.text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && (line.startsWith("[Table") || line.includes("|")))
    .slice(0, maxLines);
}

function parseNumber(value) {
  const cleaned = String(value ?? "").replace(/,/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function detectBonusType(question) {
  const q = normalize(question);
  if (q.includes("loyalty bonus")) {
    return "loyalty";
  }
  if (q.includes("performance investment bonus")) {
    return "performance";
  }
  if (q.includes("power-up bonus") || q.includes("power up bonus")) {
    return "power-up";
  }
  if (q.includes("initial bonus")) {
    return "initial";
  }
  return null;
}

function detectInputAmount(question) {
  const match = String(question).match(
    /(?:account value|accumulation units account value|initial units account value|value|amount)\D*([\d,]+(?:\.\d+)?)/i,
  );
  if (match) {
    return parseNumber(match[1]);
  }
  const fallback = String(question).match(/\b([\d,]{4,}(?:\.\d+)?)\b/);
  return fallback ? parseNumber(fallback[1]) : null;
}

function detectPolicyYear(question) {
  const ordinal = String(question ?? "").match(/\b(\d{1,2})(?:st|nd|rd|th)\s+year\b/i);
  if (ordinal) {
    return Number(ordinal[1]);
  }
  const fallback = String(question ?? "").match(/\byear\D{0,6}(\d{1,2})\b/i);
  return fallback ? Number(fallback[1]) : null;
}

function resolveFormulaName(bonusType) {
  if (bonusType === "loyalty") {
    return "loyalty bonus";
  }
  if (bonusType === "performance") {
    return "performance investment bonus";
  }
  if (bonusType === "power-up") {
    return "power-up bonus";
  }
  if (bonusType === "initial") {
    return "initial bonus";
  }
  return null;
}

function mapFormulaInputs(bonusType, inputAmount) {
  if (bonusType === "power-up" || bonusType === "initial") {
    return {
      initial_units_account_value: inputAmount,
    };
  }
  return {
    accumulation_units_account_value: inputAmount,
  };
}

function detectBonusRate(bonusType, evidence) {
  const metadataRows = parseBonusMetadataRows(evidence);
  const metadataRow = metadataRows.find((row) =>
    normalize(row.bonusType).includes(bonusType),
  );
  if (metadataRow) {
    const parsedRate = parseNumber(String(metadataRow.rate).replace("%", ""));
    if (parsedRate !== null) {
      return parsedRate / 100;
    }
  }

  const key =
    bonusType === "loyalty"
      ? "loyalty bonus"
      : bonusType === "performance"
        ? "performance investment bonus"
        : bonusType === "power-up"
          ? "power-up bonus"
          : bonusType === "initial"
            ? "initial bonus"
            : null;

  if (!key) {
    return null;
  }

  for (const item of evidence) {
    const lines = item.text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!normalize(line).includes(key)) {
        continue;
      }
      const window = lines.slice(i, Math.min(lines.length, i + 8)).join(" ");
      const rateMatch = window.match(/(\d+(?:\.\d+)?)\s*%/);
      if (rateMatch) {
        const rate = Number(rateMatch[1]) / 100;
        if (Number.isFinite(rate)) {
          return rate;
        }
      }
    }
  }

  return null;
}

function tryComputeBonus(question, evidence, formulaRuntime = null) {
  const bonusType = detectBonusType(question);
  if (!bonusType) {
    return null;
  }
  const inputAmount = detectInputAmount(question);
  if (inputAmount === null) {
    return {
      bonusType,
      status: "missing_input",
      message:
        "Computation requires an input amount. Example: loyalty bonus for account value 100000",
    };
  }

  const formulaName = resolveFormulaName(bonusType);
  const formulaDefinition = formulaName
    ? findFormula({
      formulas: formulaRuntime?.formulas ?? [],
      nameContains: formulaName,
      category: "bonus",
    })
    : null;
  if (formulaDefinition) {
    const computed = evaluateFormula({
      formulaDefinition,
      inputs: mapFormulaInputs(bonusType, inputAmount),
      policyYear: detectPolicyYear(question),
    });
    if (computed.status === "computed") {
      const traceExpression = computed.trace?.find((item) => item.step === "evaluate_expression");
      return {
        bonusType,
        status: "computed",
        rate: null,
        inputAmount,
        result: computed.result,
        source: "formula-engine",
        expression: traceExpression?.compiledExpression ?? formulaDefinition.expression,
      };
    }
  }

  const rate = detectBonusRate(bonusType, evidence);
  if (rate === null) {
    return {
      bonusType,
      status: "missing_rate",
      message: "Unable to locate bonus rate from retrieved evidence.",
    };
  }

  return {
    bonusType,
    status: "computed",
    rate,
    inputAmount,
    result: Number((inputAmount * rate).toFixed(2)),
  };
}

function parseBonusMetadataRows(evidence) {
  const rows = [];
  for (const item of evidence) {
    if (item.chunkKind !== "metadata") {
      continue;
    }
    const fields = {};
    for (const line of item.text.split("\n")) {
      const [rawKey, ...rest] = line.split(":");
      if (!rawKey || rest.length === 0) {
        continue;
      }
      const key = normalize(rawKey);
      const value = rest.join(":").trim();
      fields[key] = value;
    }
    if (fields["bonus type"]) {
      rows.push({
        bonusType: fields["bonus type"],
        formula: fields["formula"] ?? "to be defined",
        rate: fields["rate"] ?? "to be defined",
        eligibleFrom: fields["eligible from"] ?? "to be defined",
        eligibleTo: fields["eligible to"] ?? "to be defined",
        confidence: fields["confidence"] ?? "unknown",
      });
    }
  }
  return rows;
}

function parseRiderMetadataRows(evidence) {
  const rows = [];
  for (const item of evidence) {
    if (item.chunkKind !== "metadata") {
      continue;
    }
    const fields = {};
    for (const line of item.text.split("\n")) {
      const [rawKey, ...rest] = line.split(":");
      if (!rawKey || rest.length === 0) {
        continue;
      }
      fields[normalize(rawKey)] = rest.join(":").trim();
    }
    if (!fields["rider name"]) {
      continue;
    }
    rows.push({
      riderName: fields["rider name"],
      benefitType: fields["benefit type"] ?? "to be defined",
      coverageTriggers: fields["coverage triggers"] ?? "to be defined",
      coverageTerm: fields["coverage term"] ?? "to be defined",
      hasSurrenderValue: fields["has surrender value"] ?? "to be defined",
      premiumRateGuarantee:
        fields["premium rate guarantee"] ?? "to be defined",
      benefitSummary: fields["benefit summary"] ?? "to be defined",
      confidence: fields["confidence"] ?? "unknown",
    });
  }
  return rows;
}

function parseCriticalIllnessItems(evidence) {
  const numbered = new Map();
  for (const item of evidence) {
    if (
      item.chunkKind !== "critical_illness_list" &&
      item.chunkKind !== "text" &&
      item.chunkKind !== "table"
    ) {
      continue;
    }
    const lines = String(item.text ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    let pendingNumber = null;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const explicit = line.match(/^(\d{1,2})\.\s*(.+)$/);
      if (explicit) {
        const num = Number(explicit[1]);
        const value = explicit[2].trim();
        if (num >= 1 && num <= 40 && value && !numbered.has(num)) {
          numbered.set(num, value);
        }
        pendingNumber = null;
        continue;
      }
      const numberOnly = line.match(/^(\d{1,2})\.$/);
      if (numberOnly) {
        const num = Number(numberOnly[1]);
        pendingNumber = num >= 1 && num <= 40 ? num : null;
        continue;
      }
      if (pendingNumber && !numbered.has(pendingNumber) && !/^\d{1,2}\.?$/.test(line)) {
        numbered.set(pendingNumber, line);
        pendingNumber = null;
      }
    }
  }
  return [...numbered.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, name]) => ({ number, name }));
}

function synthesizeCriticalIllnessListAnswer(question, evidence) {
  const asksList =
    /\b(40|forty).*(critical illness(?:es)?|covered critical illnesses?)|critical illness(?:es)?\s+list|critical illness(?:es)?.*covered.*rider|critical illness(?:es)?.*rider|critical+ illness(?:es)?.*rider|what are (those|they)\b/i.test(
      String(question ?? ""),
    );
  if (!asksList) {
    return null;
  }
  const items = parseCriticalIllnessItems(evidence);
  if (items.length === 0) {
    return "Direct Answer: information not found in retrieved evidence for the covered critical illness list.";
  }
  const lines = [
    `Direct Answer: Retrieved ${items.length} covered critical illnesses from available evidence.`,
    "Evidence Highlights:",
    ...items.map((item) => `- ${item.number}. ${item.name}`),
  ];
  if (items.length < 40) {
    lines.push(
      `- Note: Retrieved partial list (${items.length}/40) from current evidence chunks.`,
    );
  }
  return lines.join("\n");
}

function synthesizeRiderBenefitAnswer(question, evidence) {
  const isRiderQuestion =
    /\benhanced.*rider|rider benefit|rider coverage|benefit.*rider|what.*rider|waiver of premium|TPD|critical illness\b/i.test(
      String(question ?? ""),
    );
  if (!isRiderQuestion) {
    return null;
  }

  const rows = parseRiderMetadataRows(evidence);
  if (rows.length === 0) {
    return "Direct Answer: information not found in retrieved evidence for rider benefits.";
  }
  const normalizedQuestion = normalize(question);
  const exact = rows.find((row) =>
    normalizedQuestion.includes(normalize(row.riderName)),
  );
  const enhanced = rows.find((row) =>
    /enhanced/i.test(row.riderName ?? ""),
  );
  const selected = exact ?? enhanced ?? rows[0];
  const triggers =
    selected.coverageTriggers && selected.coverageTriggers !== "to be defined"
      ? selected.coverageTriggers
      : "to be defined";

  return [
    `Direct Answer: ${selected.riderName} provides ${selected.benefitType}.`,
    "Evidence Highlights:",
    `- Coverage triggers: ${triggers}`,
    `- Coverage term: ${selected.coverageTerm}`,
    `- Has surrender value: ${selected.hasSurrenderValue}`,
    `- Premium rate guarantee: ${selected.premiumRateGuarantee}`,
    selected.benefitSummary && selected.benefitSummary !== "to be defined"
      ? `- Benefit summary: ${selected.benefitSummary}`
      : "- Benefit summary: to be defined",
  ].join("\n");
}

function synthesizeSumAssuredAnswer(question, evidence) {
  const asks = /\bsum assured|basic sum assured\b/i.test(String(question ?? ""));
  if (!asks) {
    return null;
  }
  for (const item of evidence) {
    const lines = String(item.text ?? "").split("\n");
    const line = lines.find((value) => /^\s*Sum Assured\s*:/i.test(value));
    if (!line) {
      continue;
    }
    const value = line.split(":").slice(1).join(":").trim();
    const currencyLine = lines.find((entry) => /^\s*Currency\s*:/i.test(entry));
    const currency = currencyLine
      ? currencyLine.split(":").slice(1).join(":").trim()
      : null;
    if (value && value !== "to be defined") {
      return `Direct Answer: Sum assured is ${value}${currency && currency !== "to be defined" ? ` ${currency}` : ""}.`;
    }
  }
  for (const item of evidence) {
    const text = String(item.text ?? "");
    const match = text.match(
      /(?:basic\s+)?sum assured[^0-9]{0,30}([\d,]+(?:\.\d+)?)/i,
    );
    if (match) {
      return `Direct Answer: Sum assured is ${match[1]}.`;
    }
  }
  return "Direct Answer: information not found in retrieved evidence for sum assured.";
}

function synthesizeWaitingPeriodAnswer(question, evidence) {
  const asks = /\bwaiting period|deferment period\b/i.test(String(question ?? ""));
  if (!asks) {
    return null;
  }
  for (const item of evidence) {
    const lines = String(item.text ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const metadataDays = lines.find((line) => /^Waiting Period Days\s*:/i.test(line));
    if (metadataDays && !/to be defined/i.test(metadataDays)) {
      const days = metadataDays.split(":").slice(1).join(":").trim();
      const conditionsLine = lines.find((line) =>
        /^Waiting Period Conditions\s*:/i.test(line),
      );
      const scopeLine = lines.find((line) => /^Waiting Period Scope\s*:/i.test(line));
      return [
        `Direct Answer: Waiting period is ${days} days.`,
        "Evidence Highlights:",
        scopeLine
          ? `- ${scopeLine.replace(/^Waiting Period Scope\s*:\s*/i, "").trim()}`
          : "- Waiting period scope not explicitly captured.",
        conditionsLine
          ? `- Conditions: ${conditionsLine.replace(/^Waiting Period Conditions\s*:\s*/i, "").trim()}`
          : "- Conditions: to be defined.",
      ].join("\n");
    }
    const hit = lines.find((line) => {
      const compact = line.replace(/\s+/g, " ").trim();
      if (/^waiting period$/i.test(compact)) {
        return false;
      }
      return /within\s+\d+\s+days.*coverage commencement date|waiting period|deferment period/i.test(
        compact,
      );
    });
    if (hit) {
      return `Direct Answer: ${hit.replace(/\s+/g, " ").trim()}`;
    }
  }
  return "Direct Answer: information not found in retrieved evidence for waiting period.";
}

function parsePremiumPaidRowsFromEvidence(evidence) {
  const entries = new Map();
  const add = (year, amount, age = null) => {
    if (!Number.isFinite(year) || !Number.isFinite(amount) || entries.has(year)) {
      return;
    }
    entries.set(year, { year, amount, age });
  };

  for (const item of evidence) {
    const text = String(item.text ?? "");
    const lines = text.split("\n").map((line) => line.trim());

    // Preferred: metadata-enriched rows.
    for (const line of lines) {
      const metadataMatch = line.match(
        /^Policy Year\s+(\d+)\s*:\s*([\d,]+(?:\.\d+)?)(?:\s+\(Age NB\s+(\d+)\))?/i,
      );
      if (metadataMatch) {
        add(
          Number(metadataMatch[1]),
          parseNumber(metadataMatch[2]),
          metadataMatch[3] ? Number(metadataMatch[3]) : null,
        );
      }
    }

    // Markdown table rows where first two columns are flattened lists.
    for (const line of lines) {
      if (!line.startsWith("|") || !/\d+\s*\/\s*\d+/.test(line)) {
        continue;
      }
      const cells = line
        .split("|")
        .map((value) => value.trim())
        .filter(Boolean);
      if (cells.length < 2) {
        continue;
      }
      const yearAgeMatches = [...cells[0].matchAll(/(\d+)\s*\/\s*(\d+)/g)];
      const premiumMatches = [...cells[1].matchAll(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g)];
      const count = Math.min(yearAgeMatches.length, premiumMatches.length);
      for (let i = 0; i < count; i += 1) {
        add(
          Number(yearAgeMatches[i][1]),
          parseNumber(premiumMatches[i][1]),
          Number(yearAgeMatches[i][2]),
        );
      }
    }

    // Vertical layout rows: "10/ 27" followed by "36,000".
    const verticalRows = [];
    for (let i = 0; i < lines.length; i += 1) {
      const yearAge = lines[i].match(/^(\d+)\s*\/\s*(\d+)\s*$/);
      if (!yearAge) {
        continue;
      }
      const nextAmount = lines[i + 1]?.match(/^(\d{1,3}(?:,\d{3})*(?:\.\d+)?)$/);
      if (!nextAmount) {
        continue;
      }
      verticalRows.push({
        year: Number(yearAge[1]),
        age: Number(yearAge[2]),
        amount: parseNumber(nextAmount[1]),
      });
    }
    for (const row of verticalRows) {
      add(row.year, row.amount, row.age);
    }
  }

  return [...entries.values()].sort((a, b) => a.year - b.year);
}

function synthesizePremiumPaidAnswer(question, evidence) {
  const asksPremiumPaid =
    /\b(total )?premiums? paid|paid to-?date\b/i.test(String(question ?? "")) &&
    /\byear\b/i.test(String(question ?? ""));
  if (!asksPremiumPaid) {
    return null;
  }
  const year = detectPolicyYear(question);
  if (!year) {
    return "Direct Answer: information not found in retrieved evidence for total premium paid.";
  }

  const parsedRows = parsePremiumPaidRowsFromEvidence(evidence);
  const exact = parsedRows.find((row) => row.year === year);
  if (exact) {
    const amount = Number.isFinite(exact.amount)
      ? exact.amount.toLocaleString("en-US")
      : String(exact.amount);
    return `Direct Answer: Total premium paid at policy year ${year} is ${amount}.`;
  }

  return `Direct Answer: information not found in retrieved evidence for total premium paid at policy year ${year}.`;
}

function synthesizePlanNameAnswer(question, evidence) {
  const isPlanNameQuestion = /\bbasic plan|plan name|name of (the )?plan|plan for\b/i.test(
    String(question ?? ""),
  );
  if (!isPlanNameQuestion) {
    return null;
  }

  for (const item of evidence) {
    const lines = String(item.text ?? "").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const linePlanMatch = line.match(
        /^\s*([A-Z][A-Za-z0-9 ()/&-]{2,80}?)\s+is\s+(?:a|an)\b[\s\S]*\bplan\b/i,
      );
      if (linePlanMatch) {
        const candidate = linePlanMatch[1].trim();
        if (!/^(the|this|it)$/i.test(candidate)) {
          return `Direct Answer: Plan is ${candidate}.`;
        }
      }
      const metadataMatch = line.match(/^\s*Plan Name\s*:\s*(.+)\s*$/i);
      if (metadataMatch) {
        return `Direct Answer: Basic plan is ${metadataMatch[1].trim()}.`;
      }
      const inlineMatch = line.match(/^\s*Basic Plan\s*:\s*(.+)\s*$/i);
      if (inlineMatch) {
        return `Direct Answer: Basic plan is ${inlineMatch[1].trim()}.`;
      }
      if (/^\s*Basic Plan\s*$/i.test(line)) {
        const next = String(lines[i + 1] ?? "").trim();
        const next2 = String(lines[i + 2] ?? "").trim();
        const nextInline = next.match(/^:\s*(.+)\s*$/);
        if (nextInline) {
          return `Direct Answer: Basic plan is ${nextInline[1].trim()}.`;
        }
        if (next === ":" && next2) {
          return `Direct Answer: Basic plan is ${next2}.`;
        }
      }
    }
  }

  return "Direct Answer: information not found";
}

function synthesizeEligibleBonusList(question, evidence) {
  if (!/\beligible|eligibility|bonus list|list of bonus|bonus\b/i.test(question)) {
    return null;
  }
  const rows = parseBonusMetadataRows(evidence);
  if (rows.length === 0) {
    return null;
  }
  const unique = [];
  const seen = new Set();
  for (const row of rows) {
    const key = normalize(row.bonusType);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(row);
  }

  const lines = [
    "Direct Answer: Eligible bonus list from available metadata:",
    "Evidence Highlights:",
    ...unique.map(
      (row) =>
        `- ${row.bonusType}: rate=${row.rate}, eligibleFrom=${row.eligibleFrom}, eligibleTo=${row.eligibleTo}, formula=${row.formula}, confidence=${row.confidence}`,
    ),
  ];
  return lines.join("\n");
}

function shorten(line, maxLength = 180) {
  const compact = line.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength - 3)}...`;
}

function tableReferences(evidence) {
  const refs = new Set();
  for (const item of evidence) {
    const first = item.text.split("\n")[0]?.trim() ?? "";
    if (first.startsWith("[Table")) {
      refs.add(first);
    }
  }
  return [...refs];
}

function looksLikeDataCell(cell) {
  const trimmed = cell.trim();
  if (!trimmed) {
    return false;
  }
  if (/[a-z]/i.test(trimmed)) {
    return false;
  }
  return /\d/.test(trimmed);
}

function summarizeNumberSeries(cell) {
  const values = [...cell.matchAll(/\d[\d,]*/g)].map((match) => match[0]);
  if (values.length === 0) {
    return null;
  }
  if (values.length <= 6) {
    return values.join(", ");
  }
  return `${values.slice(0, 3).join(", ")} ... ${values.slice(-3).join(", ")}`;
}

function parseTableInsight(question, evidence) {
  const tableChunk = evidence.find((item) => item.chunkKind === "table");
  if (!tableChunk) {
    return null;
  }

  const rows = tableChunk.text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("|") && !/^\|\s*-+/.test(line));

  const dataRow = rows.find((line) => {
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);
    return cells.length >= 4 && cells.every((cell) => looksLikeDataCell(cell));
  });

  if (!dataRow) {
    return null;
  }

  const cells = dataRow
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
  if (cells.length < 4) {
    return null;
  }

  const lowerQ = normalize(question);
  const asks8 = lowerQ.includes("8%");
  const asks4 = lowerQ.includes("4%");
  const asksTotal = lowerQ.includes("total");
  const defaultIndex = cells.length - 1;

  let targetIndex = defaultIndex;
  if (asks8 && asksTotal && cells.length >= 7) {
    targetIndex = 6;
  } else if (asks8 && cells.length >= 6) {
    targetIndex = 5;
  } else if (asks4 && asksTotal && cells.length >= 5) {
    targetIndex = 4;
  } else if (asks4 && cells.length >= 4) {
    targetIndex = 3;
  }

  const yearsSummary = summarizeNumberSeries(cells[0]);
  const valueSummary = summarizeNumberSeries(cells[targetIndex]);
  if (!yearsSummary || !valueSummary) {
    return null;
  }

  return `Projected values across policy years ${yearsSummary}: ${valueSummary}`;
}

function synthesizeDirectAnswer(question, rankedLines) {
  const strong = rankedLines.filter(
    (item) => item.overlap > 0 && !item.isSeparator && !item.isGenericTableTitle,
  );
  const selected = (strong.length > 0 ? strong : rankedLines).slice(0, 2);
  if (selected.length === 0) {
    return "information not found";
  }
  const parts = selected.map((item) => shorten(item.line, 160));
  return `${parts.join(" ")}.`;
}

export function createDefaultConversationProvider(config = {}) {
  const provider = config.provider ?? "default-conversation-provider";
  const model = config.model ?? "stub-conversation-v1";
  const formulaRegistryDir = config.formulaRegistryDir ?? "metadata/runtime/formulas";
  const formulaRuntimeCache = new Map();

  function getFormulaRuntime(productKey) {
    const normalizedKey = String(productKey ?? "").trim();
    if (!normalizedKey) {
      return { filePath: null, formulas: [] };
    }
    if (!formulaRuntimeCache.has(normalizedKey)) {
      formulaRuntimeCache.set(
        normalizedKey,
        loadFormulaBundle({
          registryDir: formulaRegistryDir,
          productKey: normalizedKey,
        }),
      );
    }
    return formulaRuntimeCache.get(normalizedKey);
  }

  return {
    provider,
    model,
    synthesizeAnswer({ question, evidence }) {
      const criticalIllnessAnswer = synthesizeCriticalIllnessListAnswer(
        question,
        evidence,
      );
      if (criticalIllnessAnswer) {
        return criticalIllnessAnswer;
      }
      const sumAssuredAnswer = synthesizeSumAssuredAnswer(question, evidence);
      if (sumAssuredAnswer) {
        return sumAssuredAnswer;
      }
      const waitingPeriodAnswer = synthesizeWaitingPeriodAnswer(question, evidence);
      if (waitingPeriodAnswer) {
        return waitingPeriodAnswer;
      }
      const premiumPaidAnswer = synthesizePremiumPaidAnswer(question, evidence);
      if (premiumPaidAnswer) {
        return premiumPaidAnswer;
      }
      const planNameAnswer = synthesizePlanNameAnswer(question, evidence);
      if (planNameAnswer) {
        return planNameAnswer;
      }
      const riderAnswer = synthesizeRiderBenefitAnswer(question, evidence);
      if (riderAnswer) {
        return riderAnswer;
      }

      const bonusRequested = Boolean(detectBonusType(question));
      const formulaProduct = resolveFormulaProductSelection({
        question,
        evidence,
        config,
      });
      if (bonusRequested && formulaProduct.reason === "ambiguous") {
        return `Direct Answer: Multiple products were detected (${formulaProduct.candidates.join(", ")}). Please specify product name before bonus computation.`;
      }
      const formulaRuntime = getFormulaRuntime(formulaProduct.productKey);
      const bonusComputation = tryComputeBonus(question, evidence, formulaRuntime);
      if (bonusComputation?.status === "computed") {
        const bonusLabel = bonusComputation.bonusType;
        const computationLine =
          bonusComputation.rate === null
            ? `Computed ${bonusLabel} bonus = ${bonusComputation.result.toLocaleString()}.`
            : `Computed ${bonusLabel} bonus = ${bonusComputation.inputAmount.toLocaleString()} x ${(bonusComputation.rate * 100).toFixed(2)}% = ${bonusComputation.result.toLocaleString()}.`;
        return [
          `Direct Answer: ${computationLine}`,
          "Evidence Highlights:",
          bonusComputation.source === "formula-engine"
            ? `- Formula engine expression: ${bonusComputation.expression}`
            : "- Formula rate sourced from retrieved product text.",
          "- Result is deterministic and based on provided input amount.",
        ].join("\n");
      }
      if (bonusComputation?.status === "missing_input") {
        return `Direct Answer: ${bonusComputation.message}`;
      }
      if (bonusComputation?.status === "missing_rate") {
        return `Direct Answer: ${bonusComputation.message}`;
      }

      const eligibleBonusAnswer = synthesizeEligibleBonusList(question, evidence);
      if (eligibleBonusAnswer) {
        return eligibleBonusAnswer;
      }

      const lines = uniqueLines(evidence);
      if (lines.length === 0) {
        return "information not found";
      }

      const ranked = rankLines(question, lines);
      const tableInsight = parseTableInsight(question, evidence);
      const directAnswer = tableInsight ?? synthesizeDirectAnswer(question, ranked);
      const topEvidence = ranked
        .filter(
          (item) =>
            item.overlap > 0 && !item.isSeparator && !item.isGenericTableTitle,
        )
        .slice(0, 3);
      const fallbackEvidence = ranked.slice(0, 3);
      const selectedEvidence =
        topEvidence.length > 0 ? topEvidence : fallbackEvidence;
      const evidenceLines = selectedEvidence.map((item) => `- ${shorten(item.line)}`);

      const tableExcerpt = extractTableExcerpt(evidence, 4);
      const tableRefs = tableReferences(evidence);
      const sections = [
        `Direct Answer: ${directAnswer}`,
        "Evidence Highlights:",
        ...evidenceLines,
      ];

      if (tableRefs.length > 0) {
        sections.push(
          `Table Evidence: ${tableRefs.join(", ")}`,
        );
      }

      if (tableExcerpt.length > 0) {
        sections.push("Table Snippet:");
        for (const line of tableExcerpt.map((line) => shorten(line, 180))) {
          sections.push(`- ${line}`);
        }
      }

      return sections.join("\n");
    },
  };
}
