import { LLMProvider, ReviewIssue, BatchReviewResult } from "./types.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { OllamaProvider } from "./ollama.js";
import { loadGlobalConfig } from "../config/loader.js";
import { LLMProvider as LLMProviderType } from "../config/schema.js";

export * from "./types.js";

export async function createLLMProvider(): Promise<LLMProvider> {
  const config = await loadGlobalConfig();

  switch (config.provider) {
    case "openai":
      return new OpenAIProvider();
    case "anthropic":
      return new AnthropicProvider();
    case "ollama":
      return new OllamaProvider();
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export function getProviderByName(name: LLMProviderType): LLMProvider {
  switch (name) {
    case "openai":
      return new OpenAIProvider();
    case "anthropic":
      return new AnthropicProvider();
    case "ollama":
      return new OllamaProvider();
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

export function parseReviewResponse(response: string): ReviewIssue[] {
  // Try to extract JSON from the response
  let jsonStr = response.trim();

  // Handle markdown code blocks
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Handle array response
    if (Array.isArray(parsed)) {
      return parsed as ReviewIssue[];
    }

    // Handle object response (batch review)
    return [];
  } catch (error) {
    // Try to find JSON array in the response
    const arrayMatch = response.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as ReviewIssue[];
      } catch {
        // Ignore
      }
    }

    console.error("Failed to parse review response:", error);
    return [];
  }
}

export function parseBatchReviewResponse(response: string): BatchReviewResult {
  let jsonStr = response.trim();

  // Handle markdown code blocks
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Handle object response
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as BatchReviewResult;
    }

    return {};
  } catch (error) {
    // Try to find JSON object in the response
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]) as BatchReviewResult;
      } catch {
        // Ignore
      }
    }

    console.error("Failed to parse batch review response:", error);
    return {};
  }
}
