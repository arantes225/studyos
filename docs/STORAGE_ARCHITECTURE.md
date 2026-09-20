# LURIA — Arquitetura de Storage

## Estado atual

O LURIA usa uma camada central em:

- `assets/js/storage-router.js`

Hoje as rotas abaixo continuam apontando para o projeto Supabase principal e para o bucket `docmap`:

- `error_images`
- `flashcard_images`
- `question_assets`
- `notebook_images`

Caderno de Erros e Flashcards já usam a camada central para upload, download, URL assinada e exclusão.

## Referências de arquivo

Arquivos do storage principal continuam usando o formato legado:

```text
<user-id>/errors/<arquivo>
<user-id>/flashcards/<arquivo>
```

Quando um provider externo for ativado, a camada aceita referências auto-descritivas:

```text
luria-storage://<provider>/<bucket>/<path>
```

Assim o LURIA sabe exatamente onde procurar o arquivo. Não é necessário tentar vários bancos sequencialmente.

## Regra de compatibilidade

- referência sem prefixo = storage principal;
- referência com `luria-storage://` = provider e bucket informados na própria referência;
- registros antigos continuam funcionando;
- novos registros podem ser distribuídos entre storages sem migrar tudo de uma vez.

## Migração futura

### 1. Criar o novo destino de mídia

Criar um projeto/storage secundário ou outro object storage.

Não mover o banco relacional nem o Auth nesta etapa.

### 2. Definir buckets

Exemplo:

- `flashcard-images`
- `error-images`

Preferir buckets privados para material do usuário.

### 3. Criar acesso seguro

O login do projeto Supabase principal não deve ser presumido como autenticação válida em outro projeto Supabase.

Nunca colocar `service_role` ou secret keys no frontend.

Para um segundo projeto privado, usar uma ponte segura, por exemplo:

- Edge Function/backend no projeto principal;
- validação do usuário autenticado;
- geração de URL assinada ou upload autorizado no storage secundário.

### 4. Registrar o provider

A camada expõe:

```js
LuriaStorage.registerSupabaseProvider("media", client);
```

Para uma arquitetura com backend/proxy, estender o router com um provider próprio em vez de expor credenciais privadas.

### 5. Trocar a rota

Exemplo conceitual:

```js
LuriaStorage.configureRoute("flashcard_images", {
  provider: "media",
  bucket: "flashcard-images"
});
```

A partir daí novos uploads de Flashcards passam para o novo destino.

### 6. Não migrar arquivos antigos imediatamente

Arquivos antigos continuam no storage principal.

Os novos recebem referência com provider/bucket.

Isso permite migração gradual e sem downtime.

### 7. Migração opcional do acervo antigo

Depois, um job administrativo pode:

1. baixar o arquivo antigo;
2. enviar ao novo storage;
3. atualizar a referência no banco;
4. validar leitura;
5. apagar o arquivo antigo.

Sempre atualizar a referência apenas depois de confirmar que o novo arquivo está acessível.

## Estratégia recomendada

### Fase A — agora

- banco + Auth + Storage no Supabase principal;
- router central ativo;
- Caderno de Erros e Flashcards usando o router.

### Fase B — storage crescendo

- banco e Auth continuam no Supabase principal;
- imagens mais pesadas/massivas vão para um storage secundário;
- migração apenas para novos uploads no início.

### Fase C — escala maior

- considerar object storage dedicado (S3/R2 ou equivalente);
- manter Supabase para banco/Auth;
- router continua sendo a interface das páginas.

## Segurança

- nunca expor service_role no navegador;
- buckets privados exigem autorização para leitura;
- regras de upload/delete continuam necessárias mesmo em buckets públicos;
- usar caminhos por usuário;
- validar tipo e tamanho dos arquivos;
- evitar sobrescrever o mesmo path quando possível;
- manter deleção de banco e storage coordenadas para reduzir arquivos órfãos.
