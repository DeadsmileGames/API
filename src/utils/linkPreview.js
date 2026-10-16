import dns from "node:dns/promises";
import https from "node:https";
import net from "node:net";

const MAX_URL_LENGTH = 2_048;
const MAX_HTML_BYTES = 512 * 1_024;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const CACHE_TTL_MS = 60 * 60 * 1_000;
const MAX_CACHE_ENTRIES = 500;
const cache = new Map();

function ipv4Parts(address) {
  if (net.isIP(address) !== 4) return null;
  return address.split(".").map(Number);
}

function inIpv4Range(parts, base, prefix) {
  const value = parts.reduce((result, part) => result * 256 + part, 0);
  const network = base.split(".").map(Number).reduce((result, part) => result * 256 + part, 0);
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (network & mask);
}

export function isPublicAddress(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const parts = ipv4Parts(address);
    const blocked = [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.88.99.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ];
    return !blocked.some(([base, prefix]) => inIpv4Range(parts, base, prefix));
  }

  if (family === 6) {
    const normalized = address.toLowerCase().split("%")[0];
    // Only global unicast (2000::/3) is eligible. Local, mapped, and reserved
    // IPv6 addresses are deliberately excluded from external page lookups.
    if (normalized.startsWith("::ffff:")) return false;
    const firstHextet = Number.parseInt(normalized.split(":")[0] || "0", 16);
    if (firstHextet < 0x2000 || firstHextet > 0x3fff) return false;
    if (
      normalized.startsWith("2001:db8:") ||
      normalized === "2001:db8::" ||
      normalized.startsWith("2001:10:")
    ) return false;
    return true;
  }

  return false;
}

export function normalizePreviewUrl(value) {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_URL_LENGTH) {
    return null;
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !hostname.includes(".") ||
    hostname === "localhost" ||
    /\.(?:localhost|local|internal|test|invalid|example|onion)$/.test(hostname) ||
    net.isIP(hostname)
  ) {
    return null;
  }

  url.hash = "";
  return url;
}

function attribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(
    new RegExp("(?:^|\\s)" + escaped + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"),
  );
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : "";
}

function decodeEntities(value) {
  return value
    .replace(/&#(x[0-9a-f]+|[0-9]+);?/gi, (_match, code) => {
      const hexadecimal = /^x/i.test(code);
      const number = Number.parseInt(hexadecimal ? code.slice(1) : code, hexadecimal ? 16 : 10);
      if (!Number.isFinite(number) || number < 1 || number > 0x10ffff) return "";
      try {
        return String.fromCodePoint(number);
      } catch {
        return "";
      }
    })
    .replace(/&nbsp;?/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanTitle(value) {
  const title = decodeEntities(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/[\u0000-\u001f\u007f\s]+/g, " ")
    .trim();
  return title ? title.slice(0, 300) : null;
}

export function extractPageTitle(html) {
  if (typeof html !== "string" || !html) return null;

  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const wanted of ["og:title", "twitter:title"]) {
    const tag = metaTags.find((item) =>
      [attribute(item, "property"), attribute(item, "name")]
        .some((value) => value.toLowerCase() === wanted),
    );
    const title = cleanTitle(tag ? attribute(tag, "content") : "");
    if (title) return title;
  }

  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  return cleanTitle(match?.[1] || "");
}

async function resolvePublicAddresses(hostname) {
  let addresses;
  if (net.isIP(hostname)) {
    addresses = [{ address: hostname, family: net.isIP(hostname) }];
  } else {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  }

  if (
    !Array.isArray(addresses) ||
    addresses.length === 0 ||
    addresses.some((item) => !isPublicAddress(item.address))
  ) {
    throw new Error("External URL resolves to a non-public address");
  }
  return addresses;
}

function requestHtml(url, addresses) {
  return new Promise((resolve, reject) => {
    const lookup = (_hostname, options, callback) => {
      const ordered = options?.family
        ? addresses.filter((item) => item.family === options.family)
        : addresses;
      const selected = ordered[0] || addresses[0];
      if (!selected) return callback(new Error("No public address available"));
      if (options?.all) return callback(null, ordered);
      return callback(null, selected.address, selected.family);
    };

    const request = https.request(
      url,
      {
        method: "GET",
        lookup,
        agent: false,
        maxHeaderSize: 16 * 1_024,
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "Accept-Encoding": "identity",
          "User-Agent": "DeadsmileGames-LinkTitle/1.0 (+https://deadsmilegames.vercel.app)",
        },
      },
      (response) => {
        const status = Number(response.statusCode || 0);
        const location = response.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location) {
          response.resume();
          resolve({ status, location });
          return;
        }

        const contentType = String(response.headers["content-type"] || "").toLowerCase();
        if (status < 200 || status >= 300 || !/(?:text\/html|application\/xhtml\+xml)/.test(contentType)) {
          response.resume();
          resolve({ status, title: null });
          return;
        }

        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX_HTML_BYTES) {
            request.destroy(new Error("External HTML exceeds the size limit"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          if (request.destroyed) return;
          const html = Buffer.concat(chunks).toString("utf8");
          resolve({ status, title: extractPageTitle(html) });
        });
        response.on("error", reject);
      },
    );

    const deadline = setTimeout(
      () => request.destroy(new Error("External request timed out")),
      REQUEST_TIMEOUT_MS,
    );
    deadline.unref?.();
    request.on("close", () => clearTimeout(deadline));
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error("External request timed out")));
    request.on("error", reject);
    request.end();
  });
}

function setCache(key, value) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function getPageTitle(rawUrl) {
  const original = normalizePreviewUrl(rawUrl);
  if (!original) throw new TypeError("Invalid external URL");

  const cacheKey = original.href;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) cache.delete(cacheKey);

  let current = original;
  let title = null;
  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const safeCurrent = normalizePreviewUrl(current.href);
      if (!safeCurrent) break;
      const addresses = await resolvePublicAddresses(safeCurrent.hostname);
      const response = await requestHtml(safeCurrent, addresses);
      if (response.location && redirects < MAX_REDIRECTS) {
        let target;
        try {
          target = new URL(response.location, safeCurrent);
        } catch {
          break;
        }
        const safeTarget = normalizePreviewUrl(target.href);
        if (!safeTarget) break;
        current = safeTarget;
        continue;
      }
      title = response.title || null;
      break;
    }
  } catch {
    // A preview is optional. A remote site's refusal or timeout must not
    // prevent the original link from being displayed or opened.
    title = null;
  }

  const value = { url: original.href, title };
  setCache(cacheKey, value);
  return value;
}
