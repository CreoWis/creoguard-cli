import { ReviewLevel, RuleSeverity } from "../config/schema.js";

export interface ReviewContext {
  filePath: string;
  language: string;
  diff: string;
  reviewLevel: ReviewLevel;
  rules: {
    security: RuleSeverity;
    performance: RuleSeverity;
    bestPractices: RuleSeverity;
    codeStyle: RuleSeverity;
  };
  customPrompt?: string;
  companyGuidelines?: string; // Company best practices content
}

export function buildReviewPrompt(context: ReviewContext): string {
  const { filePath, language, diff, reviewLevel, rules, customPrompt, companyGuidelines } = context;

  const levelInstructions = {
    strict: "Be thorough and flag any potential issues, even minor ones.",
    standard: "Focus on important issues that should be fixed before committing.",
    relaxed: "Only flag critical issues that absolutely must be fixed.",
  };

  const enabledRules: string[] = [];
  if (rules.security !== "off") {
    enabledRules.push(
      `- **Security** (${rules.security === "error" ? "CRITICAL" : "WARNING"}): Check for SQL injection, XSS, command injection, hardcoded secrets, insecure dependencies, authentication flaws`
    );
  }
  if (rules.performance !== "off") {
    enabledRules.push(
      `- **Performance** (${rules.performance === "error" ? "CRITICAL" : "WARNING"}): Check for N+1 queries, memory leaks, unnecessary re-renders, inefficient algorithms, missing indexes`
    );
  }
  if (rules.bestPractices !== "off") {
    enabledRules.push(
      `- **Best Practices** (${rules.bestPractices === "error" ? "CRITICAL" : "WARNING"}): Check for error handling, null checks, async/await usage, proper typing, code organization`
    );
  }
  if (rules.codeStyle !== "off") {
    enabledRules.push(
      `- **Code Style** (${rules.codeStyle === "error" ? "CRITICAL" : "WARNING"}): Check for naming conventions, code duplication, function length, complexity`
    );
  }

  // Build company guidelines section
  let guidelinesSection = "";
  if (companyGuidelines) {
    guidelinesSection = `
## Company Coding Standards & Best Practices
The following are the company's specific coding standards and best practices. These rules take PRIORITY over general best practices. Flag violations as issues with category "companyGuidelines".

<company_guidelines>
${companyGuidelines}
</company_guidelines>

`;
  }

  const prompt = `You are an expert code reviewer. Review the following code changes and identify issues.

## File Information
- **File**: ${filePath}
- **Language**: ${language}

## Review Level
${levelInstructions[reviewLevel]}

## Rules to Check
${enabledRules.join("\n")}
${companyGuidelines ? `- **Company Guidelines** (CRITICAL): Violations of company-specific coding standards and best practices defined below` : ""}
${guidelinesSection}
${customPrompt ? `## Additional Instructions\n${customPrompt}\n` : ""}

## Code Changes (Diff)
Each line is prefixed with its actual file line number (e.g. "L   42: " means line 42 in the file). Removed lines have no line number prefix.
\`\`\`${language}
${diff}
\`\`\`

## Response Format
Respond with a JSON array of issues found. Each issue should have:
- \`severity\`: "critical", "warning", or "info"
- \`category\`: "security", "performance", "bestPractices", "codeStyle", or "companyGuidelines"
- \`line\`: the ACTUAL file line number from the "L" prefix annotations above (e.g. if the issue is on a line prefixed "L   42:", use 42). Use null if not specific to a line.
- \`message\`: brief description of the issue
- \`currentCode\`: the problematic code snippet (if applicable)
- \`suggestedFix\`: how to fix it (code snippet if applicable)
- \`explanation\`: why this is an issue${companyGuidelines ? " (reference company guidelines if applicable)" : ""}

If no issues are found, return an empty array: []

Example response:
\`\`\`json
[
  {
    "severity": "critical",
    "category": "security",
    "line": 45,
    "message": "SQL Injection Vulnerability",
    "currentCode": "const query = \`SELECT * FROM users WHERE id = '\${userId}'\`",
    "suggestedFix": "const query = 'SELECT * FROM users WHERE id = $1'; await db.query(query, [userId])",
    "explanation": "String interpolation in SQL queries allows attackers to inject malicious SQL code."
  }
]
\`\`\`

Respond ONLY with the JSON array, no additional text.`;

  return prompt;
}

export function buildBatchReviewPrompt(
  files: Array<{ filePath: string; language: string; diff: string }>,
  reviewLevel: ReviewLevel,
  rules: {
    security: RuleSeverity;
    performance: RuleSeverity;
    bestPractices: RuleSeverity;
    codeStyle: RuleSeverity;
  },
  customPrompt?: string,
  companyGuidelines?: string
): string {
  const levelInstructions = {
    strict: "Be thorough and flag any potential issues, even minor ones.",
    standard: "Focus on important issues that should be fixed before committing.",
    relaxed: "Only flag critical issues that absolutely must be fixed.",
  };

  const enabledRules: string[] = [];
  if (rules.security !== "off") {
    enabledRules.push(
      `- **Security** (${rules.security === "error" ? "CRITICAL" : "WARNING"}): SQL injection, XSS, command injection, hardcoded secrets, auth flaws`
    );
  }
  if (rules.performance !== "off") {
    enabledRules.push(
      `- **Performance** (${rules.performance === "error" ? "CRITICAL" : "WARNING"}): N+1 queries, memory leaks, inefficient algorithms`
    );
  }
  if (rules.bestPractices !== "off") {
    enabledRules.push(
      `- **Best Practices** (${rules.bestPractices === "error" ? "CRITICAL" : "WARNING"}): Error handling, null checks, async/await, typing`
    );
  }
  if (rules.codeStyle !== "off") {
    enabledRules.push(
      `- **Code Style** (${rules.codeStyle === "error" ? "CRITICAL" : "WARNING"}): Naming, duplication, complexity`
    );
  }

  // Build company guidelines section
  let guidelinesSection = "";
  if (companyGuidelines) {
    guidelinesSection = `
## Company Coding Standards & Best Practices
The following are the company's specific coding standards. These rules take PRIORITY. Flag violations as "companyGuidelines".

<company_guidelines>
${companyGuidelines}
</company_guidelines>

`;
  }

  const filesContent = files
    .map(
      (f, i) => `### File ${i + 1}: ${f.filePath} (${f.language})
Each line is prefixed with its actual file line number (e.g. "L   42: " means line 42). Removed lines have no line number prefix.
\`\`\`${f.language}
${f.diff}
\`\`\``
    )
    .join("\n\n");

  const prompt = `You are an expert code reviewer. Review the following code changes across multiple files.

## Review Level
${levelInstructions[reviewLevel]}

## Rules to Check
${enabledRules.join("\n")}
${companyGuidelines ? `- **Company Guidelines** (CRITICAL): Violations of company-specific coding standards` : ""}
${guidelinesSection}
${customPrompt ? `## Additional Instructions\n${customPrompt}\n` : ""}

## Files to Review
${filesContent}

## Response Format
Respond with a JSON object where keys are file paths and values are arrays of issues.

Each issue should have:
- \`severity\`: "critical", "warning", or "info"
- \`category\`: "security", "performance", "bestPractices", "codeStyle", or "companyGuidelines"
- \`line\`: the ACTUAL file line number from the "L" prefix annotations in the diff (e.g. if the issue is on a line prefixed "L   42:", use 42). Use null if not specific to a line.
- \`message\`: brief description
- \`currentCode\`: problematic code (if applicable)
- \`suggestedFix\`: how to fix it
- \`explanation\`: why this is an issue${companyGuidelines ? " (reference company guidelines if applicable)" : ""}

Example:
\`\`\`json
{
  "src/auth/login.ts": [
    {
      "severity": "critical",
      "category": "security",
      "line": 45,
      "message": "SQL Injection",
      "currentCode": "...",
      "suggestedFix": "...",
      "explanation": "..."
    }
  ],
  "src/utils/helper.ts": []
}
\`\`\`

Respond ONLY with the JSON object, no additional text.`;

  return prompt;
}
