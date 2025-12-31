import chalk from "chalk";
import boxen from "boxen";

export const logger = {
  info: (message: string) => {
    console.log(chalk.blue("ℹ"), message);
  },

  success: (message: string) => {
    console.log(chalk.green("✔"), message);
  },

  warning: (message: string) => {
    console.log(chalk.yellow("⚠"), message);
  },

  error: (message: string) => {
    console.log(chalk.red("✖"), message);
  },

  critical: (message: string) => {
    console.log(chalk.bgRed.white(" CRITICAL "), message);
  },

  box: (message: string, title?: string) => {
    console.log(
      boxen(message, {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "cyan",
        title: title,
        titleAlignment: "center",
      })
    );
  },

  header: (message: string) => {
    console.log(
      boxen(message, {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        borderStyle: "round",
        borderColor: "cyan",
      })
    );
  },

  divider: () => {
    console.log(chalk.gray("─".repeat(60)));
  },

  newLine: () => {
    console.log();
  },

  // For review results
  fileHeader: (filePath: string) => {
    console.log();
    console.log(chalk.cyan("┌─"), chalk.bold.white(filePath), chalk.cyan("─".repeat(Math.max(0, 50 - filePath.length))));
  },

  fileFooter: () => {
    console.log(chalk.cyan("└" + "─".repeat(58)));
  },

  issue: (
    severity: "critical" | "warning" | "info",
    line: number | null,
    message: string
  ) => {
    const lineInfo = line ? `[line ${line}]` : "";

    switch (severity) {
      case "critical":
        console.log(chalk.cyan("│"));
        console.log(
          chalk.cyan("│  "),
          chalk.red("✖ CRITICAL"),
          chalk.gray(lineInfo),
          chalk.white(message)
        );
        break;
      case "warning":
        console.log(chalk.cyan("│"));
        console.log(
          chalk.cyan("│  "),
          chalk.yellow("⚠ WARNING"),
          chalk.gray(lineInfo),
          chalk.white(message)
        );
        break;
      case "info":
        console.log(chalk.cyan("│"));
        console.log(
          chalk.cyan("│  "),
          chalk.blue("ℹ INFO"),
          chalk.gray(lineInfo),
          chalk.white(message)
        );
        break;
    }
  },

  codeBlock: (code: string, type: "current" | "suggested" = "current") => {
    const prefix = type === "current" ? chalk.red("-") : chalk.green("+");
    const label = type === "current"
      ? chalk.gray("   Current:")
      : chalk.gray("   Suggested fix:");

    console.log(chalk.cyan("│"));
    console.log(chalk.cyan("│  "), label);

    const lines = code.split("\n");
    for (const line of lines) {
      console.log(chalk.cyan("│  "), chalk.gray("│"), prefix, line);
    }
  },

  summary: (critical: number, warnings: number, info: number) => {
    const parts = [];
    if (critical > 0) parts.push(chalk.red(`${critical} critical`));
    if (warnings > 0) parts.push(chalk.yellow(`${warnings} warning${warnings > 1 ? 's' : ''}`));
    if (info > 0) parts.push(chalk.blue(`${info} info`));

    const status = critical > 0
      ? chalk.red("✖")
      : warnings > 0
        ? chalk.yellow("⚠")
        : chalk.green("✔");

    if (parts.length === 0) {
      console.log(
        boxen(chalk.green("✔ No issues found! Your code looks good."), {
          padding: { top: 0, bottom: 0, left: 1, right: 1 },
          borderStyle: "round",
          borderColor: "green",
        })
      );
    } else {
      console.log(
        boxen(`${status} Review Complete: ${parts.join(" · ")}`, {
          padding: { top: 0, bottom: 0, left: 1, right: 1 },
          borderStyle: "round",
          borderColor: critical > 0 ? "red" : warnings > 0 ? "yellow" : "blue",
        })
      );
    }
  },

  blocked: (reason: string) => {
    console.log();
    console.log(
      boxen(
        chalk.red(`✖ Commit blocked: ${reason}\n\n`) +
        chalk.gray("Options:\n") +
        chalk.white("  • Fix the issues and commit again\n") +
        chalk.white("  • creoguard disable (skip review temporarily)\n") +
        chalk.white("  • git commit --no-verify (bypass this time)"),
        {
          padding: 1,
          borderStyle: "round",
          borderColor: "red",
        }
      )
    );
  },
};
