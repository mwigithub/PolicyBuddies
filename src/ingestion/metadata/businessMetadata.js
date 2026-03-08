import { basename } from "node:path";
import { loadMetadataRuntimeConfig } from "../../config/metadataRuntimeConfig.js";
import { resolveMetadataProfile } from "./profiles/index.js";

function normalizeString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function inferProductFamily(productName, unknownValue = "to be defined") {
  const value = String(productName ?? "").toLowerCase();
  if (value.includes("wealth")) {
    return "investment-linked";
  }
  if (value.includes("term")) {
    return "term-life";
  }
  if (value.includes("whole")) {
    return "whole-life";
  }
  return unknownValue;
}

function detectCurrency(text) {
  const upper = String(text ?? "").toUpperCase();
  if (/\bSGD\b|S\$/i.test(upper)) {
    return "SGD";
  }
  if (/\bUSD\b|US\$/i.test(upper)) {
    return "USD";
  }
  if (/\bGBP\b|£/.test(upper)) {
    return "GBP";
  }
  if (/\bEUR\b|€/.test(upper)) {
    return "EUR";
  }
  if (/\bAUD\b/.test(upper)) {
    return "AUD";
  }
  return null;
}

function parseAmount(value) {
  if (!value) {
    return null;
  }
  const cleaned = String(value).replace(/,/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function detectSumAssured(text) {
  const patterns = [
    /basic sum assured[^0-9]{0,30}([\d,]+(?:\.\d+)?)/i,
    /sum assured[^0-9]{0,30}([\d,]+(?:\.\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = String(text ?? "").match(pattern);
    if (match) {
      return parseAmount(match[1]);
    }
  }
  return null;
}

function detectWaitingPeriod(text) {
  const source = String(text ?? "");
  const normalized = source.replace(/\s+/g, " ").trim();
  const sectionMatch = normalized.match(
    /Waiting Period\s+([\s\S]{0,1200}?)(?:Policy Owners[’'] Protection|Important Notes|Declaration and Acknowledgement|$)/i,
  );
  if (!sectionMatch) {
    return {
      exists: false,
      periodDays: null,
      scope: null,
      conditions: [],
      parserConfidence: "low",
      sourceCitation: {
        lineRange: null,
      },
    };
  }

  const sectionText = sectionMatch[1].trim();
  const daysMatch = sectionText.match(/within\s+(\d+)\s+days/i);
  const periodDays = daysMatch ? Number(daysMatch[1]) : null;
  const scopeMatch = sectionText.match(
    /we will not waive[^.]*premium[^.]*\./i,
  );
  const conditionMatches = [
    ...sectionText.matchAll(
      /\(\s*[a-z]\s*\)\s*([^;.\n]+(?:;|\.|$))/gi,
    ),
  ];
  const conditions = conditionMatches
    .map((match) => String(match[1] ?? "").replace(/[;.\s]+$/g, "").trim())
    .filter(Boolean);
  const parserConfidence =
    periodDays !== null && conditions.length > 0
      ? "high"
      : periodDays !== null || conditions.length > 0
        ? "medium"
        : "low";

  return {
    exists: true,
    periodDays,
    scope: scopeMatch ? scopeMatch[0].trim() : null,
    conditions,
    parserConfidence,
    sourceCitation: {
      lineRange: null,
    },
  };
}

function detectPremiumPaidToDateByPolicyYear(text) {
  const lines = String(text ?? "").split("\n");
  const records = [];
  const seenYears = new Set();
  let inTable = false;

  for (const rawLine of lines) {
    const line = String(rawLine ?? "");
    if (
      /End of Policy Year \/ Age NB/i.test(line) &&
      /Total Premiums Paid To-?Date/i.test(line)
    ) {
      inTable = true;
      continue;
    }
    if (!inTable || !line.trim().startsWith("|")) {
      continue;
    }
    if (/---/.test(line)) {
      continue;
    }
    const cells = line
      .split("|")
      .map((value) => value.trim())
      .filter(Boolean);
    if (cells.length < 2) {
      continue;
    }
    const yearAgeCell = cells[0];
    const premiumCell = cells[1];
    if (!/\d+\s*\/\s*\d+/.test(yearAgeCell) || !/\d/.test(premiumCell)) {
      continue;
    }

    const yearAgeMatches = [...yearAgeCell.matchAll(/(\d+)\s*\/\s*(\d+)/g)];
    const premiumMatches = [
      ...premiumCell.matchAll(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g),
    ];
    if (yearAgeMatches.length === 0 || premiumMatches.length === 0) {
      continue;
    }

    const count = Math.min(yearAgeMatches.length, premiumMatches.length);
    for (let i = 0; i < count; i += 1) {
      const policyYear = Number(yearAgeMatches[i][1]);
      if (!Number.isFinite(policyYear) || seenYears.has(policyYear)) {
        continue;
      }
      const ageNextBirthday = Number(yearAgeMatches[i][2]);
      const premiumAmount = parseAmount(premiumMatches[i][1]);
      if (premiumAmount === null) {
        continue;
      }
      seenYears.add(policyYear);
      records.push({
        policyYear,
        ageNextBirthday: Number.isFinite(ageNextBirthday) ? ageNextBirthday : null,
        totalPremiumPaidToDate: premiumAmount,
      });
    }
  }

  records.sort((a, b) => a.policyYear - b.policyYear);
  return {
    records,
    parserConfidence: records.length > 0 ? "high" : "low",
  };
}

function detectProjectionRates(text) {
  const matches = [
    ...String(text ?? "").matchAll(
      /illustrated(?:\s+at)?\s+(\d+(?:\.\d+)?)%\s*(?:investment return|p\.a\.)?/gi,
    ),
  ];
  const rates = new Set();
  for (const match of matches) {
    const num = Number(match[1]);
    if (Number.isFinite(num)) {
      rates.add(num / 100);
    }
  }
  return [...rates].sort((a, b) => a - b);
}

function detectPlanName(text) {
  const source = String(text ?? "");
  const multiline = source.match(/basic plan\s*\n\s*:\s*([^\n]+)/i);
  if (multiline) {
    return normalizeString(multiline[1]);
  }
  const inline = source.match(/basic plan\s*:\s*([^\n]+)/i);
  if (inline) {
    return normalizeString(inline[1]);
  }
  return null;
}

function detectIndustryStandardTerms(text, definitions = []) {
  const lines = String(text ?? "").split("\n");
  const normalizedLines = lines.map((line) => line.toLowerCase());
  const terms = [];

  for (const definition of definitions) {
    const patterns = Array.isArray(definition.patterns)
      ? definition.patterns.filter(Boolean)
      : [];
    let foundIndex = -1;
    let foundPattern = null;

    for (const pattern of patterns) {
      const regex = new RegExp(pattern, "i");
      const index = normalizedLines.findIndex((line) => regex.test(line));
      if (index >= 0) {
        foundIndex = index;
        foundPattern = pattern;
        break;
      }
    }

    terms.push({
      canonicalTerm: definition.canonicalTerm,
      standardLabel: definition.label ?? definition.canonicalTerm,
      aliases: patterns,
      detected: foundIndex >= 0,
      matchedPattern: foundPattern,
      sourceCitation: {
        lineRange: foundIndex >= 0 ? `${foundIndex + 1}-${foundIndex + 1}` : null,
      },
      parserConfidence: foundIndex >= 0 ? "high" : "low",
    });
  }

  const detectedCount = terms.filter((item) => item.detected).length;
  const coverageRatio = terms.length > 0 ? detectedCount / terms.length : 0;
  return {
    terms,
    detectedCount,
    totalCount: terms.length,
    coverageRatio: Number(coverageRatio.toFixed(3)),
  };
}

function detectGuaranteedAndNonGuaranteedBenefits(text) {
  const lower = String(text ?? "").toLowerCase();
  const guaranteed = [];
  const nonGuaranteed = [];

  if (lower.includes("guaranteed death benefit")) {
    guaranteed.push("guaranteed death benefit");
  }
  if (lower.includes("guaranteed")) {
    guaranteed.push("guaranteed benefits (general)");
  }
  if (lower.includes("non-guaranteed policy value")) {
    nonGuaranteed.push("non-guaranteed policy value");
  }
  if (lower.includes("non-guaranteed surrender value")) {
    nonGuaranteed.push("non-guaranteed surrender value");
  }
  if (lower.includes("non-guaranteed")) {
    nonGuaranteed.push("non-guaranteed benefits (general)");
  }

  return {
    guaranteedBenefits: [...new Set(guaranteed)],
    nonGuaranteedBenefits: [...new Set(nonGuaranteed)],
  };
}

function detectDividendScale(text, unknownValue = "to be defined") {
  const lower = String(text ?? "").toLowerCase();
  let scaleType = "none";

  if (lower.includes("reversionary")) {
    scaleType = "reversionary";
  } else if (lower.includes("terminal bonus")) {
    scaleType = "terminal";
  } else if (lower.includes("dividend")) {
    scaleType = "cash";
  } else if (lower.includes("bonus")) {
    scaleType = unknownValue;
  }

  const nearDividend = String(text ?? "").match(
    /(?:dividend|bonus)[\s\S]{0,80}?(\d+(?:\.\d+)?)%/i,
  );
  const currentRate = nearDividend ? Number(nearDividend[1]) / 100 : null;

  return {
    scaleType,
    currentRate: Number.isFinite(currentRate) ? currentRate : null,
    effectiveDate: null,
    isGuaranteed: "no",
  };
}

function detectBasis(text) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  const match = normalized.match(
    /(Accumulation Units Account value|Initial Units Account value|Account value)/i,
  );
  return match ? match[1] : null;
}

function detectAppliesPeriod(text) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  const match = normalized.match(/(starting from[^.]+)/i);
  return match ? match[1].trim() : null;
}

function detectAppliesTo(text) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  const specific = normalized.match(
    /until (the end of minimum investment period|[^,.]*policy year)/i,
  );
  if (specific) {
    return `until ${specific[1].trim()}`;
  }
  const generic = normalized.match(/until ([^.]+)/i);
  if (!generic) {
    return null;
  }
  const clause = generic[1].split(",")[0].trim();
  if (!/policy year|minimum investment period/i.test(clause)) {
    return null;
  }
  return `until ${clause}`;
}

function buildBonusRecord({
  bonusType,
  sectionText,
  lineStart,
  lineEnd,
  unknownValue = "to be defined",
}) {
  const rateMatch = String(sectionText).match(/(\d+(?:\.\d+)?)\s*%/i);
  const rate = rateMatch ? Number(rateMatch[1]) / 100 : null;
  const basis = detectBasis(sectionText);
  const appliesPeriod = detectAppliesPeriod(sectionText);
  const appliesTo = detectAppliesTo(sectionText);
  const containsNotGuaranteed = /not guaranteed/i.test(sectionText);

  let parserConfidence = "low";
  if (rate !== null && basis) {
    parserConfidence = "high";
  } else if (rate !== null || basis) {
    parserConfidence = "medium";
  }

  return {
    bonusType,
    formulaExpression:
      rate !== null && basis ? `${rateMatch[1]}% x ${basis}` : null,
    rate,
    rateUnit: rate !== null ? "percentage" : null,
    basis,
    appliesFrom: appliesPeriod,
    appliesTo,
    isGuaranteed: containsNotGuaranteed ? "no" : unknownValue,
    sourceCitation: {
      lineRange: `${lineStart}-${lineEnd}`,
    },
    parserConfidence,
  };
}

function parseBonusSections(text, bonusDefinitions, unknownValue = "to be defined") {
  const lines = String(text ?? "").split("\n");
  const defs = (bonusDefinitions ?? []).map((item) => ({
    bonusType: item.bonusType,
    heading: new RegExp(item.headingPattern, "i"),
  }));

  const headingRows = [];
  for (let i = 0; i < lines.length; i += 1) {
    const value = lines[i].trim().replace(/\s+/g, " ");
    if (!value || value.length > 48) {
      continue;
    }
    for (const def of defs) {
      if (def.heading.test(value)) {
        headingRows.push({ index: i, bonusType: def.bonusType });
        break;
      }
    }
  }

  const results = [];
  for (let i = 0; i < headingRows.length; i += 1) {
    const current = headingRows[i];
    const next = headingRows[i + 1];
    const endIndex = next
      ? next.index - 1
      : Math.min(lines.length - 1, current.index + 35);
    const sectionLines = lines.slice(current.index, endIndex + 1);
    const sectionText = sectionLines.join("\n");
    results.push(
      buildBonusRecord({
        bonusType: current.bonusType,
        sectionText,
        lineStart: current.index + 1,
        lineEnd: endIndex + 1,
        unknownValue,
      }),
    );
  }

  const uniqueByType = new Map();
  for (const item of results) {
    const existing = uniqueByType.get(item.bonusType);
    if (!existing) {
      uniqueByType.set(item.bonusType, item);
      continue;
    }
    const score = { low: 1, medium: 2, high: 3 };
    const existingQuality =
      score[existing.parserConfidence] +
      (existing.formulaExpression ? 2 : 0) +
      (existing.appliesFrom ? 1 : 0) +
      (existing.appliesTo ? 1 : 0);
    const nextQuality =
      score[item.parserConfidence] +
      (item.formulaExpression ? 2 : 0) +
      (item.appliesFrom ? 1 : 0) +
      (item.appliesTo ? 1 : 0);
    if (nextQuality > existingQuality) {
      uniqueByType.set(item.bonusType, item);
    }
  }
  return [...uniqueByType.values()];
}

function validateBenefitAttributes(benefitAttributes, maxRate = 0.5) {
  const warnings = [];
  for (const bonus of benefitAttributes.bonuses ?? []) {
    if (bonus.rate !== null && (bonus.rate <= 0 || bonus.rate > maxRate)) {
      warnings.push(
        `bonus-rate-out-of-range:${bonus.bonusType}:${bonus.rate}`,
      );
    }
    if (!bonus.formulaExpression) {
      warnings.push(`bonus-formula-missing:${bonus.bonusType}`);
    }
  }
  if (
    benefitAttributes.dividendScale.currentRate !== null &&
    (benefitAttributes.dividendScale.currentRate <= 0 ||
      benefitAttributes.dividendScale.currentRate > maxRate)
  ) {
    warnings.push(
      `dividend-rate-out-of-range:${benefitAttributes.dividendScale.currentRate}`,
    );
  }
  return warnings;
}

function enrichBonusEligibilityFromGlobalText(bonuses, text) {
  const normalizedText = String(text ?? "").replace(/\s+/g, " ");
  return bonuses.map((bonus) => {
    if (bonus.appliesFrom && bonus.appliesTo) {
      return bonus;
    }
    const label = String(bonus.bonusType ?? "").replace(/\s+/g, "\\s+");
    const pattern = new RegExp(`${label}[^.]{0,260}?starting from([^.]*)`, "i");
    const match = normalizedText.match(pattern);
    if (!match) {
      return bonus;
    }
    const clause = `starting from${match[1]}`.trim();
    const untilMatch = clause.match(/until ([^.]*)/i);
    return {
      ...bonus,
      appliesFrom: bonus.appliesFrom ?? clause,
      appliesTo: bonus.appliesTo ?? (untilMatch ? `until ${untilMatch[1].trim()}` : null),
    };
  });
}

function detectRiderAttributes(text, unknownValue = "to be defined") {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  const riderPattern = /([A-Z][A-Za-z0-9 ()-]+Rider)\s+is\s+a\s+[^.]*\./g;
  const riders = [];
  const seen = new Set();

  for (const match of normalized.matchAll(riderPattern)) {
    const riderName = normalizeString(
      String(match[1]).replace(/^Rider Description\s+/i, "").trim(),
    );
    if (!riderName) {
      continue;
    }
    const riderKey = riderName.toLowerCase();
    if (seen.has(riderKey)) {
      continue;
    }
    seen.add(riderKey);

    const start = match.index ?? 0;
    const window = normalized.slice(start, start + 2200);
    const benefitType = /waiver of premium/i.test(window)
      ? "premium waiver"
      : unknownValue;
    const coverageTermMatch = window.match(/coverage term for this rider[^.]*\./i);
    const benefitSummaryMatch = window.match(
      /while this rider is in force,\s*([^.]+)\./i,
    );
    const triggers = [];
    if (/\bdie|death\b/i.test(window)) {
      triggers.push("death");
    }
    if (/\btotal(?:ly)? and permanent(?:ly)? disabled|\bTPD\b/i.test(window)) {
      triggers.push("TPD");
    }
    if (/\bcritical illness|\bCI\b/i.test(window)) {
      triggers.push("critical illness");
    }
    const hasSurrenderValue = /no surrender value/i.test(window)
      ? "no"
      : unknownValue;
    const premiumRateGuarantee = /premiums?\s+rates?.*non-guaranteed/i.test(window)
      ? "non-guaranteed"
      : unknownValue;
    const parserConfidence =
      benefitType !== unknownValue && triggers.length > 0
        ? "high"
        : benefitType !== unknownValue || triggers.length > 0
          ? "medium"
          : "low";

    riders.push({
      riderName,
      benefitType,
      coverageTriggers: triggers,
      coverageTerm: coverageTermMatch ? coverageTermMatch[0].trim() : null,
      hasSurrenderValue,
      premiumRateGuarantee,
      benefitSummary: benefitSummaryMatch ? benefitSummaryMatch[1].trim() : null,
      parserConfidence,
      sourceCitation: {
        lineRange: null,
      },
    });
  }

  return {
    riders,
    riderCount: riders.length,
  };
}

export function buildBusinessMetadata({
  sourcePath,
  metadata,
  actorId,
  mimeType,
  contentText,
}) {
  const runtimeConfig = loadMetadataRuntimeConfig();
  const unknownValue = runtimeConfig.defaults?.unknownValue ?? "to be defined";
  const now = new Date().toISOString();
  const fileName = basename(sourcePath);
  const text = String(contentText ?? "");
  const metadataProfile = resolveMetadataProfile({ metadata, contentText: text });
  const effectiveBonusDefinitions = metadataProfile.getBonusDefinitions(
    runtimeConfig.bonusDefinitions ?? [],
  );
  const effectiveIndustryTermDefinitions = metadataProfile.getIndustryTermDefinitions(
    runtimeConfig.industryTermDefinitions ?? [],
  );
  const detectedCurrency = detectCurrency(text);
  const detectedPlanName = detectPlanName(text);
  const industryStandardTerms = detectIndustryStandardTerms(
    text,
    effectiveIndustryTermDefinitions,
  );
  const sumAssuredAmount = detectSumAssured(text);
  const projectionRates = detectProjectionRates(text);
  const {
    guaranteedBenefits,
    nonGuaranteedBenefits,
  } = detectGuaranteedAndNonGuaranteedBenefits(text);
  const dividendScale = detectDividendScale(text, unknownValue);
  const bonuses = enrichBonusEligibilityFromGlobalText(
    parseBonusSections(
      text,
      effectiveBonusDefinitions,
      unknownValue,
    ),
    text,
  );
  const riderAttributes = detectRiderAttributes(text, unknownValue);
  const waitingPeriod = detectWaitingPeriod(text);
  const premiumPaidToDateByPolicyYear = detectPremiumPaidToDateByPolicyYear(text);
  const hasGuaranteedValueSignal =
    /guaranteed death benefit|guaranteed value|guaranteed cash value/i.test(text);
  const productFamily = inferProductFamily(metadata.productName, unknownValue);

  const benefitAttributes = {
    sumAssured: {
      amount: sumAssuredAmount,
      currency: detectedCurrency,
      basis: sumAssuredAmount !== null ? "face-amount" : unknownValue,
    },
    guaranteedValue: {
      amount: null,
      currency: detectedCurrency,
      valueType: hasGuaranteedValueSignal
        ? "death-benefit-floor"
        : unknownValue,
    },
    dividendScale,
    bonuses,
    guaranteedBenefits,
    nonGuaranteedBenefits,
    projectionAssumptions: {
      rates: projectionRates,
      notes: [],
    },
    premiumPaidToDateByPolicyYear,
  };
  const mappingWarnings = validateBenefitAttributes(
    benefitAttributes,
    runtimeConfig.validation?.maxRate ?? 0.5,
  );

  const product = {
    productName: normalizeString(metadata.productName),
    productCode: null,
    productFamily,
    insurerName: null,
    jurisdiction: normalizeString(metadata.jurisdiction),
    currency: detectedCurrency,
    productLevel: {
      planName: detectedPlanName,
      productCategory: normalizeString(metadata.insuranceType) ?? unknownValue,
      planType: unknownValue,
      premiumType: unknownValue,
      premiumPaymentTerm: null,
      policyTerm: null,
      issueAgeRange: null,
      lifeAssuredType: unknownValue,
      distributionChannel: unknownValue,
    },
  };

  const policy = {
    lineOfBusiness: runtimeConfig.defaults?.lineOfBusiness ?? "life-insurance",
    participatingType: unknownValue,
    shariahCompliant: unknownValue,
    targetMarketSegment: unknownValue,
  };

  const document = {
    fileName,
    documentType: normalizeString(metadata.documentType),
    versionLabel: normalizeString(metadata.versionLabel),
    language: runtimeConfig.defaults?.language ?? "en",
    issueDate: null,
    effectiveDate: null,
    mimeType: normalizeString(mimeType),
  };

  const governance = {
    sourceSystem: runtimeConfig.defaults?.sourceSystem ?? "manual-ingestion",
    actorId: normalizeString(actorId),
    dataClass: runtimeConfig.defaults?.dataClass ?? "internal",
    piiContains: runtimeConfig.defaults?.piiContains ?? unknownValue,
    regulatoryRegime:
      runtimeConfig.defaults?.regulatoryRegime ?? unknownValue,
    createdAt: now,
    updatedAt: now,
  };

  const profilePostProcess = metadataProfile.postProcess({
    product,
    benefitAttributes,
    riderAttributes: {
      ...riderAttributes,
      waitingPeriod,
    },
    mappingWarnings,
  });
  const finalProduct = profilePostProcess.product ?? product;
  const finalBenefitAttributes =
    profilePostProcess.benefitAttributes ?? benefitAttributes;
  const finalRiderAttributes = profilePostProcess.riderAttributes ?? {
    ...riderAttributes,
    waitingPeriod,
  };
  const finalMappingWarnings =
    profilePostProcess.mappingWarnings ?? mappingWarnings;

  return {
    metadataStandardVersion:
      runtimeConfig.metadataStandardVersion ?? "li-metadata-v1",
    metadataParserVersion:
      runtimeConfig.metadataParserVersion ?? "li-metadata-parser-v2",
    coreMetadata: {
      product,
      policy,
      document,
      governance,
    },
    productMetadata: {
      profileId: metadataProfile.id,
      profileVersion: metadataProfile.version ?? "v1",
      schemaVersion: runtimeConfig.schemaVersion ?? "1.0.0",
      data: {
        benefitAttributes: finalBenefitAttributes,
        riderAttributes: finalRiderAttributes,
        industryStandardTerms,
      },
      mappingWarnings: finalMappingWarnings,
    },
    // Backward-compatible fields used by current modules
    product: finalProduct,
    policy,
    benefitAttributes: finalBenefitAttributes,
    riderAttributes: finalRiderAttributes,
    industryStandardTerms,
    document,
    governance,
    mappingWarnings: finalMappingWarnings,
  };
}
