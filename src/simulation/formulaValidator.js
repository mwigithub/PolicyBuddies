function asNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function validateFormulaDefinition(formula) {
  const errors = [];
  if (!formula || typeof formula !== "object") {
    return ["Formula definition must be an object."];
  }
  if (!formula.formulaId) {
    errors.push("formulaId is required.");
  }
  if (!formula.expression) {
    errors.push("expression is required.");
  }
  if (!Array.isArray(formula.variables) || formula.variables.length === 0) {
    errors.push("variables must contain at least one variable.");
  }
  return errors;
}

export function validateFormulaInputs(formula, inputs, policyYear) {
  const missingInputs = [];
  for (const variable of formula.variables ?? []) {
    if (!variable.required) {
      continue;
    }
    if (inputs?.[variable.name] === undefined || inputs?.[variable.name] === null) {
      missingInputs.push(variable.name);
    }
  }

  const year = asNumber(policyYear);
  if (
    year !== null &&
    formula.effectiveFromYear !== null &&
    formula.effectiveFromYear !== undefined
  ) {
    if (year < Number(formula.effectiveFromYear)) {
      return {
        status: "not_eligible",
        missingInputs,
        reason: `policyYear is before effectiveFromYear (${formula.effectiveFromYear}).`,
      };
    }
  }
  if (
    year !== null &&
    formula.effectiveToYear !== null &&
    formula.effectiveToYear !== undefined
  ) {
    if (year > Number(formula.effectiveToYear)) {
      return {
        status: "not_eligible",
        missingInputs,
        reason: `policyYear is after effectiveToYear (${formula.effectiveToYear}).`,
      };
    }
  }

  if (missingInputs.length > 0) {
    return {
      status: "missing_input",
      missingInputs,
      reason: "Required input variables are missing.",
    };
  }

  return {
    status: "ok",
    missingInputs: [],
    reason: null,
  };
}
