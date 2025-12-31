import OpenAI from "openai";
import { LLMProvider } from "./types.js";
import { loadGlobalConfig } from "../config/loader.js";

export class OpenAIProvider implements LLMProvider {
  name = "openai";
  private client: OpenAI | null = null;
  private model: string = "gpt-4o-mini";

  async initialize(): Promise<void> {
    const config = await loadGlobalConfig();

    if (!config.apiKey) {
      throw new Error(
        "OpenAI API key not configured. Run: creoguard config set apiKey <your-key>"
      );
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
    });

    this.model = config.model || "gpt-4o-mini";
  }

  async isConfigured(): Promise<boolean> {
    const config = await loadGlobalConfig();
    return !!config.apiKey && config.provider === "openai";
  }

  async review(prompt: string): Promise<string> {
    if (!this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "You are an expert code reviewer. Analyze code for security issues, bugs, performance problems, and best practice violations. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    return content;
  }
}
