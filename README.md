# 🎙️ SPIK Voice Platform

**Optimized for Fast Voice Cloning and API Integration (OpenAI Standard)**

SPIK is an "All-in-One" voice synthesis and cloning platform, encapsulated in a single Docker container. It brings the intelligence of OmniVoice with an elegant management panel for you to generate dozens of clones and integrate them perfectly with your ecosystem (like OpenWebUI), maintaining complete auditing without overloading your hard drive.

---

## 🚀 Features and Advantages

- **Single-Container Architecture**: OmniVoice, the processing queue (Celery/Redis), the API, and the interface panel (React) spin up in a snap, together in the same secure environment.
- **Zero-Shot Cloning**: Clone any voice with less than 10 seconds of audio directly through the interface.
- **"Jobs Queue" Audit**: Technical history and request queue that allows you to see everything being processed "under the hood" by the API (without bloating the disk with temporary audio files).
- **Native OpenAI Compatibility**: A `/v1/audio/speech` route that simulates the OpenAI API. Your clones instantly become native models in OpenWebUI!
- **Clean & Dark Interface**: A premium Glassmorphism panel that makes it easy to manipulate the TTS studio and your Voice Bank.

---

## 🛠️ How to Start (Deploy)

You don't need to install dependencies on your computer. All you need is Docker installed.

1. **Spin up the container** using Docker Compose in the root folder:
   ```bash
   docker-compose up --build -d
   ```

2. **Access the web interface**:
   - Open your browser and go to: `http://localhost:7512`
   - *The interface will be empty and ready for your first clone!*

---

## 🧩 How to Use in OpenWebUI (Chatbot)

SPIK was designed to perfectly power the voices of your AI agents in **OpenWebUI**. To integrate:

1. Access the SPIK web panel at `http://localhost:7512` and create the voice clone you want.
2. In the **Voice Bank** tab, copy the unique ID of the generated clone (e.g., `clone_0817...`).
3. Open **OpenWebUI** and go to: **Admin Panel / Settings → Audio**.
4. Fill in the fields exactly like this:
   - **Text-to-Speech Engine**: Select `Custom TTS` (or `OpenAI`).
   - **API Base URL**: Paste `http://host.docker.internal:7512/v1` *(this ensures that OpenWebUI, if running via Docker, finds SPIK on your host network)*.
   - **API Key**: Paste `sk-spik-12345`.
   - **TTS Voice**: Select or enter the **Clone ID** (e.g., `clone_0817...`). SPIK now lists cloned voices dynamically, allowing direct selection in this field.
   - **TTS Model**: Fill with the default model (e.g., `tts-1` or `tts-1-hd`). It is no longer necessary to paste the clone ID here.

> Requests that OpenWebUI sends to SPIK will appear in real-time in the **Jobs Queue** of your SPIK web interface under the red **API_TTS** tag.

---

## 📁 Repository Structure

- `/frontend/` – React code for the Glassmorphism Panel. The build is generated inside the container.
- `/backend/` – The Python heart (FastAPI + Celery) that handles OmniVoice.
- `/data/` – Local volumes (SQLite Database, Uploads, Outputs). Already properly configured in `.gitignore`.
- `Dockerfile` and `supervisord-mega.conf` – The infrastructure that ties all the magic together in a single container.

---

✨ *Developed for high-performance and lightweight environments.*
