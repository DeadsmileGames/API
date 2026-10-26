import test from "node:test";
import assert from "node:assert/strict";
import {
  hasCompleteNotificationCopy,
  notificationCopyFor,
  notificationCopyKeys,
  notificationCopyLocales,
} from "../src/utils/notificationCopy.js";

test("publication email and push copy is complete for every supported language", () => {
  assert.deepEqual(notificationCopyLocales().sort(), ["en", "es", "pt-BR"].sort());
  assert.equal(hasCompleteNotificationCopy(), true);
  assert.deepEqual(notificationCopyKeys().sort(), [
    "newContentAvailable",
    "newFromStudio",
    "newsletterNotice",
    "unsubscribe",
    "viewOnSite",
  ].sort());
});

test("localized notification fallback copy differs by language", () => {
  assert.equal(notificationCopyFor("en").viewOnSite, "View on Deadsmile Games");
  assert.equal(notificationCopyFor("pt-BR").viewOnSite, "Ver no site da Deadsmile Games");
  assert.equal(notificationCopyFor("es").viewOnSite, "Ver en Deadsmile Games");
  assert.equal(notificationCopyFor("fr").unsubscribe, "Unsubscribe");
});
