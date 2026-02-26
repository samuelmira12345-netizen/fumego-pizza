# 🔥 FUMÊGO Pizza v4 - Guia Completo

---

## 🆘 RESOLVENDO O ERRO DO PIX

O erro `internal_error` do Mercado Pago geralmente é causado por **Access Token incorreto**. Siga estes passos:

### Passo 1: Verificar o Token
Acesse no navegador: `https://SUA-URL.vercel.app/api/check-token`

Isso vai mostrar se o token está configurado e funcionando.

### Passo 2: Copiar Token Novamente
1. Acesse **https://www.mercadopago.com.br/developers**
2. Clique em **Suas integrações** → Sua aplicação
3. Vá em **Credenciais de teste** (para testar) ou **Credenciais de produção**
4. Copie o **Access Token** completo (começa com `APP_USR-` ou `TEST-`)

### Passo 3: Atualizar na Vercel
1. Acesse **https://vercel.com** → Seu projeto
2. **Settings** → **Environment Variables**
3. Encontre `MERCADO_PAGO_ACCESS_TOKEN`
4. Clique em **Edit** → **Apague tudo** → Cole o novo token
5. **IMPORTANTE**: Certifique-se que NÃO tem espaços antes ou depois
6. Salve
7. Vá em **Deployments** → Clique nos 3 pontos do deploy mais recente → **Redeploy**

### Passo 4: Testar
Acesse novamente `https://SUA-URL.vercel.app/api/check-token` para confirmar que agora mostra `"status": "OK"`.

---

## 1️⃣ BANCO DE DADOS (Supabase)

### Se você JÁ TEM o Supabase da versão anterior:
1. Vá no **SQL Editor** do Supabase
2. Execute APENAS isto para criar o bucket (se ainda não existir):

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "product_images_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "product_images_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images');

CREATE POLICY "product_images_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images');
```

Se der erro dizendo que a policy já existe, ignore — está tudo certo.

### Se é a PRIMEIRA VEZ:
1. Acesse **https://supabase.com** → Login com GitHub
2. **New Project** → Nome: `fumego-pizza` → Region: `South America (São Paulo)`
3. Aguarde criar
4. Vá em **SQL Editor** → **New Query**
5. Cole TODO o conteúdo do arquivo `supabase-schema.sql`
6. Clique **Run**
7. Vá em **Project Settings** → **API** → Copie:
   - `Project URL` (NEXT_PUBLIC_SUPABASE_URL)
   - `anon public key` (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - `service_role secret key` (SUPABASE_SERVICE_ROLE_KEY)

---

## 2️⃣ SUBSTITUIR ARQUIVOS NO GITHUB

### Opção A — Delete e reupload (mais seguro):
1. No GitHub, vá no repositório
2. **Settings** → Scroll até **Danger Zone** → **Delete this repository**
3. Crie um novo repositório com o mesmo nome
4. Faça upload de TODOS os arquivos do ZIP

### Opção B — Substituir arquivo por arquivo:
Delete todos os arquivos antigos e suba os novos.

A estrutura deve ser:
```
fumego-pizza/
├── .env.example
├── .gitignore
├── jsconfig.json
├── next.config.js
├── package.json
├── postcss.config.js
├── supabase-schema.sql
├── tailwind.config.js
├── lib/
│   └── supabase.js
└── app/
    ├── globals.css
    ├── layout.js
    ├── page.js
    ├── admin/
    │   └── page.js
    ├── checkout/
    │   └── page.js
    ├── login/
    │   └── page.js
    ├── register/
    │   └── page.js
    └── api/
        ├── admin/
        │   └── route.js
        ├── auth/
        │   ├── login/
        │   │   └── route.js
        │   └── register/
        │       └── route.js
        ├── check-token/
        │   └── route.js        ← NOVO: diagnóstico do token
        ├── create-payment/
        │   └── route.js        ← CORRIGIDO: melhor tratamento de erros
        └── pix-webhook/
            └── route.js
```

⚠️ **NÃO suba .env.local** — ele contém suas senhas!

---

## 3️⃣ DEPLOY NA VERCEL

1. **https://vercel.com** → Login GitHub → **Add New Project**
2. Selecione o repositório
3. Em **Environment Variables**, adicione:

| Variável | Valor |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do seu projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key do Supabase |
| `MERCADO_PAGO_ACCESS_TOKEN` | Access Token do Mercado Pago |
| `JWT_SECRET` | Uma string longa aleatória qualquer |
| `NEXT_PUBLIC_APP_URL` | A URL da Vercel (ex: https://fumego-pizza.vercel.app) |
| `ADMIN_PASSWORD` | Sua senha para o painel admin |

4. **Deploy**
5. Após o deploy, copie a URL e atualize `NEXT_PUBLIC_APP_URL` se necessário
6. Faça **Redeploy** se atualizou a URL

---

## 4️⃣ WEBHOOK DO PIX

1. No **Mercado Pago** → Sua aplicação → **Webhooks**
2. URL: `https://SUA-URL.vercel.app/api/pix-webhook`
3. Eventos: marque **Pagamentos**
4. Salvar

---

## 🆕 O QUE MUDOU NA v4

1. ✅ **PIX com diagnóstico**: Novo endpoint `/api/check-token` mostra se o token está funcionando
2. ✅ **Mensagens de erro claras**: Agora o erro do PIX explica exatamente o que fazer
3. ✅ **Erro exibido na tela**: O checkout mostra detalhes do erro em vez de um alerta genérico
4. ✅ **Fotos salvam direto no banco**: O upload de fotos agora salva a URL diretamente na tabela products (sem depender do botão Salvar)
5. ✅ **Validação do token**: O sistema verifica formato do token antes de chamar o Mercado Pago
6. ✅ **Tratamento de erros completo**: Diferencia erro 401, 400, 403, 500 do Mercado Pago

---

## ❓ PROBLEMAS COMUNS

### "Erro interno do Mercado Pago" / "internal_error"
→ **95% das vezes é o Access Token errado.** Siga a seção "RESOLVENDO O ERRO DO PIX" acima.

### "Fotos não aparecem no cardápio"
→ No Supabase, vá em **Storage** e veja se o bucket `product-images` existe e está como **público**.
→ Se não existir, crie manualmente: Storage → New Bucket → Nome: `product-images` → Marque "Public"

### "Foto sumiu depois de enviar"
→ Na v4, a foto é salva DIRETAMENTE no banco ao fazer upload. Se mesmo assim não aparece, verifique:
  1. Se o bucket está público no Supabase Storage
  2. Se a RLS policy `products_update` existe (rode o SQL schema novamente)

### "CEP não preenche"
→ O CEP deve ter 8 dígitos. Clique fora do campo para disparar a busca.
