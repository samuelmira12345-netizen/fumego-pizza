# 🔥 FUMÊGO Pizza v3 - Guia Completo

---

## 1️⃣ BANCO DE DADOS (Supabase)

### Se você JÁ TEM o Supabase configurado da versão anterior:
1. Vá no **SQL Editor** do Supabase
2. Execute APENAS este comando para criar o bucket de imagens:

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

3. Pronto! O resto do banco já está ok.

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

## 2️⃣ PAGAMENTO PIX (Mercado Pago)

### Problemas comuns que causam erro no PIX:
- **Access Token errado**: Verifique se copiou o token completo
- **Token de teste vs produção**: Use o de TESTE para testar
- **Email inválido**: O app agora gera um email automático se o campo estiver vazio

### Configurar:
1. Acesse **https://www.mercadopago.com.br/developers**
2. **Suas integrações** → **Criar aplicação**
   - Nome: `FUMEGO Pizza`
   - Tipo: **CheckoutAPI** → **Pagamentos online**
3. Copie o **Access Token** das credenciais de TESTE primeiro
4. Para ir para produção depois, copie o token de PRODUÇÃO

---

## 3️⃣ SUBSTITUIR ARQUIVOS NO GITHUB

### Opção A — Delete e reupload (mais seguro):
1. No GitHub, vá no repositório
2. **Settings** → Scroll até **Danger Zone** → **Delete this repository**
3. Crie um novo repositório com o mesmo nome
4. Faça upload de TODOS os arquivos do ZIP

### Opção B — Substituir arquivo por arquivo:
Delete todos os arquivos antigos e suba os novos. A estrutura final deve ser:

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
    ├── page.js                    ← Cardápio (pizza circular)
    ├── admin/
    │   └── page.js                ← Painel admin (upload fotos)
    ├── checkout/
    │   └── page.js                ← Checkout (carrinho + CEP)
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
        ├── create-payment/
        │   └── route.js           ← PIX corrigido
        └── pix-webhook/
            └── route.js
```

⚠️ **NÃO suba .env.local** — ele contém suas senhas!

---

## 4️⃣ DEPLOY NA VERCEL

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

## 5️⃣ CONFIGURAR WEBHOOK DO PIX

1. No **Mercado Pago** → Sua aplicação → **Webhooks**
2. URL: `https://SUA-URL.vercel.app/api/pix-webhook`
3. Eventos: marque **Pagamentos**
4. Salvar

### Testar:
- Acesse o app → Escolha uma pizza → Checkout → Preencha dados → Pagar com PIX
- Se usar credenciais de TESTE, simule o pagamento com contas de teste

---

## 6️⃣ SUBIR FOTOS DOS PRODUTOS

1. Acesse `https://SUA-URL.vercel.app/admin`
2. Digite a senha admin
3. Na aba **Produtos**, cada produto tem um botão **"📤 Enviar foto"**
4. Clique e selecione a imagem da pizza
5. A foto será enviada para o Supabase Storage e aparecerá no cardápio

### Dicas para as fotos:
- **Marguerita e Calabresa**: Use fotos quadradas ou circulares para ficarem bonitas no círculo da meia lua
- **Combo**: Use uma foto horizontal/paisagem
- **Especial**: Use uma foto horizontal/paisagem
- Formatos aceitos: JPG, PNG, WEBP
- Tamanho recomendado: até 2MB por foto

---

## 🆕 O QUE MUDOU NESTA VERSÃO (v3)

1. ✅ **Design circular da pizza** como na foto original — Calabresa e Marguerita dentro de um círculo dividido ao meio
2. ✅ **Layout mobile-first** — Máximo 480px, otimizado para celular
3. ✅ **Sistema de carrinho** restaurado — Adicionar múltiplos itens, ver carrinho, remover itens
4. ✅ **Barra do carrinho flutuante** — Mostra itens e total na parte de baixo
5. ✅ **Busca de CEP automática** — Digite o CEP e rua/bairro/cidade preenchem sozinhos (via ViaCEP)
6. ✅ **Preenchimento automático** — Se logado, endereço e dados preenchem automaticamente
7. ✅ **PIX corrigido** — Melhor tratamento de erros, CPF e email formatados corretamente
8. ✅ **Upload de fotos no admin** — Envie fotos dos produtos direto pelo painel
9. ✅ **Botão salvar fixo** no admin — Sempre visível, funciona mesmo com produtos desativados
10. ✅ **Seção combo com fundo amber/dourado** como no design original
11. ✅ **Seção especial do mês** com badge e design destacado

---

## ❓ PROBLEMAS COMUNS

### "Erro ao gerar PIX"
- Verifique se `MERCADO_PAGO_ACCESS_TOKEN` está correto
- Abra o console do navegador (F12) para ver detalhes do erro
- O token deve começar com `APP_USR-` ou `TEST-`

### "Fotos não aparecem"
- Execute o SQL do bucket de imagens (Passo 1 acima)
- No Supabase, vá em **Storage** e verifique se o bucket `product-images` existe
- Se não existir, crie manualmente: Storage → New Bucket → Nome: `product-images` → Marque "Public"

### "CEP não preenche"
- O CEP deve ter 8 dígitos
- Clique fora do campo (blur) para disparar a busca
- Funciona apenas com CEPs válidos brasileiros

### "Não consigo salvar no admin"
- O botão "Salvar Tudo" está fixo no rodapé, sempre acessível
