# Change Set: TTS Compatibility Fix for OpenWebUI

## Descrição da Alteração
Adicionados novos endpoints de listagem de vozes e modelos compatíveis com o padrão OpenAI e com a integração "Custom TTS" do OpenWebUI. A lógica de resolução de voz no endpoint `/v1/audio/speech` foi aprimorada para priorizar o parâmetro `voice` quando este contiver uma voz personalizada, mantendo compatibilidade retroativa com o parâmetro `model`.

## Arquivos Modificados
* `backend/app/main.py`

## Endpoints Adicionados / Modificados
1. **`GET /v1/audio/voices`** e **`GET /v1/voices`**: Retorna uma lista dos IDs de todas as vozes cadastradas no banco de dados.
   * Exemplo de resposta: `{"voices": ["clone_abc123", "clone_xyz789"]}`
2. **`GET /v1/models`**: Retorna uma lista de modelos (`tts-1`, `tts-1-hd`) combinada com as vozes disponíveis para clientes que requerem validação de modelo.
3. **`POST /v1/audio/speech`**: Processa a geração de áudio. Prioriza a voz personalizada informada em `voice` caso não seja uma das vozes padrão da OpenAI (`alloy`, `echo`, etc.). Caso contrário, usa o `model`.

## Impacto no Sistema
* **Automação no OpenWebUI**: Ao selecionar o mecanismo "Custom TTS" e apontar a URL base para o SPIK (`http://host.docker.internal:7512/v1`), o OpenWebUI carregará automaticamente as vozes do SPIK no dropdown de seleção de vozes.
* **Compatibilidade Retroativa**: Configurações legadas onde o ID da voz era digitado no campo "Modelo TTS" continuam funcionando normalmente.
