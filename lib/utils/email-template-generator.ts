/**
 * Sistema para geração de templates de email e conteúdo natural
 * Complementa o sistema de envio cruzado de emails
 */

import { EmailTemplate } from './email-interaction-network';

/**
 * Tipo de template de email
 */
export enum EmailTemplateType {
  INTRODUCTION = 'introduction',       // Apresentação inicial
  FOLLOW_UP = 'follow_up',             // Continuação de conversa
  QUESTION = 'question',               // Pergunta
  INFORMATION = 'information',         // Informações
  INVITATION = 'invitation',           // Convite para evento
  NEWSLETTER = 'newsletter',           // Newsletter periódica
  PRODUCT_UPDATE = 'product_update',   // Atualização de produto
  PERSONAL = 'personal',               // Comunicação pessoal
  PROFESSIONAL = 'professional',       // Comunicação profissional
}

/**
 * Nível de formalidade do email
 */
export enum FormalityLevel {
  VERY_FORMAL = 'very_formal',         // Muito formal
  FORMAL = 'formal',                   // Formal
  NEUTRAL = 'neutral',                 // Neutro
  CASUAL = 'casual',                   // Casual
  VERY_CASUAL = 'very_casual',         // Muito casual
}

/**
 * Características de linguagem
 */
export interface LanguageStyle {
  formalityLevel: FormalityLevel;
  useEmojis: boolean;
  punctuationVariation: boolean;       // Variações como "!!!" ou "?!"
  typoFrequency: number;               // 0-1, frequência de erros de digitação
  wordVariety: number;                 // 0-1, variedade de vocabulário
  regionalisms: string[];              // Expressões regionais específicas
  abbreviations: boolean;              // Uso de abreviações
}

/**
 * Opções para geração de template
 */
export interface TemplateGenerationOptions {
  type: EmailTemplateType;
  language: 'pt-BR' | 'en-US' | 'es-ES';
  style: LanguageStyle;
  variables?: string[];
  length: 'short' | 'medium' | 'long';
  includeSignature: boolean;
  includeGreeting: boolean;
  subjectVariations?: number;          // Número de variações para o assunto
  bodyVariations?: number;             // Número de variações para o corpo
}

/**
 * Classe principal para geração de templates de email
 */
export class EmailTemplateGenerator {
  // Banco de frases para compor emails
  private greetings: Record<string, string[]> = {
    'pt-BR': [
      'Olá {{receiverName}}',
      'Oi {{receiverName}}',
      'Bom dia {{receiverName}}',
      'Boa tarde {{receiverName}}',
      'Boa noite {{receiverName}}',
      'Prezado(a) {{receiverName}}',
      'Caro(a) {{receiverName}}',
    ],
    'en-US': [
      'Hello {{receiverName}}',
      'Hi {{receiverName}}',
      'Good morning {{receiverName}}',
      'Good afternoon {{receiverName}}',
      'Good evening {{receiverName}}',
      'Dear {{receiverName}}',
    ],
    'es-ES': [
      'Hola {{receiverName}}',
      'Buenos días {{receiverName}}',
      'Buenas tardes {{receiverName}}',
      'Buenas noches {{receiverName}}',
      'Estimado/a {{receiverName}}',
      'Querido/a {{receiverName}}',
    ]
  };
  
  private closings: Record<string, string[]> = {
    'pt-BR': [
      'Atenciosamente',
      'Abraços',
      'Até mais',
      'Um abraço',
      'Cordialmente',
      'Obrigado',
      'Obrigado pela atenção',
      'Aguardo retorno',
      'Fico à disposição',
    ],
    'en-US': [
      'Regards',
      'Best regards',
      'Kind regards',
      'Best wishes',
      'Sincerely',
      'Cheers',
      'Thanks',
      'Thank you',
      'Looking forward to hearing from you',
    ],
    'es-ES': [
      'Saludos',
      'Saludos cordiales',
      'Atentamente',
      'Un saludo',
      'Cordialmente',
      'Gracias',
      'Gracias por su atención',
      'Quedo a la espera',
      'Quedo a su disposición',
    ]
  };
  
  private signatures: Record<string, string[]> = {
    'pt-BR': [
      '{{senderName}}',
      '{{senderName}} | {{senderEmail}}',
      'Equipe {{senderName}}',
    ],
    'en-US': [
      '{{senderName}}',
      '{{senderName}} | {{senderEmail}}',
      '{{senderName}} Team',
    ],
    'es-ES': [
      '{{senderName}}',
      '{{senderName}} | {{senderEmail}}',
      'Equipo {{senderName}}',
    ]
  };
  
  private introductions: Record<string, Record<FormalityLevel, string[]>> = {
    'pt-BR': {
      [FormalityLevel.VERY_FORMAL]: [
        'Venho por meio deste email apresentar-me.',
        'É com grande satisfação que entro em contato.',
        'Permita-me apresentar-me formalmente.',
      ],
      [FormalityLevel.FORMAL]: [
        'Gostaria de me apresentar.',
        'Estou entrando em contato para me apresentar.',
        'É um prazer estabelecer este primeiro contato.',
      ],
      [FormalityLevel.NEUTRAL]: [
        'Estou entrando em contato para nos conhecermos melhor.',
        'Queria me apresentar e conhecer um pouco sobre você também.',
        'Estou fazendo contato para nos conectarmos.',
      ],
      [FormalityLevel.CASUAL]: [
        'Queria dar um oi e me apresentar.',
        'Estou entrando em contato para batermos um papo.',
        'Que bom poder conversar com você!',
      ],
      [FormalityLevel.VERY_CASUAL]: [
        'E aí, beleza? Queria me apresentar.',
        'Opa! Tudo bem? Sou o(a) {{senderName}}.',
        'Fala {{receiverName}}! Vamos nos conhecer?',
      ],
    },
    'en-US': {
      [FormalityLevel.VERY_FORMAL]: [
        'I am writing to introduce myself.',
        'It is with great pleasure that I am contacting you.',
        'Allow me to formally introduce myself.',
      ],
      [FormalityLevel.FORMAL]: [
        'I would like to introduce myself.',
        'I am writing to connect with you.',
        'It is a pleasure to establish this first contact.',
      ],
      [FormalityLevel.NEUTRAL]: [
        'I wanted to reach out and introduce myself.',
        'I'm getting in touch to connect with you.',
        'I thought it would be nice to introduce myself.',
      ],
      [FormalityLevel.CASUAL]: [
        'Just wanted to say hi and introduce myself.',
        'Thought I'd reach out and connect with you.',
        'Great to be connecting with you!',
      ],
      [FormalityLevel.VERY_CASUAL]: [
        'Hey there! Just wanted to introduce myself.',
        'What's up? I'm {{senderName}}.',
        'Hi {{receiverName}}! Let's get to know each other?',
      ],
    },
    'es-ES': {
      [FormalityLevel.VERY_FORMAL]: [
        'Me dirijo a usted para presentarme formalmente.',
        'Es un honor poder establecer contacto con usted.',
        'Permítame presentarme adecuadamente.',
      ],
      [FormalityLevel.FORMAL]: [
        'Quisiera presentarme con usted.',
        'Me pongo en contacto para presentarme.',
        'Es un placer establecer este primer contacto.',
      ],
      [FormalityLevel.NEUTRAL]: [
        'Me gustaría presentarme y conocerle mejor.',
        'Estoy estableciendo contacto para conectar con usted.',
        'Es bueno poder comunicarme con usted.',
      ],
      [FormalityLevel.CASUAL]: [
        'Quería saludar y presentarme.',
        'Me pongo en contacto para charlar un poco.',
        '¡Qué bueno poder hablar contigo!',
      ],
      [FormalityLevel.VERY_CASUAL]: [
        '¡Hola! ¿Qué tal? Quería presentarme.',
        '¡Hey! Soy {{senderName}}.',
        '¡Hola {{receiverName}}! ¿Nos conocemos?',
      ],
    },
  };
  
  private bodyParagraphs: Record<EmailTemplateType, Record<string, string[]>> = {
    [EmailTemplateType.INTRODUCTION]: {
      'pt-BR': [
        'Meu nome é {{senderName}} e trabalho na área de {{industry}}.',
        'Estou interessado(a) em conhecer mais sobre o seu trabalho em {{topic}}.',
        'Recentemente, vi seu perfil e achei que seria interessante estabelecermos contato.',
        'Temos algumas conexões em comum e acredito que poderíamos colaborar em projetos futuros.',
        'Estou buscando expandir minha rede de contatos profissionais na área de {{industry}}.',
      ],
      'en-US': [
        'My name is {{senderName}} and I work in the {{industry}} field.',
        'I'm interested in learning more about your work in {{topic}}.',
        'I recently saw your profile and thought it would be interesting to connect.',
        'We have some mutual connections and I believe we could collaborate on future projects.',
        'I'm looking to expand my professional network in the {{industry}} industry.',
      ],
      'es-ES': [
        'Mi nombre es {{senderName}} y trabajo en el área de {{industry}}.',
        'Estoy interesado/a en conocer más sobre su trabajo en {{topic}}.',
        'Recientemente vi su perfil y pensé que sería interesante establecer contacto.',
        'Tenemos algunas conexiones en común y creo que podríamos colaborar en proyectos futuros.',
        'Estoy buscando expandir mi red de contactos profesionales en el área de {{industry}}.',
      ],
    },
    [EmailTemplateType.FOLLOW_UP]: {
      'pt-BR': [
        'Estou entrando em contato para dar continuidade à nossa conversa anterior sobre {{topic}}.',
        'Gostaria de saber se você teve a oportunidade de analisar a proposta que enviei.',
        'Desde nossa última conversa, surgiu uma nova ideia que gostaria de compartilhar com você.',
        'Estou acompanhando o desenvolvimento do projeto e gostaria de oferecer ajuda se necessário.',
        'Houve algum avanço em relação aos pontos que discutimos anteriormente?',
      ],
      'en-US': [
        'I'm following up on our previous conversation about {{topic}}.',
        'I wanted to check if you've had a chance to review the proposal I sent.',
        'Since our last conversation, I've had a new idea that I'd like to share with you.',
        'I've been tracking the project's progress and would like to offer assistance if needed.',
        'Has there been any progress regarding the points we discussed earlier?',
      ],
      'es-ES': [
        'Me comunico para dar continuidad a nuestra conversación anterior sobre {{topic}}.',
        'Quisiera saber si ha tenido la oportunidad de analizar la propuesta que le envié.',
        'Desde nuestra última conversación, surgió una nueva idea que me gustaría compartir con usted.',
        'Estoy siguiendo el desarrollo del proyecto y me gustaría ofrecer ayuda si es necesario.',
        '¿Ha habido algún avance en relación a los puntos que discutimos anteriormente?',
      ],
    },
    // Implementação para os outros tipos...
    [EmailTemplateType.QUESTION]: {
      'pt-BR': [
        'Gostaria de saber sua opinião sobre {{topic}}.',
        'Tenho uma dúvida sobre {{topic}} e acredito que você poderia me ajudar.',
        'Você poderia me dar mais informações sobre {{topic}}?',
        'Estou pesquisando sobre {{topic}} e sua expertise seria muito valiosa.',
        'Qual sua experiência com {{topic}}?',
      ],
      'en-US': [
        'I would like to know your opinion about {{topic}}.',
        'I have a question about {{topic}} and I believe you could help me.',
        'Could you provide me with more information about {{topic}}?',
        'I'm researching {{topic}} and your expertise would be very valuable.',
        'What is your experience with {{topic}}?',
      ],
      'es-ES': [
        'Me gustaría conocer su opinión sobre {{topic}}.',
        'Tengo una duda sobre {{topic}} y creo que usted podría ayudarme.',
        '¿Podría darme más información sobre {{topic}}?',
        'Estoy investigando sobre {{topic}} y su experiencia sería muy valiosa.',
        '¿Cuál es su experiencia con {{topic}}?',
      ],
    },
    [EmailTemplateType.INFORMATION]: {
      'pt-BR': [
        'Gostaria de compartilhar algumas informações sobre {{topic}} que podem ser de seu interesse.',
        'Recentemente, descobri dados interessantes sobre {{topic}} e pensei em você.',
        'Como prometido, estou enviando as informações sobre {{topic}}.',
        'Aqui estão as informações que você solicitou sobre {{topic}}.',
        'Preparei um breve resumo sobre {{topic}} que pode ser útil para você.',
      ],
      'en-US': [
        'I would like to share some information about {{topic}} that might interest you.',
        'I recently discovered interesting data about {{topic}} and thought of you.',
        'As promised, I am sending you the information about {{topic}}.',
        'Here is the information you requested about {{topic}}.',
        'I've prepared a brief summary about {{topic}} that might be useful for you.',
      ],
      'es-ES': [
        'Me gustaría compartir algunas informaciones sobre {{topic}} que pueden ser de su interés.',
        'Recientemente, descubrí datos interesantes sobre {{topic}} y pensé en usted.',
        'Como prometido, le envío la información sobre {{topic}}.',
        'Aquí está la información que solicitó sobre {{topic}}.',
        'He preparado un breve resumen sobre {{topic}} que puede serle útil.',
      ],
    },
    [EmailTemplateType.INVITATION]: {
      'pt-BR': [
        'Gostaria de convidá-lo(a) para {{event}} que acontecerá em {{date}}.',
        'Temos o prazer de convidar você para participar de {{event}}.',
        'Está confirmado: {{event}} acontecerá em {{date}} e gostaríamos muito da sua presença.',
        'Reserve a data: {{date}} para {{event}}. Sua presença é muito importante para nós.',
        'Você está convidado(a) para {{event}}. Podemos contar com sua presença?',
      ],
      'en-US': [
        'I would like to invite you to {{event}} happening on {{date}}.',
        'We are pleased to invite you to participate in {{event}}.',
        'It's confirmed: {{event}} will take place on {{date}} and we would love to have you there.',
        'Save the date: {{date}} for {{event}}. Your presence is very important to us.',
        'You are invited to {{event}}. Can we count on your presence?',
      ],
      'es-ES': [
        'Me gustaría invitarle a {{event}} que tendrá lugar el {{date}}.',
        'Tenemos el placer de invitarle a participar en {{event}}.',
        'Está confirmado: {{event}} tendrá lugar el {{date}} y nos encantaría contar con su presencia.',
        'Reserve la fecha: {{date}} para {{event}}. Su presencia es muy importante para nosotros.',
        'Está invitado/a a {{event}}. ¿Podemos contar con su presencia?',
      ],
    },
    [EmailTemplateType.NEWSLETTER]: {
      'pt-BR': [
        'Confira as novidades deste mês sobre {{topic}}.',
        'Aqui está nossa atualização mensal com as principais novidades sobre {{topic}}.',
        'Não perca as últimas notícias e tendências sobre {{topic}} em nossa newsletter.',
        'Reunimos as informações mais relevantes sobre {{topic}} para mantê-lo(a) atualizado(a).',
        'Novidades, tendências e análises sobre {{topic}} em nossa newsletter mensal.',
      ],
      'en-US': [
        'Check out this month's news about {{topic}}.',
        'Here is our monthly update with the main news about {{topic}}.',
        'Don't miss the latest news and trends about {{topic}} in our newsletter.',
        'We've gathered the most relevant information about {{topic}} to keep you updated.',
        'News, trends, and analyses about {{topic}} in our monthly newsletter.',
      ],
      'es-ES': [
        'Consulte las novedades de este mes sobre {{topic}}.',
        'Aquí está nuestra actualización mensual con las principales novedades sobre {{topic}}.',
        'No se pierda las últimas noticias y tendencias sobre {{topic}} en nuestro boletín.',
        'Hemos reunido la información más relevante sobre {{topic}} para mantenerle actualizado/a.',
        'Novedades, tendencias y análisis sobre {{topic}} en nuestro boletín mensual.',
      ],
    },
    [EmailTemplateType.PRODUCT_UPDATE]: {
      'pt-BR': [
        'Estamos entusiasmados em anunciar as novas funcionalidades de {{product}}.',
        'Atualizamos {{product}} com recursos que você solicitou.',
        '{{product}} acaba de ficar ainda melhor com nossa última atualização.',
        'Novidades importantes: veja o que mudou em {{product}}.',
        'Conheça as melhorias que implementamos em {{product}} recentemente.',
      ],
      'en-US': [
        'We're excited to announce new features for {{product}}.',
        'We've updated {{product}} with features you requested.',
        '{{product}} just got even better with our latest update.',
        'Important news: see what changed in {{product}}.',
        'Check out the improvements we've implemented in {{product}} recently.',
      ],
      'es-ES': [
        'Estamos entusiasmados en anunciar las nuevas funcionalidades de {{product}}.',
        'Hemos actualizado {{product}} con recursos que usted solicitó.',
        '{{product}} acaba de mejorar aún más con nuestra última actualización.',
        'Novedades importantes: vea lo que ha cambiado en {{product}}.',
        'Conozca las mejoras que hemos implementado en {{product}} recientemente.',
      ],
    },
    [EmailTemplateType.PERSONAL]: {
      'pt-BR': [
        'Como vão as coisas? Espero que esteja tudo bem com você.',
        'Faz tempo que não nos falamos. Como tem passado?',
        'Só queria saber como você está e manter contato.',
        'Estive pensando em você e resolvi mandar uma mensagem.',
        'E aí, quais são as novidades na sua vida?',
      ],
      'en-US': [
        'How are things going? I hope everything is well with you.',
        'It's been a while since we've talked. How have you been?',
        'Just wanted to know how you're doing and keep in touch.',
        'I've been thinking about you and decided to send a message.',
        'So, what's new in your life?',
      ],
      'es-ES': [
        '¿Cómo van las cosas? Espero que todo esté bien contigo.',
        'Hace tiempo que no hablamos. ¿Cómo has estado?',
        'Solo quería saber cómo estás y mantener el contacto.',
        'He estado pensando en ti y decidí enviarte un mensaje.',
        '¿Qué hay de nuevo en tu vida?',
      ],
    },
    [EmailTemplateType.PROFESSIONAL]: {
      'pt-BR': [
        'Gostaria de discutir uma oportunidade de negócio em {{industry}}.',
        'Acredito que podemos colaborar em projetos relacionados a {{topic}}.',
        'Com base em seu perfil profissional, gostaria de propor uma parceria.',
        'Estamos buscando especialistas em {{topic}} para um novo projeto.',
        'Sua experiência em {{industry}} chamou minha atenção e gostaria de conversar mais.',
      ],
      'en-US': [
        'I would like to discuss a business opportunity in {{industry}}.',
        'I believe we can collaborate on projects related to {{topic}}.',
        'Based on your professional profile, I would like to propose a partnership.',
        'We are looking for specialists in {{topic}} for a new project.',
        'Your experience in {{industry}} caught my attention and I would like to talk more.',
      ],
      'es-ES': [
        'Me gustaría discutir una oportunidad de negocio en {{industry}}.',
        'Creo que podemos colaborar en proyectos relacionados con {{topic}}.',
        'Basándome en su perfil profesional, me gustaría proponer una asociación.',
        'Estamos buscando especialistas en {{topic}} para un nuevo proyecto.',
        'Su experiencia en {{industry}} llamó mi atención y me gustaría hablar más.',
      ],
    },
  };
  
  private subjectLines: Record<EmailTemplateType, Record<string, string[]>> = {
    [EmailTemplateType.INTRODUCTION]: {
      'pt-BR': [
        'Apresentação: {{senderName}} - {{industry}}',
        'Olá de {{senderName}}',
        'Novo contato: {{senderName}}',
        'Prazer em conhecê-lo(a)',
        'Expandindo nossa rede profissional',
      ],
      'en-US': [
        'Introduction: {{senderName}} - {{industry}}',
        'Hello from {{senderName}}',
        'New contact: {{senderName}}',
        'Pleasure to meet you',
        'Expanding our professional network',
      ],
      'es-ES': [
        'Presentación: {{senderName}} - {{industry}}',
        'Hola de {{senderName}}',
        'Nuevo contacto: {{senderName}}',
        'Un placer conocerle',
        'Ampliando nuestra red profesional',
      ],
    },
    // Implementar para os outros tipos...
    [EmailTemplateType.FOLLOW_UP]: {
      'pt-BR': [
        'Acompanhamento: {{topic}}',
        'Continuação da nossa conversa sobre {{topic}}',
        'Novidades sobre {{topic}}',
        'Atualização sobre nosso último contato',
        'Retomando nossa conversa anterior',
      ],
      'en-US': [
        'Follow-up: {{topic}}',
        'Continuing our conversation about {{topic}}',
        'Updates on {{topic}}',
        'Update on our last contact',
        'Getting back to our previous conversation',
      ],
      'es-ES': [
        'Seguimiento: {{topic}}',
        'Continuando nuestra conversación sobre {{topic}}',
        'Novedades sobre {{topic}}',
        'Actualización sobre nuestro último contacto',
        'Retomando nuestra conversación anterior',
      ],
    },
    [EmailTemplateType.QUESTION]: {
      'pt-BR': [
        'Consulta sobre {{topic}}',
        'Pergunta sobre {{topic}}',
        'Preciso de sua ajuda com {{topic}}',
        'Dúvidas sobre {{topic}}',
        'Poderia me ajudar com {{topic}}?',
      ],
      'en-US': [
        'Inquiry about {{topic}}',
        'Question about {{topic}}',
        'I need your help with {{topic}}',
        'Questions about {{topic}}',
        'Could you help me with {{topic}}?',
      ],
      'es-ES': [
        'Consulta sobre {{topic}}',
        'Pregunta sobre {{topic}}',
        'Necesito su ayuda con {{topic}}',
        'Dudas sobre {{topic}}',
        '¿Podría ayudarme con {{topic}}?',
      ],
    },
    [EmailTemplateType.INFORMATION]: {
      'pt-BR': [
        'Informações sobre {{topic}}',
        'Dados importantes sobre {{topic}}',
        'Compartilhando informações: {{topic}}',
        'Detalhes sobre {{topic}} para sua análise',
        '{{topic}}: informações relevantes',
      ],
      'en-US': [
        'Information about {{topic}}',
        'Important data about {{topic}}',
        'Sharing information: {{topic}}',
        'Details about {{topic}} for your analysis',
        '{{topic}}: relevant information',
      ],
      'es-ES': [
        'Información sobre {{topic}}',
        'Datos importantes sobre {{topic}}',
        'Compartiendo información: {{topic}}',
        'Detalles sobre {{topic}} para su análisis',
        '{{topic}}: información relevante',
      ],
    },
    [EmailTemplateType.INVITATION]: {
      'pt-BR': [
        'Convite: {{event}} - {{date}}',
        'Você está convidado(a): {{event}}',
        'Reserve esta data: {{event}} em {{date}}',
        'Convite especial para {{event}}',
        'Gostaríamos de sua presença em {{event}}',
      ],
      'en-US': [
        'Invitation: {{event}} - {{date}}',
        'You are invited: {{event}}',
        'Save the date: {{event}} on {{date}}',
        'Special invitation to {{event}}',
        'We would like your presence at {{event}}',
      ],
      'es-ES': [
        'Invitación: {{event}} - {{date}}',
        'Está invitado/a: {{event}}',
        'Reserve esta fecha: {{event}} el {{date}}',
        'Invitación especial para {{event}}',
        'Nos gustaría contar con su presencia en {{event}}',
      ],
    },
    [EmailTemplateType.NEWSLETTER]: {
      'pt-BR': [
        'Newsletter: Novidades sobre {{topic}}',
        'Atualização mensal: {{topic}}',
        '{{topic}} - Principais acontecimentos do mês',
        'Fique por dentro das novidades em {{topic}}',
        'Resumo mensal: O que aconteceu em {{topic}}',
      ],
      'en-US': [
        'Newsletter: News about {{topic}}',
        'Monthly update: {{topic}}',
        '{{topic}} - Main events of the month',
        'Stay up to date with news on {{topic}}',
        'Monthly summary: What happened in {{topic}}',
      ],
      'es-ES': [
        'Boletín: Novedades sobre {{topic}}',
        'Actualización mensual: {{topic}}',
        '{{topic}} - Principales acontecimientos del mes',
        'Manténgase al día con las novedades en {{topic}}',
        'Resumen mensual: Lo que ocurrió en {{topic}}',
      ],
    },
    [EmailTemplateType.PRODUCT_UPDATE]: {
      'pt-BR': [
        'Novidades em {{product}}',
        '{{product}} - Nova atualização disponível',
        'Melhoramos {{product}} para você',
        'Atualizações importantes em {{product}}',
        'Confira as novas funcionalidades de {{product}}',
      ],
      'en-US': [
        'News in {{product}}',
        '{{product}} - New update available',
        'We've improved {{product}} for you',
        'Important updates in {{product}}',
        'Check out the new features of {{product}}',
      ],
      'es-ES': [
        'Novedades en {{product}}',
        '{{product}} - Nueva actualización disponible',
        'Hemos mejorado {{product}} para usted',
        'Actualizaciones importantes en {{product}}',
        'Consulte las nuevas funcionalidades de {{product}}',
      ],
    },
    [EmailTemplateType.PERSONAL]: {
      'pt-BR': [
        'Olá! Como você está?',
        'Mantendo contato',
        'Novidades?',
        'Há quanto tempo!',
        'Só para dizer olá',
      ],
      'en-US': [
        'Hi! How are you?',
        'Keeping in touch',
        'What's new?',
        'Long time no see!',
        'Just saying hello',
      ],
      'es-ES': [
        '¡Hola! ¿Cómo estás?',
        'Manteniendo el contacto',
        '¿Qué hay de nuevo?',
        '¡Cuánto tiempo!',
        'Solo para saludar',
      ],
    },
    [EmailTemplateType.PROFESSIONAL]: {
      'pt-BR': [
        'Oportunidade de negócio em {{industry}}',
        'Proposta de colaboração: {{topic}}',
        'Parceria potencial em {{industry}}',
        'Convite para projeto em {{topic}}',
        'Oportunidade profissional: {{industry}}',
      ],
      'en-US': [
        'Business opportunity in {{industry}}',
        'Collaboration proposal: {{topic}}',
        'Potential partnership in {{industry}}',
        'Invitation for project in {{topic}}',
        'Professional opportunity: {{industry}}',
      ],
      'es-ES': [
        'Oportunidad de negocio en {{industry}}',
        'Propuesta de colaboración: {{topic}}',
        'Asociación potencial en {{industry}}',
        'Invitación para proyecto en {{topic}}',
        'Oportunidad profesional: {{industry}}',
      ],
    },
  };
  
  /**
   * Gera um novo template de email
   */
  public generateTemplate(
    templateId: string,
    options: TemplateGenerationOptions
  ): EmailTemplate {
    // Validar opções
    if (!this.bodyParagraphs[options.type] || !this.bodyParagraphs[options.type][options.language]) {
      throw new Error(`Tipo de template ou idioma não suportado: ${options.type}, ${options.language}`);
    }
    
    // Gerar assunto
    const subjectLines = this.subjectLines[options.type][options.language];
    const selectedSubject = this.getRandomItem(subjectLines);
    
    // Determinar cumprimento e fechamento baseado no nível de formalidade
    const greetings = this.greetings[options.language];
    const closings = this.closings[options.language];
    const signatures = this.signatures[options.language];
    
    let greeting = '';
    let closing = '';
    let signature = '';
    
    // Se solicitado, incluir saudação
    if (options.includeGreeting) {
      greeting = this.getRandomItem(greetings);
      
      // Adicionar vírgula ou não, dependendo da formalidade
      if (options.style.formalityLevel === FormalityLevel.VERY_CASUAL) {
        greeting = greeting.endsWith('!') ? greeting : greeting + '!';
      } else {
        greeting = greeting.endsWith(',') ? greeting : greeting + ',';
      }
    }
    
    // Selecionar fechamento baseado na formalidade
    if (options.style.formalityLevel === FormalityLevel.VERY_FORMAL) {
      closing = closings.filter(c => ['Atenciosamente', 'Cordialmente', 'Sincerely', 'Regards', 'Atentamente'].includes(c))[0];
    } else if (options.style.formalityLevel === FormalityLevel.VERY_CASUAL) {
      closing = closings.filter(c => ['Abraços', 'Até mais', 'Cheers', 'Thanks', 'Saludos'].includes(c))[0];
    } else {
      closing = this.getRandomItem(closings);
    }
    
    // Se solicitado, incluir assinatura
    if (options.includeSignature) {
      signature = this.getRandomItem(signatures);
    }
    
    // Gerar parágrafos para o corpo do email
    const availableParagraphs = this.bodyParagraphs[options.type][options.language];
    const introductions = this.introductions[options.language][options.style.formalityLevel];
    
    // Selecionar número de parágrafos com base no comprimento solicitado
    const paragraphCount = options.length === 'short' ? 1 : 
                          options.length === 'medium' ? 2 : 3;
    
    // Sempre incluir uma introdução
    const selectedIntro = this.getRandomItem(introductions);
    
    // Selecionar parágrafos aleatórios para o corpo
    const shuffledParagraphs = this.shuffleArray(availableParagraphs);
    const selectedParagraphs = shuffledParagraphs.slice(0, paragraphCount);
    
    // Compor o corpo do email
    let htmlBody = '';
    let textBody = '';
    
    // Adicionar saudação
    if (greeting) {
      htmlBody += `${greeting}<br><br>`;
      textBody += `${greeting}\n\n`;
    }
    
    // Adicionar introdução
    htmlBody += `${selectedIntro}<br><br>`;
    textBody += `${selectedIntro}\n\n`;
    
    // Adicionar parágrafos
    selectedParagraphs.forEach(paragraph => {
      htmlBody += `${paragraph}<br><br>`;
      textBody += `${paragraph}\n\n`;
    });
    
    // Adicionar fechamento
    if (closing) {
      htmlBody += `${closing},<br>`;
      textBody += `${closing},\n`;
      
      if (signature) {
        htmlBody += `${signature}`;
        textBody += `${signature}`;
      }
    }
    
    // Criar e retornar o template
    const template: EmailTemplate = {
      subject: selectedSubject,
      htmlBody,
      textBody,
      variables: options.variables || [
        'senderName', 
        'receiverName', 
        'senderEmail', 
        'receiverEmail',
        'industry',
        'topic',
        'product',
        'event',
        'date'
      ]
    };
    
    return template;
  }
  
  /**
   * Gera variações de um template existente
   */
  public generateVariations(
    baseTemplate: EmailTemplate, 
    count: number = 3
  ): EmailTemplate[] {
    const variations: EmailTemplate[] = [baseTemplate];
    
    // Gerar variações adicionais
    for (let i = 1; i < count; i++) {
      const variation: EmailTemplate = {
        subject: this.createVariation(baseTemplate.subject),
        htmlBody: this.createVariation(baseTemplate.htmlBody),
        textBody: this.createVariation(baseTemplate.textBody),
        variables: baseTemplate.variables,
        attachments: baseTemplate.attachments
      };
      
      variations.push(variation);
    }
    
    return variations;
  }
  
  /**
   * Cria uma variação de um texto
   */
  private createVariation(text: string): string {
    // Implementação básica: pequenas modificações no texto
    
    // 1. Chance de adicionar ou remover espaços
    const spaceVariation = Math.random() > 0.7;
    if (spaceVariation) {
      if (Math.random() > 0.5) {
        // Adicionar espaço extra
        text = text.replace('. ', '.  ').replace(', ', ',  ');
      } else {
        // Remover espaço extra
        text = text.replace('  ', ' ');
      }
    }
    
    // 2. Chance de alterar pontuação
    const punctuationVariation = Math.random() > 0.7;
    if (punctuationVariation) {
      if (Math.random() > 0.5) {
        // Adicionar ênfase
        text = text.replace('!', '!!').replace('?', '??');
      } else {
        // Suavizar
        text = text.replace('!!', '!').replace('??', '?');
      }
    }
    
    // 3. Chance de adicionar erro de digitação
    const typoVariation = Math.random() > 0.8;
    if (typoVariation) {
      // Selecionar uma palavra aleatória
      const words = text.split(' ');
      if (words.length > 3) {
        const randomIndex = Math.floor(Math.random() * words.length);
        const word = words[randomIndex];
        
        if (word.length > 3) {
          // Gerar erro: trocar letras, duplicar letra, etc.
          const errorType = Math.floor(Math.random() * 3);
          
          if (errorType === 0 && word.length > 3) {
            // Trocar letras adjacentes
            const pos = Math.floor(Math.random() * (word.length - 2)) + 1;
            const newWord = word.substring(0, pos) + 
                          word.charAt(pos + 1) + 
                          word.charAt(pos) + 
                          word.substring(pos + 2);
            words[randomIndex] = newWord;
          } else if (errorType === 1) {
            // Duplicar letra
            const pos = Math.floor(Math.random() * word.length);
            const newWord = word.substring(0, pos) + 
                          word.charAt(pos) + 
                          word.substring(pos);
            words[randomIndex] = newWord;
          } else {
            // Omitir letra
            const pos = Math.floor(Math.random() * word.length);
            const newWord = word.substring(0, pos) + 
                          word.substring(pos + 1);
            words[randomIndex] = newWord;
          }
        }
      }
      
      text = words.join(' ');
    }
    
    return text;
  }
  
  /**
   * Embaralha um array (algoritmo Fisher-Yates)
   */
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  
  /**
   * Obtém um item aleatório de um array
   */
  private getRandomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }
}