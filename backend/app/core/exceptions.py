"""
Centralized error handling.

Design:
  - HTTPException → passed through unchanged (FastAPI already formats these)
  - RequestValidationError → flattened into a friendly field-error list
  - Everything else → logged with an ID, sent to Sentry, returned as 500
    with a friendly message and the same ID so the user can reference it
"""
import logging
import uuid

from fastapi import Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR, HTTP_422_UNPROCESSABLE_ENTITY

import sentry_sdk

logger = logging.getLogger("api.errors")


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Pass through but ensure a `message` field is always present."""
    detail = exc.detail
    if isinstance(detail, str):
        body = {"message": detail}
    elif isinstance(detail, dict):
        body = {"message": detail.get("message", "Request failed"), **detail}
    else:
        body = {"message": "Request failed", "detail": detail}
    return JSONResponse(status_code=exc.status_code, content=body,
                        headers=getattr(exc, "headers", None))


async def validation_exception_handler(
    request: Request, exc: RequestValidationError,
) -> JSONResponse:
    """Flatten pydantic errors into a list the frontend can render next to fields."""
    errors = []
    for err in exc.errors():
        loc = ".".join(str(p) for p in err["loc"] if p != "body")
        errors.append({
            "field": loc or "(root)",
            "message": err["msg"],
            "type": err["type"],
        })
    return JSONResponse(
        status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        content={"message": "Please check the highlighted fields", "errors": errors},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Last-resort handler. Never leaks the traceback to the client.
    Sends to Sentry with a request-scoped correlation ID.
    """
    error_id = str(uuid.uuid4())[:8]

    logger.exception(
        "Unhandled [%s] %s %s",
        error_id, request.method, request.url.path,
        extra={"ctx_error_id": error_id, "ctx_path": request.url.path},
    )

    if sentry_sdk.Hub.current.client:
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("error_id", error_id)
            scope.set_context("request", {
                "method": request.method,
                "path": request.url.path,
                "query": str(request.query_params),
            })
            sentry_sdk.capture_exception(exc)

    return JSONResponse(
        status_code=HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "message": "Something went wrong. Our team has been notified.",
            "error_id": error_id,
        },
    )