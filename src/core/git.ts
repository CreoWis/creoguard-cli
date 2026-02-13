import { simpleGit, SimpleGit } from "simple-git";
import * as path from "path";
import * as fs from "fs";

export interface StagedFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
}

export interface FileDiff {
  path: string;
  language: string;
  diff: string;
  additions: string[];
  deletions: string[];
}

const git: SimpleGit = simpleGit();

export async function isGitRepository(cwd: string = process.cwd()): Promise<boolean> {
  try {
    const gitDir = path.join(cwd, ".git");
    return fs.existsSync(gitDir);
  } catch {
    return false;
  }
}

export async function getGitRoot(cwd: string = process.cwd()): Promise<string | null> {
  try {
    const result = await simpleGit(cwd).revparse(["--show-toplevel"]);
    return result.trim();
  } catch {
    return null;
  }
}

export async function getStagedFiles(cwd: string = process.cwd()): Promise<StagedFile[]> {
  const gitInstance = simpleGit(cwd);
  const status = await gitInstance.status();

  const files: StagedFile[] = [];

  for (const file of status.staged) {
    files.push({ path: file, status: "modified" });
  }

  for (const file of status.created) {
    if (status.staged.includes(file) || (await isFileStaged(file, cwd))) {
      files.push({ path: file, status: "added" });
    }
  }

  for (const file of status.deleted) {
    if (await isFileStaged(file, cwd)) {
      files.push({ path: file, status: "deleted" });
    }
  }

  for (const file of status.renamed) {
    files.push({ path: file.to, status: "renamed" });
  }

  return files;
}

async function isFileStaged(file: string, cwd: string): Promise<boolean> {
  try {
    const gitInstance = simpleGit(cwd);
    const diff = await gitInstance.diff(["--cached", "--name-only"]);
    return diff.includes(file);
  } catch {
    return false;
  }
}

export async function getUncommittedFiles(cwd: string = process.cwd()): Promise<StagedFile[]> {
  const gitInstance = simpleGit(cwd);
  const status = await gitInstance.status();

  const files: StagedFile[] = [];

  for (const file of status.modified) {
    files.push({ path: file, status: "modified" });
  }

  for (const file of status.not_added) {
    files.push({ path: file, status: "added" });
  }

  for (const file of status.created) {
    files.push({ path: file, status: "added" });
  }

  for (const file of status.deleted) {
    files.push({ path: file, status: "deleted" });
  }

  // Add staged files too
  const stagedFiles = await getStagedFiles(cwd);
  for (const staged of stagedFiles) {
    if (!files.find(f => f.path === staged.path)) {
      files.push(staged);
    }
  }

  return files;
}

export async function getStagedDiff(cwd: string = process.cwd()): Promise<string> {
  const gitInstance = simpleGit(cwd);
  return await gitInstance.diff(["--cached"]);
}

export async function getFileDiff(
  filePath: string,
  staged: boolean = true,
  cwd: string = process.cwd()
): Promise<FileDiff | null> {
  const gitInstance = simpleGit(cwd);

  try {
    const args = staged ? ["--cached", "--", filePath] : ["--", filePath];
    const diff = await gitInstance.diff(args);

    if (!diff.trim()) {
      // File might be newly added, get full content
      const fullPath = path.join(cwd, filePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        return {
          path: filePath,
          language: getLanguageFromExtension(filePath),
          diff: content,
          additions: content.split("\n"),
          deletions: [],
        };
      }
      return null;
    }

    const additions: string[] = [];
    const deletions: string[] = [];

    const lines = diff.split("\n");
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        additions.push(line.substring(1));
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        deletions.push(line.substring(1));
      }
    }

    return {
      path: filePath,
      language: getLanguageFromExtension(filePath),
      diff,
      additions,
      deletions,
    };
  } catch {
    return null;
  }
}

export async function getFileContent(
  filePath: string,
  cwd: string = process.cwd()
): Promise<string | null> {
  const fullPath = path.join(cwd, filePath);
  try {
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, "utf-8");
    }
  } catch {
    // Ignore
  }
  return null;
}

export function getLanguageFromExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  const languageMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".rb": "ruby",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".kt": "kotlin",
    ".swift": "swift",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".php": "php",
    ".vue": "vue",
    ".svelte": "svelte",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "sass",
    ".less": "less",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".md": "markdown",
    ".sql": "sql",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "zsh",
    ".fish": "fish",
    ".ps1": "powershell",
    ".dockerfile": "dockerfile",
    ".tf": "terraform",
    ".hcl": "hcl",
  };

  return languageMap[ext] || "text";
}

/**
 * Annotates a unified diff with actual file line numbers so the LLM
 * can accurately reference line numbers in the new version of the file.
 *
 * Input:  raw unified diff from git
 * Output: diff lines prefixed with "L<number>: " for context/added lines,
 *         or "      : " for removed lines and headers.
 */
export function annotateDiffWithLineNumbers(diff: string): string {
  const lines = diff.split("\n");
  const annotated: string[] = [];
  let currentNewLine = 0;

  for (const line of lines) {
    // Parse hunk header to get the new file starting line number
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      currentNewLine = parseInt(hunkMatch[1], 10);
      annotated.push(line);
      continue;
    }

    // Skip diff metadata lines (---, +++, diff --git, index, etc.)
    if (
      line.startsWith("diff ") ||
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("\\")
    ) {
      annotated.push(line);
      continue;
    }

    if (line.startsWith("-")) {
      // Removed line — no new-file line number
      annotated.push(`       : ${line}`);
    } else if (line.startsWith("+")) {
      // Added line — has a new-file line number
      annotated.push(`L${String(currentNewLine).padStart(5)}: ${line}`);
      currentNewLine++;
    } else {
      // Context line — has a new-file line number
      annotated.push(`L${String(currentNewLine).padStart(5)}: ${line}`);
      currentNewLine++;
    }
  }

  return annotated.join("\n");
}

/**
 * Adds line numbers to plain file content (for newly added files
 * that have no diff).
 */
export function annotateContentWithLineNumbers(content: string): string {
  const lines = content.split("\n");
  return lines
    .map((line, i) => `L${String(i + 1).padStart(5)}: ${line}`)
    .join("\n");
}

export async function getHooksPath(cwd: string = process.cwd()): Promise<string> {
  const gitRoot = await getGitRoot(cwd);
  if (!gitRoot) {
    throw new Error("Not a git repository");
  }

  // Check if there's a custom hooks path configured
  try {
    const gitInstance = simpleGit(cwd);
    const config = await gitInstance.getConfig("core.hooksPath");
    if (config.value) {
      return path.isAbsolute(config.value)
        ? config.value
        : path.join(gitRoot, config.value);
    }
  } catch {
    // Ignore
  }

  return path.join(gitRoot, ".git", "hooks");
}

export async function getCurrentBranch(cwd: string = process.cwd()): Promise<string | null> {
  try {
    const gitInstance = simpleGit(cwd);
    const branch = await gitInstance.revparse(["--abbrev-ref", "HEAD"]);
    return branch.trim();
  } catch {
    return null;
  }
}
