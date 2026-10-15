const HOSTS = new Set(["youtube.com", "m.youtube.com", "youtube-nocookie.com"]);

export function youtubeVideoId(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    let id = null;
    if (host === "youtu.be") id = url.pathname.split("/")[1];
    else if (HOSTS.has(host))
      id =
        url.pathname === "/watch"
          ? url.searchParams.get("v")
          : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    return /^[A-Za-z0-9_-]{6,20}$/.test(id || "") ? id : null;
  } catch {
    return null;
  }
}
