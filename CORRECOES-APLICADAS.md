# Deadsmile Games — entrega técnica das versões (9)

## Escopo e honestidade da validação

Este pacote é uma **correção parcial testada**, não uma certificação de que todos os bugs da auditoria anterior foram eliminados. Foi preservado o contrato do launcher com a API sempre que possível; o novo campo opcional `expectedUserId` exige publicar **primeiro a API e depois o launcher** (a versão antiga da API rejeita campos extras em `PUT /platform/saves`). Os arquivos foram alterados sobre os dois ZIPs (9) recebidos.

## Correções implementadas

### Launcher

1. `electron/install-state.cjs` e `electron/main.cjs`: reconciliação da biblioteca com o arquivo executável real na inicialização, após mudanças e quando a janela recupera o foco. Exclusão manual da pasta libera o botão de download; caminhos fora da biblioteca e links simbólicos não são aceitos. Falhas de acesso ao diretório raiz mantêm o registro em vez de serem tratadas como desinstalação. Antes de iniciar um jogo, uma falha de validação do executável dispara nova reconciliação.
2. `electron/install-transaction.cjs`, `electron/main.cjs`: instalação normal e atualização passam a usar diretório de preparo no volume da biblioteca, com troca de diretórios, backup e tentativa de rollback. Um backup pendente não é sobrescrito; um backup órfão é recuperado antes de nova substituição. A limpeza de backup após confirmação não invalida um jogo novo que já tenha sido validado.
3. `electron/main.cjs`: downloads normais também respeitam jogo em execução. A desinstalação valida o ID, a identidade do jogo retornada pela API, a pasta de destino e trabalhos em andamento. Se a pasta já foi removida, a desinstalação limpa atalhos e permite remover o registro do frontend.
4. `electron/download-queue.cjs`: resultado confirmado não fica pausado nem retorna cancelado tardiamente; falha permite nova tentativa; o timer antigo não remove a tentativa nova.
5. `electron/main.cjs`: saves PICO-8 divergentes são preservados em backup antes de substituir os dados locais pela revisão remota; a gravação da cópia remota usa arquivo temporário. Falhas na consulta remota bloqueiam upload que não conhece a revisão.
6. `electron/main.cjs`: conquistas pendentes novas carregam ID da conta; eventos da fila não são enviados com outra conta autenticada. Entradas antigas da fila sem dono ficam preservadas sem sincronização automática por não ser possível atribuí-las com segurança. O upload de saves recebe a conta originadora da sessão e falha se a conta ativa mudou.
7. `src/App.jsx`: jogos comprados fora da primeira página pública são incorporados à biblioteca da conta sem contaminar o cache público; notificações pessoais são salvas por conta; seletor de concorrência mostra a configuração real. Falhas de consulta de atualização não são apresentadas como confirmação de versão atualizada. A verificação de update do launcher não depende mais do login.
8. `electron/main.cjs`: a atualização do próprio launcher é impedida quando há partida ou download ativo (verificação antes e depois da preparação).
9. `scripts/validate-auth-bridge.cjs`: verificador atualizado para a mensagem de erro já usada pela implementação atual, sem alterar o comportamento de autenticação do produto.

### API

1. `src/repositories/platform.repository.js`: operações distintas para criação de slot (`INSERT ... ON CONFLICT DO NOTHING`) e atualização condicionada à revisão (`UPDATE ... WHERE revision = $6`). Uma revisão ausente não sobrescreve o save, e uma revisão antiga não recria um slot apagado.
2. `src/routes/platform.routes.js`, `src/middleware/expectedAccount.js`, `src/validators/platform.validators.js`: quando o launcher informa o dono original de saves ou conquistas, a API rejeita a requisição se a conta atualmente autenticada for diferente; o parâmetro é opcional para clientes legados.

## Testes executados

- Node.js nativo: **10/10** testes unitários do launcher; **2/2** testes unitários da API.
- `node --check`: arquivos `.js` e `.cjs` dos diretórios `electron`, `scripts`, `src` e testes: **passaram**.
- `validate-game-shortcuts.cjs`: **10/10** verificações.
- `validate-auth-bridge.cjs`: **13/13** verificações.
- `npm ci --offline` no launcher: **não executou** por dependência não presente no cache (`yocto-queue`). Portanto **não foram executados** o build React/Vite, Electron empacotado, instalador real no Windows, banco PostgreSQL nem integração de rede com GitHub/itch.io.
- Os testes foram executados em Node.js v22.16.0 neste ambiente; a API declara suporte a Node 24.x. Repetir os testes na versão de Node configurada para produção.

## Pendências relevantes — NÃO afirmar que estão corrigidas

1. **Download pausado e retomada após encerrar o launcher**: a fila ainda é volátil; a transferência parcial é descartada, e a pausa reinicia o download. Implementar persistência e suporte condicional a HTTP Range/If-Range somente quando confirmado pelo servidor.
2. **Respostas HTTP 200 para assets privados do GitHub**: a API ainda exige `302`. A documentação oficial aceita `200` ou `302`; suportar `200` com segurança exige desenhar a entrega de stream autenticado, sem expor o token de acesso nem assumir que um backend serverless suportará ZIPs grandes. Não há fallback seguro implementado nesta entrega.
3. **Manifesto por arquivo do jogo / reparo completo**: a verificação atual identifica executável ausente, mas não detecta todos os arquivos de dados/DLLs apagados. Exige um manifesto de release confiável e testes com os pacotes reais.
4. **Troca de conta**: o tempo jogado local e alguns saves físicos compartilhados ainda não têm isolamento completo por conta. Saves PICO-8 usam um caminho local escolhido pelo jogo; não remapear diretórios sem suporte do jogo.
5. **Atualizador do próprio launcher**: o bloqueio preventivo de partidas foi adicionado, mas faltam diário de transação e teste de recuperação com falha de energia no Windows.
6. **Seleção de versões/canais beta**: precisa de definição de política e dados publicados pela API; não foi improvisada uma regra de produto.
7. **Desinstalação offline**: a operação destrutiva agora exige confirmar a identidade do jogo com metadados confiáveis. Para oferecer desinstalação offline, é necessário registro de instalação local assinado ou outra fonte confiável, que não foi criada nesta entrega.
8. **Saves na nuvem**: os backups divergentes são preservados, mas a interface não oferece ainda um seletor visual de versões; recuperação manual é possível por meio dos backups locais.
9. **Sessões remotas interrompidas / estatística por usuário**: a API não usa `durationMs` enviado pelo cliente, e não foi alterado o cálculo de duração nem criado diário de sessões pendentes.
10. **Build/distribuição**: validar ambiente Windows, Node 24 para a API, conexão real com o banco, certificados e tamanho de arquivos antes de publicar em produção.

## Documentação oficial consultada

- Electron: https://www.electronjs.org/docs/latest/tutorial/security
- Node.js, filesystem: https://nodejs.org/api/fs.html
- PostgreSQL, INSERT / ON CONFLICT: https://www.postgresql.org/docs/current/sql-insert.html
- Microsoft, MoveFile: https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefilew
- GitHub REST, release assets: https://docs.github.com/en/rest/releases/assets
- HTTP Range (Mozilla): https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests

## Recursos tipográficos não reenviados

Fontes tipográficas binárias fornecidas nos ZIPs originais não estão incluídas nos ZIPs corrigidos. Antes de preparar a publicação, copie `public/assets/fonts` do ZIP original do **launcher** para a mesma pasta no launcher corrigido e `public/fonts` do ZIP original da **API** para a mesma pasta na API corrigida. Os arquivos de fonte pertencem aos ZIPs enviados por você e não foram alterados; sua ausência nos pacotes desta entrega pode alterar o visual ou impedir a apresentação das fontes personalizadas.
