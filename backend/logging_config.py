import logging
import json
import os
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Emits one JSON object per log record with a fixed set of fields."""

    _SKIP_ATTRS = frozenset({
        "name", "msg", "args", "levelname", "levelno", "pathname",
        "filename", "module", "exc_info", "exc_text", "stack_info",
        "lineno", "funcName", "created", "msecs", "relativeCreated",
        "thread", "threadName", "processName", "process", "message",
        "taskName",
    })

    def format(self, record: logging.LogRecord) -> str:
        record.message = record.getMessage()
        entry: dict = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.message,
        }
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        # Attach any extra fields passed via extra={...}
        for key, value in record.__dict__.items():
            if key not in self._SKIP_ATTRS:
                entry[key] = value
        return json.dumps(entry, default=str)


def setup_logging() -> None:
    """Configure root logger. Call once at application startup."""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    log_format = os.getenv("LOG_FORMAT", "json")

    handler = logging.StreamHandler()
    if log_format == "json":
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        ))

    logging.basicConfig(level=log_level, handlers=[handler], force=True)

    # Silence noisy third-party loggers
    for noisy in ("motor", "pymongo", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
