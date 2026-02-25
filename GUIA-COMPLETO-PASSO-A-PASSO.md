# 🔥 FUMÊGO Pizza - Guia Completo de Configuração

## 📋 ÍNDICE
1. Configurar Banco de Dados (Supabase)
2. Configurar Pagamento PIX (Mercado Pago)
3. Subir os Arquivos no GitHub
4. Deploy na Vercel
5. Configurar Variáveis de Ambiente
6. Ativar a API (Webhook do PIX)
7. Testar tudo

---

## 1️⃣ CONFIGURAR BANCO DE DADOS (SUPABASE)

### Passo 1.1 — Criar conta no Supabase
1. Acesse **https://supabase.com**
2. Clique em **"Start your project"**
3. Faça login com sua conta **GitHub**
4. Clique em **"New Project"**
5. Preencha:
   - **Organization**: Selecione ou crie uma
   - **Name**: `fumego-pizza`
   - **Database Password**: Crie uma senha forte e **ANOTE ELA**
   - **Region**: Escolha `South America (São Paulo)` para menor latência
6. Clique em **"Create new project"**
7. Aguarde 1-2 minutos até o projeto ser criado

### Passo 1.2 — Executar o SQL do Banco de Dados
1. No painel do Supabase, clique em **"SQL Editor"** no menu lateral esquerdo
2. Clique em **"New Query"**
3. Copie **TODO** o conteúdo do arquivo `supabase-schema.sql` que está na pasta do projeto
4. Cole no editor SQL
5. Clique no botão **"Run"** (ou Ctrl+Enter)
6. Deve aparecer "Success. No rows returned" — isso é normal!

### Passo 1.3 — Pegar as Chaves do Supabase
1. No menu lateral, clique em **"Project Settings"** (ícone de engrenagem)
2. Clique em **"API"** no submenu
3. Você verá 3 informações importantes — **COPIE TODAS**:
   - **Project URL**: Algo como `https://xyzabc123.supabase.co`
   - **anon public key**: Uma chave longa que começa com `eyJ...`
   - **service_role secret key**: Outra chave longa (clique em "Reveal" para ver)

> ⚠️ **IMPORTANTE**: A `service_role key` é secreta! Nunca compartilhe ou coloque no código frontend.

### Passo 1.4 — Verificar as Tabelas
1. No menu lateral, clique em **"Table Editor"**
2. Você deve ver as tabelas: `products`, `drinks`, `users`, `orders`, `order_items`, `coupons`, `coupon_usage`, `settings`
3. Clique em `products` — deve ter 4 produtos cadastrados
4. Clique em `drinks` — deve ter 3 bebidas
5. Clique em `coupons` — deve ter o cupom BEMVINDO

✅ **Banco de dados configurado!**

---

## 2️⃣ CONFIGURAR PAGAMENTO PIX (MERCADO PAGO)

### Passo 2.1 — Criar conta de desenvolvedor
1. Acesse **https://www.mercadopago.com.br/developers**
2. Faça login com sua conta Mercado Pago (ou crie uma)
3. Após o login, você estará no **Dashboard de Desenvolvedor**

### Passo 2.2 — Criar uma aplicação
1. No Dashboard, clique em **"Suas integrações"** ou **"Your integrations"**
2. Clique em **"Criar aplicação"**
3. Preencha:
   - **Nome**: `FUMEGO Pizza`
   - **Modelo de integração**: Selecione **"CheckoutAPI"**
   - **Tipo de produto**: Selecione **"Pagamentos online"**
4. Clique em **"Criar aplicação"**

### Passo 2.3 — Pegar o Access Token (PRODUÇÃO)
1. Na página da aplicação, clique em **"Credenciais de produção"**
2. Copie o **Access Token** (é uma chave longa que começa com `APP_USR-`)

> 🔴 **ATENÇÃO**: Para TESTAR primeiro, use as **"Credenciais de teste"** em vez das de produção.
> O Access Token de teste permite simular pagamentos sem dinheiro real.

### Passo 2.4 — Configurar o Webhook (será feito após o deploy)
O webhook é a URL que o Mercado Pago usa para avisar quando um pagamento for confirmado.
Vamos configurar isso no **Passo 6** após fazer o deploy.

✅ **Mercado Pago configurado!**

---

## 3️⃣ SUBIR OS ARQUIVOS NO GITHUB

### Passo 3.1 — Preparar o repositório
Se você já tem um repositório do projeto FUMÊGO:

1. Acesse **https://github.com** e faça login
2. Vá ao seu repositório existente
3. **DELETE todos os arquivos antigos** (vamos substituir tudo):
   - Clique em cada arquivo > botão **"..."** > **"Delete file"** > Commit
   - OU mais fácil: Delete o repositório inteiro e crie um novo

### Passo 3.2 — Criar repositório novo (se necessário)
1. No GitHub, clique em **"+"** > **"New repository"**
2. Nome: `fumego-pizza`
3. Deixe como **Private**
4. **NÃO** marque "Add README" (vamos subir nossos arquivos)
5. Clique em **"Create repository"**

### Passo 3.3 — Subir os arquivos
**OPÇÃO A — Pelo site do GitHub (mais fácil):**

1. No repositório, clique em **"uploading an existing file"** ou **"Add file"** > **"Upload files"**
2. Arraste TODOS os arquivos e pastas do projeto para a área de upload
3. A estrutura deve ficar assim:

```
fumego-pizza/
├── app/
│   ├── globals.css
│   ├── layout.js
│   ├── page.js              ← Página principal (meia lua)
│   ├── admin/
│   │   └── page.js          ← Painel admin (botão salvar fixo)
│   ├── checkout/
│   │   └── page.js          ← Página de checkout
│   ├── login/
│   │   └── page.js          ← Página de login
│   ├── register/
│   │   └── page.js          ← Página de cadastro
│   └── api/
│       ├── admin/
│       │   └── route.js      ← API de autenticação admin
│       ├── auth/
│       │   ├── login/
│       │   │   └── route.js  ← API de login
│       │   └── register/
│       │       └── route.js  ← API de registro
│       ├── create-payment/
│       │   └── route.js      ← API de criação de pagamento PIX
│       └── pix-webhook/
│           └── route.js      ← Webhook do Mercado Pago
├── lib/
│   └── supabase.js           ← Cliente Supabase
├── .env.example              ← Template de variáveis
├── .gitignore
├── jsconfig.json
├── next.config.js
├── package.json
├── postcss.config.js
└── tailwind.config.js
```

4. Clique em **"Commit changes"**

**OPÇÃO B — Via terminal (para quem sabe usar Git):**
```bash
cd pasta-do-projeto
git init
git add .
git commit -m "FUMÊGO Pizza v2.0 - rebuild completo"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/fumego-pizza.git
git push -u origin main
```

> ⚠️ **NÃO suba o arquivo `.env.local`!** Ele contém senhas. O `.gitignore` já impede isso.
> O arquivo `supabase-schema.sql` pode ser subido — é útil como referência.

✅ **Arquivos no GitHub!**

---

## 4️⃣ DEPLOY NA VERCEL

### Passo 4.1 — Conectar com Vercel
1. Acesse **https://vercel.com**
2. Faça login com sua conta **GitHub**
3. Clique em **"Add New..."** > **"Project"**
4. Selecione o repositório `fumego-pizza`
5. **Framework Preset**: Deve detectar automaticamente "Next.js"

### Passo 4.2 — Configurar Variáveis de Ambiente
**ANTES de clicar em Deploy**, expanda a seção **"Environment Variables"** e adicione:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://SEU-PROJETO.supabase.co` (do Passo 1.3) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sua anon key (do Passo 1.3) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sua service role key (do Passo 1.3) |
| `MERCADO_PAGO_ACCESS_TOKEN` | Seu Access Token (do Passo 2.3) |
| `JWT_SECRET` | Uma string aleatória longa (ex: `fumego2024secretkey!@#$muito-segura-123`) |
| `NEXT_PUBLIC_APP_URL` | `https://fumego-pizza.vercel.app` (ou seu domínio) |
| `ADMIN_PASSWORD` | A senha que você quer usar para acessar o painel admin |

### Passo 4.3 — Deploy
1. Clique em **"Deploy"**
2. Aguarde 1-3 minutos
3. Quando terminar, clique na URL do projeto (algo como `fumego-pizza.vercel.app`)
4. Seu cardápio deve aparecer com o design da meia lua! 🎉

> 💡 Se der erro no build, clique em "View Build Logs" para ver o que aconteceu.

✅ **Deploy feito!**

---

## 5️⃣ ATUALIZAR A URL DO APP

Agora que você tem a URL da Vercel:

1. Na Vercel, vá em **Settings** > **Environment Variables**
2. Edite `NEXT_PUBLIC_APP_URL` e coloque sua URL real (ex: `https://fumego-pizza.vercel.app`)
3. Clique em **Save**
4. Vá em **Deployments** > clique nos **"..."** do último deploy > **"Redeploy"**

---

## 6️⃣ ATIVAR A API (WEBHOOK DO PIX)

O webhook é ESSENCIAL para que o app saiba quando o pagamento foi aprovado.

### Passo 6.1 — Configurar webhook no Mercado Pago
1. Acesse **https://www.mercadopago.com.br/developers/panel/app**
2. Clique na sua aplicação **"FUMEGO Pizza"**
3. No menu lateral, clique em **"Webhooks"** ou **"Notificações"**
4. Clique em **"Configurar notificações"**
5. Preencha:
   - **URL**: `https://SUA-URL.vercel.app/api/pix-webhook`
     - Exemplo: `https://fumego-pizza.vercel.app/api/pix-webhook`
   - **Eventos**: Marque **"Pagamentos"** (ou "Payments")
6. Clique em **"Salvar"**

### Passo 6.2 — Testar o Webhook
1. No painel do Mercado Pago, há um botão **"Simular"** ou **"Enviar notificação de teste"**
2. Clique nele
3. Se retornar status **200**, está funcionando!

### Passo 6.3 — Testar pagamento completo
1. Acesse seu app na URL da Vercel
2. Selecione uma pizza
3. Preencha os dados de entrega
4. Clique em "Pagar com PIX"
5. Deve aparecer o QR Code
6. Se estiver usando **credenciais de teste**, use as contas de teste do Mercado Pago para simular o pagamento

> 📖 Para criar contas de teste: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-test/test-accounts

### Passo 6.4 — Mudar para Produção (quando estiver pronto)
1. No Mercado Pago, vá nas **"Credenciais de produção"**
2. Copie o **Access Token de produção**
3. Na Vercel, atualize a variável `MERCADO_PAGO_ACCESS_TOKEN` com o token de produção
4. Faça redeploy

✅ **API do PIX ativada!**

---

## 7️⃣ ACESSAR O PAINEL ADMIN

1. Acesse: `https://SUA-URL.vercel.app/admin`
2. Digite a senha que você configurou em `ADMIN_PASSWORD`
3. No painel admin você pode:
   - ✅ Ativar/desativar produtos e bebidas
   - ✅ Alterar preços e descrições
   - ✅ Ver e gerenciar pedidos
   - ✅ Abrir/fechar a loja
   - ✅ Configurar taxa de entrega e tempo
   - ✅ Mudar o sabor especial do mês
4. **O botão "Salvar Tudo" fica FIXO na parte de baixo da tela** — sempre acessível!

---

## ❓ PROBLEMAS COMUNS

### "Erro ao carregar cardápio"
- Verifique se o `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão corretos
- Verifique se executou o SQL no Supabase

### "Erro ao criar pagamento PIX"
- Verifique se o `MERCADO_PAGO_ACCESS_TOKEN` está correto
- Se estiver testando, use o token de TESTE, não o de produção

### "Pagamento não confirma"
- Verifique se o webhook está configurado corretamente no Mercado Pago
- A URL deve ser exatamente: `https://SUA-URL.vercel.app/api/pix-webhook`

### "Não consigo salvar no admin"
- O botão "Salvar Tudo" agora está FIXO no rodapé, sempre visível
- Funciona mesmo quando produtos estão desativados

### Build falha na Vercel
- Verifique se TODAS as variáveis de ambiente foram adicionadas
- Verifique os logs de build para o erro específico

---

## 🎨 O QUE MUDOU NESTA VERSÃO

1. **✅ Design da Meia Lua RESTAURADO** — A tela inicial mostra Marguerita e Calabresa lado a lado com o design de meia lua original, divisor dourado central com o ícone 🔥, e semicírculos decorativos
2. **✅ Botão Salvar FIXO no Admin** — O botão "Salvar Tudo" agora fica fixo no rodapé da tela, sempre visível e acessível, mesmo ao rolar a página ou desativar produtos
3. **✅ Indicador de alterações** — Mostra "⚠️ Alterações não salvas" quando há mudanças pendentes
4. **✅ Todos os arquivos recriados** — Projeto completo para substituir no GitHub
