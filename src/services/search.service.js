import { searchSite } from "../repositories/search.repository.js";

function toClientResult(row) {
  const item = {
    type: row.type,
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description || "",
    image: row.image || null,
    status: row.status || null,
    publishedAt: row.published_at || null,
  };

  if (row.type === "game") {
    item.coverImage = row.image || null;
    item.shortDescription = row.description || "";
  }

  if (row.type === "news") {
    item.excerpt = row.description || "";
  }

  if (row.type === "video") {
    item.thumbnail = row.thumbnail || row.image || null;
    item.thumbnail_en = row.thumbnail_en || null;
    item.thumbnail_pt_br = row.thumbnail_pt_br || null;
    item.thumbnail_es = row.thumbnail_es || null;
  }

  return item;
}

export async function performSearch({ q, page, limit, language = "en" }) {
  const { items, total } = await searchSite({ q, page, limit, language });
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
