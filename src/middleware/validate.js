import { sendError } from '../utils/apiResponse.js';
import { publicErrorMessage } from '../utils/publicErrors.js';

const fieldCodes = {
  title: 'FIELD_TITLE', slug: 'FIELD_SLUG', shortDescription: 'FIELD_SHORT_DESCRIPTION',
  description: 'FIELD_DESCRIPTION', status: 'FIELD_GAME_STATUS', releaseDate: 'FIELD_RELEASE_DATE',
  heroImage: 'FIELD_IMAGE', coverImage: 'FIELD_IMAGE', image: 'FIELD_IMAGE', thumbnail: 'FIELD_IMAGE',
  trailerUrl: 'FIELD_HTTPS_URL', videoUrl: 'FIELD_HTTPS_URL', downloadUrl: 'FIELD_HTTPS_URL',
  purchaseUrl: 'FIELD_PURCHASE_URL', itchUrl: 'FIELD_ITCH_URL', itchGameId: 'FIELD_ITCH_ID',
  microsoftStoreBadge: 'INVALID_STORE_BADGE', genres: 'FIELD_TAGS', platforms: 'FIELD_TAGS',
  body: 'FIELD_BODY', excerpt: 'FIELD_EXCERPT', gameId: 'FIELD_GAME_ID', category: 'FIELD_CATEGORY',
};

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const fields = req.originalUrl?.startsWith('/api/admin/') && source === 'body'
        ? [...new Map(result.error.issues.slice(0, 20).map((issue) => {
          const field = String(issue.path[0] || 'form');
          const code = fieldCodes[field] || 'VALIDATION_ERROR';
          return [field, { field, code, message: publicErrorMessage(code, 400, res.locals?.locale) }];
        })).values()] : undefined;
      return sendError(res, 400, 'VALIDATION_ERROR', fields);
    }
    req[source] = result.data;
    next();
  };
}
