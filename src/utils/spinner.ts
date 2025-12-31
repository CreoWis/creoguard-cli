import ora, { Ora } from "ora";
import chalk from "chalk";

export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: "cyan",
    spinner: "dots",
  });
}

export async function withSpinner<T>(
  text: string,
  fn: () => Promise<T>,
  successText?: string,
  failText?: string
): Promise<T> {
  const spinner = createSpinner(text);
  spinner.start();

  try {
    const result = await fn();
    spinner.succeed(successText || chalk.green("Done"));
    return result;
  } catch (error) {
    spinner.fail(failText || chalk.red("Failed"));
    throw error;
  }
}

export function reviewSpinner(fileName: string): Ora {
  return ora({
    text: `Reviewing ${chalk.cyan(fileName)}`,
    color: "cyan",
    spinner: "dots",
  });
}
