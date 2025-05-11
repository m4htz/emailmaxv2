# Gerenciamento de Dependências

## Sobre o arquivo requirements.txt

Este diretório contém um `requirements.txt` que é uma cópia idêntica do arquivo na raiz do projeto. 

### Importante
- O arquivo principal de dependências é o `/requirements.txt` na raiz do projeto
- Ao adicionar ou atualizar dependências, SEMPRE faça isso no arquivo da raiz e depois copie para esta pasta
- **NÃO** modifique apenas este arquivo, pois isso quebrará a sincronização

### Para manter os arquivos sincronizados

Após modificar o arquivo na raiz, execute o seguinte comando:

```bash
cp /path/to/EmailMaxV2/requirements.txt /path/to/EmailMaxV2/imap-smtp-validator/requirements.txt
```

### Por que dois arquivos?

Mantemos duas cópias por motivos de:
1. Compatibilidade com Docker/scripts automatizados que esperam um requirements.txt local
2. Permitir a execução isolada do microserviço quando necessário
3. Evitar caminhos relativos que podem quebrar em alguns ambientes

O arquivo na raiz contém todas as dependências necessárias para o projeto completo, incluindo o microserviço de validação IMAP/SMTP.