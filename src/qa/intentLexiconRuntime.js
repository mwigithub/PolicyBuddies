function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9%\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSensitiveLiteral(token) {
  return /\d|%|\$|sgd|usd|eur|gbp|aud/i.test(token);
}

function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean);
}

function levenshtein(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  const dp = Array.from({ length: left.length + 1 }, () =>
    new Array(right.length + 1).fill(0),
  );
  for (let i = 0; i <= left.length; i += 1) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= right.length; j += 1) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[left.length][right.length];
}

function maxDistance(token) {
  if (token.length <= 5) {
    return 1;
  }
  return 2;
}

export function normalizeQuestionWithLexicon(question, lexicon) {
  const originalQuestion = String(question ?? "");
  let normalizedQuestion = normalizeText(originalQuestion);
  const appliedCorrections = [];

  const terms = Array.isArray(lexicon?.terms) ? lexicon.terms : [];
  for (const term of terms) {
    const canonical = normalizeText(term.canonicalTerm);
    for (const typo of Array.isArray(term.misspellings) ? term.misspellings : []) {
      const normalizedTypo = normalizeText(typo);
      if (!normalizedTypo || !canonical) {
        continue;
      }
      const pattern = new RegExp(`\\b${normalizedTypo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
      if (pattern.test(normalizedQuestion)) {
        normalizedQuestion = normalizedQuestion.replace(pattern, canonical);
        appliedCorrections.push({
          from: normalizedTypo,
          to: canonical,
          reason: "lexicon_misspelling",
        });
      }
    }
  }

  // Token-level typo correction using lexicon vocabulary.
  const vocabulary = new Set();
  for (const term of terms) {
    const variants = [
      term.canonicalTerm,
      ...(term.synonyms ?? []),
      ...(term.abbreviations ?? []),
    ];
    for (const variant of variants) {
      for (const token of tokenize(variant)) {
        if (token.length >= 3 && !isSensitiveLiteral(token)) {
          vocabulary.add(token);
        }
      }
    }
  }

  const correctedTokens = normalizedQuestion.split(" ").map((token) => {
    const source = token.trim();
    if (!source || source.length < 4 || isSensitiveLiteral(source)) {
      return source;
    }
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of vocabulary) {
      if (candidate === source) {
        return source;
      }
      const distance = levenshtein(source, candidate);
      if (distance <= maxDistance(source) && distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    if (!best || bestDistance <= 0) {
      return source;
    }
    appliedCorrections.push({
      from: source,
      to: best,
      reason: "fuzzy_token",
    });
    return best;
  });
  normalizedQuestion = correctedTokens.join(" ").replace(/\s+/g, " ").trim();

  return {
    originalQuestion,
    normalizedQuestion,
    appliedCorrections,
  };
}

export function collectLexiconMatches(normalizedQuestion, lexicon) {
  const terms = Array.isArray(lexicon?.terms) ? lexicon.terms : [];
  const qTokens = tokenize(normalizedQuestion);
  const fuzzyMatches = [];
  const exactMatches = [];

  for (const term of terms) {
    const candidates = [
      term.canonicalTerm,
      ...(term.synonyms ?? []),
      ...(term.abbreviations ?? []),
    ]
      .map(normalizeText)
      .filter(Boolean);

    const exactHit = candidates.find((candidate) => {
      const pattern = new RegExp(`\\b${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      return pattern.test(normalizedQuestion);
    });
    if (exactHit) {
      exactMatches.push({
        canonicalTerm: term.canonicalTerm,
        matched: exactHit,
        signal: "exact",
        intentSignals: term.intentSignals ?? [],
        documentHints: term.documentHints ?? [],
        chunkHints: term.chunkHints ?? [],
      });
      continue;
    }

    const candidateTokens = candidates.flatMap((item) => tokenize(item));
    let fuzzyHit = null;
    for (const token of candidateTokens) {
      const max = maxDistance(token);
      for (const qToken of qTokens) {
        if (!token || !qToken) {
          continue;
        }
        const distance = levenshtein(token, qToken);
        if (distance > 0 && distance <= max) {
          fuzzyHit = { token, qToken, distance };
          break;
        }
      }
      if (fuzzyHit) {
        break;
      }
    }
    if (fuzzyHit) {
      fuzzyMatches.push({
        canonicalTerm: term.canonicalTerm,
        token: fuzzyHit.token,
        matchedToken: fuzzyHit.qToken,
        distance: fuzzyHit.distance,
        intentSignals: term.intentSignals ?? [],
        documentHints: term.documentHints ?? [],
        chunkHints: term.chunkHints ?? [],
      });
    }
  }

  return { exactMatches, fuzzyMatches };
}
