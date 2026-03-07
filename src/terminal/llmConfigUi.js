import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  DEFAULT_LLM_CONFIG,
  LLM_CONFIG_PATH,
  loadLlmConfig,
  resetLlmConfig,
  saveLlmConfig,
} from "../config/llmConfig.js";

const MODULE_LABELS = {
  sourceIngestion: "Source Ingestion LLM",
  intentRouting: "Intent Routing LLM",
  queryPlannerLlm: "Query Planner LLM",
  conversation: "Conversation LLM",
  conversationLlm: "Conversation Synthesis LLM",
  confidenceReview: "Confidence Review LLM",
  embedding: "Embedding LLM",
};

function printConfig(config) {
  console.log("\nCurrent LLM Module Configuration");
  console.log("================================");
  for (const [moduleKey, moduleConfig] of Object.entries(config)) {
    console.log(`${MODULE_LABELS[moduleKey] ?? moduleKey}`);
    console.log(`  provider: ${moduleConfig.provider}`);
    console.log(`  model:    ${moduleConfig.model}`);
  }
  console.log(`\nFile: ${LLM_CONFIG_PATH}\n`);
}

function printMenu() {
  console.log("PolicyBuddies LLM Config Terminal");
  console.log("=================================");
  console.log("1) View current config");
  console.log("2) Update module config");
  console.log("3) Reset to defaults");
  console.log("4) Save config");
  console.log("5) Exit");
}

async function selectModule(rl, config) {
  const moduleKeys = Object.keys(config);
  console.log("\nSelect module:");
  moduleKeys.forEach((key, index) => {
    console.log(`${index + 1}) ${MODULE_LABELS[key] ?? key}`);
  });

  const choiceRaw = await rl.question("Module number: ");
  const choice = Number(choiceRaw.trim());
  if (Number.isNaN(choice) || choice < 1 || choice > moduleKeys.length) {
    return null;
  }
  return moduleKeys[choice - 1];
}

async function updateModuleConfig(rl, config) {
  const moduleKey = await selectModule(rl, config);
  if (!moduleKey) {
    console.log("Invalid module selection.\n");
    return config;
  }

  const current = config[moduleKey];
  const provider = (
    await rl.question(
      `Provider [${current.provider}] (enter to keep current): `,
    )
  ).trim();
  const model = (
    await rl.question(`Model [${current.model}] (enter to keep current): `)
  ).trim();

  const next = {
    ...config,
    [moduleKey]: {
      provider: provider || current.provider,
      model: model || current.model,
    },
  };

  console.log(`${MODULE_LABELS[moduleKey] ?? moduleKey} updated.\n`);
  return next;
}

export async function runLlmConfigUi() {
  const rl = createInterface({ input, output });
  let config = loadLlmConfig();
  let done = false;

  while (!done) {
    printMenu();
    const selected = (await rl.question("Select option: ")).trim();
    console.log("");

    if (selected === "1") {
      printConfig(config);
      continue;
    }

    if (selected === "2") {
      config = await updateModuleConfig(rl, config);
      continue;
    }

    if (selected === "3") {
      config = { ...DEFAULT_LLM_CONFIG };
      resetLlmConfig();
      console.log("Config reset to defaults and saved.\n");
      continue;
    }

    if (selected === "4") {
      saveLlmConfig(config);
      console.log(`Saved to ${LLM_CONFIG_PATH}\n`);
      continue;
    }

    if (selected === "5") {
      done = true;
      continue;
    }

    console.log("Invalid option.\n");
  }

  rl.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runLlmConfigUi();
}
