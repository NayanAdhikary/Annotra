"""
Central logging setup. Call `configure_logging()` once at the top of main.py
and workers/__init__.py before anything else runs.

Format:
  - In development (ENVIRONMENT=development): human-readable
  - In production: JSON, one object per line — ready for Loki / Datadog / ELK
"""
from app.config import settings
import logging
import sys
import json
from datetime import datetime, timezone

class HumanFormatter(logging.Formatter):
    """ Colored, readable output for local dev. """

    COLORS = {
        "DEBUG": "\033[36m",     # cyan
        "INFO": "\033[32m",      # green
        "WARNING": "\033[33m",   # yellow
        "ERROR": "\033[31m",     # red
        "CRITICAL": "\033[35m",  # magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        name = record.name
        msg = record.getMessage()
        line = f"{color}{record.levelname:<8}{self.RESET} {ts}  {name:<24} {msg}"
        if record.exc_info:
            line += "\n" + self.formatException(record.exc_info)
        return line

class JsonFormatter(logging.Formatter):
    "One JSON object per line, ready for log aggregators."

    def format(self, record: logging.LogRecord) -> str:
        obj = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "env": settings.ENVIRONMENT,
            "release": settings.RELEASE,
        }
        if record.exc_info:
            obj["exception"] = self.formatException(record.exc_info)
            #Execute fields added via logger.info("msg", extra={...})
            for k, v in record.__dict__.items():
                if k.startswith("ctx_"):
                    obj[k[4:]] = v
            return json.dumps(obj)


def configure_logging() -> None:
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    if settings.ENVIRONMENT == "development":
        handler.setFormatter(HumanFormatter())
    else:
        handler.setFormatter(JsonFormatter())


    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)

    #Quieten noisy third-party loggers
    for noisy in ("uvicorn.access", "httpx", "httpcore", "botocore", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    # SQLAlchemy is verbose at INFO; you'll enable it explicitly when debugging
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)