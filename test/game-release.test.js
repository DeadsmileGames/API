import test from "node:test";
import assert from "node:assert/strict";
import { getEffectiveGameStatus, hasReleaseDateArrived, isGameDownloadUnlocked } from "../src/utils/gameRelease.js";
import { toClientGame } from "../src/utils/clientGame.js";

test("a game stays in development until midnight in Sao Paulo on its release date", () => {
  assert.equal(
    hasReleaseDateArrived("2026-10-16", new Date("2026-10-16T02:59:59.000Z")),
    false,
  );
  assert.equal(
    hasReleaseDateArrived("2026-10-16", new Date("2026-10-16T03:00:00.000Z")),
    true,
  );
});

test("an in-development game becomes released automatically on its release date", () => {
  const game = { status: "in_development", release_date: "2026-10-16" };

  assert.equal(
    getEffectiveGameStatus(game, new Date("2026-10-16T02:59:59.000Z")),
    "in_development",
  );
  assert.equal(
    getEffectiveGameStatus(game, new Date("2026-10-16T03:00:00.000Z")),
    "released",
  );
});

test("announced games are not auto-released, and missing dates do not change status", () => {
  assert.equal(
    getEffectiveGameStatus(
      { status: "announced", release_date: "2020-01-01" },
      new Date("2026-10-16T03:00:00.000Z"),
    ),
    "announced",
  );
  assert.equal(
    getEffectiveGameStatus({ status: "in_development", release_date: null }),
    "in_development",
  );
});

test("a scheduled game becomes launchable through the public game response once its date arrives", () => {
  const game = toClientGame({
    id: "00000000-0000-4000-8000-000000000001",
    title: "Scheduled",
    slug: "scheduled",
    short_description: "A scheduled game",
    status: "in_development",
    release_date: "2020-01-01",
    access_type: "free",
    download_url: "https://cdn.example.test/scheduled.zip",
    genres: [],
    platforms: [],
  });

  assert.equal(game.status, "released");
  assert.equal(game.downloadAvailable, true);
  assert.equal(game.launcherAvailable, true);
});


test("the end of pre-registration never unlocks game downloads before launch", () => {
  const game = {
    status: "in_development",
    release_date: "2026-10-20",
    preorder_enabled: true,
    preorder_ends_at: "2026-10-17T03:00:00.000Z",
  };

  assert.equal(
    isGameDownloadUnlocked(game, new Date("2026-10-18T12:00:00.000Z")),
    false,
  );
  assert.equal(
    isGameDownloadUnlocked(game, new Date("2026-10-20T03:00:00.000Z")),
    true,
  );
});
