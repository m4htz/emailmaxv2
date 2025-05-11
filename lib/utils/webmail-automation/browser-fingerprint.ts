/**
 * Sistema de fingerprinting de navegador para automação de webmail
 * Gera e gerencia fingerprints únicos e realistas para evitar detecção
 */

import crypto from 'crypto';

export interface BrowserFingerprint {
  userAgent: string;
  screenResolution: { width: number; height: number };
  colorDepth: number;
  timezone: string;
  platform: string;
  plugins: string[];
  fonts: string[];
  canvas: string; // Hash do fingerprint de canvas
  webgl: string;  // Hash do fingerprint de WebGL
  hardwareConcurrency: number;
  deviceMemory?: number;
  language: string;
  cookieEnabled: boolean;
  doNotTrack?: string;
  touchPoints?: number;
  hardwareAcceleration: boolean;
}

export interface FingerprintOptions {
  platform?: 'windows' | 'mac' | 'linux' | 'android' | 'ios';
  browserBase?: 'chrome' | 'firefox' | 'safari' | 'edge';
  browserVersionMin?: number;
  browserVersionMax?: number;
  randomizeOnEachUse?: boolean;
  consistentForAccount?: boolean;
  uniqueIdentifier?: string; // Para gerar fingerprints consistentes por conta
}

/**
 * Classe para geração e gestão de fingerprints de navegador
 */
export class BrowserFingerprintGenerator {
  private options: FingerprintOptions;
  private cachedFingerprint: BrowserFingerprint | null = null;

  constructor(options: FingerprintOptions = {}) {
    this.options = {
      platform: options.platform || this.getRandomItem(['windows', 'mac']) as 'windows' | 'mac',
      browserBase: options.browserBase || this.getRandomBrowser(),
      browserVersionMin: options.browserVersionMin || 90,
      browserVersionMax: options.browserVersionMax || 125,
      randomizeOnEachUse: options.randomizeOnEachUse !== undefined ? options.randomizeOnEachUse : false,
      consistentForAccount: options.consistentForAccount !== undefined ? options.consistentForAccount : true,
      uniqueIdentifier: options.uniqueIdentifier
    };
  }

  /**
   * Gera um fingerprint de navegador completo
   */
  public generateFingerprint(): BrowserFingerprint {
    // Se já existe um fingerprint em cache e não precisamos randomizar, retorne o cache
    if (this.cachedFingerprint && !this.options.randomizeOnEachUse) {
      return this.cachedFingerprint;
    }

    const userAgent = this.generateUserAgent();
    const fingerprint: BrowserFingerprint = {
      userAgent,
      screenResolution: this.generateScreenResolution(),
      colorDepth: 24,
      timezone: this.generateTimezone(),
      platform: this.getPlatformString(),
      plugins: this.generatePluginList(),
      fonts: this.generateFontList(),
      canvas: this.generateCanvasHash(),
      webgl: this.generateWebGLHash(),
      hardwareConcurrency: this.generateHardwareConcurrency(),
      language: this.generateLanguage(),
      cookieEnabled: true,
      hardwareAcceleration: true
    };

    // Adicionar propriedades específicas com base no navegador
    if (this.options.browserBase === 'chrome' || this.options.browserBase === 'edge') {
      fingerprint.deviceMemory = this.getRandomItem([2, 4, 8, 16]);
    }

    if (this.options.browserBase !== 'safari') {
      fingerprint.doNotTrack = this.getRandomItem(['0', '1', null]);
    }

    // Salvar em cache se consistente
    if (this.options.consistentForAccount) {
      this.cachedFingerprint = fingerprint;
    }

    return fingerprint;
  }

  /**
   * Gera um User-Agent realista com base nas opções configuradas
   */
  private generateUserAgent(): string {
    const platform = this.options.platform;
    const browser = this.options.browserBase;
    const version = this.getRandomInt(
      this.options.browserVersionMin!,
      this.options.browserVersionMax!
    );

    // Construir User-Agent específico para cada combinação de navegador/plataforma
    switch (browser) {
      case 'chrome':
        if (platform === 'windows') {
          return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
        } else if (platform === 'mac') {
          return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
        } else if (platform === 'linux') {
          return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
        } else if (platform === 'android') {
          return `Mozilla/5.0 (Linux; Android 12; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Mobile Safari/537.36`;
        }
        break;

      case 'firefox':
        const ffVersion = this.getRandomInt(90, 120);
        if (platform === 'windows') {
          return `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${ffVersion}.0) Gecko/20100101 Firefox/${ffVersion}.0`;
        } else if (platform === 'mac') {
          return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${ffVersion}.0) Gecko/20100101 Firefox/${ffVersion}.0`;
        } else if (platform === 'linux') {
          return `Mozilla/5.0 (X11; Linux i686; rv:${ffVersion}.0) Gecko/20100101 Firefox/${ffVersion}.0`;
        }
        break;

      case 'safari':
        const safariVersion = this.getRandomInt(14, 17);
        const safariSubVersion = this.getRandomInt(0, 9);
        return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safariVersion}.${safariSubVersion} Safari/605.1.15`;

      case 'edge':
        const edgeVersion = this.getRandomInt(90, 125);
        return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36 Edg/${edgeVersion}.0.0.0`;
    }

    // Fallback para Chrome no Windows
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
  }

  /**
   * Gera uma resolução de tela realista
   */
  private generateScreenResolution(): { width: number; height: number } {
    const commonResolutions = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
      { width: 1680, height: 1050 },
      { width: 1280, height: 720 },
      { width: 1280, height: 800 }
    ];

    return this.getRandomItem(commonResolutions);
  }

  /**
   * Gera um fuso horário realista
   */
  private generateTimezone(): string {
    const timezones = [
      '-12:00', '-11:00', '-10:00', '-09:00', '-08:00', '-07:00', '-06:00',
      '-05:00', '-04:00', '-03:00', '-02:00', '-01:00', '+00:00', '+01:00',
      '+02:00', '+03:00', '+04:00', '+05:00', '+06:00', '+07:00', '+08:00',
      '+09:00', '+10:00', '+11:00', '+12:00'
    ];

    return this.getRandomItem(timezones);
  }

  /**
   * Retorna a string da plataforma baseada na opção selecionada
   */
  private getPlatformString(): string {
    switch (this.options.platform) {
      case 'windows': return 'Win32';
      case 'mac': return 'MacIntel';
      case 'linux': return 'Linux x86_64';
      case 'android': return 'Android';
      case 'ios': return 'iPhone';
      default: return 'Win32';
    }
  }

  /**
   * Gera uma lista realista de plugins para o navegador
   */
  private generatePluginList(): string[] {
    const basePlugins = ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer'];
    
    if (this.options.browserBase === 'chrome') {
      return [...basePlugins, 'Native Client'];
    } else if (this.options.browserBase === 'firefox') {
      return [];
    } else if (this.options.browserBase === 'safari') {
      return [];
    } else if (this.options.browserBase === 'edge') {
      return [...basePlugins, 'Microsoft Edge PDF Viewer'];
    }
    
    return basePlugins;
  }

  /**
   * Gera uma lista realista de fontes disponíveis
   */
  private generateFontList(): string[] {
    const commonFonts = [
      'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Courier New',
      'Courier', 'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman',
      'Tahoma', 'Trebuchet MS', 'Impact', 'Comic Sans MS', 'Calibri'
    ];

    // Gerar um subconjunto aleatório da lista
    const numFonts = this.getRandomInt(8, 15);
    const selectedFonts: string[] = [];
    
    for (let i = 0; i < numFonts; i++) {
      const font = this.getRandomItem(commonFonts);
      if (!selectedFonts.includes(font)) {
        selectedFonts.push(font);
      }
    }
    
    return selectedFonts;
  }

  /**
   * Gera um hash simulando o fingerprint de canvas
   */
  private generateCanvasHash(): string {
    // Se tivermos um identificador único, usá-lo para consistência
    if (this.options.uniqueIdentifier && this.options.consistentForAccount) {
      return this.hashString(`canvas_${this.options.uniqueIdentifier}_${this.options.browserBase}`);
    }
    
    // Caso contrário, gerar um hash aleatório
    return this.hashString(`canvas_${this.getRandomInt(1, 1000000)}_${Date.now()}`);
  }

  /**
   * Gera um hash simulando o fingerprint de WebGL
   */
  private generateWebGLHash(): string {
    // Se tivermos um identificador único, usá-lo para consistência
    if (this.options.uniqueIdentifier && this.options.consistentForAccount) {
      return this.hashString(`webgl_${this.options.uniqueIdentifier}_${this.options.browserBase}`);
    }
    
    // Caso contrário, gerar um hash aleatório
    return this.hashString(`webgl_${this.getRandomInt(1, 1000000)}_${Date.now()}`);
  }

  /**
   * Gera um valor realista para o número de núcleos do CPU
   */
  private generateHardwareConcurrency(): number {
    return this.getRandomItem([2, 4, 6, 8, 12, 16]);
  }

  /**
   * Gera um idioma aleatório para o navegador
   */
  private generateLanguage(): string {
    const languages = ['pt-BR', 'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT'];
    return this.getRandomItem(languages);
  }

  /**
   * Escolhe um navegador aleatório
   */
  private getRandomBrowser(): 'chrome' | 'firefox' | 'safari' | 'edge' {
    const browsers: ('chrome' | 'firefox' | 'safari' | 'edge')[] = ['chrome', 'firefox', 'safari', 'edge'];
    // Maior probabilidade para Chrome
    const weights = [70, 15, 10, 5];
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const random = this.getRandomInt(1, totalWeight);
    
    let cumulativeWeight = 0;
    for (let i = 0; i < browsers.length; i++) {
      cumulativeWeight += weights[i];
      if (random <= cumulativeWeight) {
        return browsers[i];
      }
    }
    
    return 'chrome';
  }

  /**
   * Utilitário para selecionar um item aleatório de um array
   */
  private getRandomItem<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  /**
   * Utilitário para gerar um número inteiro aleatório dentro de um intervalo
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Cria um hash a partir de uma string
   */
  private hashString(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }
}