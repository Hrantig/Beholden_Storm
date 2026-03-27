import { spawn } from "node:child_process";

const port = Number(process.env.PORT || 4173);

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "preview", "--host", "0.0.0.0", "--port", String(port)],
  {
    stdio: "inherit",
    shell: false,
  }
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

