import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function safeReadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function loadFormulaBundle({
  registryDir = "metadata/runtime/formulas",
  productKey = null,
}) {
  const normalizedProductKey = String(productKey ?? "").trim();
  if (!normalizedProductKey) {
    return {
      filePath: null,
      formulas: [],
    };
  }
  const filePath = resolve(
    process.cwd(),
    registryDir,
    `${normalizedProductKey}.formulas.json`,
  );
  const parsed = safeReadJson(filePath);
  if (!parsed || !Array.isArray(parsed.formulas)) {
    return {
      filePath,
      formulas: [],
    };
  }
  return {
    filePath,
    formulas: parsed.formulas,
  };
}

export function findFormula({
  formulas,
  formulaId,
  nameContains,
  category,
}) {
  if (!Array.isArray(formulas)) {
    return null;
  }
  if (formulaId) {
    return formulas.find((item) => item.formulaId === formulaId) ?? null;
  }
  const needle = String(nameContains ?? "").toLowerCase();
  return (
    formulas.find((item) => {
      const name = String(item.name ?? "").toLowerCase();
      const cat = String(item.category ?? "").toLowerCase();
      if (category && cat !== String(category).toLowerCase()) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return name.includes(needle);
    }) ?? null
  );
}
