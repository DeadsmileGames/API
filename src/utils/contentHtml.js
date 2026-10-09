import sanitizeHtml from 'sanitize-html';
import { newswireTags, newswireAttributes, microsoftBadgeLink, microsoftBadgeImage } from './contentPolicy.js';

export function sanitizeContent(value) {
  const stack = [];
  return sanitizeHtml(String(value || ''), {
    allowedTags: newswireTags,
    allowedAttributes: newswireAttributes,
    allowedSchemes: ['https', 'mailto'],
    allowProtocolRelative: false,
    onOpenTag(tag, attributes) { stack.push({ tag, badge: tag === 'a' ? microsoftBadgeLink(attributes.href) : null }); },
    onCloseTag() { stack.pop(); },
    transformTags: {
      a(tag, attributes) {
        const href = microsoftBadgeLink(attributes.href);
        return { tagName: tag, attribs: href
          ? { href, target: '_self', rel: 'noopener noreferrer', 'aria-label': 'Get it from Microsoft Store' }
          : { ...attributes, target: '_blank', rel: 'noopener noreferrer' } };
      },
      img(tag, attributes) {
        const parent = stack.at(-2);
        const src = microsoftBadgeImage(attributes.src);
        return { tagName: tag, attribs: parent?.tag === 'a' && parent.badge && src
          ? { src, width: '200', alt: 'Get it from Microsoft Store', loading: 'lazy' }
          : {} };
      },
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  });
}
