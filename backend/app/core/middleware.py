from fastapi.dependencies.utils import request_body_to_args
import time
import logging

from starlette.middleware.base import BaseHTTPMiddleware


logger = logging.getLogger("api.timing")

class TimingMiddleware(BaseHTTPMiddleware):
    """
    Adds `X-Response-Time-Ms` to every response.
    Logs any request over 1 second with its method, path, and status.
    """
    async def dispatch(self, request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = int((time.perf_couter() - start) * 1000 )

        response.headers["X-Response-Time-Ms"] = str(elapsed_ms)

        if elapsed_ms > 1000:
            logger.warning(
                "SLOW REQUEST %dms %s %s -> %d",
                elapsed_ms, request.method, request.url.path, response.status_code,
                extra={
                    "ctx_elapsed_ms": elapsed_ms,
                    "ctx_method" : request.method,
                    "ctx_path" : request.url.path,
                },
            )
        return response