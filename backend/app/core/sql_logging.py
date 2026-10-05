"""
Attaches SQLAlchemy event listeners to log any query taking longer than
SLOW_QUERY_THRESHOLD_MS. Wired into the engine from database.py.
"""
import logging
import time

from sqlalchemy import event

logger = logging.getLogger("sql.slow")

SLOW_QUERY_THRESHOLD_MS = 500


def attach_slow_query_logger(engine) -> None:
    """Call once after the engine is created."""

    @event.listens_for(engine.sync_engine, "before_cursor_execute")
    def _before(conn, cursor, statement, parameters, context, executemany):
        conn.info.setdefault("query_start", []).append(time.perf_counter())

    @event.listens_for(engine.sync_engine, "after_cursor_execute")
    def _after(conn, cursor, statement, parameters, context, executemany):
        starts = conn.info.get("query_start") or []
        if not starts:
            return
        total = time.perf_counter() - starts.pop()
        ms = int(total * 1000)
        if ms >= SLOW_QUERY_THRESHOLD_MS:
            logger.warning(
                "SLOW QUERY %dms | %.300s",
                ms, statement.replace("\n", " ").strip(),
                extra={"ctx_query_ms": ms, "ctx_statement": statement[:200]},
            )