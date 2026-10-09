import { sanitizeContent } from '../utils/contentHtml.js';
import { AppError } from '../utils/AppError.js';
import {
  listNews,
  findNews,
  listVideos,
  findVideo,
  listDownloads,
  listProducts } from
'../repositories/content.repository.js';

export async function getNews(query) {
  return listNews(query);
}

export async function getNewsBySlug(slug) {
  const item = await findNews(slug);
  if (!item) throw new AppError(404, 'NEWS_NOT_FOUND');
  return { ...item, body: sanitizeContent(item.body) };
}

export async function getVideos(query) {
  return listVideos(query);
}

export async function getVideoById(id) {
  const item = await findVideo(id);
  if (!item) throw new AppError(404, 'VIDEO_NOT_FOUND');
  return item;
}

export async function getDownloads() {
  return listDownloads();
}

export async function getProducts() {
  return listProducts();
}
