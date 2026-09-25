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
    const userAgent = String(
        req.get("user-agent") || ""
    ).slice(0, 256);

    const isLauncher =
        req.get("origin") ===
        "deadsmile-app://launcher";

    req.session.device = {
        id: randomUUID(),
        client: isLauncher ? "launcher" : "browser",

        platform: detectPlatform(userAgent),

        createdAt: new Date().toISOString(),
    };
}