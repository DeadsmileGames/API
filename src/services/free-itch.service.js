import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

async function request(path) {
  if (!env.itchDownloadApiKey) throw new AppError(503, 'ITCH_DOWNLOAD_NOT_CONFIGURED');
  let response;
  try {
    response = await fetch(`https://api.itch.io${path}`, { headers: { Authorization: `Bearer ${env.itchDownloadApiKey}`, Accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(10_000) });
  } catch { throw new AppError(503, 'ITCH_UNAVAILABLE'); }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.errors?.length) throw new AppError(503, 'ITCH_UNAVAILABLE');
  return data;
}

export async function getFreeItchDownload(game, channel) {
  const catalog = await request('/profile/games');
  const providerGame = catalog.games?.find((item) => String(item.id) === String(game.itch_game_id));
  if (!providerGame || providerGame.published !== true || Number(providerGame.min_price) !== 0) throw new AppError(409, 'GAME_NOT_FREE');
  const data = await request(`/games/${game.itch_game_id}/uploads`);
  const candidates = (data.uploads || []).filter((item) => /\.zip$/i.test(item.filename || '')
    && (item.min_price == null || Number(item.min_price) === 0) && item.hidden !== true
    && (item.p_windows === true || item.traits?.includes('p_windows'))
    && Number.isSafeInteger(Number(item.id)) && Number(item.id) > 0
    && Number.isSafeInteger(Number(item.size)) && Number(item.size) > 0 && Number(item.size) <= 2 * 1024 ** 3
    && (!channel || item.channel_name === channel));
  if (candidates.length !== 1) throw new AppError(409, 'ITCH_UPLOAD_AMBIGUOUS');
  const upload = candidates[0];
  const download = await request(`/uploads/${upload.id}/download`);
  let url;
  try { url = new URL(download.url); } catch { throw new AppError(503, 'ITCH_UNAVAILABLE'); }
  if (url.protocol !== 'https:' || url.username || url.password || !/^(?:[a-z0-9-]+\.)*(?:itch\.zone|hwcdn\.net)$/.test(url.hostname)) throw new AppError(503, 'ITCH_UNAVAILABLE');
  return { delivery: 'archive', downloadUrl: url.toString(), filename: upload.filename, sizeBytes: Number(upload.size),
    version: upload.build?.version ? String(upload.build.version) : null, sha256: null };
}
