# 🎙️ SPIK Voice Platform

**Otimizado para Clonagem de Voz Rápida e Integração via API (Padrão OpenAI)**

O SPIK é uma plataforma de síntese e clonagem de voz "All-in-One", encapsulada em um único container Docker. Ele traz a inteligência do OmniVoice com um painel de gerenciamento elegante para você gerar dezenas de clones e integrá-los perfeitamente com seu ecossistema (como o OpenWebUI), mantendo auditoria completa sem sobrecarregar seu disco rígido.

---

## 🚀 Recursos e Vantagens

- **Single-Container Architecture**: O OmniVoice, a fila de processamento (Celery/Redis), a API e o painel de interface (React) sobem num estalar de dedos, juntos num mesmo ambiente seguro.
- **Clonagem Zero-Shot**: Clona qualquer voz com menos de 10 segundos de áudio diretamente pela interface.
- **Auditoria "Jobs Queue"**: Histórico técnico e fila de requisições que permite ver tudo o que está sendo processado "por baixo dos panos" pela API (sem engordar o disco com arquivos de áudio temporários).
- **Compatibilidade Nativa com OpenAI**: Uma rota `/v1/audio/speech` que simula a API da OpenAI. Seus clones viram modelos nativos do OpenWebUI instantaneamente!
- **Interface Clean & Dark**: Um painel Glassmorphism premium que facilita a manipulação do estúdio TTS e do seu Banco de Vozes.

---

## 🛠️ Como Iniciar (Deploy)

Você não precisa instalar dependências no seu computador. Tudo de que você precisa é do Docker instalado.

1. **Suba o container** usando o Docker Compose na pasta raiz:
   ```bash
   docker-compose up --build -d
   ```

2. **Acesse a interface web**:
   - Abra o navegador e vá em: `http://localhost:7512`
   - *A interface estará zerada e pronta para o seu primeiro clone!*

> **Nota de Rede:** O SPIK roda internamente na porta `8000`, mas para não dar conflito com outras aplicações que você tenha (como o próprio OpenWebUI), o `docker-compose.yml` mapeia tudo com segurança para a porta **7512** na sua máquina.

---

## 🧩 Como Usar no OpenWebUI (Chatbot)

O SPIK foi projetado para alimentar perfeitamente as vozes dos seus agentes de IA no **OpenWebUI**. Para integrar:

1. Acesse o painel web do SPIK em `http://localhost:7512` e crie a clonagem da voz que deseja.
2. Na aba **Voice Bank (Banco de Vozes)**, copie o ID exclusivo do clone gerado (ex: `clone_0817...`).
3. Abra o **OpenWebUI** e vá em: **Admin Panel / Configurações → Áudio (Audio)**.
4. Preencha os campos exatamente assim:
   - **Motor de Texto para Fala**: Selecione `OpenAI`.
   - **URL Base da API**: Cole `http://host.docker.internal:7512/v1` *(isso garante que o OpenWebUI, caso esteja via Docker, ache o SPIK na sua rede host)*.
   - **Chave da API**: Cole `sk-spik-12345`.
   - **Voz TTS**: Pode escrever `alloy` ou qualquer outro nome fictício (o SPIK ignora esse campo).
   - **Modelo TTS**: Cole o **ID do Clone** copiado no passo 2.

> As requisições que o OpenWebUI enviar para o SPIK vão aparecer em tempo real lá na **Jobs Queue** da sua interface web do SPIK sob a etiqueta vermelha de **API_TTS**.

---

## 📁 Estrutura do Repositório

- `/frontend/` – Código React do Painel Glassmorphism. O build é gerado dentro do container.
- `/backend/` – O coração Python (FastAPI + Celery) que lida com o OmniVoice.
- `/data/` – Volumes locais (Banco de Dados SQLite, Uploads, Outputs). Já devidamente configurado no `.gitignore`.
- `Dockerfile` e `supervisord-mega.conf` – A infraestrutura que une a mágica toda em um container só.

---

✨ *Desenvolvido para ambientes de alta performance e consumo leve.*
