# Contributing

## Development

- Use Node.js 24 or newer and a disposable PostgreSQL database for migration checks.
- Run `npm ci`, `npm audit --audit-level=high`, and `npm test`.
- To verify the current schema against a fresh local database, configure `.env` for that disposable database and run `npm run db:bootstrap`, `npm run db:migrate`, and `npm run db:verify`.
- Never run bootstrap or migration experiments against production. Back up any non-disposable database before applying migrations.

## Pull requests

Target `main` unless a change is explicitly intended for `Beta`. Keep changes scoped, add regression tests for behavior changes, and describe authorization and failure cases. Treat all third-party HTTP responses and submitted content as untrusted.

Applied SQL migration files are immutable. Add a new migration rather than editing a migration that has already been deployed. Do not include credentials, production data, or personal information in tests, commits, logs, or screenshots. Coordinate API contract changes with the website and Windows launcher.

The PostgreSQL CI job generates per-run test keys at runtime. Keep reusable credentials and secret-like values out of workflow YAML and test fixtures.
