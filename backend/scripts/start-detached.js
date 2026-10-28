import { spawn } from "node:child_process";
import fs from "node:fs";

const backendLog = fs.openSync("/tmp/uniswap-backend.log", "a");

const backend = spawn("node", ["--no-network-family-autoselection", "--env-file=.env", "src/server.js"], {
  cwd: new URL("../", import.meta.url).pathname,
  detached: true,
  stdio: ["ignore", backendLog, backendLog],
});
backend.unref();

console.log(`Backend server started: PID ${backend.pid}`);
