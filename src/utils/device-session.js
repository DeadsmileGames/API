import { env } from "../config/env.js";
import { randomUUID } from "node:crypto";

function detectPlatform(userAgent) {
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iOS";
  if (/windows/i.test(userAgent)) return "Windows";
  if (/macintosh|mac os/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";

  return "Outro dispositivo";
}

export function attachDeviceSession(req) {
  const userAgent = String(req.get("user-agent") || "").slice(0, 256);
  const origin = req.get("origin");
  let refererOrigin = null;
  try {
    refererOrigin = req.get("referer") ? new URL(req.get("referer")).origin : null;
  } catch {
    refererOrigin = null;
  }

  const isLauncher = origin === "deadsmile-app://launcher";
  const isWebsite = origin === env.frontendUrl || refererOrigin === env.frontendUrl;

  req.session.device = {
    id: randomUUID(),
    client: isLauncher ? "launcher" : isWebsite ? "website" : "other",
    platform: detectPlatform(userAgent),
    createdAt: new Date().toISOString(),
  };
}
