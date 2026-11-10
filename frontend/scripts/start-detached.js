import { spawn } from "node:child_process";
import fs from "node:fs";

const frontendLog = fs.openSync("/tmp/uniswap-frontend.log", "a");

const frontend = spawn("npm", ["run", "dev"], {
  cwd: new URL("../", import.meta.url).pathname,
  detached: true,
  stdio: ["ignore", frontendLog, frontendLog],
});
frontend.unref();

console.log(`Frontend server started: PID ${frontend.pid}`);
