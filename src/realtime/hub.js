import crypto from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { query, realtimePool } from "../config/database.js";
import { env } from "../config/env.js";

const CHANNEL = "deadsmile_realtime";
const INSTANCE_ID = crypto.randomUUID();
const clients = new Set();
let listenerClient = null;
let listenerPromise = null;
let heartbeatTimer = null;
let retryTimer = null;

function signature(value) {
  return crypto.createHmac("sha256", env.sessionSecret).update(value).digest("base64url");
}

export function createLiveTicket(userId, sessionId) {
  const encoded = Buffer.from(
    JSON.stringify({ userId, sessionId, expiresAt: Date.now() + 60_000 }),
  ).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

function verifyLiveTicket(ticket) {
  if (!ticket || typeof ticket !== "string" || ticket.length > 2_000) return null;
  const [encoded, received, extra] = ticket.split(".");
  if (!encoded || !received || extra) return null;
  const expected = signature(encoded);
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      typeof value.userId !== "string" ||
      typeof value.sessionId !== "string" ||
      !value.sessionId ||
      value.sessionId.length > 256 ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= Date.now()
    )
      return null;
    return { userId: value.userId, sessionId: value.sessionId };
  } catch {
    return null;
  }
}

function originAllowed(origin, authenticated) {
  if (origin === env.frontendUrl || origin === "deadsmile-app://launcher") return true;
  if (
    !env.isProduction &&
    ["http://localhost:5173", "http://localhost:8081"].includes(origin)
  )
    return true;
  if (authenticated && (!origin || origin === "null")) return true;
  return false;
}

function send(ws, event) {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(event));
  } catch {}
}

async function activeSessions(sessionIds) {
  const ids = [...new Set(sessionIds.filter(Boolean))];
  if (!ids.length) return new Set();
  const { rows } = await query(
    `SELECT s.sid, s.sess->>'userId' AS user_id
     FROM user_sessions s
     JOIN users u ON u.id::text = s.sess->>'userId'
     WHERE s.sid = ANY($1::text[])
       AND s.expire > now() AND u.email_verified_at IS NOT NULL`,
    [ids],
  );
  return new Set(rows.map((row) => `${row.sid}:${row.user_id}`));
}

async function broadcast(event) {
  const recipients = [...clients].filter(
    (ws) => !event.audience_user_id || ws.userId === String(event.audience_user_id),
  );
  let sessions;
  if (event.audience_user_id) {
    try {
      sessions = await activeSessions(recipients.map((ws) => ws.sessionId));
    } catch {
      return;
    }
  }
  for (const ws of recipients) {
    if (sessions && !sessions.has(`${ws.sessionId}:${ws.userId}`)) {
      ws.terminate();
      continue;
    }
    send(ws, event);
  }
}

async function loadAndBroadcastEvent(id) {
  const { rows } = await query(
    `SELECT id, event_type, audience_user_id, entity_id, payload, created_at
     FROM content_events WHERE id = $1`,
    [id],
  );
  if (rows[0]) await broadcast(rows[0]);
}

function clearListener() {
  if (!listenerClient) return;
  const client = listenerClient;
  listenerClient = null;
  client.removeAllListeners("notification");
  client.removeAllListeners("error");
  client
    .query(`UNLISTEN ${CHANNEL}`)
    .catch(() => {})
    .finally(() => client.release());
}

function scheduleListenerRetry() {
  if (!clients.size || retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    ensureListener().catch(() => scheduleListenerRetry());
  }, 2_000);
  retryTimer.unref?.();
}

async function ensureListener() {
  if (!clients.size || listenerClient) return;
  if (listenerPromise) return listenerPromise;
  listenerPromise = (async () => {
    const client = await realtimePool.connect();
    try {
      await client.query(`LISTEN ${CHANNEL}`);
      if (!clients.size) {
        await client.query(`UNLISTEN ${CHANNEL}`);
        client.release();
        return;
      }
      client.on("notification", (message) => {
        if (message.channel !== CHANNEL || !message.payload) return;
        try {
          const notice = JSON.parse(message.payload);
          if (notice.origin === INSTANCE_ID || !Number.isSafeInteger(notice.id)) return;
          loadAndBroadcastEvent(notice.id).catch(() => {});
        } catch {}
      });
      client.on("error", () => {
        if (listenerClient === client) {
          listenerClient = null;
          try {
            client.release(true);
          } catch {}
          scheduleListenerRetry();
        }
      });
      listenerClient = client;
    } catch (error) {
      client.release(true);
      throw error;
    }
  })();
  try {
    await listenerPromise;
  } finally {
    listenerPromise = null;
  }
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(async () => {
    let sessions;
    try {
      sessions = await activeSessions([...clients].map((ws) => ws.sessionId));
    } catch {
      sessions = new Set();
    }
    for (const ws of clients) {
      if (
        ws.isAlive === false ||
        (ws.userId && !sessions.has(`${ws.sessionId}:${ws.userId}`))
      ) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        ws.terminate();
      }
    }
  }, 30_000);
  heartbeatTimer.unref?.();
}

function stopHeartbeatIfIdle() {
  if (clients.size || !heartbeatTimer) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function removeClient(ws) {
  clients.delete(ws);
  stopHeartbeatIfIdle();
  if (!clients.size) {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    clearListener();
  }
}

export function attachRealtimeServer(server) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 16_384,
    perMessageDeflate: false,
  });

  server.on("upgrade", async (request, socket, head) => {
    let url;
    try {
      url = new URL(request.url, env.backendUrl);
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== "/api/live") {
      socket.destroy();
      return;
    }
    const ticket = url.searchParams.get("ticket");
    const identity = ticket ? verifyLiveTicket(ticket) : null;
    if (
      (ticket && !identity) ||
      !originAllowed(request.headers.origin, Boolean(identity))
    ) {
      socket.destroy();
      return;
    }
    try {
      if (identity) {
        const sessions = await activeSessions([identity.sessionId]);
        if (!sessions.has(`${identity.sessionId}:${identity.userId}`)) {
          socket.destroy();
          return;
        }
      }
      if (socket.destroyed) return;
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.userId = identity?.userId || null;
        ws.sessionId = identity?.sessionId || null;
        wss.emit("connection", ws);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    clients.add(ws);
    startHeartbeat();
    ensureListener().catch(() => scheduleListenerRetry());
    send(ws, { type: "connected", authenticated: Boolean(ws.userId) });
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    ws.on("close", () => removeClient(ws));
    ws.on("error", () => removeClient(ws));
  });

  server.on("close", () => {
    for (const ws of clients) ws.terminate();
    clients.clear();
    stopHeartbeatIfIdle();
    clearListener();
  });

  return wss;
}

export async function signalRealtimeEvent(event) {
  await broadcast(event);
  try {
    await query("SELECT pg_notify($1, $2)", [
      CHANNEL,
      JSON.stringify({ id: Number(event.id), origin: INSTANCE_ID }),
    ]);
  } catch {}
}
