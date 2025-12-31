import * as fs from "fs";
import * as path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export interface GuidelinesContent {
  source: string;
  content: string;
  lastUpdated: Date;
}

// Cache for loaded guidelines
let guidelinesCache: GuidelinesContent | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Load company guidelines from a PDF file
 */
export async function loadGuidelinesFromPDF(pdfPath: string): Promise<string> {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`Guidelines PDF not found: ${pdfPath}`);
  }

  const pdfParse = require("pdf-parse");
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);

  return data.text;
}

/**
 * Load company guidelines from a text/markdown file
 */
export async function loadGuidelinesFromText(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Guidelines file not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Load guidelines from any supported file type
 */
export async function loadGuidelines(filePath: string): Promise<GuidelinesContent> {
  const now = Date.now();

  // Check cache
  if (guidelinesCache && now < cacheExpiry && guidelinesCache.source === filePath) {
    return guidelinesCache;
  }

  const ext = path.extname(filePath).toLowerCase();
  let content: string;

  switch (ext) {
    case ".pdf":
      content = await loadGuidelinesFromPDF(filePath);
      break;
    case ".txt":
    case ".md":
    case ".markdown":
      content = await loadGuidelinesFromText(filePath);
      break;
    default:
      // Try to read as text
      content = await loadGuidelinesFromText(filePath);
  }

  // Clean up the content
  content = cleanGuidelinesContent(content);

  const guidelines: GuidelinesContent = {
    source: filePath,
    content,
    lastUpdated: new Date(),
  };

  // Update cache
  guidelinesCache = guidelines;
  cacheExpiry = now + CACHE_DURATION;

  return guidelines;
}

/**
 * Clean up extracted text content
 */
function cleanGuidelinesContent(content: string): string {
  return content
    // Remove excessive whitespace
    .replace(/\s+/g, " ")
    // Restore paragraph breaks
    .replace(/\.\s+/g, ".\n\n")
    // Remove page numbers and headers that might repeat
    .replace(/Page \d+ of \d+/gi, "")
    // Trim
    .trim();
}

/**
 * Get guidelines path from project config directory
 */
export function getProjectGuidelinesPath(cwd: string = process.cwd()): string | null {
  const possiblePaths = [
    path.join(cwd, ".creoguard", "guidelines.pdf"),
    path.join(cwd, ".creoguard", "guidelines.md"),
    path.join(cwd, ".creoguard", "guidelines.txt"),
    path.join(cwd, ".creoguard", "best-practices.pdf"),
    path.join(cwd, ".creoguard", "best-practices.md"),
    path.join(cwd, ".creoguard", "coding-standards.pdf"),
    path.join(cwd, ".creoguard", "coding-standards.md"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Get guidelines path from global config directory
 */
export function getGlobalGuidelinesPath(): string | null {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const possiblePaths = [
    path.join(homeDir, ".creoguard", "guidelines.pdf"),
    path.join(homeDir, ".creoguard", "guidelines.md"),
    path.join(homeDir, ".creoguard", "guidelines.txt"),
    path.join(homeDir, ".creoguard", "best-practices.pdf"),
    path.join(homeDir, ".creoguard", "best-practices.md"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Copy a guidelines file to the appropriate location
 */
export async function installGuidelines(
  sourcePath: string,
  scope: "project" | "global",
  cwd: string = process.cwd()
): Promise<string> {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  const ext = path.extname(sourcePath).toLowerCase();
  const fileName = `guidelines${ext}`;

  let targetDir: string;
  if (scope === "project") {
    targetDir = path.join(cwd, ".creoguard");
  } else {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    targetDir = path.join(homeDir, ".creoguard");
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = path.join(targetDir, fileName);
  fs.copyFileSync(sourcePath, targetPath);

  // Clear cache
  guidelinesCache = null;

  return targetPath;
}

/**
 * Summarize guidelines for use in prompts (to manage token limits)
 */
export function summarizeGuidelines(content: string, maxLength: number = 4000): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Try to intelligently truncate
  const sections = content.split(/\n\n+/);
  let result = "";

  for (const section of sections) {
    if (result.length + section.length + 2 > maxLength) {
      break;
    }
    result += section + "\n\n";
  }

  if (result.length === 0) {
    // If even one section is too long, just truncate
    result = content.substring(0, maxLength - 3) + "...";
  }

  return result.trim();
}

/**
 * Clear the guidelines cache
 */
export function clearGuidelinesCache(): void {
  guidelinesCache = null;
  cacheExpiry = 0;
}
