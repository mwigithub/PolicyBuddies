function normalizeVariableName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeExpression(expression) {
  return String(expression ?? "")
    .replace(/×/g, "*")
    .replace(/\bx\b/gi, "*")
    .replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferVariablesFromExpression(expression) {
  const matches = normalizeExpression(expression).match(/[a-z_][a-z0-9_]*/gi) ?? [];
  const reserved = new Set(["Math"]);
  const seen = new Set();
  const vars = [];
  for (const match of matches) {
    const name = normalizeVariableName(match);
    if (!name || reserved.has(name) || seen.has(name)) {
      continue;
    }
    seen.add(name);
    vars.push(name);
  }
  return vars;
}

export function parseFormulaDefinition(raw) {
  const expression = normalizeExpression(raw?.expression);
  return {
    ...raw,
    expression,
    variables: Array.isArray(raw?.variables)
      ? raw.variables.map((item) => ({
        ...item,
        name: normalizeVariableName(item?.name),
      }))
      : inferVariablesFromExpression(expression).map((name) => ({
        name,
        type: "number",
        required: true,
        source: "user_input",
      })),
  };
}
