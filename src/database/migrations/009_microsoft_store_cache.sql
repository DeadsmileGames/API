CREATE TABLE microsoft_store_products (
  product_id text NOT NULL CHECK (product_id ~ '^[A-Z0-9]{12}$'),
  market text NOT NULL CHECK (market IN ('BR', 'US', 'ES')),
  locale text NOT NULL CHECK (locale IN ('pt-BR', 'en-US', 'es-ES')),
  metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, market, locale)
);
