export type LLMProvider = "openai" | "anthropic" | "ollama";

export type ReviewLevel = "strict" | "standard" | "relaxed";

export type RuleSeverity = "error" | "warn" | "off";

export interface GlobalConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
  guidelinesPath?: string; // Global company guidelines PDF/MD path
}

export interface ProjectConfig {
  enabled: boolean;
  reviewLevel: ReviewLevel;
  blockOnCritical: boolean;
  ignore: string[];
  rules: {
    security: RuleSeverity;
    performance: RuleSeverity;
    bestPractices: RuleSeverity;
    codeStyle: RuleSeverity;
  };
  customPrompt?: string;
  guidelinesPath?: string; // Project-specific guidelines PDF/MD path
  useGlobalGuidelines?: boolean; // Whether to also use global guidelines
}

export interface FullConfig extends GlobalConfig, ProjectConfig {}

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  provider: "openai",
  model: "gpt-4o-mini",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "codellama",
};

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  enabled: true,
  reviewLevel: "standard",
  blockOnCritical: true,
  ignore: [
    "*.test.ts",
    "*.test.js",
    "*.spec.ts",
    "*.spec.js",
    "*.d.ts",
    "dist/**",
    "build/**",
    "node_modules/**",
    "coverage/**",
    ".next/**",
    "*.min.js",
    "*.min.css",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
  ],
  rules: {
    security: "error",
    performance: "warn",
    bestPractices: "warn",
    codeStyle: "warn",
  },
  useGlobalGuidelines: true,
};

export const MODEL_OPTIONS: Record<LLMProvider, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
  ollama: ["codellama", "llama3", "mistral", "deepseek-coder"],
};
