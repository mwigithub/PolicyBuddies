import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const DEFAULT_FORMULA_PRODUCT_ROUTING = {
  version: "1.0.0",
  defaultProductKey: null,
  mappings: [
    {
      productKey: "wealth-pro-v1",
      productNames: ["wealth pro", "wealth pro (ii)"],
      aliases: ["wealth pro ii"],
    },
  ],
};

export const FORMULA_PRODUCT_ROUTING_PATH = resolve(
  process.cwd(),
  "metadata/runtime/formula-product-routing.json",
);

function ensureRoutingFile(path) {
  const absolute = resolve(process.cwd(), path);
  mkdirSync(dirname(absolute), { recursive: true });
  try {
    readFileSync(absolute, "utf8");
  } catch {
    writeFileSync(
      absolute,
      `${JSON.stringify(DEFAULT_FORMULA_PRODUCT_ROUTING, null, 2)}\n`,
      "utf8",
    );
  }
  return absolute;
}

export function loadFormulaProductRouting(path) {
  const absolute = ensureRoutingFile(path);
  try {
    const parsed = JSON.parse(readFileSync(absolute, "utf8"));
    const mappings = Array.isArray(parsed.mappings) ? parsed.mappings : [];
    return {
      ...DEFAULT_FORMULA_PRODUCT_ROUTING,
      ...parsed,
      mappings,
    };
  } catch {
    return { ...DEFAULT_FORMULA_PRODUCT_ROUTING };
  }
}

export function saveFormulaProductRouting(path, config) {
  const absolute = ensureRoutingFile(path);
  const payload = {
    ...DEFAULT_FORMULA_PRODUCT_ROUTING,
    ...(config ?? {}),
    mappings: Array.isArray(config?.mappings) ? config.mappings : [],
  };
  writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
