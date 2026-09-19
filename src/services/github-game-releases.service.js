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

function releaseVersion(tag) {
  const match = String(tag || '').match(/(?:^|[-_/])v?(\d+(?:\.\d+){1,3})$/i);
  return match ? match[1] : null;
}

function compareReleaseVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
  }
  return 0;
}

function validZipAsset(asset) {
  return asset && asset.state === 'uploaded'
    && typeof asset.name === 'string' && /^[A-Za-z0-9._ -]+\.zip$/i.test(asset.name)
    && Number.isSafeInteger(asset.id)
    && Number.isSafeInteger(asset.size)
    && asset.size > 0 && asset.size <= 2 * 1024 * 1024 * 1024;
}

function zipAssetForRelease(release, preferredFilename) {
  const archives = Array.isArray(release?.assets) ? release.assets.filter(validZipAsset) : [];
  if (archives.length === 1) return archives[0];
  return archives.find((asset) => asset.name === preferredFilename) || null;
}

async function latestGameRelease(repoApi, token, tag, filename) {
  const baseline = tag.match(/^(.*[-_/])v?(\d+(?:\.\d+){1,3})$/i);
  if (!baseline) return null;
  const prefix = baseline[1].toLowerCase();
  let latest = null;
  let latestVersion = baseline[2];
  for (let page = 1; page <= 3; page += 1) {
    const response = await githubFetch(`${repoApi}/releases?per_page=100&page=${page}`, token, 'application/vnd.github+json');
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new AppError(503, 'GITHUB_UNAVAILABLE', 'GitHub could not list game releases.');
    }
    const releases = await response.json().catch(() => null);
    if (!Array.isArray(releases)) throw new AppError(503, 'GITHUB_UNAVAILABLE', 'GitHub returned invalid release data.');
    for (const release of releases) {
      if (!release || release.draft || release.prerelease || typeof release.tag_name !== 'string') continue;
      const candidateTag = release.tag_name;
      if (!candidateTag.toLowerCase().startsWith(prefix)) continue;
      const version = releaseVersion(candidateTag);
      if (!version || candidateTag.slice(0, candidateTag.length - version.length).replace(/v$/i, '').toLowerCase() !== prefix) continue;
      if (compareReleaseVersions(version, latestVersion) <= 0) continue;
      const asset = zipAssetForRelease(release, filename);
      if (!asset) continue;
      latest = { release, asset };
      latestVersion = version;
    }
    if (releases.length < 100) break;
  }
  return latest;
}

export async function getGithubGameDownload(game) {
  const { repository, token } = configuration();
  const { tag, filename } = releaseAssetFromGame(game, repository);
  const repoApi = `https://api.github.com/repos/${repository}`;
  const newerRelease = await latestGameRelease(repoApi, token, tag, filename);
  let release = newerRelease?.release;
  let asset = newerRelease?.asset;
  if (!release) {
    const releaseResponse = await githubFetch(`${repoApi}/releases/tags/${encodeURIComponent(tag)}`, token, 'application/vnd.github+json');
    if (!releaseResponse.ok) {
      await releaseResponse.body?.cancel().catch(() => {});
      throw new AppError(503, 'GITHUB_UNAVAILABLE', 'GitHub could not locate the game release.');
    }
    release = await releaseResponse.json().catch(() => null);
    if (release?.draft || release?.prerelease) throw new AppError(409, 'GAME_RELEASE_NOT_FOUND', 'The selected game release is not published.');
    asset = release?.assets?.find((item) => item.name === filename && validZipAsset(item));
  }
  if (!asset) {
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
  const version = releaseVersion(release?.tag_name || tag);
  return {
    downloadUrl: download.toString(),
    filename: asset.name,
    sizeBytes: asset.size,
    sha256: /^sha256:[0-9a-f]{64}$/i.test(digest) ? digest.slice(7).toLowerCase() : null,
    version,
  };
}
