import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { getGithubGameDownload } from './github-game-releases.service.js';
import { toClientGame } from '../utils/clientGame.js';
import { AppError } from '../utils/AppError.js';
import { decryptToken, encryptToken } from '../utils/tokenCipher.js';
import {
  consumeOAuthState,
  createOAuthState,
  findItchAccount,
  findItchGame,
  findInstallBuild,

  grantEntitlement,
  listEntitlements,
  listItchGames,
  markItchAccountSynced,
  removeItchAccount,
  revokeEntitlement,
  touchItchAccount,
  upsertItchAccount } from
'../repositories/itch-integration.repository.js';

const API_ROOT = 'https://api.itch.io';

function configured() {
  return Boolean(env.itchClientId && env.itchTokenEncryptionKey.length >= 32 && env.itchRedirectUri);
}

function requireConfigured() {
  if (!configured()) {
    throw new AppError(503, 'ITCH_NOT_CONFIGURED');
  }
}

function stateHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function itchRequest(path, token, params, { method = 'GET' } = {}) {
  const url = new URL(`${API_ROOT}${path}`);
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(params || {})) {
    if (method === 'GET') {
      url.searchParams.set(key, String(value));
    } else {
      body.set(key, String(value));
    }
  }

  let response;
  let data;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(method === 'GET'
          ? {}
          : { 'Content-Type': 'application/x-www-form-urlencoded' })
      },
      ...(method === 'GET' ? {} : { body }),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000)
    });

    data = await response.json().catch(() => null);
  } catch (error) {
    const networkCodes = new Set([
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_BODY_TIMEOUT'
    ]);

    const cause = error?.cause?.code || error?.code;

    console.warn('itch_request_failed', {
      endpoint: path,
      reason:
        error?.name === 'TimeoutError'
          ? 'TIMEOUT'
          : networkCodes.has(cause)
            ? cause
            : 'FETCH_FAILED'
    });

    throw new AppError(503, 'ITCH_UNAVAILABLE');
  }

  const providerErrors = Array.isArray(data?.errors) ? data.errors : [];

  if (
    !response.ok ||
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    providerErrors.length
  ) {
    const description = providerErrors
      .filter((item) => typeof item === 'string')
      .join(' ')
      .toLowerCase();

    const scopeMissing = /scope|permission/.test(description);

    const invalidToken =
      /invalid[_ ](?:api[_ ]key|key|token|credentials)|(?:token|key|credentials).*?(?:expired|revoked)|unauthenticated|unauthorized/.test(
        description
      );

    const code = scopeMissing
      ? 'ITCH_SCOPE_MISSING'
      : response.status === 401 ||
          response.status === 403 ||
          invalidToken
        ? 'ITCH_RECONNECT_REQUIRED'
        : 'ITCH_UNAVAILABLE';

    console.warn('itch_request_failed', {
      endpoint: path,
      status: response.status,
      reason: code,
      invalidJson: !data
    });

    throw new AppError(
      code === 'ITCH_UNAVAILABLE' ? 503 : 409,
      code
    );
  }

  return data;
}

async function ownedKeysFor(account, gameIds = []) {
  const token = decryptToken(account.access_token_encrypted);
  const ids = [...new Set(gameIds.map(String))];

  if (
    ids.length > 50 ||
    ids.some((id) => !/^[1-9]\d*$/.test(id))
  ) {
    throw new AppError(409, 'ITCH_GAME_NOT_CONFIGURED');
  }

  const keys = [];
  const seenPages = new Set();

  for (let page = 1; page <= 200; page += 1) {
    const data = await itchRequest('/profile/owned-keys', token, {
      page,
      per_page: 500,
      ...(ids.length ? { game_ids: ids.join(',') } : {})
    });

    if (!Array.isArray(data.owned_keys)) {
      console.warn('itch_library_invalid', {
        reason: 'MISSING_OWNED_KEYS',
        page
      });

      throw new AppError(503, 'ITCH_LIBRARY_INVALID');
    }

    const pageKeys = data.owned_keys;

    if (!pageKeys.length) return keys;

    const invalidKey = pageKeys.some(
      (item) =>
        !/^[1-9]\d*$/.test(String(item?.id || '')) ||
        !/^[1-9]\d*$/.test(
          String(item?.game_id || item?.game?.id || '')
        )
    );

    if (invalidKey) {
      console.warn('itch_library_invalid', {
        reason: 'INVALID_KEY_DATA',
        page
      });

      throw new AppError(503, 'ITCH_LIBRARY_INVALID');
    }

    const pageIdentity = pageKeys
      .map((item) => String(item.id))
      .join(',');

    if (seenPages.has(pageIdentity)) {
      console.warn('itch_library_invalid', {
        reason: 'REPEATED_PAGE',
        page
      });

      throw new AppError(503, 'ITCH_LIBRARY_INVALID');
    }

    seenPages.add(pageIdentity);
    keys.push(...pageKeys);
  }

  throw new AppError(503, 'ITCH_LIBRARY_TOO_LARGE');
}

function ownershipFor(game, keys) {
  const match = keys.find((item) =>
  String(item?.game_id || item?.game?.id || '') === String(game.itch_game_id) &&
  item?.id != null
  );
  return match ?
  { owned: true, reference: String(match.id), acquiredAt: match.created_at || null } :
  { owned: false };
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
    lastSyncAt: account.last_sync_at
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
    expiresAt: new Date(Date.now() + 10 * 60 * 1_000)
  });
  const url = new URL('https://itch.io/user/oauth');
  url.searchParams.set('client_id', env.itchClientId);
  url.searchParams.set('scope', 'profile:me profile:owned');
  url.searchParams.set('redirect_uri', env.itchRedirectUri);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('state', state);
  return { authorizeUrl: url.toString(), expiresIn: 600 };
}

export async function completeItchConnection({ state, accessToken }, setLocale = () => {}) {
  requireConfigured();
  const flow = await consumeOAuthState(stateHash(state));
  if (!flow) throw new AppError(400, 'ITCH_LINK_EXPIRED');
  setLocale(flow.locale);
  const [credentials, profile] = await Promise.all([
  itchRequest('/credentials/info', accessToken),
  itchRequest('/profile', accessToken)]
  );
  const scopes = new Set(
    Array.isArray(credentials.scopes) ? credentials.scopes : []
  );
  const hasProfile = scopes.has('profile');
  if (!hasProfile && !scopes.has('profile:me') || !hasProfile && !scopes.has('profile:owned')) {
    throw new AppError(400, 'ITCH_SCOPE_MISSING');
  }
  const itchUser = profile.user;
  if (!itchUser?.id || !itchUser?.username) {
    throw new AppError(400, 'ITCH_PROFILE_INVALID');
  }
  try {
    await upsertItchAccount({
      userId: flow.user_id,
      itchUserId: itchUser.id,
      username: itchUser.username,
      profileUrl: itchUser.url || null,
      encryptedToken: encryptToken(accessToken)
    });
  } catch (error) {
    if (error?.code === '23505') {
      throw new AppError(409, 'ITCH_ACCOUNT_IN_USE');
    }
    throw error;
  }
  try {
  await syncItchLibrary(flow.user_id);
} catch (error) {
  if (
    !(error instanceof AppError) ||
    error.code === 'ITCH_NOT_CONNECTED'
  ) {
    throw error;
  }

  console.warn('itch_initial_sync_failed', {
    code: error.code
  });
}
  return {
    client: flow.client,
    locale: flow.locale,
    returnUrl: flow.client === 'site' ? `${env.frontendUrl}${flow.return_path}` : null
  };
}

export async function disconnectItch(userId) {
  await removeItchAccount(userId);
  return { connected: false };
}

export async function verifyGameOwnership(userId, gameId) {
  const game = await findItchGame(gameId);
  if (!game) throw new AppError(404, 'GAME_NOT_FOUND');
  if (game.status !== 'released') throw new AppError(409, 'GAME_NOT_RELEASED');
  if (game.access_type === 'free') {
    return { owned: true, status: 'owned', accessType: 'free', gameId };
  }
  requireConfigured();
  const account = await findItchAccount(userId);
  if (!account) throw new AppError(409, 'ITCH_NOT_CONNECTED');
  if (!game.itch_game_id || !game.purchase_url) throw new AppError(409, 'ITCH_GAME_NOT_CONFIGURED');
  const result = ownershipFor(
    game,
    await ownedKeysFor(account, [game.itch_game_id])
  );
  if (result.owned) await grantEntitlement({ userId, gameId, externalReference: result.reference, acquiredAt: result.acquiredAt });else
  await revokeEntitlement(userId, gameId);
  await touchItchAccount(userId);
  return { owned: result.owned, status: result.owned ? 'owned' : 'not_owned', gameId, purchaseUrl: game.purchase_url };
}

export async function syncItchLibrary(userId) {
  requireConfigured();
  const account = await findItchAccount(userId);
  if (!account) throw new AppError(409, 'ITCH_NOT_CONNECTED');
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
        acquiredAt: result.acquiredAt
      });
    } else {
      await revokeEntitlement(userId, game.id);
    }
    results.push({ gameId: game.id, owned: result.owned });
  }
  await markItchAccountSynced(userId);
  return { results, syncedAt: new Date().toISOString() };
}

function libraryGame(row) {
  return { ...toClientGame(row), owned: row.owned === true, inLibrary: row.in_library === true, acquiredAt: row.acquired_at, lastVerifiedAt: row.last_verified_at };
}

export async function getLibrary(userId) {
  return { items: (await listEntitlements(userId)).map(libraryGame) };
}

export async function getLauncherCatalog(userId) {
  return { items: (await listEntitlements(userId, true)).map(libraryGame) };
}

export async function addGameToLibrary(userId, gameId) {
  const ownership = await verifyGameOwnership(userId, gameId);
  if (!ownership.owned) throw new AppError(403, 'GAME_NOT_OWNED');
  if (ownership.accessType === 'free') await grantEntitlement({ userId, gameId, source: 'free' });
  return { gameId, owned: true, inLibrary: true };
}

export async function getInstallMetadata(userId, gameId) {
  const game = await findItchGame(gameId);
  if (!game) throw new AppError(404, 'GAME_NOT_FOUND');
  if (!game.download_url) throw new AppError(409, 'GAME_RELEASE_NOT_CONFIGURED');
  await addGameToLibrary(userId, gameId);
  const build = await findInstallBuild(userId, gameId);
  if (build?.download_url === game.download_url) {
    return { delivery: 'archive', downloadUrl: game.download_url, filename: new URL(game.download_url).pathname.split('/').pop(),
      sha256: build.sha256, sizeBytes: Number(build.size_bytes), version: build.version };
  }
  return { delivery: 'archive', ...(await getGithubGameDownload(game)) };
}
