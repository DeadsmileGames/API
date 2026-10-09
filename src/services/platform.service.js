import crypto from 'node:crypto';
import { encryptSecret, decryptSecret } from '../utils/secretCipher.js';
import { verifyGameOwnership } from './itch-integration.service.js';
import { AppError } from '../utils/AppError.js';
import * as repository from '../repositories/platform.repository.js';
import * as engagement from '../repositories/engagement.repository.js';
import { createLiveTicket } from '../realtime/hub.js';
import { Expo } from 'expo-server-sdk';

const MAX_SAVE_BYTES = 1024;


function validarSavePico8(filename, bytes) {
  if (
  typeof filename !== "string" ||
  !/^[a-z0-9_-]{1,64}\.p8d\.txt$/i.test(filename))
  {
    throw new AppError(
      400,
      "SAVE_INVALID"

    );
  }

  if (!bytes.length || bytes.length > MAX_SAVE_BYTES) {
    throw new AppError(
      400,
      "SAVE_INVALID"

    );
  }

  const content = bytes.
  toString("latin1").
  replace(/\r\n/g, "\n").
  replace(/\n$/, "");

  if (!/^(?:[0-9a-fA-F]{64}\n){7}[0-9a-fA-F]{64}$/.test(content)) {
    throw new AppError(
      400,
      "SAVE_INVALID"

    );
  }

  return true;
}


export async function startSession(userId, payload) {
  const ownership = await verifyGameOwnership(userId, payload.gameId);
  if (!ownership.owned) throw new AppError(403, 'GAME_ACCESS_REQUIRED');
  const access = await repository.gameAccess(userId, payload.gameId);
  if (!access) throw new AppError(404, 'GAME_NOT_FOUND');
  if (!access.allowed) throw new AppError(403, 'GAME_ACCESS_REQUIRED');

  const session = await repository.createSession({ userId, ...payload });
  if (!session) throw new AppError(409, 'SESSION_START_FAILED');
  return session;
}

export async function endSession(userId, sessionId) {
  const session = await repository.finishSession({ userId, sessionId });
  if (!session) throw new AppError(409, 'SESSION_NOT_ACTIVE');
  return session;
}

export async function achievements(userId, gameId) {
  const access = await repository.gameAccess(userId, gameId);
  if (!access) throw new AppError(404, 'GAME_NOT_FOUND');
  if (!access.allowed) throw new AppError(403, 'GAME_ACCESS_REQUIRED');
  return repository.listAchievements(userId, gameId);
}

export async function unlock(userId, gameId, key) {
  const achievement = await repository.findAchievement(gameId, key);
  if (!achievement) {
    throw new AppError(404, 'ACHIEVEMENT_NOT_FOUND');
  }

  const access = await repository.gameAccess(userId, gameId);
  if (!access) {
    throw new AppError(404, 'GAME_NOT_FOUND');
  }
  if (!access.allowed) {
    throw new AppError(403, 'GAME_ACCESS_REQUIRED');
  }

  return repository.unlockAchievement(userId, achievement.id);
}

export async function downloadSave(userId, gameId, slot) {
  const item = await repository.findCloudSave(userId, gameId, slot);
  if (!item) throw new AppError(404, 'SAVE_NOT_FOUND');
  return { ...item, payload: decryptSecret(item.payload, `save:${userId}:${gameId}:${slot}`) };
}

export async function uploadSave(userId, gameId, slot, body) {
  const access = await repository.gameAccess(userId, gameId);
  if (!access) throw new AppError(404, 'GAME_NOT_FOUND');
  if (!access.allowed) throw new AppError(403, 'GAME_ACCESS_REQUIRED');
  if (!access.cloud_saves_enabled) throw new AppError(409, 'CLOUD_SAVES_DISABLED');
  const encoded = String(body.payload || '');
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new AppError(400, 'SAVE_INVALID');
  }
  let bytes;
  try {
    bytes = Buffer.from(encoded, 'base64');
  } catch {
    throw new AppError(400, 'SAVE_INVALID');
  }
  if (!bytes.length || bytes.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
    throw new AppError(400, 'SAVE_INVALID');
  }

  validarSavePico8(body.filename, bytes);

  const sha256 = crypto.
  createHash("sha256").
  update(bytes).
  digest("hex");

  const item = await repository.upsertCloudSave({ userId, gameId, slot, payload: encryptSecret(body.payload, `save:${userId}:${gameId}:${slot}`), sha256, revision: body.revision });
  if (!item) throw new AppError(409, 'SAVE_CONFLICT');
  return item;
}

export async function getConsent(userId) {
  return { enabled: await repository.getTelemetryConsent(userId) };
}

export async function setConsent(userId, enabled) {
  return repository.setTelemetryConsent(userId, enabled);
}

export async function telemetry(userId, payload) {
  if (!(await repository.getTelemetryConsent(userId))) return { accepted: false, reason: 'consent_required' };
  const context = await repository.telemetryContext(userId, payload.gameId, payload.sessionId);
  if (!context) throw new AppError(403, 'TELEMETRY_CONTEXT_INVALID');
  if (!context.enabled) return { accepted: false, reason: 'diagnostics_disabled' };
  const event = await repository.insertTelemetry({ userId, ...payload, gameId: context.gameId, sessionId: context.sessionId });
  return event ? { accepted: true, event } : { accepted: false, reason: 'consent_required' };
}

export async function status() {
  const snapshot = await repository.statusSnapshot();
  const degraded = snapshot.incidents.some((item) => item.status !== 'resolved');
  return {
    status: degraded ? 'degraded' : 'operational',
    checkedAt: new Date().toISOString(),
    components: [
    { id: 'api', name: 'Deadsmile Games API', status: 'operational' },
    { id: 'database', name: 'Account and library', status: 'operational', latencyMs: snapshot.databaseLatencyMs },
    { id: 'itch', name: 'itch.io connection', status: 'external' }],

    incidents: snapshot.incidents
  };
}

export async function events(userId, query) {
  return engagement.listEvents({ userId, after: query.after, limit: query.limit });
}

export async function liveTicket(userId) {
  return { ticket: createLiveTicket(userId), expiresIn: 60 };
}

export async function savePushSubscription(userId, payload) {
  if (!Expo.isExpoPushToken(payload.token)) throw new AppError(400, 'PUSH_TOKEN_INVALID');
  return engagement.savePushSubscription({ userId, ...payload });
}

export async function removePushSubscription(userId, token) {
  await engagement.disablePushSubscription(userId, token);
  return { disabled: true };
}


export async function saves(userId, gameId) {
  return repository.listCloudSaves(userId, gameId);
}

export async function deleteSave(userId, gameId, slot) {
  const item = await repository.deleteCloudSave(userId, gameId, slot);
  if (!item) throw new AppError(404, 'SAVE_NOT_FOUND');
  return item;
}
