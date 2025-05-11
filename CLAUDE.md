# CLAUDE.md - EmailMaxV2

Este arquivo fornece orientações para o Claude Code ao trabalhar com este repositório. As instruções aqui são essenciais para o correto entendimento e manipulação do projeto.

## 🚀 Visão Geral do Projeto

EmailMaxV2 é uma plataforma completa para gerenciamento e aquecimento de contas de email, oferecendo:

- **Gestão de Contas**: Integração e validação automática de contas de email via IMAP/SMTP
- **Aquecimento de Email**: Sistema para melhorar a reputação de envio de contas novas
- **Monitoramento**: Métricas e análises de desempenho de entregas
- **Automação**: Funcionalidades para interações automáticas com interfaces webmail

O projeto utiliza uma arquitetura moderna com Next.js 14 (App Router) para o frontend e Supabase para autenticação e banco de dados, complementado por um microserviço de validação em Python.

## ⚠️ IMPORTANTE: INICIANDO O PROJETO ⚠️

Para evitar erros comuns e garantir um ambiente de desenvolvimento funcional, **SEMPRE** inicie o projeto utilizando o comando unificado:

```bash
# No Linux/MacOS
npm run dev:all

# No Windows (PowerShell)
npm run dev:windows
```

Este comando único iniciará corretamente:
- O servidor Next.js na porta 3000
- O microserviço de validação IMAP/SMTP na porta 5000
- Configurará corretamente as conexões entre os sistemas

Para desenvolvimento com reinicialização automática ao alterar arquivos:
```bash
npm run dev:all:watch
```

**NUNCA INICIE** os componentes separadamente, pois isso frequentemente causa erros de conexão e problemas de CORS!

## 🏗️ Arquitetura do Projeto

### Frontend (Next.js)
- Aplicação Next.js 14 com App Router
- Autenticação via Supabase Auth
- Interface construída com React, TailwindCSS e componentes Radix UI
- Estado gerenciado com Zustand

### Backend
- Supabase para banco de dados PostgreSQL e autenticação
- Microserviço Python para validação de conexões IMAP/SMTP

### Fluxo de Dados
1. Autenticação via Supabase Auth
2. Gerenciamento de contas de email com validação IMAP/SMTP
3. Planos de aquecimento para email (warmup plans)
4. Métricas e análise de desempenho

## 📂 Estrutura de Diretórios Principais

```
/app                    # Rotas e páginas Next.js (App Router)
  /(dashboard)          # Rotas protegidas do dashboard
  /api                  # Endpoints de API
  /auth                 # Rotas de autenticação
/components             # Componentes React reutilizáveis
  /auth                 # Componentes relacionados à autenticação
  /dashboard            # Componentes do painel principal
  /email-accounts       # Componentes de gerenciamento de contas
  /layout               # Componentes de layout e estrutura
  /ui                   # Componentes de UI primitivos
  /warmup               # Componentes do sistema de aquecimento
/lib                    # Bibliotecas e utilitários
  /store                # Estados globais (Zustand)
  /supabase             # Clientes e utilitários Supabase
  /utils                # Funções utilitárias
    /webmail-automation # Sistema de automação de webmail
/imap-smtp-validator    # Microserviço de validação de email
/supabase               # Configurações e migrações do Supabase
  /functions            # Edge Functions do Supabase
  /migrations           # Migrações do banco de dados
/tests                  # Testes unitários e de integração
```

## 💻 Comunicação 

Ao interagir com o código deste projeto, Claude Code deve:

- Sempre responder em português brasileiro
- Sempre que implementar algo, fazer testes para ter 100% de certeza que a implementação está correta
- Mostrar o processo de pensamento em tempo real com exemplos de código
- Explicar detalhadamente as alterações e decisões tomadas

## 🛠️ SUPER IMPORTANTE, UTILIZE AO MÁXIMO! Ferramentas MCP (Machine Capabilities)

Ao utilizar MCPs (Model Capabilities Protocol), sempre deixar explícito quando estiver usando, com marcações claras:

- **context7**: Para obter documentação atualizada de bibliotecas e frameworks. SEMPRE UTILIZAR CONTEXT7 MCP SERVER para consultar APIs, métodos e práticas recomendadas.
- **supabase**: Executa operações diretas no banco de dados Supabase, incluindo listagem de projetos, execução de SQL, gerenciamento de tabelas e migrações.
- **brave-search**: Realiza buscas na web para encontrar informações atualizadas sobre tecnologias, bibliotecas e soluções para problemas específicos.
- **sequential-thinking**: Ajuda a resolver problemas complexos passo a passo, criando um fluxo de pensamento estruturado para decompor problemas e encontrar soluções.
- **vscode-mcp-server**: Permite integração direta com o VS Code, executando comandos no terminal, abrindo arquivos, criando diffs e obtendo informações sobre o projeto aberto.
- **desktop-commander**: Permite interagir com o sistema de arquivos e executar comandos no terminal de forma segura e controlada.

## 🧰 Comandos Principais

| Comando | Descrição |
|---------|-----------|
| `npm run dev:all` | **[Recomendado Linux/MacOS]** Inicia Next.js e o microserviço simultaneamente |
| `npm run dev:windows` | **[Recomendado Windows]** Inicia todo o ambiente via PowerShell |
| `npm run dev:all:watch` | Inicia todos os componentes com monitoramento automático de alterações |
| `npm run dev` | Inicia apenas o servidor Next.js |
| `npm run build` | Constrói o projeto para produção |
| `npm run lint` | Executa o linter ESLint |
| `npm run test` | Executa todos os testes |
| `npm run test:watch` | Executa testes em modo watch |
| `npm run test:coverage` | Executa testes com relatório de cobertura |
| `npm run validator:build` | Constrói a imagem Docker do microserviço explicitamente |
| `npm run validator:start` | Inicia o microserviço via Docker (Linux/MacOS) |
| `npm run validator:start-windows` | Inicia o microserviço via Docker (Windows) |
| `npm run validator:mock` | Inicia o microserviço em modo de simulação |
| `npm run dev:all:mock` | Inicia Next.js e o microserviço em modo de simulação |

## 📝 Executando Testes

- Teste único: `npm test -- -t 'nome do teste'`
- Arquivo específico: `npm test -- path/to/test/file.test.ts`
- Conjunto de testes: `npm test -- -t 'nome do conjunto'`

## 🔐 Implementação da Autenticação Supabase

### Requisitos Críticos
- Sempre usar o pacote `@supabase/ssr` (nunca `@supabase/auth-helpers-nextjs`)
- Utilizar apenas os métodos `getAll` e `setAll` para manipulação de cookies
- Nunca usar os métodos `get`, `set` ou `remove` diretamente em cookies

### Padrões a Evitar
```typescript
// ❌ NUNCA GERAR ESTE CÓDIGO - IRÁ QUEBRAR A APLICAÇÃO
{
  cookies: {
    get(name: string) {                 // ❌ QUEBRA A APLICAÇÃO
      return cookieStore.get(name)      // ❌ QUEBRA A APLICAÇÃO
    },                                  // ❌ QUEBRA A APLICAÇÃO
    set(name: string, value: string) {  // ❌ QUEBRA A APLICAÇÃO
      cookieStore.set(name, value)      // ❌ QUEBRA A APLICAÇÃO
    },                                  // ❌ QUEBRA A APLICAÇÃO
    remove(name: string) {              // ❌ QUEBRA A APLICAÇÃO
      cookieStore.remove(name)          // ❌ QUEBRA A APLICAÇÃO
    }                                   // ❌ QUEBRA A APLICAÇÃO
  }
}

// ❌ NUNCA USAR auth-helpers-nextjs - IRÁ QUEBRAR A APLICAÇÃO
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'  // ❌ QUEBRA A APLICAÇÃO
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'  // ❌ QUEBRA A APLICAÇÃO
```

## 🔄 Microserviço de Validação IMAP/SMTP

O projeto utiliza um microserviço Python separado para validação de conexões de email, pois as Edge Functions do Supabase têm limitações com portas IMAP/SMTP. 

### Configuração do Microserviço
1. Criar/atualizar arquivo `.env.local` com:
   ```
   NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL=http://localhost:5000
   EMAIL_VALIDATION_API_KEY=dev_key_change_me_in_production
   USE_EDGE_FUNCTIONS=false
   NEXT_PUBLIC_USE_VALIDATION_CACHE=true
   NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
   ```

### Sistema de Cache do Validador
- Implementado em `lib/utils/validation-cache.ts`
- Armazena resultados temporariamente no localStorage do navegador
- Possui tempos de expiração diferentes para resultados de sucesso (30 minutos) e falha (2 minutos)
- Configurável via variável de ambiente `NEXT_PUBLIC_USE_VALIDATION_CACHE`

### Troubleshooting do Microserviço
- Verifique se o Docker está rodando, ou se o Python 3.8+ está instalado
- Use uma "Senha de Aplicativo" para Gmail, não a senha normal
- Verifique se o provedor permite acesso IMAP/SMTP (alguns exigem ativação)
- Verifique as portas 3000 (Next.js) e 5000 (microserviço)
- Para desabilitar o cache: `NEXT_PUBLIC_USE_VALIDATION_CACHE=false` no `.env.local`

## 💾 Banco de Dados (Supabase)

- **Tabelas Principais**: 
  - `email_accounts`: Configurações e credenciais das contas
  - `warmup_plans`: Planos de aquecimento de email
  - `warmup_metrics`: Métricas de desempenho 
  - `secure_credentials`: Armazenamento seguro de credenciais via Vault

- **Migrações Importantes**:
  - Consolidação da estrutura da tabela `email_accounts`
  - Migração de credenciais para o Supabase Vault
  - Funções de compatibilidade para acesso seguro às senhas

### Aplicando Migrações
1. Conectar ao banco de dados:
   ```bash
   npx supabase link --project-ref SEU_ID_PROJETO
   ```

2. Aplicar migrações:
   ```bash
   npx supabase db push
   ```

## 📋 Estilo de Código

- Usar sintaxe de módulos ES (import/export), não CommonJS (require)
- Desestruturar importações quando possível
- Seguir convenções de TypeScript para tipagem
- Utilizar hooks e componentes funcionais no React

## 🧪 Metodologia de Desenvolvimento e Testes

O projeto segue uma metodologia de desenvolvimento incremental com foco em componentização e testabilidade:

1. **Divisão de Tarefas**: Cada funcionalidade é dividida em unidades testáveis mínimas
2. **Implementação Incremental**: Desenvolvimento em pequenos incrementos de 2-4 horas
3. **Teste Imediato**: Validação contínua em cada etapa do desenvolvimento
4. **Debugging Estruturado**: Seguir o framework de Observação → Hipótese → Teste → Resolução → Verificação → Prevenção

### Recomendações para Testes
- Manter isolamento entre testes unitários
- Usar os mocks predefinidos em `/tests/mocks/`
- Para componentes da UI, usar `@testing-library/react`
- Para hooks personalizados, usar `@testing-library/react-hooks`
- Seguir o padrão de nomenclatura claro e descritivo nas suites de teste

## ✅ Fluxo de Trabalho Recomendado

1. Iniciar o ambiente completo: 
   - Linux/MacOS: `npm run dev:all` (ou `npm run dev:all:watch`)
   - Windows: `npm run dev:windows`
2. Executar o linter e typechecker após alterações: `npm run lint`
3. Executar testes relacionados à área modificada: `npm test -- path/to/test/file.test.ts`
4. Atualizar este arquivo após concluir qualquer tarefa listada abaixo

## 🔄 Resolução de Problemas Comuns

### 1. Problema com `next/font` e Babel

Se encontrar erros relacionados ao Babel e `next/font`, como:
```
Syntax error: "next/font" requires SWC although Babel is being used due to a custom babel config being present.
```

Soluções possíveis:
- Renomear temporariamente o arquivo `babel.config.js` para `babel.config.js.bak` durante o desenvolvimento
- Evitar o uso de `next/font` em `app/layout.tsx` e usar classes do Tailwind para fontes
- Criar um arquivo `next.config.js` padrão com `swcMinify: true` para forçar o uso do SWC

### 2. Porta 5000 em uso pelo Microserviço

Se encontrar erros indicando que a porta 5000 está em uso:
```
Error response from daemon: driver failed programming external connectivity: Bind for 0.0.0.0:5000 failed: port is already allocated
```

Soluções possíveis:
- Verificar e parar contêineres Docker existentes: `docker ps` seguido de `docker stop ID_DO_CONTAINER`
- Remover contêineres antigos: `docker rm ID_DO_CONTAINER`
- Alterar a porta do serviço no arquivo `.env.local` e no `docker-compose.yml`

### 3. O serviço de Validação não inicia

Se o microserviço de validação falhar ao iniciar:

Soluções possíveis:
- Verificar logs: `cd imap-smtp-validator && docker compose logs`
- Reiniciar Docker: `docker compose down && docker compose up -d`
- Utilizar o modo de mock: `npm run dev:all:mock` para desenvolvimento sem o serviço real

### 4. Erro "Cannot access 'process' before initialization" no start-validator.js

Este erro ocorre devido a um conflito de nomenclatura no script:

Solução:
- Renomear a variável `process` para `dockerProcess` na função startValidator
- Usar `npm run validator:start-windows` em ambiente Windows

### 5. Comando && não funciona no PowerShell

O PowerShell não usa o operador `&&` do bash para execução sequencial:

Solução:
- Usar os scripts específicos para Windows: `npm run validator:start-windows`
- Ou usar ponto-e-vírgula: `cd imap-smtp-validator; docker compose up -d`

### 6. Erro na imagem Docker "unable to get image"

Este erro ocorre porque o Docker está tentando buscar uma imagem inexistente:

Solução:
- Modificar o arquivo `docker-compose.yml` para incluir o nome correto da imagem
- Adicionar a instrução `image:` em services.validation-service
- Fazer o build da imagem antes de executar: `docker compose build`

### 7. Erro "pull access denied for emailmaxv2-validation-service"

Se aparecer este erro:
```
validation-service Warning pull access denied for emailmaxv2-validation-service, repository does not exist or may require 'docker login': denied: requested access to the resource is denied
```

Isso acontece porque o Docker está tentando baixar a imagem de um repositório remoto em vez de construí-la localmente.

**Causa do Problema:**
- O Docker procura primeiro por uma imagem com o nome especificado em repositórios remotos (Docker Hub)
- Quando não encontra, tenta fazer pull de imagens que não existem remotamente
- O correto é forçar a construção local antes de tentar iniciar o container

**Soluções Implementadas:**
1. Modificado o `start-validator.js` para usar a flag `--no-cache --pull=never` no build do Docker, forçando a construção local e impedindo tentativas de pull remoto
2. Atualizado o `docker-compose.yml` para:
   - Usar uma tag específica (`image: emailmaxv2-validation-service:local`)
   - Adicionar argumentos de build que desativam o pull automático
   - Ativar o BuildKit para melhor desempenho de build

**Como Resolver Manualmente:**
```bash
# Opção 1: Usando comandos separados
# Ir para o diretório do microserviço
cd imap-smtp-validator

# Construir explicitamente a imagem Docker
docker build -t emailmaxv2-validation-service:local .

# Iniciar o serviço usando a imagem local
docker compose up -d

# Opção 2: Usando o novo script npm
npm run validator:build  # Constrói explicitamente a imagem
npm run validator:start  # Inicia o serviço usando a imagem local
```

Se o problema persistir após essas alterações, verifique se existem containers ou imagens antigas com o mesmo nome e remova-os com:
```bash
docker rm -f emailmaxv2-validation-service
docker rmi emailmaxv2-validation-service
```

### 8. Erro na versão de pacotes no requirements.txt

Se você encontrar erros nas versões dos pacotes, como:
```
ERROR: No matching distribution found for prometheus-client==0.19.1
```

Solução:
- Atualizar o `requirements.txt` com versões disponíveis dos pacotes
- Usar versões mais recentes e estáveis (`prometheus-client==0.21.0` em vez de `0.19.1`)

### 8. Problema de acesso WSL ao localhost

Quando executar o projeto no WSL2, você pode ter dificuldades para acessar o serviço via localhost:

Soluções possíveis:
- Acessar o serviço pelo IP do Windows: `http://$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}'):3000`
- Adicionar a seguinte linha ao arquivo `.env.local`:
  ```
  NEXT_PUBLIC_EMAIL_VALIDATION_SERVICE_URL=http://host.docker.internal:5000
  ```
- Em ambiente Windows puro (sem WSL), usar simplesmente http://localhost:3000 e http://localhost:5000

## 📋 Lista de Tarefas e Progresso

### Tarefas Concluídas ✅
- 1.1-1.4: Correções na autenticação e AuthGuard
- 2.1-2.4: Melhorias no banco de dados e migração para Vault
- 3.1-3.4: Padronização dos clientes Supabase
- 4.1-4.6: Substituição de dados mockados
- 5.1-5.4: Melhorias no microserviço de validação
- 6.1-6.5: Expansão de testes e correção de configurações
- 7.1.1: Implementação de navegação automatizada em Gmail, Outlook e Yahoo
- 7.1.2: Criação de sistema para emular cliques, rolagem e digitação em webmail
- 7.1.3: Desenvolvimento de detecção automática de elementos de interface
- 7.1.4: Implementação de operações como gerenciamento de pastas e etiquetas
- 8.1.1: Criação de sistema de envio cruzado de emails entre contas da rede

### Tarefas em Andamento 🔄

- **8.1.** Desenvolver motor de interações entre contas IMAP/SMTP
  - 8.1.2. Implementar resgate automático de emails da pasta spam/lixo
  - 8.1.3. Desenvolver interações variadas (responder, encaminhar, favoritar)
  - 8.1.4. Criar cadeias de conversação realistas com histórico

- **9.1.** Implementar fingerprints de email e navegador
  - 9.1.1. Desenvolver gerador de user-agents diversificados por conta
  - 9.1.2. Criar sistema de rotação de headers SMTP/IMAP
  - 9.1.3. Implementar parâmetros TLS específicos por provedor

- **10.1.** Desenvolver cliente universal IMAP/SMTP
  - 10.1.1. Criar cliente com suporte completo a comandos e extensões
  - 10.1.2. Desenvolver biblioteca de configurações específicas por provedor
  - 10.1.3. Implementar manipulação avançada de email multipart e HTML

### Próximas Tarefas Planejadas 📅
- **7.2.** Criar simulação comportamental para webmail
- **8.2.** Implementar métricas de aquecimento de email
- **9.2.** Criar sistema anti-rastreamento para operações de email
- **10.2.** Implementar monitoramento de saúde de contas

### Problemas Conhecidos ⚠️
- O acesso direto via IP do WSL ao servidor Next.js pode requerer configurações adicionais de rede
- Há problemas de compatibilidade com o uso de next/headers em arquivos fora do app/ diretório
- Em alguns ambientes Windows, o Node.js pode ter problemas ao monitorar arquivos
- O erro "Failed to fetch" no ServiceHealthCard pode acontecer quando o microserviço não está rodando
- Se o microserviço não iniciar com `npm run dev:all`, iniciar o Docker com `cd imap-smtp-validator && docker compose build && docker compose up -d`
- Em ambientes Windows com WSL, conflitos de porta podem ocorrer se serviços tanto no Windows quanto no WSL tentarem usar a mesma porta (ex: 5000)

**IMPORTANTE:** Após concluir qualquer tarefa, este arquivo CLAUDE.md DEVE ser atualizado para refletir o progresso.