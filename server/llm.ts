import { spawn } from "node:child_process";
import type { z } from "zod";

const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";

/**
 * Shell out to `claude -p --output-format json --json-schema ...`.
 * The Claude CLI prints a top-level JSON wrapper; the constrained tool output
 * lives under `structured_output`. We parse with the caller's zod schema.
 */
export async function llmStructured<S extends z.ZodTypeAny>(
  prompt: string,
  jsonSchema: object,
  schema: S,
): Promise<z.infer<S>> {
  const args = [
    "-p",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(jsonSchema),
    prompt,
  ];

  const child = spawn(CLAUDE_BIN, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const code: number = await new Promise((resolveExit, reject) => {
    child.on("error", reject);
    child.on("close", (c) => resolveExit(c ?? 0));
  });

  if (code !== 0) {
    throw new Error(`claude exited ${code}: ${stderr || stdout}`);
  }

  let envelope: {
    structured_output?: unknown;
    is_error?: boolean;
    result?: string;
  };
  try {
    envelope = JSON.parse(stdout);
  } catch (cause) {
    throw new Error(`failed to parse claude json: ${stdout.slice(0, 400)}`, {
      cause,
    });
  }

  if (envelope.is_error) {
    throw new Error(`claude reported error: ${envelope.result || ""}`);
  }

  const so = envelope.structured_output;
  if (!so) {
    throw new Error(
      `claude returned no structured_output (raw result: ${(envelope.result ?? "").slice(0, 200)})`,
    );
  }

  return schema.parse(so);
}
