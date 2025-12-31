export interface ReviewIssue {
  severity: "critical" | "warning" | "info";
  category: "security" | "performance" | "bestPractices" | "codeStyle" | "companyGuidelines";
  line: number | null;
  message: string;
  currentCode?: string;
  suggestedFix?: string;
  explanation?: string;
}

export interface ReviewResult {
  filePath: string;
  issues: ReviewIssue[];
}

export interface LLMProvider {
  name: string;
  review(prompt: string): Promise<string>;
  isConfigured(): Promise<boolean>;
}

export interface BatchReviewResult {
  [filePath: string]: ReviewIssue[];
}
