import { execFile, type ExecFileException } from "node:child_process";

type RunProcessOptions = {
  timeoutMs?: number;
  maxBufferBytes?: number;
};

/**
 * Minimal helper for invoking scanner CLIs as separate processes.
 */
export function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  const timeout = options.timeoutMs ?? 120_000;
  const maxBuffer = options.maxBufferBytes ?? 10 * 1024 * 1024;

  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout, maxBuffer }, (error: ExecFileException | null, stdout: string, stderr: string) => {
      if (error) {
        reject(
          new Error(
            `Command failed: ${command} ${args.join(" ")}\n${stderr || stdout || error.message}`
          )
        );
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}
