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

Na API 1.2.2, esse campo aceita o HTML formatado com quebras de linha e indentação entre as tags. Continuam proibidos tags extras, múltiplos badges nesse campo e destinos diferentes dos oficiais. A correção é compatível com website e launcher 1.2.1 e não exige migração.

A migração `009_microsoft_store_cache.sql` cria o cache persistente de metadados da Store. `GET /api/launcher` consulta o produto `9P6P8284V337`; `GET /api/games/:slug` inclui `microsoftStore` para jogos com badge. Os dois endpoints usam o mesmo serviço, filtram texto/URLs, limitam respostas a 2 MiB e recusam redirecionamentos. Não repassam payloads internos do provedor.

`Accept-Language` seleciona pt-BR/BR, en-US/US ou es-ES/ES. O catálogo é revalidado na próxima consulta depois de uma hora. Uma falha temporária permite mostrar o último resultado por até sete dias com `stale: true`. A instalação gratuita Microsoft exige consulta nova e preço zero do produto completo disponível; não usa cache antigo, trial ou campo gratuito do banco como prova de preço. Falhas e mudança de preço retornam os códigos localizados do catálogo mestre.

São consultados `storeedgefd.dsx.mp.microsoft.com/v9.0/products` e `displaycatalog.mp.microsoft.com/v7.0/products`, endpoints públicos da Microsoft usados pela Store. O formato público pode mudar; o serviço mantém fallback entre as duas fontes e o cache. Requisitos, idiomas, classificações e descritores, mídias, versão, tamanhos, preço, notas, permissões, termos e avaliações só são expostos quando presentes. A versão vem do pacote, nunca da versão do frontend da Store. `downloadCount` permanece `null`: contagem de avaliações ou campos internos de compras não são downloads. Analytics de aquisições exigem credenciais e acesso ao Partner Center; essas credenciais não foram fornecidas nesta entrega.

URLs temporárias de download saem apenas do endpoint autenticado `/api/library/:gameId/install-metadata`. Catálogo público retorna `downloadUrl: null`.

## Erros, conteúdo e privacidade

`src/utils/errorCatalog.json` é a fonte dos erros em inglês, português brasileiro e espanhol. `Accept-Language` determina o idioma, com fallback para inglês. A resposta contém `error.code`, `error.locale` e `error.message`. Não há interpolação de exceções privadas. `/api/errors` fornece o catálogo do idioma solicitado.

Execute `npm run errors:sync` com os diretórios irmãos `api`, `website` e `launcher` para atualizar os fallbacks offline dos clientes. Esses arquivos são gerados pela API e não devem ser editados nos clientes.

A newswire usa `/api/newswire`; `/api/news` continua compatível com clientes antigos. Publicações aceitam `gameId` opcional. Corpo HTML usa uma lista restrita de tags. Exclusão do jogo remove a referência sem excluir a notícia.

O body também aceita um ou mais badges oficiais Microsoft Store misturados ao texto. O link deve usar `https://get.microsoft.com/installer/download/ID?referrer=appbadge`, e a imagem `https://get.microsoft.com/images/en-us%20light.svg` ou sua variante oficial de idioma/tema. A API preserva somente esse par validado, normaliza largura, descrição e carregamento e remove scripts, handlers, estilos e outras imagens. Execute `npm run content:sync` na API para sincronizar essa política com site e launcher. Posts cujo badge foi removido pela versão anterior precisam recebê-lo novamente e ser salvos; o HTML descartado não está no banco. Esta correção não acrescenta migração.

Diagnóstico exige consentimento de conta. Revogação apaga eventos anteriores e bloqueia gravações concorrentes. Payload permite apenas código de erro e plataforma. Saves usam AES-256-GCM associado a usuário, jogo e slot. Preserve as chaves utilizadas para conseguir ler os dados; a versão anterior de segredos continua compatível.

## Produção

Configure URLs HTTPS reais, `NODE_ENV=production`, `COOKIE_SAMESITE=none`, `DATA_ENCRYPTION_KEY` e segredos independentes. Conexões remotas PostgreSQL verificam TLS; use `DATABASE_SSL_CA` se houver autoridade privada. Configure reCAPTCHA e os provedores de e-mail para os respectivos recursos.

Aplique as migrações antes de disponibilizar a nova API. Publique API, site e launcher da mesma entrega. Em outro domínio, ajuste CORS, `VITE_API_URL`, CSP do site e `API_URL`/origens permitidas do launcher em conjunto. Não coloque `.env`, backups, logs ou builds com credenciais no repositório público.

Os testes não substituem o teste de OAuth, entrega de e-mail, ZIP real e pacote assinado de Windows com suas credenciais de produção.

## Sincronização de conteúdo — versão 1.3.0

Execute `npm run db:migrate` antes de publicar. A migração `010_content_change_events.sql` amplia a restrição dos eventos para edição e exclusão de jogos, newswire e vídeos. O CRUD emite esses eventos para atualizar site e launcher; somente novas publicações enviam avisos de publicação. As migrações históricas continuam intactas. A classificação principal da Store é selecionada pelo mercado solicitado: DJCTQ/BR, ESRB/US ou PEGI/ES; sem correspondência, retorna `null`.
