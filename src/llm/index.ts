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

export function parseBatchReviewResponse(response: string, verbose?: boolean): BatchReviewResult {
  let jsonStr = response.trim();

  if (verbose) {
    console.log("\n[DEBUG] Raw LLM response:", response.substring(0, 500), "...\n");
  }

  // Handle markdown code blocks
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Handle object response
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      if (verbose) {
        console.log("[DEBUG] Parsed batch response keys:", Object.keys(parsed));
      }
      return parsed as BatchReviewResult;
    }

    // If it's an array, it might be a single-file response format
    // Try to return it as a generic result
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (verbose) {
        console.log("[DEBUG] Got array response with", parsed.length, "issues");
      }
      return { "_default": parsed } as BatchReviewResult;
    }

    return {};
  } catch (error) {
    // Try to find JSON object in the response
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        const parsed = JSON.parse(objectMatch[0]);
        if (verbose) {
          console.log("[DEBUG] Parsed from object match, keys:", Object.keys(parsed));
        }
        return parsed as BatchReviewResult;
      } catch {
        // Ignore
      }
    }

    // Try to find JSON array in the response
    const arrayMatch = response.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (verbose) {
            console.log("[DEBUG] Parsed array with", parsed.length, "issues");
          }
          return { "_default": parsed } as BatchReviewResult;
        }
      } catch {
        // Ignore
      }
    }

    console.error("Failed to parse batch review response:", error);
    if (verbose) {
      console.log("[DEBUG] Full response was:", response);
    }
    return {};
  }
}
