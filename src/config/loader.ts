import { cosmiconfig } from "cosmiconfig";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  GlobalConfig,
  ProjectConfig,
  FullConfig,
  DEFAULT_GLOBAL_CONFIG,
  DEFAULT_PROJECT_CONFIG,
} from "./schema.js";

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".creoguard");
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, "config.json");

const explorer = cosmiconfig("creoguard", {
  searchPlaces: [
    ".creoguard/config.json",
    ".creoguard.json",
    "creoguard.config.json",
    "package.json",
  ],
});

export async function loadGlobalConfig(): Promise<GlobalConfig> {
  try {
    if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
      const content = fs.readFileSync(GLOBAL_CONFIG_PATH, "utf-8");
      const config = JSON.parse(content) as Partial<GlobalConfig>;
      return { ...DEFAULT_GLOBAL_CONFIG, ...config };
    }
  } catch (error) {
    // Ignore errors, return defaults
  }
  return { ...DEFAULT_GLOBAL_CONFIG };
}

export async function saveGlobalConfig(config: Partial<GlobalConfig>): Promise<void> {
  const existing = await loadGlobalConfig();
  const merged = { ...existing, ...config };

  if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }

  fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(merged, null, 2));
}

export async function getGlobalConfigValue(key: keyof GlobalConfig): Promise<string | undefined> {
  const config = await loadGlobalConfig();
  const value = config[key];
  return value !== undefined ? String(value) : undefined;
}

export async function setGlobalConfigValue(
  key: keyof GlobalConfig,
  value: string
): Promise<void> {
  await saveGlobalConfig({ [key]: value } as Partial<GlobalConfig>);
}

export async function loadProjectConfig(cwd: string = process.cwd()): Promise<ProjectConfig | null> {
  try {
    const result = await explorer.search(cwd);
    if (result && result.config) {
      // If loaded from package.json, look for creoguard key
      const config = result.config.creoguard || result.config;
      return { ...DEFAULT_PROJECT_CONFIG, ...config };
    }
  } catch (error) {
    // Ignore errors
  }
  return null;
}

export async function saveProjectConfig(
  config: ProjectConfig,
  cwd: string = process.cwd()
): Promise<void> {
  const configDir = path.join(cwd, ".creoguard");
  const configPath = path.join(configDir, "config.json");

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export async function loadFullConfig(cwd: string = process.cwd()): Promise<FullConfig> {
  const globalConfig = await loadGlobalConfig();
  const projectConfig = await loadProjectConfig(cwd);

  return {
    ...DEFAULT_GLOBAL_CONFIG,
    ...DEFAULT_PROJECT_CONFIG,
    ...globalConfig,
    ...(projectConfig || {}),
  };
}

export async function isInitialized(cwd: string = process.cwd()): Promise<boolean> {
  const configPath = path.join(cwd, ".creoguard", "config.json");
  return fs.existsSync(configPath);
}

export function getGlobalConfigPath(): string {
  return GLOBAL_CONFIG_PATH;
}

export function getProjectConfigPath(cwd: string = process.cwd()): string {
  return path.join(cwd, ".creoguard", "config.json");
}
