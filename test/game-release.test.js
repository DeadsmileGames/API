import test from "node:test";
import assert from "node:assert/strict";
import { getEffectiveGameStatus, hasReleaseDateArrived } from "../src/utils/gameRelease.js";

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
