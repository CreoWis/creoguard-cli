import Anthropic from "@anthropic-ai/sdk";
import { LLMProvider } from "./types.js";
import { loadGlobalConfig } from "../config/loader.js";

export class AnthropicProvider implements LLMProvider {
  name = "anthropic";
  private client: Anthropic | null = null;
  private model: string = "claude-sonnet-4-20250514";

  async initialize(): Promise<void> {
    const config = await loadGlobalConfig();

    if (!config.apiKey) {
      throw new Error(
        "Anthropic API key not configured. Run: creoguard config set apiKey <your-key>"
      );
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
    });

    this.model = config.model || "claude-sonnet-4-20250514";
  }

  async isConfigured(): Promise<boolean> {
    const config = await loadGlobalConfig();
    return !!config.apiKey && config.provider === "anthropic";
  }

  async review(prompt: string): Promise<string> {
    if (!this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error("Anthropic client not initialized");
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      system:
        "You are an expert code reviewer. Analyze code for security issues, bugs, performance problems, and best practice violations. Always respond with valid JSON only, no additional text.",
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Anthropic");
    }

    return content.text;
  }
}
