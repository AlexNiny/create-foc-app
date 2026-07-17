import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { DEFAULT_PROJECT_NAME } from "./constants.js";

export async function promptForProjectName(): Promise<string> {
  const terminal = readline.createInterface({ input, output });
  try {
    const answer = await terminal.question(
      `Project name (${DEFAULT_PROJECT_NAME}): `,
    );

    return answer.trim() || DEFAULT_PROJECT_NAME;
  } finally {
    terminal.close();
  }
}
