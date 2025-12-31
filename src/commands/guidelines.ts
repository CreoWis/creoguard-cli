import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger.js";
import { createSpinner } from "../utils/spinner.js";
import {
  installGuidelines,
  loadGuidelines,
  getProjectGuidelinesPath,
  getGlobalGuidelinesPath,
} from "../core/guidelines.js";

interface GuidelinesOptions {
  global?: boolean;
  verbose?: boolean;
}

export async function guidelinesAddCommand(
  filePath: string,
  options: GuidelinesOptions
): Promise<void> {
  const cwd = process.cwd();
  const scope = options.global ? "global" : "project";

  // Resolve the file path
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(cwd, filePath);

  // Check if file exists
  if (!fs.existsSync(absolutePath)) {
    logger.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  // Check file extension
  const ext = path.extname(absolutePath).toLowerCase();
  if (![".pdf", ".md", ".txt", ".markdown"].includes(ext)) {
    logger.warning(`Unsupported file type: ${ext}`);
    logger.info("Supported formats: PDF, Markdown (.md), Text (.txt)");
  }

  const spinner = createSpinner(`Installing ${scope} guidelines...`);
  spinner.start();

  try {
    // Validate the file can be parsed
    await loadGuidelines(absolutePath);

    // Install the guidelines
    const targetPath = await installGuidelines(absolutePath, scope, cwd);

    spinner.succeed(`Guidelines installed successfully!`);

    logger.newLine();
    logger.success(`Guidelines saved to: ${targetPath}`);
    logger.newLine();

    if (scope === "global") {
      logger.info("These guidelines will be applied to all repositories.");
      logger.info("Projects can disable global guidelines with:");
      logger.info('  Set "useGlobalGuidelines": false in .creoguard/config.json');
    } else {
      logger.info("These guidelines will be applied to this repository only.");
      logger.info("Make sure to commit .creoguard/guidelines.* to share with your team.");
    }
  } catch (error) {
    spinner.fail("Failed to install guidelines");
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export async function guidelinesShowCommand(options: GuidelinesOptions): Promise<void> {
  const cwd = process.cwd();

  logger.newLine();
  logger.header("Company Guidelines Configuration");
  logger.newLine();

  // Check project guidelines
  const projectPath = getProjectGuidelinesPath(cwd);
  if (projectPath) {
    logger.success(`Project guidelines: ${projectPath}`);
    if (options.verbose) {
      try {
        const guidelines = await loadGuidelines(projectPath);
        logger.newLine();
        console.log("  Content preview (first 500 chars):");
        console.log("  " + "-".repeat(50));
        console.log("  " + guidelines.content.substring(0, 500).replace(/\n/g, "\n  "));
        if (guidelines.content.length > 500) {
          console.log("  ...");
        }
        console.log("  " + "-".repeat(50));
      } catch (error) {
        logger.warning(`  Failed to read: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } else {
    logger.info("Project guidelines: Not configured");
    logger.info("  Add with: creoguard guidelines add <path-to-file>");
  }

  logger.newLine();

  // Check global guidelines
  const globalPath = getGlobalGuidelinesPath();
  if (globalPath) {
    logger.success(`Global guidelines: ${globalPath}`);
    if (options.verbose) {
      try {
        const guidelines = await loadGuidelines(globalPath);
        logger.newLine();
        console.log("  Content preview (first 500 chars):");
        console.log("  " + "-".repeat(50));
        console.log("  " + guidelines.content.substring(0, 500).replace(/\n/g, "\n  "));
        if (guidelines.content.length > 500) {
          console.log("  ...");
        }
        console.log("  " + "-".repeat(50));
      } catch (error) {
        logger.warning(`  Failed to read: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } else {
    logger.info("Global guidelines: Not configured");
    logger.info("  Add with: creoguard guidelines add --global <path-to-file>");
  }

  logger.newLine();
}

export async function guidelinesRemoveCommand(options: GuidelinesOptions): Promise<void> {
  const cwd = process.cwd();
  const scope = options.global ? "global" : "project";

  let guidelinesPath: string | null;

  if (scope === "global") {
    guidelinesPath = getGlobalGuidelinesPath();
  } else {
    guidelinesPath = getProjectGuidelinesPath(cwd);
  }

  if (!guidelinesPath) {
    logger.info(`No ${scope} guidelines configured.`);
    return;
  }

  try {
    fs.unlinkSync(guidelinesPath);
    logger.success(`Removed ${scope} guidelines: ${guidelinesPath}`);
  } catch (error) {
    logger.error(`Failed to remove guidelines: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
