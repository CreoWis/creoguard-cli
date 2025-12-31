import { checkFile } from "../core/reviewer.js";
import { logger } from "../utils/logger.js";
import * as fs from "fs";
import * as path from "path";

interface CheckOptions {
  verbose?: boolean;
}

export async function checkCommand(
  file: string,
  options: CheckOptions
): Promise<void> {
  const cwd = process.cwd();
  const filePath = path.isAbsolute(file) ? file : path.relative(cwd, path.resolve(cwd, file));

  // Check if file exists
  const absolutePath = path.resolve(cwd, file);
  if (!fs.existsSync(absolutePath)) {
    logger.error(`File not found: ${file}`);
    process.exit(1);
  }

  // Check if it's a file (not a directory)
  const stats = fs.statSync(absolutePath);
  if (stats.isDirectory()) {
    logger.error(`${file} is a directory. Please specify a file.`);
    process.exit(1);
  }

  try {
    const result = await checkFile(filePath, { verbose: options.verbose });

    // Exit with error code if critical issues found
    const criticalCount = result.issues.filter((i) => i.severity === "critical").length;
    if (criticalCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    logger.error("Check failed");
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
