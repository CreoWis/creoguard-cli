import { logger } from "../utils/logger.js";
import { createSpinner } from "../utils/spinner.js";
import { getStagedFiles, getFileDiff, getUncommittedFiles, StagedFile, FileDiff } from "./git.js";
import { loadFullConfig } from "../config/loader.js";
import { buildReviewPrompt, buildBatchReviewPrompt } from "../prompts/review.js";
import {
  createLLMProvider,
  parseReviewResponse,
  parseBatchReviewResponse,
  ReviewIssue,
  ReviewResult,
} from "../llm/index.js";
import { minimatch } from "minimatch";
import {
  loadGuidelines,
  getProjectGuidelinesPath,
  getGlobalGuidelinesPath,
  summarizeGuidelines,
} from "./guidelines.js";

export interface ReviewOptions {
  staged?: boolean;
  all?: boolean;
  files?: string[];
  verbose?: boolean;
}

export interface ReviewSummary {
  totalFiles: number;
  reviewedFiles: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  results: ReviewResult[];
  blocked: boolean;
}

/**
 * Load company guidelines from configured paths
 */
async function loadCompanyGuidelines(
  cwd: string,
  config: { guidelinesPath?: string; useGlobalGuidelines?: boolean },
  globalGuidelinesPath?: string,
  verbose?: boolean
): Promise<string | undefined> {
  const guidelinesSources: string[] = [];

  // Check for project-specific guidelines
  const projectGuidelinesPath = config.guidelinesPath || getProjectGuidelinesPath(cwd);
  if (projectGuidelinesPath) {
    try {
      const guidelines = await loadGuidelines(projectGuidelinesPath);
      guidelinesSources.push(guidelines.content);
      if (verbose) {
        logger.info(`Loaded project guidelines from: ${projectGuidelinesPath}`);
      }
    } catch (error) {
      if (verbose) {
        logger.warning(`Failed to load project guidelines: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Check for global guidelines (if enabled)
  if (config.useGlobalGuidelines !== false) {
    const globalPath = globalGuidelinesPath || getGlobalGuidelinesPath();
    if (globalPath && globalPath !== projectGuidelinesPath) {
      try {
        const guidelines = await loadGuidelines(globalPath);
        guidelinesSources.push(guidelines.content);
        if (verbose) {
          logger.info(`Loaded global guidelines from: ${globalPath}`);
        }
      } catch (error) {
        if (verbose) {
          logger.warning(`Failed to load global guidelines: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  if (guidelinesSources.length === 0) {
    return undefined;
  }

  // Combine and summarize guidelines to fit within token limits
  const combined = guidelinesSources.join("\n\n---\n\n");
  return summarizeGuidelines(combined, 6000); // Limit to ~6000 chars to leave room for code
}

export async function reviewCode(options: ReviewOptions): Promise<ReviewSummary> {
  const cwd = process.cwd();
  const config = await loadFullConfig(cwd);

  if (!config.enabled) {
    logger.info("CreoGuard is disabled for this repository.");
    return {
      totalFiles: 0,
      reviewedFiles: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      results: [],
      blocked: false,
    };
  }

  // Get files to review
  let filesToReview: StagedFile[] = [];

  if (options.files && options.files.length > 0) {
    filesToReview = options.files.map((f) => ({ path: f, status: "modified" as const }));
  } else if (options.all) {
    filesToReview = await getUncommittedFiles(cwd);
  } else {
    // Default to staged files
    filesToReview = await getStagedFiles(cwd);
  }

  if (filesToReview.length === 0) {
    logger.info("No files to review.");
    return {
      totalFiles: 0,
      reviewedFiles: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      results: [],
      blocked: false,
    };
  }

  // Filter out ignored files
  const filteredFiles = filesToReview.filter((file) => {
    // Skip deleted files
    if (file.status === "deleted") {
      return false;
    }

    // Check against ignore patterns
    for (const pattern of config.ignore) {
      if (minimatch(file.path, pattern)) {
        if (options.verbose) {
          logger.info(`Skipping ${file.path} (matches ignore pattern: ${pattern})`);
        }
        return false;
      }
    }
    return true;
  });

  if (filteredFiles.length === 0) {
    logger.info("All files match ignore patterns. Nothing to review.");
    return {
      totalFiles: filesToReview.length,
      reviewedFiles: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      results: [],
      blocked: false,
    };
  }

  logger.header(`🔍 CreoGuard reviewing ${filteredFiles.length} file${filteredFiles.length > 1 ? "s" : ""}...`);
  logger.newLine();

  // Load company guidelines
  const companyGuidelines = await loadCompanyGuidelines(
    cwd,
    config,
    config.guidelinesPath,
    options.verbose
  );

  if (companyGuidelines && options.verbose) {
    logger.info("Company guidelines loaded and will be applied to review.");
  }

  // Get diffs for all files
  const diffs: FileDiff[] = [];
  for (const file of filteredFiles) {
    const diff = await getFileDiff(file.path, options.staged !== false, cwd);
    if (diff && diff.diff.trim()) {
      diffs.push(diff);
    }
  }

  if (diffs.length === 0) {
    logger.info("No changes to review.");
    return {
      totalFiles: filesToReview.length,
      reviewedFiles: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      results: [],
      blocked: false,
    };
  }

  // Create LLM provider
  const provider = await createLLMProvider();

  // Check if provider is configured
  if (!(await provider.isConfigured())) {
    logger.error("LLM provider is not configured.");
    logger.info("Run: creoguard config set apiKey <your-api-key>");
    process.exit(1);
  }

  const results: ReviewResult[] = [];
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  // Decide whether to batch or review individually
  const useBatch = diffs.length > 1 && diffs.length <= 5;

  if (useBatch) {
    // Batch review for multiple files
    const spinner = createSpinner(`Reviewing ${diffs.length} files...`);
    spinner.start();

    try {
      const prompt = buildBatchReviewPrompt(
        diffs.map((d) => ({ filePath: d.path, language: d.language, diff: d.diff })),
        config.reviewLevel,
        config.rules,
        config.customPrompt,
        companyGuidelines
      );

      const response = await provider.review(prompt);
      const batchResults = parseBatchReviewResponse(response, options.verbose);

      spinner.succeed(`Reviewed ${diffs.length} files`);

      // Process results
      for (const diff of diffs) {
        // Try exact match first, then try to find a matching key
        let issues = batchResults[diff.path];

        if (!issues) {
          // Try to find a key that contains or matches the filename
          const filename = diff.path.split('/').pop();
          for (const key of Object.keys(batchResults)) {
            if (key === diff.path || key.endsWith(diff.path) || diff.path.endsWith(key) || key.includes(filename || '')) {
              issues = batchResults[key];
              break;
            }
          }
        }

        // Check for _default key (when LLM returns array instead of object)
        if (!issues && batchResults["_default"]) {
          issues = batchResults["_default"];
        }

        issues = issues || [];
        results.push({ filePath: diff.path, issues });

        for (const issue of issues) {
          switch (issue.severity) {
            case "critical":
              criticalCount++;
              break;
            case "warning":
              warningCount++;
              break;
            case "info":
              infoCount++;
              break;
          }
        }
      }
    } catch (error) {
      spinner.fail("Review failed");
      throw error;
    }
  } else {
    // Review files individually
    for (const diff of diffs) {
      const spinner = createSpinner(`Reviewing ${diff.path}...`);
      spinner.start();

      try {
        const prompt = buildReviewPrompt({
          filePath: diff.path,
          language: diff.language,
          diff: diff.diff,
          reviewLevel: config.reviewLevel,
          rules: config.rules,
          customPrompt: config.customPrompt,
          companyGuidelines,
        });

        const response = await provider.review(prompt);
        const issues = parseReviewResponse(response);

        spinner.succeed(`Reviewed ${diff.path}`);

        results.push({ filePath: diff.path, issues });

        for (const issue of issues) {
          switch (issue.severity) {
            case "critical":
              criticalCount++;
              break;
            case "warning":
              warningCount++;
              break;
            case "info":
              infoCount++;
              break;
          }
        }
      } catch (error) {
        spinner.fail(`Failed to review ${diff.path}`);
        if (options.verbose) {
          logger.error(error instanceof Error ? error.message : String(error));
        }
      }
    }
  }

  // Display results
  logger.newLine();
  displayResults(results, options.verbose);

  // Summary
  logger.newLine();
  logger.summary(criticalCount, warningCount, infoCount);

  // Determine if we should block
  const blocked = config.blockOnCritical && criticalCount > 0;

  if (blocked) {
    logger.blocked(`${criticalCount} critical issue${criticalCount > 1 ? "s" : ""} must be fixed`);
  }

  return {
    totalFiles: filesToReview.length,
    reviewedFiles: diffs.length,
    criticalCount,
    warningCount,
    infoCount,
    results,
    blocked,
  };
}

function displayResults(results: ReviewResult[], verbose?: boolean): void {
  for (const result of results) {
    if (result.issues.length === 0) {
      continue;
    }

    logger.fileHeader(result.filePath);

    for (const issue of result.issues) {
      logger.issue(issue.severity, issue.line, issue.message);

      if (issue.currentCode) {
        logger.codeBlock(issue.currentCode, "current");
      }

      if (issue.suggestedFix) {
        logger.codeBlock(issue.suggestedFix, "suggested");
      }

      if (verbose && issue.explanation) {
        console.log();
        console.log("   ", issue.explanation);
      }
    }

    logger.fileFooter();
  }
}

export async function checkFile(
  filePath: string,
  options: { verbose?: boolean }
): Promise<ReviewResult> {
  const cwd = process.cwd();
  const config = await loadFullConfig(cwd);

  // Check if file should be ignored
  for (const pattern of config.ignore) {
    if (minimatch(filePath, pattern)) {
      logger.warning(`File matches ignore pattern: ${pattern}`);
      return { filePath, issues: [] };
    }
  }

  const diff = await getFileDiff(filePath, false, cwd);

  if (!diff) {
    logger.error(`Could not read file: ${filePath}`);
    return { filePath, issues: [] };
  }

  const spinner = createSpinner(`Checking ${filePath}...`);
  spinner.start();

  try {
    const provider = await createLLMProvider();

    if (!(await provider.isConfigured())) {
      spinner.fail("LLM provider not configured");
      logger.info("Run: creoguard config set apiKey <your-api-key>");
      return { filePath, issues: [] };
    }

    // Load company guidelines
    const companyGuidelines = await loadCompanyGuidelines(
      cwd,
      config,
      config.guidelinesPath,
      options.verbose
    );

    const prompt = buildReviewPrompt({
      filePath: diff.path,
      language: diff.language,
      diff: diff.diff,
      reviewLevel: config.reviewLevel,
      rules: config.rules,
      customPrompt: config.customPrompt,
      companyGuidelines,
    });

    const response = await provider.review(prompt);
    const issues = parseReviewResponse(response);

    spinner.succeed(`Checked ${filePath}`);

    const result = { filePath, issues };

    // Display results
    logger.newLine();
    displayResults([result], options.verbose);

    // Summary
    const criticalCount = issues.filter((i) => i.severity === "critical").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const infoCount = issues.filter((i) => i.severity === "info").length;

    logger.newLine();
    logger.summary(criticalCount, warningCount, infoCount);

    return result;
  } catch (error) {
    spinner.fail(`Failed to check ${filePath}`);
    logger.error(error instanceof Error ? error.message : String(error));
    return { filePath, issues: [] };
  }
}
