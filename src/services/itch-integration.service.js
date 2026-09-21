import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { getGithubGameDownload } from './github-game-releases.service.js';
import { AppError } from '../utils/AppError.js';
import { decryptToken, encryptToken } from '../utils/tokenCipher.js';
import {
  consumeOAuthState,
  createOAuthState,
  findItchAccount,
  findItchGame,
  findPreferredItchChannel,
  grantEntitlement,
  listEntitlements,
  listItchGames,
  markItchAccountSynced,
  removeItchAccount,
  revokeEntitlement,
  touchItchAccount,
  upsertItchAccount,
} from '../repositories/itch-integration.repository.js';

const API_ROOT = 'https://api.itch.io';

function configured() {
  return Boolean(env.itchClientId && env.itchTokenEncryptionKey.length >= 32 && env.itchRedirectUri);
}

function requireConfigured() {
  if (!configured()) {
    throw new AppError(503, 'ITCH_NOT_CONFIGURED', 'itch.io connection is temporarily unavailable.');
  }
}

function stateHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function itchRequest(path, token, params, { method = 'GET' } = {}) {
  const url = new URL(`${API_ROOT}${path}`);
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (method === 'GET') url.searchParams.set(key, String(value));
    else body.set(key, String(value));
  }
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(method === 'GET' ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' }),
      },
      ...(method === 'GET' ? {} : { body }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AppError(503, 'ITCH_UNAVAILABLE', 'itch.io could not be reached. Try again shortly.');
  }
  const data = await response.json().catch(() => null);
  if (!data || !response.ok || (Array.isArray(data.errors) && data.errors.length > 0)) {
    const expired = response.status === 401 || response.status === 403;
    throw new AppError(expired ? 409 : 503, expired ? 'ITCH_RECONNECT_REQUIRED' : 'ITCH_UNAVAILABLE',
      expired ? 'Reconnect your itch.io account to continue.' : 'itch.io could not complete the request. Try again shortly.');
  }
  return data;
}

async function ownedKeysFor(account) {
  const token = decryptToken(account.access_token_encrypted);
  const keys = [];
  const seenPages = new Set();
  for (let page = 1; page <= 200; page += 1) {
    const data = await itchRequest('/profile/owned-keys', token, { page });
    if (!Array.isArray(data.owned_keys)) {
      throw new AppError(503, 'ITCH_LIBRARY_INVALID', 'itch.io returned an invalid library response.');
    }
    const pageKeys = data.owned_keys;
    if (pageKeys.length === 0) return keys;
    const pageIdentity = pageKeys.map((item) => String(item?.id || '')).join(',');
    if (seenPages.has(pageIdentity)) {
      throw new AppError(503, 'ITCH_LIBRARY_INVALID', 'itch.io returned repeated library pages.');
    }
    seenPages.add(pageIdentity);
    keys.push(...pageKeys);
    const perPage = Number(data.per_page);
    if (Number.isSafeInteger(perPage) && perPage > 0 && pageKeys.length < perPage) return keys;
  }
  throw new AppError(503, 'ITCH_LIBRARY_TOO_LARGE', 'itch.io library pagination did not finish.');
}

function ownershipFor(game, keys) {
  const match = keys.find((item) =>
    String(item?.game_id || item?.game?.id || '') === String(game.itch_game_id)
    && item?.id != null
  );
  return match
    ? { owned: true, reference: String(match.id), acquiredAt: match.created_at || null }
    : { owned: false };
}

function publicAccount(account) {
  if (!account) return { connected: false, configured: configured(), launcherClientId: env.itchLauncherClientId || null };
  return {
    connected: true,
    configured: configured(),
    launcherClientId: env.itchLauncherClientId || null,
    username: account.itch_username,
    profileUrl: account.itch_profile_url,
    connectedAt: account.connected_at,
    verifiedAt: account.verified_at,
    lastSyncAt: account.last_sync_at,
  };
}

function clientGame(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    shortDescription: row.short_description,
    status: row.status,
    releaseDate: row.release_date,
    heroImage: row.hero_image,
    coverImage: row.cover_image,
    trailerUrl: row.trailer_url,
    purchaseUrl: row.purchase_url,
    downloadUrl: row.itch_game_id && row.purchase_url ? null : row.download_url,
    itchGameId: row.itch_game_id ? Number(row.itch_game_id) : null,
    engine: row.engine || 'native',
    savePathTemplate: row.save_path_template || null,
    cloudSavesEnabled: Boolean(row.cloud_saves_enabled),
    telemetryEnabled: row.telemetry_enabled !== false,
    genres: row.genres || [],
    platforms: row.platforms || [],
    acquiredAt: row.acquired_at,
    lastVerifiedAt: row.last_verified_at,
  };
}

export async function getItchStatus(userId) {
  return publicAccount(await findItchAccount(userId));
}

export async function beginItchConnection(userId, { client, locale, returnPath }) {
  requireConfigured();
  const state = crypto.randomBytes(48).toString('base64url');
  await createOAuthState({
    stateHash: stateHash(state),
    userId,
    client,
    locale,
    returnPath: client === 'site' ? returnPath || '/account' : null,
    expiresAt: new Date(Date.now() + 10 * 60 * 1_000),
  });
  const url = new URL('https://itch.io/user/oauth');
  url.searchParams.set('client_id', env.itchClientId);
  url.searchParams.set('scope', 'profile:me profile:owned');
  url.searchParams.set('redirect_uri', env.itchRedirectUri);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('state', state);
  return { authorizeUrl: url.toString(), expiresIn: 600 };
}

export async function completeItchConnection({ state, accessToken }) {
  requireConfigured();
  const flow = await consumeOAuthState(stateHash(state));
  if (!flow) throw new AppError(400, 'ITCH_LINK_EXPIRED', 'This connection request expired. Start again.');
  const [credentials, profile] = await Promise.all([
    itchRequest('/credentials/info', accessToken),
    itchRequest('/profile', accessToken),
  ]);
  const scopes = new Set(credentials.scopes || []);
  const hasProfile = scopes.has('profile');
  if ((!hasProfile && !scopes.has('profile:me')) || (!hasProfile && !scopes.has('profile:owned'))) {
    throw new AppError(400, 'ITCH_SCOPE_MISSING', 'Required itch.io access was not granted.');
  }
  const itchUser = profile.user;
  if (!itchUser?.id || !itchUser?.username) {
    throw new AppError(400, 'ITCH_PROFILE_INVALID', 'The itch.io account could not be verified.');
  }
  try {
    await upsertItchAccount({
      userId: flow.user_id,
      itchUserId: itchUser.id,
      username: itchUser.username,
      profileUrl: itchUser.url || null,
      encryptedToken: encryptToken(accessToken),
    });
  } catch (error) {
    if (error?.code === '23505') {
      throw new AppError(409, 'ITCH_ACCOUNT_IN_USE', 'This itch.io account is already connected to another Deadsmile Games account.');
    }
    throw error;
  }
  try {
    await syncItchLibrary(flow.user_id);
  } catch (error) {
    if (!(error instanceof AppError) || error.code === 'ITCH_NOT_CONNECTED') throw error;
  }
  return {
    client: flow.client,
    locale: flow.locale,
    returnUrl: flow.client === 'site' ? `${env.frontendUrl}${flow.return_path}` : null,
  };
}

export async function disconnectItch(userId) {
  await removeItchAccount(userId);
  return { connected: false };
}

export async function verifyGameOwnership(userId, gameId) {
  requireConfigured();
  const [account, game] = await Promise.all([findItchAccount(userId), findItchGame(gameId)]);
  if (!account) throw new AppError(409, 'ITCH_NOT_CONNECTED', 'Connect your itch.io account to continue.');
  if (!game) throw new AppError(404, 'GAME_NOT_FOUND', 'That game could not be found.');
  if (!game.itch_game_id || !game.purchase_url) {
    throw new AppError(409, 'ITCH_GAME_NOT_CONFIGURED', 'This game is not ready for itch.io ownership checks yet.');
  }
  const result = ownershipFor(game, await ownedKeysFor(account));
  if (result.owned) {
    await grantEntitlement({
      userId,
      gameId: game.id,
      externalReference: result.reference,
      acquiredAt: result.acquiredAt,
    });
  } else {
    await revokeEntitlement(userId, game.id);
  }
  await touchItchAccount(userId);
  return {
    owned: result.owned,
    status: result.owned ? 'owned' : 'not_owned',
    gameId: game.id,
    purchaseUrl: game.purchase_url,
  };
}

export async function syncItchLibrary(userId) {
  requireConfigured();
  const account = await findItchAccount(userId);
  if (!account) throw new AppError(409, 'ITCH_NOT_CONNECTED', 'Connect your itch.io account to continue.');
  const games = await listItchGames();
  const results = [];
  const keys = await ownedKeysFor(account);
  for (const game of games) {
    const result = ownershipFor(game, keys);
    if (result.owned) {
      await grantEntitlement({
        userId,
        gameId: game.id,
        externalReference: result.reference,
        acquiredAt: result.acquiredAt,
      });
    } else {
      await revokeEntitlement(userId, game.id);
    }
    results.push({ gameId: game.id, owned: result.owned });
  }
  await markItchAccountSynced(userId);
  return { results, syncedAt: new Date().toISOString() };
}

export async function getLibrary(userId) {
  return { items: (await listEntitlements(userId)).map(clientGame) };
}

export async function getInstallMetadata(userId, gameId) {
  requireConfigured();
  const [account, game, preferredItchChannel] = await Promise.all([
    findItchAccount(userId),
    findItchGame(gameId),
    findPreferredItchChannel(userId, gameId),
  ]);
  if (!account) throw new AppError(409, 'ITCH_NOT_CONNECTED', 'Connect your itch.io account to continue.');
  if (!game) throw new AppError(404, 'GAME_NOT_FOUND', 'That game could not be found.');
  if (!game.itch_game_id || !game.purchase_url) {
    throw new AppError(409, 'ITCH_GAME_NOT_CONFIGURED', 'This game is not ready for itch.io downloads yet.');
  }
  const ownership = ownershipFor(game, await ownedKeysFor(account));
  if (!ownership.owned) {
    await revokeEntitlement(userId, game.id);
    throw new AppError(403, 'GAME_NOT_OWNED', 'This game is not available in your library.');
  }
  await grantEntitlement({
    userId,
    gameId: game.id,
    externalReference: ownership.reference,
    acquiredAt: ownership.acquiredAt,
  });
  await touchItchAccount(userId);
  const itchGameId = Number(game.itch_game_id);
  if (!Number.isSafeInteger(itchGameId) || itchGameId <= 0) {
    throw new AppError(409, 'ITCH_GAME_NOT_CONFIGURED', 'This game does not have a valid itch.io game ID.');
  }
  return {
    itchGameId,
    preferredItchChannel: preferredItchChannel || null,
    itchUserId: Number(account.itch_user_id),
    ...(await getGithubGameDownload(game)),
  };
}
