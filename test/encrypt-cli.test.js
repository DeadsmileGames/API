import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

test("db:encrypt runs as a CLI and encrypts an existing plaintext save", async () => {
  const db = await PGlite.create();
  await db.exec(
    "CREATE TABLE cloud_saves (user_id text, game_id text, slot text, payload text); INSERT INTO cloud_saves VALUES ('user','game','manual','original-save');",
  );
  const socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await socket.start();
  try {
    const script = fileURLToPath(new URL("../scripts/encrypt-data.js", import.meta.url));
    const child = spawn(process.execPath, [script], {
      env: {
        ...process.env,
        NODE_ENV: "development",
        DATABASE_URL: `postgres://postgres:postgres@${socket.getServerConn()}/postgres`,
        DATABASE_URL_UNPOOLED: "",
        SESSION_SECRET: "isolated-cli-session-secret".repeat(2),
        DATA_ENCRYPTION_KEY: "isolated-cli-data-secret".repeat(2),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    const timer = setTimeout(() => child.kill(), 15000);
    try {
      const exitCode = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", resolve);
      });
      assert.equal(exitCode, 0, stderr);
      const row = (await db.query("SELECT payload FROM cloud_saves")).rows[0];
      assert.match(row.payload, /^enc\.v2\./);
      assert(!row.payload.includes("original-save"));
    } finally {
      clearTimeout(timer);
    }
  } finally {
    await socket.stop();
    await db.close();
  }
});
