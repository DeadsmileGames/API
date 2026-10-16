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

test("premiere detection keeps upcoming videos within 24 hours and live videos with or without scheduled times", async () => {
  const hours = (value) => new Date(Date.now() + value * 3_600_000).toISOString();
  const items = [
    { id: "soonsoon01", snippet: { liveBroadcastContent: "upcoming", title: "Soon" }, liveStreamingDetails: { scheduledStartTime: hours(5) } },
    { id: "farfarfar01", snippet: { liveBroadcastContent: "upcoming" }, liveStreamingDetails: { scheduledStartTime: hours(48) } },
    { id: "plainplain1", snippet: { liveBroadcastContent: "none" } },
    { id: "transition1", snippet: { liveBroadcastContent: "upcoming", title: "Starting now" }, liveStreamingDetails: { scheduledStartTime: hours(-2 / 60) } },
    { id: "livestream1", snippet: { liveBroadcastContent: "live", title: "Live now" }, liveStreamingDetails: { actualStartTime: hours(-1) } },
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const ids = new URL(url).searchParams.get("id").split(",");
    return Response.json({ items: items.filter((item) => ids.includes(item.id)) });
  };
  try {
    const videos = items.map(({ id }) => ({ id, video_url: `https://youtu.be/${id}` }));
    const upcoming = await findPremiere(videos.slice(0, 3));
    assert.equal(upcoming.video.id, "soonsoon01");
    assert.equal(upcoming.info.state, "upcoming");
    assert.equal(await findPremiere(videos.slice(1, 3)), null);
    const transition = await findPremiere([videos[3]]);
    assert.equal(transition.video.id, "transition1");
    assert.equal(transition.info.state, "upcoming");
    const live = await findPremiere([videos[4]]);
    assert.equal(live.video.id, "livestream1");
    assert.equal(live.info.state, "live");
    assert.equal(live.info.startsAt, live.info.actualStartedAt);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
