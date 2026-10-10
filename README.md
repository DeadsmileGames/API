# Deadsmile Games API 1.7.1

Node.js 24+, Express e PostgreSQL. A API autoriza contas e jogos e disponibiliza catálogo, newswire, saves, sessões, conquistas e consentimento de diagnóstico.

## Instalação e banco

Execute `npm ci` e copie `.env.example` para `.env`. Configure PostgreSQL, URLs e chaves independentes para `SESSION_SECRET` e `DATA_ENCRYPTION_KEY`, com pelo menos 32 caracteres. Preserve as chaves existentes para manter sessões e dados criptografados legíveis.

Para banco vazio, execute `npm run db:bootstrap`. Para banco existente, faça um backup e execute `npm run db:migrate`. Não importe `schema.sql` sobre um banco existente. O migrador registra checksums e preserva migrações históricas. `npm run db:encrypt` retoma a conversão de saves antigos.

Esta entrega inclui `013_game_download_links.sql`, que converte `purchase_url` e `download_url` para `text`, preservando os dados e permitindo URLs longas aceitas pelo cadastro. O arquivo SQL também pode ser aberto no editor SQL. Migrações anteriores permanecem necessárias; a 012 remove somente o cache antigo de tradução da newswire.

Para criar o administrador, configure `ADMIN_EMAIL`, `ADMIN_USERNAME` e `ADMIN_PASSWORD` e execute `npm run seed:admin`; retire essas variáveis após o uso. Execute `npm run dev` ou `npm start`.

`npm test` usa PostgreSQL isolado com PGlite, contas fictícias e provedores simulados. Não usa o banco do seu `.env`.

## Jogos, preços e acesso

O cadastro exige `accessType: free` ou `paid`. Os botões usam somente as lojas e o download configurados. Jogos gratuitos publicados podem oferecer itch.io, Microsoft Store e download direto; jogos pagos oferecem compra no itch.io e/ou Microsoft, sem botão público de download direto.

`GET /api/games/:slug` inclui `offers`, preços por loja e metadados Microsoft. O preço itch.io vem do JSON público da página cadastrada, com confirmação do ID quando configurado, timeout, tamanho limitado e cache curto. Não precisa de chave privada do publicador. O preço Microsoft vem dos dados do produto completo, sem usar trial como preço de compra. Valores de moedas diferentes não são convertidos. Se a fonte não fornecer preço, ele permanece desconhecido e o cliente orienta consultar a loja.

Fonte pública itch.io documentada: https://itch.io/docs/api/javascript. A resposta de cada loja é tratada como entrada não confiável. Nenhum JavaScript do provedor é executado no servidor.

Jogos pagos com download do launcher exigem URL de compra itch.io e `itchGameId`. Configure `ITCH_CLIENT_ID`, `ITCH_REDIRECT_URI` e `ITCH_TOKEN_ENCRYPTION_KEY` para OAuth. Callback registrado: `https://api-ust8.onrender.com/api/integrations/itch/callback`. A posse é verificada novamente antes da instalação e do início da sessão; remoção da posse revoga o acesso. Um jogo pago exclusivo da Microsoft pode ser cadastrado sem download do launcher. Compra Microsoft não comprova posse no itch.io.

O catálogo nunca expõe o `download_url` bruto. `downloadAvailable` e `launcherAvailable` exigem link no banco e publicação. `GET /api/games/:slug/download` fornece o link HTTPS cadastrado para jogos gratuitos publicados; em jogos pagos continua exigindo sessão e nova verificação de posse, para compatibilidade com clientes autorizados.

O launcher usa `/api/library/:gameId/install-metadata` autenticado. Sem `download_url`, a instalação é recusada. Um build Windows publicado precisa usar exatamente o `download_url` cadastrado e ter tamanho e SHA-256; permanece também a resolução GitHub da configuração existente. Um link de página ou badge não substitui arquivo instalável nem concede autorização. A biblioteca `/api/library` mostra somente registros ativos adicionados à conta: `source=free` para gratuitos e `source=itch` para pagos. `/api/library/catalog` retorna todos os jogos cadastrados com `owned` e `inLibrary` separados. `POST /api/library/:gameId` registra gratuitamente sem itch.io ou verifica a posse paga antes de registrar. Downloads gratuitos feitos no website com sessão também adicionam o jogo à biblioteca; o download anônimo não cria registro de conta. Desinstalar não remove essa adição. Desconectar itch.io revoga somente registros de compras itch.io.

## Microsoft Store

O campo de badge aceita o HTML oficial, inclusive indentação e quebras de linha. A API extrai somente ID e URLs oficiais; tags extras, destinos falsos e conteúdo executável são rejeitados. Imagens oficiais light ou dark de entrada são normalizadas para dark; os clientes escolhem o idioma correspondente à interface. O body da newswire permite badges oficiais entre parágrafos e remove scripts, handlers, estilos e imagens arbitrárias.

`GET /api/launcher` consulta o produto `9P6P8284V337`. Detalhes de jogos com badge usam o mesmo serviço. Idioma e mercado são en-US/US, pt-BR/BR ou es-ES/ES. Classificação é regional; sem correspondente, fica ausente. O placeholder RP da interface não é certificação.

O serviço consulta endpoints públicos Microsoft, limita respostas a 2 MiB, recusa redirecionamentos e usa cache persistente. Dados são revalidados após uma hora; uma falha temporária permite o último resultado por até sete dias, explicitamente marcado `stale`. O formato público pode mudar, por isso há fallback entre fontes.

Só são retornadas informações existentes: ícone, screenshots, classificação, descritores, versão de pacote, atualização, novidades, privacidade, publicador, preço e demais metadados disponíveis. `downloadCount` permanece `null` sem uma contagem pública confiável; avaliações e compras internas não são downloads.

## Erros, conteúdo e privacidade

`src/utils/errorCatalog.json` é o catálogo mestre em inglês, português brasileiro e espanhol. `Accept-Language` seleciona o idioma; `/api/errors` fornece o catálogo correspondente. Erros retornam código, idioma e mensagem, sem exceções privadas. No CRUD, falhas de validação incluem campos rejeitados e mensagens localizadas, sem repetir os valores enviados.

Execute `npm run errors:sync` com `api`, `website` e `launcher` lado a lado para atualizar fallbacks offline e overlay. `npm run content:sync` sincroniza a política HTML da newswire com o website. Conteúdo original do banco é preservado; não há Azure, serviço de tradução ou chave de tradutor.

Newswire usa `/api/newswire`, com compatibilidade para `/api/news`. Publicações aceitam `gameId` opcional. Excluir um jogo remove a referência sem excluir a notícia. CRUD emite eventos de criação, edição e exclusão; clientes atualizam sem F5. Só novas publicações geram avisos de publicação.

Diagnóstico exige consentimento vinculado à conta. Revogação apaga eventos anteriores e bloqueia coleta concorrente. Payloads são restritos a código de erro e plataforma. Saves usam AES-256-GCM vinculado a usuário, jogo e slot; autorização, limites e conflitos são verificados no backend.

O callback itch.io reutiliza CSS e fontes do website, com carregamento acessível, timeout, mensagens da API e retorno à aba de jogos. `npm run ui:sync` atualiza essas cópias após mudanças no CSS. Tokens do fragmento são removidos do endereço antes das chamadas.

## Produção

Publique API, website e launcher 1.7.1 em conjunto e aplique as migrações antes da nova API. Configure HTTPS, `NODE_ENV=production`, `COOKIE_SAMESITE=none`, segredos independentes, CORS, e-mail e reCAPTCHA. PostgreSQL remoto verifica TLS; use `DATABASE_SSL_CA` se houver CA privada.

`render.yaml` configura Starter pago, Node 24, health check, migração antes da publicação, pool limitado e encerramento gracioso. Não modifica automaticamente um serviço existente. O plano gratuito suspende o serviço após inatividade; código e health check não eliminam essa regra. Documentação: https://render.com/docs/free e https://render.com/docs/blueprint-spec.

O website usa rewrite `/api` da Vercel para este backend; WebSocket conecta diretamente ao Render com ticket autenticado. Alterações de domínio devem atualizar CORS, CSP e URLs nos três projetos. Não publique `.env`, credenciais, backups ou logs.

Os testes cobrem migrações, contratos HTTP, acesso pago/gratuito, preços, sanitização, dados de Store, privacidade, saves, callback e erros. OAuth real, entrega de e-mail, implantação Render e instalação Windows não foram executados neste ambiente.
