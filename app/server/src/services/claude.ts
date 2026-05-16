import { exec } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { writeFile, unlink, access } from "fs/promises";
import { CLAUDE_BIN } from "../config.js";
import { AppError } from "../lib/errors.js";

const execAsync = promisify(exec);
const TIMEOUT_MS = 120_000;

const run = async (args: string[], stdinContent?: string): Promise<string> => {
  const cmd = `${CLAUDE_BIN} ${args.join(" ")}`;
  const { stdout, stderr } = await execAsync(cmd, {
    timeout: TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024,
    ...(stdinContent ? { input: stdinContent } : {}),
  });
  if (stderr) console.warn("[claude]", stderr);
  return stdout.trim();
};

/** Single-turn prompt. For one-shot tasks: analysis, translation, summaries. */
export const singleTurn = async (
  prompt: string,
  options?: { model?: string; contextFile?: string },
): Promise<string> => {
  const args = ["-p"];
  if (options?.model) args.push("--model", options.model);

  if (options?.contextFile) {
    // Large context via temp file — avoids shell arg length limits
    const tmpPath = `/tmp/oikos-${randomUUID()}.json`;
    await writeFile(tmpPath, options.contextFile, "utf8");
    try {
      args.push(`"${prompt}"`);
      return await run([...args, `< ${tmpPath}`]);
    } finally {
      await unlink(tmpPath).catch(() => undefined);
    }
  }

  args.push(`"${prompt.replace(/"/g, '\\"')}"`);
  try {
    return await run(args);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError(`Claude CLI error: ${msg}`, 502, "CLAUDE_ERROR");
  }
};

/** Session-based multi-turn (Gardening Specialist chat). */
export const sessionTurn = async (
  sessionId: string,
  prompt: string,
  options?: { model?: string },
): Promise<string> => {
  const args = ["-p", "--session-id", sessionId];
  if (options?.model) args.push("--model", options.model);
  args.push(`"${prompt.replace(/"/g, '\\"')}"`);

  try {
    return await run(args);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError(`Claude CLI error: ${msg}`, 502, "CLAUDE_ERROR");
  }
};

/** Image prompt for OCR and photo analysis.
 *  Flag syntax: --image <path> — verify against installed Claude CLI version if this fails.
 */
export const imageTurn = async (
  imagePath: string,
  prompt: string,
  options?: { model?: string },
): Promise<string> => {
  await access(imagePath); // throws if file does not exist
  const args = ["-p", "--image", imagePath];
  if (options?.model) args.push("--model", options.model);
  args.push(`"${prompt.replace(/"/g, '\\"')}"`);

  try {
    return await run(args);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError(`Claude CLI error: ${msg}`, 502, "CLAUDE_ERROR");
  }
};
