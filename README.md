# Deadsmile Games · API

> Backend de produção da plataforma Deadsmile Games.

| Item | Configuração |
| --- | --- |
| Runtime | Node.js 24.x · Express · PostgreSQL |
| Produção | `https://deadsmile.vercel.app` |
| Frontend | `https://deadsmilegames.vercel.app` |
| Deploy | Vercel · Fluid Compute |
| Entrada | `src/server.js` |

## Arquitetura

O backend mantém separação em camadas: `routes` define endpoints e middlewares; `controllers` adapta HTTP; `services` concentra autorização e regras de negócio; `repositories` é a única camada de persistência; `validators` aplica contratos Zod; `middleware` cobre autenticação, CSRF, rate limiting e erros; `realtime` implementa WebSocket e reconciliação de eventos.

Autorização nunca depende de valores enviados pelo frontend. Sessão, papel administrativo, entitlement, propriedade de saves, sessões de jogo, achievements, telemetria e recursos de usuário são revalidados no servidor.

## Segurança

A API usa sessões persistentes em PostgreSQL, regeneração de sessão após autenticação, cookies `HttpOnly` e `Secure` em produção, CSRF por double-submit token, CORS restrito, Helmet, HPP, validação estrita, queries parametrizadas, Argon2id, TOTP, criptografia AES-GCM para segredos sensíveis e rate limiting persistente nos fluxos críticos.

Cloud saves são isolados por usuário, jogo e slot. O servidor valida Base64 canônico, limita o payload, calcula SHA-256 e aplica revisão otimista antes de persistir. Sessões de jogo e tempo jogado são calculados pelo backend. Telemetria exige consentimento e valida o contexto da sessão quando aplicável.

O store de sessão não cria tabelas em runtime; o schema deve existir via migrations. Isso mantém a conta de produção com menor privilégio e evita DDL inesperado durante requests.

## Realtime

O WebSocket fica em `/api/live`. Tickets autenticados são efêmeros e o upgrade valida ticket e origem. Eventos continuam persistidos em `content_events`; PostgreSQL `LISTEN/NOTIFY` distribui o sinal entre instâncias e `/api/platform/events` funciona como reconciliação/fallback.

Na Vercel, WebSockets usam Fluid Compute e podem ser encerrados no limite de duração da Function. Os clientes do site e launcher reconectam e mantêm polling de fallback, portanto o estado durável não depende de uma conexão ou instância específica.

## Banco de dados

Antes de publicar uma revisão que dependa de schema novo:

```bash
npm ci
npm run db:migrate
npm run db:check-abby
```

O runner de migrations usa lock consultivo, transação e checksums. O schema de produção deve manter as constraints de `cloud_saves`, `game_sessions`, entitlements, achievements e relações de usuário/jogo presentes nas migrations.

## Produção

Em CI ou staging com registry e banco de teste acessíveis:

```bash
npm ci
npm audit --omit=dev
npm run db:migrate
npm run db:check-abby
npm start
```

Valide login, logout, 2FA, recuperação de senha, conta, itch.io, entitlement, download, sessões, achievements, cloud saves, telemetria, newsletter, suporte, administração, polling e WebSocket antes de promover o deploy.

Os arquivos de ambiente locais devem permanecer fora de logs e commits públicos. O `.env` deste snapshot foi preservado sem alteração durante a revisão.
