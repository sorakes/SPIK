# Tech Stack

## Backend
- **Language**: Python 3.10+
- **Framework**: FastAPI
- **Database**: SQLite (local database for voices and jobs audit)
- **Task Queue**: Celery (using Redis as broker)
- **Caching/Broker**: Redis

## Frontend
- **Language**: JavaScript (ES6+)
- **Framework**: React (Vite build system)
- **Styling**: Custom CSS (Glassmorphism design system)

## Infrastructure
- **Containerization**: Single-container Docker managed via Supervisord
- **Orchestration**: Docker Compose
