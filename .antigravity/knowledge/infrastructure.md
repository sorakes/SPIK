# Infrastructure Map

## Container Configurations
- **Web UI & API External Port**: `7512`
- **Internal FastAPI Port**: `8000`
- **Database Path**: `/app/data/spik.db`
- **Outputs Path (Generated Audio)**: `/app/data/outputs`
- **Uploads Path**: `/app/data/uploads`

## Integrations
- **OpenWebUI Endpoint**: `http://host.docker.internal:7512/v1`
- **OpenAI-Compatible Paths**:
  - `/v1/audio/speech` (POST)
  - `/v1/audio/voices` (GET)
  - `/v1/models` (GET)
