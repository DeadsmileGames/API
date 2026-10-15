import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgres://localhost/unused";
process.env.SESSION_SECRET = "isolated-test-session-key-".repeat(2);
process.env.YOUTUBE_API_KEY = "test-key";
const { findPremiere } = await import("../src/services/youtube.service.js");
const { youtubeVideoId } = await import("../src/utils/youtube.js");

test("YouTube links resolve to a video id and anything else is rejected", () => {
  assert.equal(youtubeVideoId("https://youtu.be/7huKuYunpPU"), "7huKuYunpPU");
  assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=7huKuYunpPU"), "7huKuYunpPU");
  assert.equal(youtubeVideoId("https://www.youtube-nocookie.com/embed/7huKuYunpPU"), "7huKuYunpPU");
  assert.equal(youtubeVideoId("https://example.com/watch?v=7huKuYunpPU"), null);
  assert.equal(youtubeVideoId("not a url"), null);
});

test("premiere detection keeps only videos starting within 24 hours or already live", async () => {
  const hours = (value) => new Date(Date.now() + value * 3_600_000).toISOString();
  const items = [
    { id: "soonsoon01", snippet: { liveBroadcastContent: "upcoming", title: "Soon" }, liveStreamingDetails: { scheduledStartTime: hours(5) } },
    { id: "farfarfar01", snippet: { liveBroadcastContent: "upcoming" }, liveStreamingDetails: { scheduledStartTime: hours(48) } },
    { id: "plainplain1", snippet: { liveBroadcastContent: "none" } },
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ items });
  try {
    const videos = items.map(({ id }) => ({ id, video_url: `https://youtu.be/${id}` }));
    const found = await findPremiere(videos);
    assert.equal(found.video.id, "soonsoon01");
    assert.equal(found.info.state, "upcoming");
    assert.equal(await findPremiere(videos.slice(1)), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
