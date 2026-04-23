import { spawn } from "node:child_process";

const appUrl = process.env.INNGEST_APP_URL?.trim() || "http://localhost:3000/api/inngest";
const args = ["--ignore-scripts=false", "inngest-cli@latest", "dev", "-u", appUrl];

const child = spawn("npx", args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
