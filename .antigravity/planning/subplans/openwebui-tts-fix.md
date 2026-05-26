# Subplano: Ajuste de Voz/Modelo TTS para OpenWebUI

## Objetivo
Permitir que o usuário insira o ID da voz personalizada no campo "Voz TTS" (ou selecione dinamicamente) em vez do campo "Modelo TTS" no OpenWebUI.

## Arquivos Afetados
- `backend/app/main.py` (criação de endpoints e ajuste na lógica de leitura do payload)

## Etapas de Implementação

### 1. Ajustar o Endpoint `/v1/audio/speech`
- Alterar a lógica para verificar prioritariamente o campo `voice`.
- Se o campo `voice` for vazio ou for um dos nomes padrões do OpenAI (`alloy`, `echo`, etc.), usar o campo `model` como fallback (caso o usuário tenha configurado no modelo como antes).
- Se `model` não começar com `tts-`, considerá-lo como o clone ID.
- **Status: [DONE]**

### 2. Implementar Endpoint `/v1/audio/voices` (GET)
- Retornar uma lista simples dos IDs das vozes cadastradas no banco SQLite no formato:
  `{"voices": [<voice_ids>]}`
- Isso permitirá que o OpenWebUI popule dinamicamente o dropdown de vozes quando o motor "Custom TTS" for selecionado.
- **Status: [DONE]**

### 3. Implementar Endpoint `/v1/models` (GET)
- Retornar uma lista de modelos no padrão OpenAI (`tts-1`, `tts-1-hd`) combinada com as vozes disponíveis, garantindo compatibilidade total com clientes que validam os modelos.
- **Status: [DONE]**

## Status da Implementação
- [x] Ajustar lógica em `/v1/audio/speech`
- [x] Implementar `/v1/audio/voices`
- [x] Implementar `/v1/models`
- [ ] Validar e gerar logs de alteração
