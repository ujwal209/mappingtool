from fastapi import APIRouter
from datetime import datetime, timezone
import platform
import sys

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "python_version": sys.version,
        "platform": platform.platform(),
    }
