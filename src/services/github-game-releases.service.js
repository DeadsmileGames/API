import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

function configuration() {
  const repository = String(env.githubGameRepository || '').trim();
  const token = String(env.githubGameToken || '').trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !token) {
    throw new AppError(503, 'GITHUB_GAMES_NOT_CONFIGURED', 'Game downloads are not configured yet.');
  }
  return { repository, token };
}

function releaseAssetFromGame(game, repository) {
  let url;
  try {
    url = new URL(game.download_url);
  } catch {
    throw new AppError(409, 'GAME_RELEASE_NOT_CONFIGURED', 'The game needs a GitHub Release download URL.');
  }
  const segments = url.pathname.split('/').filter(Boolean);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password
    || url.search || url.hash || segments.length !== 6 || segments[2] !== 'releases'
    || segments[3] !== 'download' || `${segments[0]}/${segments[1]}`.toLowerCase() !== repository.toLowerCase()) {
    throw new AppError(409, 'GAME_RELEASE_NOT_CONFIGURED', 'The game release URL does not match the configured private repository.');
  }
  let tag;
  let filename;
  try {
    tag = decodeURIComponent(segments[4]);
    filename = decodeURIComponent(segments[5]);
  } catch {
    throw new AppError(409, 'GAME_RELEASE_NOT_CONFIGURED', 'The game release URL is invalid.');
  }
  if (!tag || tag.length > 150 || !/^[A-Za-z0-9._/-]+$/.test(tag)
    || !filename || filename.length > 255 || !/^[A-Za-z0-9._ -]+\.zip$/i.test(filename)) {
    throw new AppError(409, 'GAME_RELEASE_NOT_CONFIGURED', 'The game must refer to a valid ZIP asset in a release.');
  }
  return { tag, filename };
}

async function githubFetch(url, token, accept) {
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: accept,
        'User-Agent': 'Deadsmile-Games-API',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new AppError(503, 'GITHUB_UNAVAILABLE', 'GitHub could not be reached. Try again later.');
  }
  if (response.status === 401 || response.status === 403) {
    await response.body?.cancel().catch(() => {});
    throw new AppError(503, 'GITHUB_GAMES_ACCESS_DENIED', 'The game repository is not accessible to the server.');
  }
  if (response.status === 404) {
    await response.body?.cancel().catch(() => {});
    throw new AppError(409, 'GAME_RELEASE_NOT_FOUND', 'The selected game release was not found.');
  }
  return response;
}

export async function getGithubGameDownload(game) {
  const { repository, token } = configuration();
  const { tag, filename } = releaseAssetFromGame(game, repository);
  const repoApi = `https://api.github.com/repos/${repository}`;
  const releaseResponse = await githubFetch(`${repoApi}/releases/tags/${encodeURIComponent(tag)}`, token, 'application/vnd.github+json');
  if (!releaseResponse.ok) {
    await releaseResponse.body?.cancel().catch(() => {});
    throw new AppError(503, 'GITHUB_UNAVAILABLE', 'GitHub could not locate the game release.');
  }
  const release = await releaseResponse.json().catch(() => null);
  const asset = release?.assets?.find((item) => item.name === filename && item.state === 'uploaded');
  if (!asset || !Number.isSafeInteger(asset.id) || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > 2 * 1024 * 1024 * 1024) {
    throw new AppError(409, 'GAME_ASSET_UNAVAILABLE', 'The selected game ZIP is missing or has an invalid size.');
  }
  const assetResponse = await githubFetch(`${repoApi}/releases/assets/${asset.id}`, token, 'application/octet-stream');
  if (assetResponse.status !== 302) {
    await assetResponse.body?.cancel().catch(() => {});
    throw new AppError(503, 'GITHUB_REDIRECT_UNAVAILABLE', 'GitHub did not provide a direct download link for this private release.');
  }
  const location = assetResponse.headers.get('location');
  let download;
  try {
    download = new URL(location);
  } catch {
    throw new AppError(503, 'GITHUB_REDIRECT_UNAVAILABLE', 'GitHub did not provide a valid download link.');
  }
  if (download.protocol !== 'https:' || download.username || download.password
    || !(download.hostname === 'githubusercontent.com' || download.hostname.endsWith('.githubusercontent.com'))) {
    throw new AppError(503, 'GITHUB_REDIRECT_UNAVAILABLE', 'GitHub returned an unexpected download destination.');
  }
  const digest = String(asset.digest || '');
  const versionMatch = tag.match(/(?:^|[-_/])v?(\d+(?:\.\d+){1,3})$/i);
  return {
    downloadUrl: download.toString(),
    filename,
    sizeBytes: asset.size,
    sha256: /^sha256:[0-9a-f]{64}$/i.test(digest) ? digest.slice(7).toLowerCase() : null,
    version: versionMatch ? versionMatch[1] : null,
  };
}
