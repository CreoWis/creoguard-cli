import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger.js";
import { isGitRepository, getGitRoot } from "../core/git.js";
import { isInitialized } from "../config/loader.js";

export async function toggleCommand(enable: boolean): Promise<void> {
  const cwd = process.cwd();

  // Check if it's a git repository
  if (!(await isGitRepository(cwd))) {
    logger.error("Not a Git repository.");
    process.exit(1);
  }

  // Check if CreoGuard is initialized
  if (!(await isInitialized(cwd))) {
    logger.error("CreoGuard is not initialized in this repository.");
    logger.info("Run 'creoguard init' to set up CreoGuard first.");
    process.exit(1);
  }

  const gitRoot = await getGitRoot(cwd);
  if (!gitRoot) {
    logger.error("Could not find Git root.");
    process.exit(1);
  }

  const disabledFilePath = path.join(gitRoot, ".creoguard", "disabled");

  if (enable) {
    // Enable by removing the disabled file
    if (fs.existsSync(disabledFilePath)) {
      fs.unlinkSync(disabledFilePath);
      logger.success("CreoGuard enabled. Code will be reviewed before commits.");
    } else {
      logger.info("CreoGuard is already enabled.");
    }
  } else {
    // Disable by creating the disabled file
    const creoguardDir = path.dirname(disabledFilePath);
    if (!fs.existsSync(creoguardDir)) {
      fs.mkdirSync(creoguardDir, { recursive: true });
    }

    fs.writeFileSync(disabledFilePath, `Disabled at ${new Date().toISOString()}\n`);
    logger.success("CreoGuard disabled temporarily.");
    logger.info("Run 'creoguard enable' to re-enable.");
    logger.newLine();
    logger.warning("Remember: Code reviews help catch bugs before they reach production!");
  }
}
