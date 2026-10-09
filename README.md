# Deadsmile Games API

Node.js 24+, Express e PostgreSQL. A API autoriza jogos, contas, catálogo, newswire, saves, sessões, conquistas e consentimento de diagnóstico.

## Instalação

1. Execute `npm ci`.
2. Copie `.env.example` para `.env`. Configure o PostgreSQL, as URLs e chaves independentes para `SESSION_SECRET` e `DATA_ENCRYPTION_KEY`, com pelo menos 32 caracteres cada. Gere cada chave com `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`.
3. Para banco vazio, execute `npm run db:bootstrap`. Para o banco existente, faça um backup e execute `npm run db:migrate`. Não importe `schema.sql` sobre um banco existente. A migração registra checksums, mantém os arquivos históricos e criptografa saves antigos. `npm run db:encrypt` pode retomar essa conversão.
4. Configure `ADMIN_EMAIL`, `ADMIN_USERNAME` e `ADMIN_PASSWORD` e execute `npm run seed:admin` se precisar criar o administrador. Retire essas variáveis após o uso.
5. Execute `npm run dev` ou `npm start`.

`npm test` cria PostgreSQL isolado com PGlite e contas fictícias. Não usa o banco informado no seu `.env`. Chamadas externas dos testes são simuladas.

## Jogos e lojas

`accessType` é obrigatório: `free` ou `paid`. A migração classifica registros antigos conforme o comportamento anterior: URL de compra preenchida significa pago. Revise essa classificação no cadastro antes de publicar.

Jogos pagos mantêm a verificação da biblioteca itch.io. Configure OAuth com `ITCH_CLIENT_ID`, `ITCH_REDIRECT_URI` e `ITCH_TOKEN_ENCRYPTION_KEY`; o callback é `/api/integrations/itch/callback`. O usuário não recebe a chave privada do servidor. A verificação acontece novamente ao iniciar uma sessão e obter dados de instalação.

Jogos gratuitos podem usar builds publicados com URL, tamanho e SHA-256, o repositório GitHub já configurado, downloads oficiais do itch.io ou Microsoft Store. Para baixar do itch.io, preencha `itchGameId` e, opcionalmente, `itchUrl`. Configure `ITCH_DOWNLOAD_API_KEY` com uma chave do publicador que tenha acesso ao jogo. O servidor confirma que o jogo está publicado e tem `min_price = 0`. Seleciona apenas ZIP de Windows; múltiplos uploads exigem canal explícito na configuração de builds. Uma URL de página não substitui o ID nem concede acesso à API do provedor.

Cole o badge HTML oficial da Microsoft no cadastro. Ele é convertido em ID e URLs permitidas; nenhum HTML arbitrário é executado. Microsoft Store usa o instalador oficial e gerencia sua instalação e atualizações. Isso não registra um executável local nem comprova compra de jogo pago.

URLs temporárias de download saem apenas do endpoint autenticado `/api/library/:gameId/install-metadata`. Catálogo público retorna `downloadUrl: null`.

## Erros, conteúdo e privacidade

`src/utils/errorCatalog.json` é a fonte dos erros em inglês, português brasileiro e espanhol. `Accept-Language` determina o idioma, com fallback para inglês. A resposta contém `error.code`, `error.locale` e `error.message`. Não há interpolação de exceções privadas. `/api/errors` fornece o catálogo do idioma solicitado.

Execute `npm run errors:sync` com os diretórios irmãos `api`, `website` e `launcher` para atualizar os fallbacks offline dos clientes. Esses arquivos são gerados pela API e não devem ser editados nos clientes.

A newswire usa `/api/newswire`; `/api/news` continua compatível com clientes antigos. Publicações aceitam `gameId` opcional. Corpo HTML usa uma lista restrita de tags. Exclusão do jogo remove a referência sem excluir a notícia.

Diagnóstico exige consentimento de conta. Revogação apaga eventos anteriores e bloqueia gravações concorrentes. Payload permite apenas código de erro e plataforma. Saves usam AES-256-GCM associado a usuário, jogo e slot. Preserve as chaves utilizadas para conseguir ler os dados; a versão anterior de segredos continua compatível.

## Produção

Configure URLs HTTPS reais, `NODE_ENV=production`, `COOKIE_SAMESITE=none`, `DATA_ENCRYPTION_KEY` e segredos independentes. Conexões remotas PostgreSQL verificam TLS; use `DATABASE_SSL_CA` se houver autoridade privada. Configure reCAPTCHA e os provedores de e-mail para os respectivos recursos.

Aplique as migrações antes de disponibilizar a nova API. Publique API, site e launcher da mesma entrega. Em outro domínio, ajuste CORS, `VITE_API_URL`, CSP do site e `API_URL`/origens permitidas do launcher em conjunto. Não coloque `.env`, backups, logs ou builds com credenciais no repositório público.

Os testes não substituem o teste de OAuth, entrega de e-mail, ZIP real e pacote assinado de Windows com suas credenciais de produção.
