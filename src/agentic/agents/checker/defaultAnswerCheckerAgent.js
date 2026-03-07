function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isMissingAnswer(text) {
  const value = normalize(text);
  return (
    value.length === 0 ||
    value.includes("llm synthesis failed") ||
    value.includes("information not found") ||
    value.includes("insufficient information") ||
    value.includes("to be defined")
  );
}

function isDefinitionIntent(result) {
  return normalize(result?.queryPlan?.intentClass) === "definition";
}

function isPolicySpecificQuestion(question) {
  const text = normalize(question);
  return /\b(this policy|this product|this rider|for this plan|under this policy|policy year|coverage commencement|reinstatement)\b/.test(
    text,
  );
}

function wantsHybrid(question) {
  const text = normalize(question);
  return (
    /\b(both|combine|with context|with example)\b/.test(text) ||
    /\b(in insurance).*(for this|this policy|this product)\b/.test(text) ||
    /\b(for this|this policy|this product).*(in insurance)\b/.test(text)
  );
}

function extractNumbers(text) {
  return [...String(text ?? "").matchAll(/\b\d+(?:\.\d+)?\b/g)].map((m) => m[0]);
}

function numbersInEvidence(evidence) {
  const joined = (Array.isArray(evidence) ? evidence : [])
    .map((item) => String(item.text ?? ""))
    .join(" ");
  return new Set(extractNumbers(joined));
}

function assessHallucinationRisk({ selectedSource, selectedAnswer, evidence, policySpecific }) {
  if (selectedSource !== "industry") {
    return "low";
  }
  const answerNumbers = extractNumbers(selectedAnswer);
  if (answerNumbers.length === 0) {
    return policySpecific ? "medium" : "low";
  }
  const evidenceNumbers = numbersInEvidence(evidence);
  const hasUnsupported = answerNumbers.some((num) => !evidenceNumbers.has(num));
  if (hasUnsupported && policySpecific) {
    return "high";
  }
  if (hasUnsupported) {
    return "medium";
  }
  return "low";
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function compact(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildLlmJudgePrompt({
  question,
  deterministicCandidate,
  industryCandidate,
  deterministicAvailable,
  industryAvailable,
  evidence,
}) {
  const evidencePreview = (Array.isArray(evidence) ? evidence : [])
    .slice(0, 4)
    .map((item, index) => {
      const source = `${item.sourcePath} lines ${item.lineStart}-${item.lineEnd}`;
      const snippet = compact(item.text).slice(0, 320);
      return `[E${index + 1}] ${source}: ${snippet}`;
    })
    .join("\n");

  return [
    "You are the checker agent for insurance Q&A.",
    "Decide the best response style based on question intent and evidence relevance.",
    "You MUST prioritize vector-grounded deterministic answer for policy-specific questions.",
    "Use industry answer only for generic concept questions when deterministic evidence is missing.",
    "Return ONLY JSON with keys:",
    "decision (deterministic_only|industry_only|hybrid|no_answer),",
    "selectedSource (evidence|industry|hybrid|none),",
    "rationale (short string).",
    "No markdown.",
    "",
    `Question: ${question}`,
    "",
    `DeterministicAvailable: ${deterministicAvailable}`,
    `DeterministicCandidate: ${deterministicCandidate || "none"}`,
    "",
    `IndustryAvailable: ${industryAvailable}`,
    `IndustryCandidate: ${industryCandidate || "none"}`,
    "",
    "Evidence:",
    evidencePreview || "No evidence.",
  ].join("\n");
}

async function runLlmJudge({
  question,
  deterministicCandidate,
  industryCandidate,
  deterministicAvailable,
  industryAvailable,
  evidence,
  model,
  baseUrl,
}) {
  const prompt = buildLlmJudgePrompt({
    question,
    deterministicCandidate,
    industryCandidate,
    deterministicAvailable,
    industryAvailable,
    evidence,
  });
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.1,
      },
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Checker LLM request failed (${response.status}): ${body.slice(0, 180)}`,
    );
  }
  const payload = await response.json();
  const parsed = tryParseJson(String(payload?.response ?? "").trim());
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Checker LLM returned invalid JSON payload");
  }
  return parsed;
}

export function createDefaultAnswerCheckerAgent(config = {}) {
  const llmJudgeEnabled = config.llmJudgeEnabled === true;
  const llmJudgeModel = config.llmJudgeModel ?? "llama3-lowram:latest";
  const llmJudgeBaseUrl = config.llmJudgeBaseUrl ?? "http://127.0.0.1:11434";

  const chooseByHeuristic = ({ question, result, llmAnswer, preparedAnswer = null }) => {
    const prepared = preparedAnswer ?? result?.askPreparedAnswer ?? null;
    const deterministicCandidate = String(
      prepared?.candidates?.deterministicCandidate ?? result?.answer ?? "",
    ).trim();
    const industryCandidate = String(
      prepared?.candidates?.industryCandidate ??
        result?.industryDefinitionAnswer ??
        llmAnswer ??
        "",
    ).trim();
    const deterministicAvailable = prepared?.candidates?.deterministicAvailable ??
      !isMissingAnswer(deterministicCandidate);
    const industryAvailable = prepared?.candidates?.industryAvailable ??
      !isMissingAnswer(industryCandidate);
    const policySpecific = isPolicySpecificQuestion(question);
    const definitionIntent = isDefinitionIntent(result);
    const hybridRequested = wantsHybrid(question);

    let decision = String(prepared?.decision ?? "no_answer");
    let selectedSource = String(prepared?.selectedSource ?? "none");
    let selectedAnswer = String(prepared?.selectedAnswer ?? "").trim();
    let rationale = "Reviewed prepared answer from Ask Agent.";

    if (!selectedAnswer) {
      if (hybridRequested && deterministicAvailable && industryAvailable) {
        decision = "hybrid";
        selectedSource = "hybrid";
        selectedAnswer = [
          "Industry Context:",
          industryCandidate,
          "",
          "Policy Context:",
          deterministicCandidate,
        ].join("\n");
        rationale = "Fallback hybrid composition due to missing prepared answer.";
      } else if (policySpecific && deterministicAvailable) {
        decision = "deterministic_only";
        selectedSource = "evidence";
        selectedAnswer = deterministicCandidate;
        rationale =
          "Fallback deterministic selection for policy-specific question.";
      } else if (definitionIntent && industryAvailable) {
        decision = "industry_only";
        selectedSource = "industry";
        selectedAnswer = industryCandidate;
        rationale = "Fallback industry selection for definition intent.";
      } else if (deterministicAvailable) {
        decision = "deterministic_only";
        selectedSource = "evidence";
        selectedAnswer = deterministicCandidate;
        rationale = "Fallback deterministic selection.";
      } else if (industryAvailable) {
        decision = "industry_only";
        selectedSource = "industry";
        selectedAnswer = industryCandidate;
        rationale = "Fallback industry selection.";
      } else {
        decision = "no_answer";
        selectedSource = "none";
        selectedAnswer =
          "Direct Answer: information not found in model and retrieved evidence for this question.";
        rationale = "No reliable candidate answer available.";
      }
    }

    // Enforce vector-first rule for policy-specific questions.
    if (
      policySpecific &&
      selectedSource === "industry" &&
      deterministicAvailable
    ) {
      decision = "deterministic_only";
      selectedSource = "evidence";
      selectedAnswer = deterministicCandidate;
      rationale =
        "Checker override: vector-grounded deterministic answer has highest rank for policy-specific question.";
    }

    return {
      decision,
      selectedSource,
      selectedAnswer,
      rationale,
      deterministicCandidate,
      industryCandidate,
      deterministicAvailable,
      industryAvailable,
      policySpecific,
    };
  };

  return {
    name() {
      return "default-answer-checker-agent";
    },
    capabilities() {
      return ["candidate-selection", "hallucination-guard"];
    },
    async execute({ question, result, llmAnswer, preparedAnswer = null }) {
      let {
        decision,
        selectedSource,
        selectedAnswer,
        rationale,
        deterministicCandidate,
        industryCandidate,
        deterministicAvailable,
        industryAvailable,
        policySpecific,
      } = chooseByHeuristic({ question, result, llmAnswer, preparedAnswer });

      if (llmJudgeEnabled && (deterministicAvailable || industryAvailable)) {
        try {
          const judge = await runLlmJudge({
            question,
            deterministicCandidate,
            industryCandidate,
            deterministicAvailable,
            industryAvailable,
            evidence: result?.evidence ?? [],
            model: llmJudgeModel,
            baseUrl: llmJudgeBaseUrl,
          });
          const judgedDecision = normalize(judge?.decision);
          const judgedSource = normalize(judge?.selectedSource);
          if (
            ["deterministic_only", "industry_only", "hybrid", "no_answer"].includes(
              judgedDecision,
            )
          ) {
            decision = judgedDecision;
          }
          if (["evidence", "industry", "hybrid", "none"].includes(judgedSource)) {
            selectedSource = judgedSource;
          }
          rationale = String(judge?.rationale ?? "").trim() || rationale;
          if (decision === "deterministic_only" && deterministicAvailable) {
            selectedSource = "evidence";
            selectedAnswer = deterministicCandidate;
          } else if (decision === "industry_only" && industryAvailable) {
            selectedSource = "industry";
            selectedAnswer = industryCandidate;
          } else if (
            decision === "hybrid" &&
            deterministicAvailable &&
            industryAvailable
          ) {
            selectedSource = "hybrid";
            selectedAnswer = [
              "Industry Context:",
              industryCandidate,
              "",
              "Policy Context:",
              deterministicCandidate,
            ].join("\n");
          } else if (decision === "no_answer") {
            selectedSource = "none";
            selectedAnswer =
              "Direct Answer: information not found in model and retrieved evidence for this question.";
          }
        } catch {
          // Keep heuristic decision if LLM judge fails.
        }
      }

      // Enforce vector-first rule for policy-specific questions after LLM judge.
      if (policySpecific && selectedSource === "industry" && deterministicAvailable) {
        decision = "deterministic_only";
        selectedSource = "evidence";
        selectedAnswer = deterministicCandidate;
        rationale =
          "Checker override: vector-grounded deterministic answer has highest rank for policy-specific question.";
      }
      if (policySpecific && !deterministicAvailable) {
        decision = "no_answer";
        selectedSource = "none";
        selectedAnswer =
          "Direct Answer: information not found in retrieved policy evidence for this policy-specific question.";
        rationale =
          "Checker override: policy-specific question cannot fallback to industry answer without deterministic evidence.";
      }

      const hallucinationRisk = assessHallucinationRisk({
        selectedSource,
        selectedAnswer,
        evidence: result?.evidence ?? [],
        policySpecific,
      });
      if (hallucinationRisk === "high") {
        decision = "no_answer";
        selectedSource = "none";
        selectedAnswer =
          "Direct Answer: unable to provide a safe answer because the model-generated details are not grounded in retrieved evidence.";
        rationale = "Hallucination guard blocked unsupported model-specific details.";
      }

      return {
        decision,
        selectedSource,
        selectedAnswer,
        rationale,
        hallucinationRisk,
        candidates: {
          deterministicAvailable,
          industryAvailable,
        },
      };
    },
  };
}
