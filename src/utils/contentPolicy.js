export const newswireTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'code', 'pre', 'img'];
export const newswireAttributes = { a: ['href', 'title', 'target', 'rel', 'aria-label'], img: ['src', 'width', 'alt', 'loading'] };

export function microsoftBadgeLink(value) {
  const match = typeof value === 'string' && value.match(/^https:\/\/get\.microsoft\.com\/installer\/download\/([A-Z0-9]{12})\?referrer=appbadge$/i);
  return match ? `https://get.microsoft.com/installer/download/${match[1].toUpperCase()}?referrer=appbadge` : null;
}

export function microsoftBadgeImage(value) {
  const match = typeof value === 'string' && value.match(/^https:\/\/get\.microsoft\.com\/images\/([a-z]{2}-[a-z]{2})(?:%20| )(light|dark)\.svg$/i);
  return match ? `https://get.microsoft.com/images/${match[1].toLowerCase()}%20${match[2].toLowerCase()}.svg` : null;
}
