import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { getPreorderedLibraryItems } from "../services/preorder-library.service.js";
import {
  getInstallMetadata,
  getLibrary,
  getLauncherCatalog,
  addGameToLibrary,
  removeGameFromLibrary,
  syncItchLibrary,
  verifyGameOwnership,
} from "../services/itch-integration.service.js";

function mergePreordersIntoItems(items, preorders) {
  for (const game of preorders) {
    const key = String(game.id);
    const existing = items.get(key);
    items.set(key, existing ? {
      ...existing,
      inLibrary: true,
      preorderRegistered: true,
      preorderRegisteredAt: game.preorderRegisteredAt,
      preorderEndsAt: game.preorderEndsAt,
      preorderLocked: game.preorderLocked,
      downloadAvailable: game.downloadAvailable,
      launcherAvailable: game.launcherAvailable,
      downloadUrl: game.downloadUrl,
    } : game);
  }
  return [...items.values()];
}

export const list = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId;
  const [library, preorders] = await Promise.all([getLibrary(userId), getPreorderedLibraryItems(userId)]);
  const items = new Map((library.items || []).map((game) => [String(game.id), game]));
  sendSuccess(res, { ...library, items: mergePreordersIntoItems(items, preorders) });
});

export const sync = asyncHandler(async (req, res) => {
  sendSuccess(res, await syncItchLibrary(req.session.userId));
});

export const verify = asyncHandler(async (req, res) => {
  sendSuccess(res, await verifyGameOwnership(req.session.userId, req.params.gameId));
});

export const installMetadata = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store");
  sendSuccess(res, await getInstallMetadata(req.session.userId, req.params.gameId));
});

export const catalog = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.session.userId;
  const [catalog, preorders] = await Promise.all([getLauncherCatalog(userId), getPreorderedLibraryItems(userId)]);
  const items = new Map((catalog.items || []).map((game) => [String(game.id), game]));
  sendSuccess(res, { ...catalog, items: mergePreordersIntoItems(items, preorders) });
});

export const add = asyncHandler(async (req, res) => {
  sendSuccess(res, await addGameToLibrary(req.session.userId, req.params.gameId));
});

export const remove = asyncHandler(async (req, res) => {
  sendSuccess(res, await removeGameFromLibrary(req.session.userId, req.params.gameId));
});
