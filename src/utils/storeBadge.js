import sanitizeHtml from 'sanitize-html';
import { AppError } from './AppError.js';

export function parseStoreBadge(value) {
  if (!value) return null;
  let link = null;
  let image = null;
  let anchors = 0;
  let images = 0;
  let invalid = false;
  const cleaned = sanitizeHtml(String(value), {
    allowedTags: ['a', 'img'],
    allowedAttributes: { a: ['href'], img: ['src'] },
    allowedSchemes: ['https'],
    transformTags: {
      a(tag, attributes) {anchors++;link = attributes.href;return { tagName: tag, attribs: attributes };},
      img(tag, attributes) {images++;image = attributes.src;return { tagName: tag, attribs: attributes };},
      '*': (tag, attributes) => {
        if (!['a', 'img'].includes(tag)) invalid = true;
        return { tagName: tag, attribs: attributes };
      }
    }
  });
  try {
    const href = new URL(link);
    const src = new URL(image);
    const product = href.pathname.match(/^\/installer\/download\/([A-Z0-9]{12})$/i);
    const badge = decodeURIComponent(src.pathname).match(/^\/images\/([a-z]{2}-[a-z]{2}) (light|dark)\.svg$/i);
    if (invalid || anchors !== 1 || images !== 1 || !/^<a href="[^"]+">\s*<img src="[^"]+" \/>\s*<\/a>$/.test(cleaned.trim()) ||
    href.origin !== 'https://get.microsoft.com' || src.origin !== href.origin ||
    href.username || href.password || href.port || href.hash || src.search || src.hash ||
    !product || !badge || href.search !== '?referrer=appbadge') throw new Error();
    return {
      productId: product[1].toUpperCase(),
      href: `https://get.microsoft.com/installer/download/${product[1].toUpperCase()}?referrer=appbadge`,
      imageUrl: `https://get.microsoft.com/images/${badge[1].toLowerCase()}%20${badge[2].toLowerCase()}.svg`
    };
  } catch {
    throw new AppError(400, 'INVALID_STORE_BADGE');
  }
}

export function storeBadgeFromRow(row) {
  if (!/^[A-Z0-9]{12}$/.test(row.microsoft_product_id || '')) return null;
  const imageUrl = row.microsoft_badge_image;
  if (!/^https:\/\/get\.microsoft\.com\/images\/[a-z]{2}-[a-z]{2}%20(?:light|dark)\.svg$/.test(imageUrl || '')) return null;
  return { productId: row.microsoft_product_id, href: `https://get.microsoft.com/installer/download/${row.microsoft_product_id}?referrer=appbadge`, imageUrl };
}
