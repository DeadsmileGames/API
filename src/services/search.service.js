import { searchGames } from '../repositories/search.repository.js';

function toClientResult(row) {
  return {
    id:               row.id,
    title:            row.title,
    slug:             row.slug,
    shortDescription: row.short_description,
    coverImage:       row.cover_image,
    status:           row.status,
  };
}

export async function performSearch({ q, page, limit }) {
  const { items, total } = await searchGames({ q, page, limit });
  return {
    items: items.map(toClientResult),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
