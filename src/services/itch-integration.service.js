import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { encryptToken } from '../utils/tokenCipher.js';
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
  return Boolean(env.itchClientId && env.itchApiKey && env.itchTokenEncryptionKey.length >= 32 && env.itchRedirectUri);
}

function requireConfigured() {
  if (!configured()) {
    throw new AppError(503, 'ITCH_NOT_CONFIGURED', 'itch.io connection is temporarily unavailable.');
  }
}

function stateHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function itchRequest(path, token, params, { allowApiErrors = false, method = 'GET' } = {}) {
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
  if (!data || (!response.ok && !allowApiErrors)) {
    throw new AppError(503, 'ITCH_UNAVAILABLE', 'itch.io could not complete the request. Try again shortly.');
  }
  return data;
}

function newestUpload(uploads, preferredChannel) {
  const available = Array.isArray(uploads) ? uploads.filter((upload) => upload?.id) : [];
  const channel = String(preferredChannel || '').trim().toLowerCase();
  const candidates = channel
    ? available.filter((upload) => String(upload.channel_name || '').trim().toLowerCase() === channel)
    : available;
  return candidates.sort((a, b) => {
    const aBuild = Number(a.build?.id || 0);
    const bBuild = Number(b.build?.id || 0);
    if (aBuild !== bBuild) return bBuild - aBuild;
    return Date.parse(b.updated_at || b.created_at || 0) - Date.parse(a.updated_at || a.created_at || 0);
  })[0] || null;
}

function safeDownloadRedirect(value, base) {
  let url;
  try {
    url = new URL(value, base);
  } catch {
    throw new AppError(503, 'ITCH_DOWNLOAD_UNAVAILABLE', 'The game download is temporarily unavailable.');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new AppError(503, 'ITCH_DOWNLOAD_UNAVAILABLE', 'The game download is temporarily unavailable.');
  }
  return url.toString();
}

async function itchDownloadRedirect({ gameId, downloadKeyId, upload }) {
  const session = await itchRequest(
    `/games/${gameId}/download-sessions`,
    env.itchApiKey,
    { download_key_id: downloadKeyId },
    { method: 'POST' },
  );
  if (!session?.uuid) {
    throw new AppError(503, 'ITCH_DOWNLOAD_UNAVAILABLE', 'The game download is temporarily unavailable.');
  }
  const buildId = Number(upload.build?.id || 0);
  const path = buildId > 0
    ? `/builds/${buildId}/download/archive/default`
    : `/uploads/${Number(upload.id)}/download`;
  const url = new URL(`${API_ROOT}${path}`);
  url.searchParams.set('api_key', env.itchApiKey);
  url.searchParams.set('download_key_id', String(downloadKeyId));
  url.searchParams.set('uuid', String(session.uuid));
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: 'application/octet-stream' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AppError(503, 'ITCH_DOWNLOAD_UNAVAILABLE', 'The game download is temporarily unavailable.');
  }
  const location = response.headers.get('location');
  if (![301, 302, 303, 307, 308].includes(response.status) || !location) {
    throw new AppError(503, 'ITCH_DOWNLOAD_UNAVAILABLE', 'The game download is temporarily unavailable.');
  }
  return safeDownloadRedirect(location, url);
}

async function ownershipFor(game, itchUserId) {
  const data = await itchRequest(`/games/${game.itch_game_id}/download_keys`, env.itchApiKey, { user_id: itchUserId }, { allowApiErrors: true });
  if (data.download_key) {
    return {
      owned: true,
      reference: String(data.download_key.id),
      acquiredAt: data.download_key.created_at || null,
    };
  }
  const noKey = Array.isArray(data.errors) && data.errors.some((message) => /no download key found|invalid download key/i.test(String(message)));
  if (noKey) return { owned: false };
  throw new AppError(503, 'ITCH_UNAVAILABLE', 'itch.io could not verify this game. Try again shortly.');
}

function publicAccount(account) {
  if (!account) return { connected: false, configured: configured() };
  return {
    connected: true,
    configured: configured(),
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
    downloadUrl: row.download_url,
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
  url.searchParams.set('scope', 'profile:me');
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
  if (!hasProfile && !scopes.has('profile:me')) {
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
  const result = await ownershipFor(game, account.itch_user_id);
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
  for (const game of games) {
    const result = await ownershipFor(game, account.itch_user_id);
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

export async function getDownloadAuthorization(userId, gameId) {
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
  const ownership = await ownershipFor(game, account.itch_user_id);
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
  const uploads = await itchRequest(
    `/games/${game.itch_game_id}/uploads`,
    env.itchApiKey,
    { download_key_id: ownership.reference },
  );
  const upload = newestUpload(uploads.uploads, preferredItchChannel);
  if (!upload) {
    throw new AppError(
      409,
      preferredItchChannel ? 'ITCH_CHANNEL_UNAVAILABLE' : 'WINDOWS_BUILD_UNAVAILABLE',
      'A compatible game build is not available yet.',
    );
  }
  const downloadUrl = await itchDownloadRedirect({
    gameId: Number(game.itch_game_id),
    downloadKeyId: ownership.reference,
    upload,
  });
  return {
    itchGameId: Number(game.itch_game_id),
    preferredItchChannel,
    downloadUrl,
    uploadId: Number(upload.id),
    buildId: upload.build?.id ? Number(upload.build.id) : null,
    filename: upload.filename || `${game.slug || game.id}.zip`,
    sizeBytes: Number(upload.size || 0),
    version: upload.build?.user_version || upload.build?.userVersion || null,
  };
}