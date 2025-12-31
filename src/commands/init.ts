import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger.js";
import { createSpinner } from "../utils/spinner.js";
import { isGitRepository, getHooksPath, getGitRoot } from "../core/git.js";
import {
  isInitialized,
  saveProjectConfig,
  loadGlobalConfig,
} from "../config/loader.js";
import { DEFAULT_PROJECT_CONFIG } from "../config/schema.js";

interface InitOptions {
  force?: boolean;
}

const PRE_COMMIT_HOOK = `#!/bin/sh
# CreoGuard pre-commit hook
# This hook runs CreoGuard to review staged changes before committing

# Check if creoguard is disabled
if [ -f ".creoguard/disabled" ]; then
  echo "CreoGuard is disabled. Skipping review."
  exit 0
fi

# Run CreoGuard review
creoguard review --staged

# Exit with CreoGuard's exit code
exit $?
`;

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();

  // Check if it's a git repository
  if (!(await isGitRepository(cwd))) {
    logger.error("Not a Git repository. Please run this command in a Git repository.");
    process.exit(1);
  }

  // Check if already initialized
  if ((await isInitialized(cwd)) && !options.force) {
    logger.warning("CreoGuard is already initialized in this repository.");
    logger.info("Use --force to reinitialize.");
    return;
  }

  const spinner = createSpinner("Initializing CreoGuard...");
  spinner.start();

  try {
    // Create .creoguard directory
    const creoguardDir = path.join(cwd, ".creoguard");
    if (!fs.existsSync(creoguardDir)) {
      fs.mkdirSync(creoguardDir, { recursive: true });
    }

    // Save default project config
    await saveProjectConfig(DEFAULT_PROJECT_CONFIG, cwd);

    // Setup git hook
    const hooksPath = await getHooksPath(cwd);
    if (!fs.existsSync(hooksPath)) {
      fs.mkdirSync(hooksPath, { recursive: true });
    }

    const preCommitPath = path.join(hooksPath, "pre-commit");

    // Check if pre-commit hook already exists
    if (fs.existsSync(preCommitPath) && !options.force) {
      // Append to existing hook
      const existingHook = fs.readFileSync(preCommitPath, "utf-8");
      if (!existingHook.includes("creoguard")) {
        const updatedHook = existingHook + "\n\n" + PRE_COMMIT_HOOK.split("\n").slice(1).join("\n");
        fs.writeFileSync(preCommitPath, updatedHook);
      }
    } else {
      // Create new hook
      fs.writeFileSync(preCommitPath, PRE_COMMIT_HOOK);
    }

    // Make hook executable
    fs.chmodSync(preCommitPath, "755");

    // Add .creoguard to .gitignore if not already there
    const gitignorePath = path.join(cwd, ".gitignore");
    let gitignoreContent = "";
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
    }

    if (!gitignoreContent.includes(".creoguard/disabled")) {
      const addition = "\n# CreoGuard\n.creoguard/disabled\n";
      fs.appendFileSync(gitignorePath, addition);
    }

    spinner.succeed("CreoGuard initialized successfully!");

    // Check if API key is configured
    const globalConfig = await loadGlobalConfig();
    if (!globalConfig.apiKey) {
      logger.newLine();
      logger.warning("API key not configured yet.");
      logger.info("Run the following command to set your API key:");
      logger.newLine();
      console.log("  creoguard config set apiKey <your-api-key>");
      console.log("  creoguard config set provider openai  # or anthropic, ollama");
      logger.newLine();
    }

    // Show success message
    logger.newLine();
    logger.box(
      "CreoGuard will now review your code before each commit.\n\n" +
      "Configuration: .creoguard/config.json\n" +
      "Disable temporarily: creoguard disable\n" +
      "Skip once: git commit --no-verify",
      "Setup Complete"
    );

  } catch (error) {
    spinner.fail("Failed to initialize CreoGuard");
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
