import { logger } from "../utils/logger.js";
import {
  loadGlobalConfig,
  saveGlobalConfig,
  getGlobalConfigPath,
} from "../config/loader.js";
import { GlobalConfig, LLMProvider, MODEL_OPTIONS } from "../config/schema.js";

type ConfigAction = "get" | "set" | "list" | "reset";

const VALID_KEYS: (keyof GlobalConfig)[] = [
  "provider",
  "apiKey",
  "model",
  "ollamaUrl",
  "ollamaModel",
];

const VALID_PROVIDERS: LLMProvider[] = ["openai", "anthropic", "ollama"];

export async function configCommand(
  action: ConfigAction,
  key?: string,
  value?: string
): Promise<void> {
  switch (action) {
    case "get":
      await handleGet(key);
      break;
    case "set":
      await handleSet(key, value);
      break;
    case "list":
      await handleList();
      break;
    case "reset":
      await handleReset();
      break;
    default:
      logger.error(`Unknown action: ${action}`);
      logger.info("Valid actions: get, set, list, reset");
      process.exit(1);
  }
}

async function handleGet(key?: string): Promise<void> {
  if (!key) {
    logger.error("Please specify a key to get.");
    logger.info(`Valid keys: ${VALID_KEYS.join(", ")}`);
    process.exit(1);
  }

  if (!VALID_KEYS.includes(key as keyof GlobalConfig)) {
    logger.error(`Invalid key: ${key}`);
    logger.info(`Valid keys: ${VALID_KEYS.join(", ")}`);
    process.exit(1);
  }

  const config = await loadGlobalConfig();
  const configKey = key as keyof GlobalConfig;
  const configValue = config[configKey];

  if (configValue === undefined) {
    logger.info(`${key}: (not set)`);
  } else if (key === "apiKey") {
    // Mask API key for security
    const masked =
      String(configValue).substring(0, 8) + "..." + String(configValue).slice(-4);
    logger.info(`${key}: ${masked}`);
  } else {
    logger.info(`${key}: ${configValue}`);
  }
}

async function handleSet(key?: string, value?: string): Promise<void> {
  if (!key || value === undefined) {
    logger.error("Please specify both key and value.");
    logger.info("Usage: creoguard config set <key> <value>");
    logger.info(`Valid keys: ${VALID_KEYS.join(", ")}`);
    process.exit(1);
  }

  if (!VALID_KEYS.includes(key as keyof GlobalConfig)) {
    logger.error(`Invalid key: ${key}`);
    logger.info(`Valid keys: ${VALID_KEYS.join(", ")}`);
    process.exit(1);
  }

  // Validate provider
  if (key === "provider" && !VALID_PROVIDERS.includes(value as LLMProvider)) {
    logger.error(`Invalid provider: ${value}`);
    logger.info(`Valid providers: ${VALID_PROVIDERS.join(", ")}`);
    process.exit(1);
  }

  // Validate model
  if (key === "model") {
    const config = await loadGlobalConfig();
    const validModels = MODEL_OPTIONS[config.provider];
    if (!validModels.includes(value)) {
      logger.warning(`Model "${value}" is not in the recommended list for ${config.provider}.`);
      logger.info(`Recommended models: ${validModels.join(", ")}`);
      logger.info("Proceeding anyway...");
    }
  }

  await saveGlobalConfig({ [key]: value } as Partial<GlobalConfig>);

  if (key === "apiKey") {
    const masked = value.substring(0, 8) + "..." + value.slice(-4);
    logger.success(`Set ${key} to ${masked}`);
  } else {
    logger.success(`Set ${key} to ${value}`);
  }

  // Show helpful next steps
  if (key === "provider") {
    logger.newLine();
    logger.info("Don't forget to set your API key:");
    if (value === "ollama") {
      logger.info("  creoguard config set ollamaUrl http://localhost:11434");
      logger.info("  creoguard config set ollamaModel codellama");
    } else {
      logger.info(`  creoguard config set apiKey <your-${value}-api-key>`);
    }
  }

  if (key === "apiKey") {
    logger.newLine();
    logger.success("You're all set! CreoGuard will now review your commits.");
    logger.info("Run 'creoguard init' in your repository to set up the git hook.");
  }
}

async function handleList(): Promise<void> {
  const config = await loadGlobalConfig();

  logger.newLine();
  logger.header("CreoGuard Configuration");
  logger.newLine();

  console.log(`  Config file: ${getGlobalConfigPath()}`);
  logger.newLine();

  for (const key of VALID_KEYS) {
    const value = config[key];
    if (value === undefined) {
      console.log(`  ${key}: (not set)`);
    } else if (key === "apiKey") {
      const masked =
        String(value).substring(0, 8) + "..." + String(value).slice(-4);
      console.log(`  ${key}: ${masked}`);
    } else {
      console.log(`  ${key}: ${value}`);
    }
  }

  logger.newLine();

  // Show recommended models for current provider
  const validModels = MODEL_OPTIONS[config.provider];
  console.log(`  Available models for ${config.provider}:`);
  for (const model of validModels) {
    const current = model === config.model ? " (current)" : "";
    console.log(`    - ${model}${current}`);
  }

  logger.newLine();
}

async function handleReset(): Promise<void> {
  const { default: inquirer } = await import("inquirer");

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Are you sure you want to reset all configuration?",
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info("Reset cancelled.");
    return;
  }

  await saveGlobalConfig({
    provider: "openai",
    apiKey: undefined,
    model: "gpt-4o-mini",
    ollamaUrl: "http://localhost:11434",
    ollamaModel: "codellama",
  });

  logger.success("Configuration reset to defaults.");
  logger.info("You'll need to set your API key again: creoguard config set apiKey <key>");
}
