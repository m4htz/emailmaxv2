/**
 * Testes para o módulo EmailTemplateGenerator
 */

import { 
  EmailTemplateGenerator, 
  EmailTemplateType,
  FormalityLevel
} from '../../../lib/utils/email-template-generator';

describe('EmailTemplateGenerator', () => {
  let generator: EmailTemplateGenerator;
  
  beforeEach(() => {
    generator = new EmailTemplateGenerator();
  });
  
  describe('Geração de Templates', () => {
    test('deve gerar template de introdução com saudação e assinatura', () => {
      const template = generator.generateTemplate('introduction', {
        type: EmailTemplateType.INTRODUCTION,
        language: 'pt-BR',
        style: {
          formalityLevel: FormalityLevel.NEUTRAL,
          useEmojis: false,
          punctuationVariation: false,
          typoFrequency: 0,
          wordVariety: 0.5,
          regionalisms: [],
          abbreviations: false
        },
        length: 'short',
        includeGreeting: true,
        includeSignature: true
      });
      
      // Verificar estrutura básica do template
      expect(template.subject).toBeDefined();
      expect(template.htmlBody).toBeDefined();
      expect(template.textBody).toBeDefined();
      
      // Verificar se contém saudação
      const greetingPatternsHTML = [
        /Olá {{receiverName}}<br><br>/,
        /Bom dia {{receiverName}}<br><br>/,
        /Prezado\(a\) {{receiverName}}<br><br>/
      ];
      
      const hasGreeting = greetingPatternsHTML.some(pattern => 
        pattern.test(template.htmlBody)
      );
      
      expect(hasGreeting).toBe(true);
      
      // Verificar se contém corpo
      expect(template.htmlBody).toContain('<br><br>');
      
      // Verificar se contém fechamento/assinatura
      const closingPatternsHTML = [
        /Atenciosamente,<br>/,
        /Abraços,<br>/,
        /Cordialmente,<br>/
      ];
      
      const hasClosing = closingPatternsHTML.some(pattern => 
        pattern.test(template.htmlBody)
      );
      
      expect(hasClosing).toBe(true);
    });
    
    test('deve gerar template profissional formal', () => {
      const template = generator.generateTemplate('professional', {
        type: EmailTemplateType.PROFESSIONAL,
        language: 'pt-BR',
        style: {
          formalityLevel: FormalityLevel.VERY_FORMAL,
          useEmojis: false,
          punctuationVariation: false,
          typoFrequency: 0,
          wordVariety: 0.7,
          regionalisms: [],
          abbreviations: false
        },
        length: 'medium',
        includeGreeting: true,
        includeSignature: true
      });
      
      // Verificar estrutura básica do template
      expect(template.subject).toBeDefined();
      expect(template.htmlBody).toBeDefined();
      expect(template.textBody).toBeDefined();
      
      // Verificar tom formal
      expect(template.htmlBody).toContain('Prezado(a)') || 
        expect(template.htmlBody).toContain('Caro(a)');
        
      // Para emails muito formais, esperamos fechamentos específicos
      expect(template.htmlBody).toContain('Atenciosamente') || 
        expect(template.htmlBody).toContain('Cordialmente');
    });
    
    test('deve gerar template casual/informal', () => {
      const template = generator.generateTemplate('personal', {
        type: EmailTemplateType.PERSONAL,
        language: 'pt-BR',
        style: {
          formalityLevel: FormalityLevel.VERY_CASUAL,
          useEmojis: true,
          punctuationVariation: true,
          typoFrequency: 0.3,
          wordVariety: 0.4,
          regionalisms: [],
          abbreviations: true
        },
        length: 'short',
        includeGreeting: true,
        includeSignature: true
      });
      
      // Verificar estrutura básica do template
      expect(template.subject).toBeDefined();
      expect(template.textBody).toBeDefined();
      
      // Verificar tom informal
      expect(template.htmlBody).toContain('Oi ') || 
        expect(template.htmlBody).toContain('Olá ') || 
        expect(template.htmlBody).toContain('E aí');
        
      // Para emails muito casuais, esperamos fechamentos específicos
      expect(template.htmlBody).toContain('Abraços') || 
        expect(template.htmlBody).toContain('Até mais');
    });
    
    test('deve gerar template com diferentes comprimentos', () => {
      // Template curto
      const shortTemplate = generator.generateTemplate('short', {
        type: EmailTemplateType.INFORMATION,
        language: 'pt-BR',
        style: {
          formalityLevel: FormalityLevel.NEUTRAL,
          useEmojis: false,
          punctuationVariation: false,
          typoFrequency: 0,
          wordVariety: 0.5,
          regionalisms: [],
          abbreviations: false
        },
        length: 'short',
        includeGreeting: true,
        includeSignature: true
      });
      
      // Template médio
      const mediumTemplate = generator.generateTemplate('medium', {
        type: EmailTemplateType.INFORMATION,
        language: 'pt-BR',
        style: {
          formalityLevel: FormalityLevel.NEUTRAL,
          useEmojis: false,
          punctuationVariation: false,
          typoFrequency: 0,
          wordVariety: 0.5,
          regionalisms: [],
          abbreviations: false
        },
        length: 'medium',
        includeGreeting: true,
        includeSignature: true
      });
      
      // Template longo
      const longTemplate = generator.generateTemplate('long', {
        type: EmailTemplateType.INFORMATION,
        language: 'pt-BR',
        style: {
          formalityLevel: FormalityLevel.NEUTRAL,
          useEmojis: false,
          punctuationVariation: false,
          typoFrequency: 0,
          wordVariety: 0.5,
          regionalisms: [],
          abbreviations: false
        },
        length: 'long',
        includeGreeting: true,
        includeSignature: true
      });
      
      // Verificar números relativos de parágrafos pelos <br><br>
      const shortParagraphs = (shortTemplate.htmlBody.match(/<br><br>/g) || []).length;
      const mediumParagraphs = (mediumTemplate.htmlBody.match(/<br><br>/g) || []).length;
      const longParagraphs = (longTemplate.htmlBody.match(/<br><br>/g) || []).length;
      
      expect(mediumParagraphs).toBeGreaterThanOrEqual(shortParagraphs);
      expect(longParagraphs).toBeGreaterThanOrEqual(mediumParagraphs);
    });
  });
  
  describe('Variações de Template', () => {
    test('deve gerar variações diferentes do mesmo template', () => {
      // Criar template base
      const baseTemplate = generator.generateTemplate('base', {
        type: EmailTemplateType.INTRODUCTION,
        language: 'pt-BR',
        style: {
          formalityLevel: FormalityLevel.NEUTRAL,
          useEmojis: false,
          punctuationVariation: false,
          typoFrequency: 0,
          wordVariety: 0.5,
          regionalisms: [],
          abbreviations: false
        },
        length: 'short',
        includeGreeting: true,
        includeSignature: true
      });
      
      // Gerar variações
      const variations = generator.generateVariations(baseTemplate, 3);
      
      // Verificar número de variações
      expect(variations.length).toBe(3); // O original mais 2 variações
      
      // Verificar que são diferentes
      const subjects = variations.map(v => v.subject);
      const bodies = variations.map(v => v.htmlBody);
      
      // Os assuntos devem ser diferentes
      expect(new Set(subjects).size).toBeGreaterThanOrEqual(2);
      
      // Os corpos devem ser diferentes
      expect(new Set(bodies).size).toBeGreaterThanOrEqual(2);
    });
    
    test('deve preservar variáveis nas variações', () => {
      // Criar template base com variáveis
      const baseTemplate = {
        subject: 'Email de {{senderName}} para {{receiverName}}',
        htmlBody: '<p>Olá {{receiverName}}, sou {{senderName}}.</p>',
        textBody: 'Olá {{receiverName}}, sou {{senderName}}.',
        variables: ['senderName', 'receiverName']
      };
      
      // Gerar variações
      const variations = generator.generateVariations(baseTemplate, 3);
      
      // Verificar que as variáveis foram preservadas
      variations.forEach(variation => {
        expect(variation.subject).toContain('{{senderName}}');
        expect(variation.subject).toContain('{{receiverName}}');
        expect(variation.htmlBody).toContain('{{senderName}}');
        expect(variation.htmlBody).toContain('{{receiverName}}');
      });
    });
  });
  
  describe('Suporte a Idiomas', () => {
    test('deve gerar templates em inglês', () => {
      const template = generator.generateTemplate('english', {
        type: EmailTemplateType.INTRODUCTION,
        language: 'en-US',
        style: {
          formalityLevel: FormalityLevel.NEUTRAL,
          useEmojis: false,
          punctuationVariation: false,
          typoFrequency: 0,
          wordVariety: 0.5,
          regionalisms: [],
          abbreviations: false
        },
        length: 'short',
        includeGreeting: true,
        includeSignature: true
      });
      
      // Verificar elementos em inglês
      expect(template.htmlBody).toMatch(/Hello|Hi|Good|Dear/);
      expect(template.htmlBody).toMatch(/Regards|Sincerely|Thanks|Cheers/);
    });
    
    test('deve gerar templates em espanhol', () => {
      const template = generator.generateTemplate('spanish', {
        type: EmailTemplateType.INTRODUCTION,
        language: 'es-ES',
        style: {
          formalityLevel: FormalityLevel.NEUTRAL,
          useEmojis: false,
          punctuationVariation: false,
          typoFrequency: 0,
          wordVariety: 0.5,
          regionalisms: [],
          abbreviations: false
        },
        length: 'short',
        includeGreeting: true,
        includeSignature: true
      });
      
      // Verificar elementos em espanhol
      expect(template.htmlBody).toMatch(/Hola|Buenos|Buenas|Estimado|Querido/);
      expect(template.htmlBody).toMatch(/Saludos|Atentamente|Cordialmente|Gracias/);
    });
  });
  
  describe('Tipos de Template', () => {
    test('deve gerar todos os tipos de template', () => {
      const types = [
        EmailTemplateType.INTRODUCTION,
        EmailTemplateType.FOLLOW_UP,
        EmailTemplateType.QUESTION,
        EmailTemplateType.INFORMATION,
        EmailTemplateType.INVITATION,
        EmailTemplateType.NEWSLETTER,
        EmailTemplateType.PRODUCT_UPDATE,
        EmailTemplateType.PERSONAL,
        EmailTemplateType.PROFESSIONAL
      ];
      
      // Verificar que todos os tipos podem ser gerados
      types.forEach(type => {
        expect(() => {
          generator.generateTemplate(`type-${type}`, {
            type,
            language: 'pt-BR',
            style: {
              formalityLevel: FormalityLevel.NEUTRAL,
              useEmojis: false,
              punctuationVariation: false,
              typoFrequency: 0,
              wordVariety: 0.5,
              regionalisms: [],
              abbreviations: false
            },
            length: 'short',
            includeGreeting: true,
            includeSignature: true
          });
        }).not.toThrow();
      });
    });
  });
});