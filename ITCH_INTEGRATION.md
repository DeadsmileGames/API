# Integração itch.io

## Configuração

1. Crie uma aplicação OAuth nas configurações da conta publicadora da Deadsmile no itch.io.
2. Cadastre como callback exatamente a URL HTTPS do backend seguida de `/api/integrations/itch/callback`.
3. Configure no backend:

```env
ITCH_CLIENT_ID=
ITCH_API_KEY=
ITCH_TOKEN_ENCRYPTION_KEY=
ITCH_REDIRECT_URI=https://api.seudominio.com/api/integrations/itch/callback
BACKEND_URL=https://api.seudominio.com
FRONTEND_URL=https://seudominio.com
```

`ITCH_API_KEY` deve pertencer à conta publicadora dos jogos. `ITCH_TOKEN_ENCRYPTION_KEY` deve ser um segredo aleatório exclusivo com pelo menos 32 caracteres.

## Banco de dados

Execute antes de publicar o novo backend:

```bash
npm run db:migrate
```

Para jogos já existentes, associe a URL de compra e o ID numérico exibido na página de edição do jogo no itch.io:

```sql
UPDATE games
SET purchase_url = 'https://deadsml.itch.io/abbyrestlessheart/purchase',
    itch_game_id = 4520313
WHERE slug IN ('abbyrestlessheart', 'abbys-restless-heart');
```

O ID também pode ser obtido pelo endpoint oficial `GET https://api.itch.io/profile/games`, autenticado com a chave da conta publicadora.

## Ordem de publicação

1. Migração do banco.
2. Backend.
3. Frontend.
4. Launcher.

## Validação operacional

1. Vincule uma conta itch.io sem o jogo e confirme que a verificação retorna como não adquirido.
2. Conclua uma compra real de baixo valor no checkout do itch.io.
3. Volte ao site e confirme a entrada na biblioteca.
4. Abra o launcher com a mesma conta Deadsmile e sincronize a biblioteca.
5. Baixe, instale, abra e remova o jogo.
6. Revogue a chave de download no itch.io e confirme que um novo download é recusado.

## Limite da API pública

OAuth, perfil e verificação do download key usam APIs oficiais do itch.io. O itch.io não publica uma API de cobrança por cartão nem uma API pública documentada para um launcher de terceiros baixar os arquivos comprados. Por isso, o pagamento deve continuar no checkout seguro do itch.io. O downloader já adotado pelo launcher permanece como camada de compatibilidade para aquisição do arquivo e deve ser validado em homologação sempre que o itch.io alterar o fluxo de downloads.
