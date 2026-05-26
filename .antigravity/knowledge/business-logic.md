# Business Logic

## Domain
- **SPIK** is a voice cloning and synthesis (TTS) platform.
- **Clones**: Zero-shot voice cloning using short audio samples (less than 10 seconds).
- **Jobs**: Tracked and audited tasks (CLONE, TTS, PREVIEW, API_TTS) running via Celery queue.
- **API Access**: Standard OpenAI-compatible format to allow drop-in integration with chat clients like OpenWebUI.
