#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "module";
import { initCommand } from "./commands/init.js";
import { configCommand } from "./commands/config.js";
import { reviewCommand } from "./commands/review.js";
import { checkCommand } from "./commands/check.js";
import { toggleCommand } from "./commands/toggle.js";
import {
  guidelinesAddCommand,
  guidelinesShowCommand,
  guidelinesRemoveCommand,
} from "./commands/guidelines.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

const program = new Command();

program
  .name("creoguard")
  .description(
    "AI-powered code review CLI that runs before every commit. Catch bugs, security issues, and best practice violations."
  )
  .version(packageJson.version);

// Initialize CreoGuard in current repository
program
  .command("init")
  .description("Initialize CreoGuard in the current Git repository")
  .option("-f, --force", "Overwrite existing configuration")
  .action(initCommand);

// Configuration management
program
  .command("config")
  .description("Manage CreoGuard configuration")
  .argument("<action>", "Action to perform: get, set, list, reset")
  .argument("[key]", "Configuration key")
  .argument("[value]", "Configuration value (for set action)")
  .action(configCommand);

// Review staged changes
program
  .command("review")
  .description("Review code changes")
  .option("-s, --staged", "Review only staged changes (default)")
  .option("-a, --all", "Review all uncommitted changes")
  .option("--files <files...>", "Review specific files")
  .option("-v, --verbose", "Show detailed output")
  .action(reviewCommand);

// Check specific file
program
  .command("check")
  .description("Check a specific file for issues")
  .argument("<file>", "File path to check")
  .option("-v, --verbose", "Show detailed output")
  .action(checkCommand);

// Enable/Disable hooks
program
  .command("enable")
  .description("Enable CreoGuard pre-commit hook")
  .action(() => toggleCommand(true));

program
  .command("disable")
  .description("Disable CreoGuard pre-commit hook temporarily")
  .action(() => toggleCommand(false));

// Guidelines management (company best practices PDF/MD)
const guidelinesCmd = program
  .command("guidelines")
  .description("Manage company coding guidelines and best practices");

guidelinesCmd
  .command("add")
  .description("Add company guidelines from a PDF or Markdown file")
  .argument("<file>", "Path to guidelines file (PDF, MD, or TXT)")
  .option("-g, --global", "Install as global guidelines (applies to all repos)")
  .option("-v, --verbose", "Show detailed output")
  .action(guidelinesAddCommand);

guidelinesCmd
  .command("show")
  .description("Show current guidelines configuration")
  .option("-v, --verbose", "Show guidelines content preview")
  .action(guidelinesShowCommand);

guidelinesCmd
  .command("remove")
  .description("Remove guidelines")
  .option("-g, --global", "Remove global guidelines")
  .action(guidelinesRemoveCommand);

// Parse arguments and run
program.parse();
