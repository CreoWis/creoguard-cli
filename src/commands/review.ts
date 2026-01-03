import { reviewCode, ReviewOptions } from "../core/reviewer.js";
import { logger } from "../utils/logger.js";
import { isGitRepository } from "../core/git.js";
import { isInitialized } from "../config/loader.js";

export async function reviewCommand(options: ReviewOptions): Promise<void> {
  const cwd = process.cwd();

  // Check if it's a git repository
  if (!(await isGitRepository(cwd))) {
    logger.error("Not a Git repository.");
    process.exit(1);
  }

  // Check if CreoGuard is initialized - exit if not to avoid unnecessary API calls
  if (!(await isInitialized(cwd))) {
    logger.warning("CreoGuard is not initialized in this repository.");
    logger.info("Run 'creoguard init' to set up CreoGuard.");
    process.exit(0);
  }

  try {
    const summary = await reviewCode({
      staged: options.staged ?? !options.all,
      all: options.all,
      files: options.files,
      verbose: options.verbose,
    });

    // Exit with error code if blocked
    if (summary.blocked) {
      process.exit(1);
    }
  } catch (error) {
    logger.error("Review failed");
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
