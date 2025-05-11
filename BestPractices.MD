# Metodologia de Desenvolvimento Incremental para EmailMaxV2

Este documento descreve a metodologia de desenvolvimento incremental utilizada no projeto EmailMaxV2, com foco em garantir código 100% funcional através de técnicas de desenvolvimento iterativo e debugging imediato.

## 1. Divisão de Tarefas em Unidades Testáveis Mínimas

### Princípios Fundamentais
- Toda tarefa deve ser dividida em componentes menores que possam ser testados individualmente
- Cada componente deve ter uma única responsabilidade claramente definida
- Interfaces entre componentes devem ser explícitas e documentadas
- Componentes devem ser implementados na ordem que minimiza dependências não resolvidas

### Exemplo Prático: Automação de Webmail
A tarefa "Implementar navegação automatizada em Gmail, Outlook e Yahoo" foi dividida em:

1. **Definição de interfaces** - Criar interfaces TypeScript para todos os componentes
2. **Implementação do manipulador base** - Criar classe abstrata com funcionalidades comuns
3. **Implementação específica para Gmail** - Estender a base para Gmail
4. **Implementação específica para Outlook** - Estender a base para Outlook 
5. **Implementação específica para Yahoo** - Estender a base para Yahoo
6. **Integração com sistema de sessão** - Conectar com gerenciador de sessões
7. **Testes unitários** - Testar cada componente isoladamente
8. **Testes de integração** - Testar componentes integrados

## 2. Sequência de Desenvolvimento de Cada Incremento

### Fluxo de Trabalho
1. **Planejamento**: Definir escopo exato do incremento e suas interfaces
2. **Implementação**: Codificar a funcionalidade específica
3. **Teste local**: Verificar funcionalidade em ambiente isolado
4. **Integração**: Incorporar ao sistema maior
5. **Refinamento**: Otimizar e melhorar com base em feedback

### Ciclo de Tempo
- Cada incremento deve ser completado em no máximo 2-4 horas
- Se uma tarefa excede esse limite, deve ser subdividida

### Exemplo Concreto: HumanInteraction
Implementação do componente `HumanInteraction` para simular comportamento humano:

1. **Fase 1 (2h)**: Implementar movimentos básicos de mouse
   - Criar funções para calcular trajetórias
   - Implementar aceleração/desaceleração natural
   - Testar visualmente os movimentos

2. **Fase 2 (2h)**: Implementar digitação realista
   - Adicionar variação na velocidade de digitação
   - Implementar erros de digitação aleatórios
   - Testar com diferentes textos

3. **Fase 3 (3h)**: Implementar comportamentos emocionais
   - Definir estados emocionais (calmo, apressado, distraído)
   - Implementar parâmetros para cada estado
   - Testar diferentes estados em cenários reais

## 3. Metodologia de Debugging

### Princípios de Debugging
- Debug imediato - Nunca continuar para próximo componente sem validar o atual
- Logging estratégico - Logs detalhados em pontos de decisão críticos
- Automação de testes - Testes automatizados para validar comportamento
- Isolamento de problemas - Reduzir escopo até identificar causa raiz

### Framework de Debug
1. **Observação**: Identificar o problema específico
2. **Hipótese**: Formular hipótese sobre a causa
3. **Teste**: Implementar teste que valide a hipótese
4. **Resolução**: Corrigir o problema
5. **Verificação**: Confirmar que o problema foi resolvido
6. **Prevenção**: Implementar teste permanente para evitar regressão

### Exemplo: Debugging da Navegação em Gmail
Problema identificado: Navegação falha após alteração na interface do Gmail.

1. **Observação**: 
   - Erro ocorre apenas em algumas contas
   - Seletores padrão não encontram elementos

2. **Hipótese**: 
   - Gmail tem variações de interface baseadas em perfil do usuário

3. **Teste**:
   - Implementar captura de screenshot no momento do erro
   - Analisar DOM para identificar diferenças

4. **Resolução**:
   - Implementar sistema de seletores adaptativos
   - Criar mecanismo de fallback para diferentes layouts

5. **Verificação**:
   - Testar em 5 contas diferentes para confirmar solução

6. **Prevenção**:
   - Adicionar teste automatizado para variações de interface

## 4. Exemplos de Implementação Incremental

### Caso 1: Implementação do Session Manager

#### Incremento 1: Interface básica e armazenamento de cookies
```typescript
interface SessionManager {
  saveSession(provider: string, userId: string, cookies: Cookie[]): Promise<void>;
  loadSession(provider: string, userId: string): Promise<Cookie[] | null>;
}

class BasicSessionManager implements SessionManager {
  private sessions = new Map<string, Cookie[]>();
  
  private getKey(provider: string, userId: string): string {
    return `${provider}:${userId}`;
  }
  
  async saveSession(provider: string, userId: string, cookies: Cookie[]): Promise<void> {
    this.sessions.set(this.getKey(provider, userId), cookies);
  }
  
  async loadSession(provider: string, userId: string): Promise<Cookie[] | null> {
    const key = this.getKey(provider, userId);
    return this.sessions.has(key) ? this.sessions.get(key)! : null;
  }
}

// TESTE IMEDIATO
const sessionManager = new BasicSessionManager();
await sessionManager.saveSession('gmail', 'test@gmail.com', [{ name: 'test', value: 'value' }]);
const cookies = await sessionManager.loadSession('gmail', 'test@gmail.com');
console.log('Cookies recuperados:', cookies); // Deve mostrar o cookie salvo
```

#### Incremento 2: Persistência com localStorage
```typescript
class PersistentSessionManager implements SessionManager {
  private storage: Storage;
  
  constructor(storage: Storage = localStorage) {
    this.storage = storage;
  }
  
  private getKey(provider: string, userId: string): string {
    return `session:${provider}:${userId}`;
  }
  
  async saveSession(provider: string, userId: string, cookies: Cookie[]): Promise<void> {
    this.storage.setItem(this.getKey(provider, userId), JSON.stringify(cookies));
  }
  
  async loadSession(provider: string, userId: string): Promise<Cookie[] | null> {
    const data = this.storage.getItem(this.getKey(provider, userId));
    return data ? JSON.parse(data) : null;
  }
}

// TESTE IMEDIATO
const persistentManager = new PersistentSessionManager();
await persistentManager.saveSession('gmail', 'test@gmail.com', [{ name: 'test', value: 'value' }]);
const cookies = await persistentManager.loadSession('gmail', 'test@gmail.com');
console.log('Cookies persistentes:', cookies); // Deve mostrar o cookie salvo
```

#### Incremento 3: Criptografia de dados sensíveis
```typescript
class SecureSessionManager implements SessionManager {
  private storage: Storage;
  private encryptionKey: string;
  
  constructor(encryptionKey: string, storage: Storage = localStorage) {
    this.storage = storage;
    this.encryptionKey = encryptionKey;
  }
  
  private getKey(provider: string, userId: string): string {
    return `secure-session:${provider}:${userId}`;
  }
  
  private encrypt(data: any): string {
    // Implementação simplificada - usar biblioteca de criptografia real
    const jsonStr = JSON.stringify(data);
    return btoa(jsonStr + ':' + this.encryptionKey);
  }
  
  private decrypt(encrypted: string): any {
    // Implementação simplificada - usar biblioteca de criptografia real
    const decoded = atob(encrypted);
    const separatorIndex = decoded.lastIndexOf(':');
    const jsonStr = decoded.substring(0, separatorIndex);
    return JSON.parse(jsonStr);
  }
  
  async saveSession(provider: string, userId: string, cookies: Cookie[]): Promise<void> {
    const encrypted = this.encrypt(cookies);
    this.storage.setItem(this.getKey(provider, userId), encrypted);
  }
  
  async loadSession(provider: string, userId: string): Promise<Cookie[] | null> {
    const encrypted = this.storage.getItem(this.getKey(provider, userId));
    if (!encrypted) return null;
    return this.decrypt(encrypted);
  }
}

// TESTE IMEDIATO
const secureManager = new SecureSessionManager('chave-secreta-teste');
await secureManager.saveSession('gmail', 'test@gmail.com', [{ name: 'secret', value: 'sensitive-value' }]);
const cookies = await secureManager.loadSession('gmail', 'test@gmail.com');
console.log('Cookies seguros:', cookies); // Deve mostrar o cookie recuperado
console.log('Valor criptografado no storage:', localStorage.getItem('secure-session:gmail:test@gmail.com'));
```

### Caso 2: Desenvolvimento do HumanInteraction

#### Incremento 1: Movimento básico de mouse
```typescript
interface MouseOptions {
  speed?: number; // 1 = normal, <1 = mais lento, >1 = mais rápido
  randomness?: number; // 0 = direto, 1 = muito aleatório
}

class HumanInteraction {
  private page: Page; // Playwright Page
  
  constructor(page: Page) {
    this.page = page;
  }
  
  async moveMouseTo(selector: string, options: MouseOptions = {}): Promise<void> {
    const element = await this.page.$(selector);
    if (!element) throw new Error(`Elemento não encontrado: ${selector}`);
    
    const box = await element.boundingBox();
    if (!box) throw new Error(`Não foi possível determinar a posição do elemento: ${selector}`);
    
    // Calcular posição central do elemento
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;
    
    // Obter posição atual do mouse
    const mouse = this.page.mouse;
    const position = await this.page.evaluate(() => ({ 
      x: window.mouseX || 0, 
      y: window.mouseY || 0 
    }));
    
    // Movimento direto para testes iniciais
    await mouse.move(targetX, targetY);
    console.log(`Mouse movido para ${targetX},${targetY}`);
  }
}

// TESTE IMEDIATO
// Na prática, criar um navegador Playwright e testar visualmente
// Aqui apenas pseudocódigo para demonstração
const browser = await playwright.chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('https://exemplo.com');
const human = new HumanInteraction(page);
await human.moveMouseTo('.button-test');
```

#### Incremento 2: Movimento natural de mouse com curva de Bezier
```typescript
class EnhancedHumanInteraction extends HumanInteraction {
  async moveMouseTo(selector: string, options: MouseOptions = {}): Promise<void> {
    const element = await this.page.$(selector);
    if (!element) throw new Error(`Elemento não encontrado: ${selector}`);
    
    const box = await element.boundingBox();
    if (!box) throw new Error(`Não foi possível determinar a posição do elemento: ${selector}`);
    
    // Calcular posição central do elemento
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;
    
    // Obter posição atual do mouse
    const mouse = this.page.mouse;
    const position = await this.page.evaluate(() => ({ 
      x: window.mouseX || 0, 
      y: window.mouseY || 0 
    }));
    
    // Gerar pontos de controle para curva de Bezier
    const distance = Math.sqrt(
      Math.pow(targetX - position.x, 2) + 
      Math.pow(targetY - position.y, 2)
    );
    
    const randomness = options.randomness || 0.5;
    const midPointX = (position.x + targetX) / 2;
    const midPointY = (position.y + targetY) / 2;
    
    // Criar variação aleatória para pontos de controle
    const controlPoint1X = midPointX + (Math.random() - 0.5) * distance * randomness;
    const controlPoint1Y = midPointY + (Math.random() - 0.5) * distance * randomness;
    
    // Calcular pontos da curva Bezier
    const points = this.bezierCurve(
      position.x, position.y,
      controlPoint1X, controlPoint1Y,
      targetX, targetY,
      20 // número de pontos na curva
    );
    
    // Mover mouse pelos pontos da curva
    const speed = options.speed || 1;
    for (const point of points) {
      await mouse.move(point.x, point.y);
      // Velocidade variável com alguma aleatoriedade
      await this.page.waitForTimeout(10 / speed * (0.8 + Math.random() * 0.4));
    }
  }
  
  private bezierCurve(
    startX: number, startY: number,
    controlX: number, controlY: number,
    endX: number, endY: number,
    pointCount: number
  ): {x: number, y: number}[] {
    const points: {x: number, y: number}[] = [];
    
    for (let i = 0; i <= pointCount; i++) {
      const t = i / pointCount;
      
      // Fórmula da curva de Bezier quadrática
      const x = Math.pow(1 - t, 2) * startX + 
                2 * (1 - t) * t * controlX + 
                Math.pow(t, 2) * endX;
                
      const y = Math.pow(1 - t, 2) * startY + 
                2 * (1 - t) * t * controlY + 
                Math.pow(t, 2) * endY;
                
      points.push({x, y});
    }
    
    return points;
  }
}

// TESTE IMEDIATO
// Criar função de teste para visualizar o movimento do mouse
async function testMouseMovement() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://exemplo.com');
  
  const human = new EnhancedHumanInteraction(page);
  
  // Testar com diferentes níveis de aleatoriedade e velocidade
  await human.moveMouseTo('.button-test-1', { randomness: 0.1, speed: 1 });
  await page.waitForTimeout(1000);
  
  await human.moveMouseTo('.button-test-2', { randomness: 0.5, speed: 0.8 });
  await page.waitForTimeout(1000);
  
  await human.moveMouseTo('.button-test-3', { randomness: 0.9, speed: 1.2 });
}

// Executar teste visual
testMouseMovement();
```

## 5. Considerações Complementares

### Documentação Integrada
- Cada incremento deve incluir documentação atualizada
- Comentários de código devem explicar "por quê", não "o quê"
- Mantenha exemplos de uso atualizados em `examples/`

### Refatoração Contínua
- Refatoração deve ser tratada como incremento separado
- Nunca refatore e adicione funcionalidades no mesmo incremento
- Teste meticulosamente após refatoração

### Integração Contínua
- Configure testes automatizados para executar após cada commit
- Mantenha branches pequenas e focadas
- Resolva conflitos de merge imediatamente

### Revisão de Código
- Revisão deve seguir princípios de incremento
- Revisar cada incremento completado, não grandes pull requests
- Utilize lista de verificação com padrões do projeto

## 6. Lições Aprendidas

### Falhas Comuns a Evitar
- Implementação de componentes grandes sem validação intermediária
- Falta de testes em código que lida com serviços externos
- Ignorar pequenos avisos e erros não críticos
- Acumular dívida técnica para "resolver depois"

### Estratégias de Sucesso
- Priorizar testabilidade desde o início do design
- Manter sessões focadas em um único incremento
- Desenvolver incrementalmente mesmo sob pressão de prazos
- Documentar decisões de arquitetura junto com o código

---

## Uso Prático deste Documento

Este documento deve ser consultado:
1. No início do planejamento de cada nova funcionalidade
2. Antes de iniciar a implementação de um componente
3. Durante revisões de código
4. Ao treinar novos membros da equipe

Revise e atualize este guia regularmente com base nas experiências do projeto.