import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const testDirectory = join(root, "..", "test");
const testFiles = readdirSync(testDirectory)
  .filter((file) => file.endsWith(".test.js"))
  .sort()
  .map((file) => join(testDirectory, file));

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "test" },
});

process.exitCode = result.status ?? 1;
