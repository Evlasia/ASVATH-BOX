# ASVATH Box

Aplicação de gestão do inventário da ASVATH, com Supabase/PostgreSQL como base persistente. Permite listar, pesquisar, filtrar por categoria, adicionar, editar e remover bens, além de exportar o inventário em CSV, Excel e PDF.

A aplicação também pode ser instalada como PWA em computadores e dispositivos móveis. O shell da aplicação e a última listagem ficam disponíveis offline; cadastros offline entram numa fila local e sincronizam quando a ligação regressa. A instalação requer HTTPS, exceto em `localhost`/`127.0.0.1`.

## Cadastro e campos

- `codigo`: gerado automaticamente pelo banco (`ASV-000001`).
- `nome`: obrigatório.
- `categoria`: opcional.
- `variacoes_tipo`: tipo de medida escolhido (Vinil, Camisetas/T-shirts ou um tipo adicional).
- `variacoes_campos`: definições dos campos configurados para as medidas.
- `variacoes`: valores/tamanhos cadastrados.
- `created_at`, `updated_at`, `deleted_at`: datas de controle; `deleted_at` marca itens removidos sem apagar o histórico.

A seção de medidas fica recolhida até o utilizador a abrir. Os modelos Vinil e Camisetas/T-shirts incluem campos iniciais; tipos adicionais permitem definir nome, campos, tipo de valor e unidade.

As exportações CSV, Excel e PDF usam os dados existentes: código, bem, categoria, tipo de medida, resumo de medidas/tamanhos e data de criação. Ações de edição e remoção ficam disponíveis em cada linha.

## Instalação

Requisitos: Node.js 18+ e um projeto Supabase.

1. Execute `npm install`.
2. Copie `.env.example` para `.env` e configure `SUPABASE_URL` e `SUPABASE_SECRET_KEY`.
3. Execute as migrações de `supabase/migrations/`, em ordem, no SQL Editor do Supabase (a mais recente adiciona a quantidade em estoque).
4. Execute `npm start` e abra `http://127.0.0.1:3000`. No navegador compatível, escolha **Instalar app**; no iPhone/iPad, use **Partilhar → Adicionar ao ecrã principal**.

`npm run dev` inicia o servidor em modo de desenvolvimento.

## Supabase e segurança

O servidor usa a chave secreta do Supabase exclusivamente em `.env`; ela não é enviada ao navegador. A migração habilita RLS e restringe acesso direto aos papéis `anon` e `authenticated`; as operações da aplicação passam pela API do servidor. O servidor escuta em `127.0.0.1` e não inclui autenticação de utilizadores.

O Supabase é a fonte persistente. IndexedDB mantém uma cópia local para leitura offline e uma fila para novos cadastros feitos sem conexão, que sincronizam quando a conexão retorna. Remoções são lógicas e os itens removidos deixam de aparecer nas consultas e exportações.

## Estrutura

A migração cria apenas `public.bens`, com os campos de cadastro e medidas descritos acima, sequência automática de códigos, índice de categoria e atualização automática de `updated_at`.

## API

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` | `/api/health` | Estado da configuração do serviço |
| `GET` | `/api/bens` | Lista; aceita busca `q` e filtro `categoria` |
| `POST` | `/api/bens` | Adiciona um bem e suas medidas opcionais |
| `PATCH` | `/api/bens/:id` | Edita nome, categoria, quantidade em estoque e medidas |
| `POST` | `/api/bens/:id/quantidade` | Soma uma quantidade ao estoque do bem (`{ "quantidade": 5 }`) |
| `DELETE` | `/api/bens/:id` | Remove da listagem por exclusão lógica |
| `GET` | `/api/export/csv`, `/api/export/xlsx`, `/api/export/pdf` | Exporta os campos atuais do inventário |

## Identidade visual

Interface responsiva em preto e amarelo, baseada no logótipo da ASVATH, com superfícies escuras, linhas técnicas e realces amarelos.
