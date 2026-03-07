import { parseFormulaDefinition } from "./formulaParser.js";
import {
  validateFormulaDefinition,
  validateFormulaInputs,
} from "./formulaValidator.js";

function applyRounding(value, rounding = {}) {
  const decimals = Number.isInteger(rounding.decimals) ? rounding.decimals : 2;
  const factor = 10 ** decimals;
  const mode = rounding.mode ?? "half-up";
  if (mode === "none") {
    return value;
  }
  if (mode === "floor") {
    return Math.floor(value * factor) / factor;
  }
  if (mode === "ceil") {
    return Math.ceil(value * factor) / factor;
  }
  return Math.round(value * factor) / factor;
}

function safeEvaluateExpression(expression, inputs) {
  let compiled = expression;
  for (const [name, rawValue] of Object.entries(inputs ?? {})) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      continue;
    }
    const pattern = new RegExp(`\\b${name}\\b`, "g");
    compiled = compiled.replace(pattern, String(value));
  }
  if (!/^[0-9+\-*/().\s]+$/.test(compiled)) {
    throw new Error("Expression contains unsupported symbols after input mapping.");
  }
  const fn = new Function(`return (${compiled});`);
  const result = Number(fn());
  if (!Number.isFinite(result)) {
    throw new Error("Expression evaluation returned non-finite result.");
  }
  return {
    compiledExpression: compiled,
    value: result,
  };
}

export function evaluateFormula({
  formulaDefinition,
  inputs = {},
  policyYear = null,
}) {
  const formula = parseFormulaDefinition(formulaDefinition);
  const definitionErrors = validateFormulaDefinition(formula);
  if (definitionErrors.length > 0) {
    return {
      status: "invalid_formula",
      errors: definitionErrors,
      result: null,
      trace: [],
    };
  }

  const inputValidation = validateFormulaInputs(formula, inputs, policyYear);
  if (inputValidation.status !== "ok") {
    return {
      status: inputValidation.status,
      reason: inputValidation.reason,
      missingInputs: inputValidation.missingInputs,
      result: null,
      trace: [],
    };
  }

  const evaluated = safeEvaluateExpression(formula.expression, inputs);
  const rounded = applyRounding(evaluated.value, formula.rounding);
  return {
    status: "computed",
    result: rounded,
    currency: formula.currency ?? null,
    trace: [
      {
        step: "map_inputs",
        inputs,
      },
      {
        step: "evaluate_expression",
        expression: formula.expression,
        compiledExpression: evaluated.compiledExpression,
        intermediate: evaluated.value,
      },
      {
        step: "apply_rounding",
        rounding: formula.rounding ?? { mode: "half-up", decimals: 2 },
        result: rounded,
      },
    ],
  };
}
