import { LLMProvider } from "./types.js";
import { loadGlobalConfig } from "../config/loader.js";

export class OllamaProvider implements LLMProvider {
  name = "ollama";
  private baseUrl: string = "http://localhost:11434";
  private model: string = "codellama";

  async initialize(): Promise<void> {
    const config = await loadGlobalConfig();
    this.baseUrl = config.ollamaUrl || "http://localhost:11434";
    this.model = config.ollamaModel || "codellama";
  }

  async isConfigured(): Promise<boolean> {
    const config = await loadGlobalConfig();
    if (config.provider !== "ollama") {
      return false;
    }

    // Check if Ollama is running
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async review(prompt: string): Promise<string> {
    await this.initialize();

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        prompt: `You are an expert code reviewer. Analyze code for security issues, bugs, performance problems, and best practice violations. Always respond with valid JSON only.

${prompt}`,
        stream: false,
        options: {
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama request failed: ${error}`);
    }

    const data = await response.json() as { response: string };
    return data.response;
  }

  async listModels(): Promise<string[]> {
    await this.initialize();

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        return [];
      }

      const data = await response.json() as { models: Array<{ name: string }> };
      return data.models.map((m) => m.name);
    } catch {
      return [];
    }
  }
}
