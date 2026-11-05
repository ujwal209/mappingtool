# FastAPI Backend (Powered by uv)

FastAPI backend application for the Mapping project.

## Getting Started

### 1. Requirements
- Python 3.10+ (Current: Python 3.14)
- [`uv`](https://github.com/astral-sh/uv) package manager

### 2. Running the Development Server
From the `backend` directory:

```bash
uv run uvicorn app.main:app --reload --port 8000
```

### 3. API Documentation
Once the server is running:
- **Interactive Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc UI**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check**: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)
- **Sample Items**: [http://127.0.0.1:8000/api/v1/items](http://127.0.0.1:8000/api/v1/items)

### 4. Managing Dependencies with `uv`
- **Add a dependency**: `uv add <package-name>`
- **Add dev dependency**: `uv add --dev <package-name>`
- **Remove a dependency**: `uv remove <package-name>`
- **Sync dependencies**: `uv sync`
