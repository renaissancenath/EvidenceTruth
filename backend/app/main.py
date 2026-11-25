"""EvidenceTruth API + web app server."""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import AsyncIterator
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles

from app.api import routes_account, routes_auth, routes_checks
from app.config import get_settings
from app.db import SessionLocal
from app.errors import ApiError
from app.security import ClientVersionCheck, OriginCheck, SecurityHeaders
from app.telemetry.monitor import capture, configure_logging, init_sentry

WEB_DIST = Path(__file__).resolve().parent.parent / "web"  # frontend build is copied here (see Dockerfile)
WEB_PREFIXES = {"", "app", "login", "auth", "report", "pricing", "privacy", "terms"}  # website routes (frontend/src/router.tsx)


async def _retention_loop() -> None:
    while True:
        db = SessionLocal()
        try:
            routes_account.purge_expired(db)
        except Exception as exc:  # noqa: BLE001
            capture(db, exc, "retention_job", "RETENTION_FAILED")
        finally:
            db.close()
        await asyncio.sleep(3600)


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    init_sentry()
    task = asyncio.create_task(_retention_loop()) if get_settings().env != "test" else None
    yield
    if task:
        task.cancel()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="EvidenceTruth API", version=s.version, lifespan=lifespan, docs_url=None if s.is_prod else "/v1/docs", redoc_url=None, openapi_url="/v1/openapi.json")
    app.add_middleware(OriginCheck)
    app.add_middleware(ClientVersionCheck)
    app.add_middleware(SecurityHeaders)
    origins = sorted(s.allowed_extension_origins) + ([] if s.is_prod else ["http://localhost:5173"])
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-ET-CSRF", "X-ET-Client"],
    )

    @app.exception_handler(ApiError)
    async def api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse({"code": exc.code, "message": exc.message, "hint": exc.hint}, status_code=exc.status, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [{"field": ".".join(str(x) for x in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
        return JSONResponse({"code": "VALIDATION", "message": "Some fields are not valid.", "hint": None, "fields": fields}, status_code=400)

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception) -> JSONResponse:
        db = SessionLocal()
        try:
            fp = capture(db, exc, request.url.path)
        finally:
            db.close()
        return JSONResponse({"code": "INTERNAL", "message": "Something went wrong on our side.", "hint": f"It was recorded as {fp[:8]}. Try again, or report it with this code."}, status_code=500)

    app.include_router(routes_auth.router)
    app.include_router(routes_checks.router)
    app.include_router(routes_account.router)

    if WEB_DIST.exists():
        app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")

        @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
        async def spa(path: str) -> FileResponse:
            if path == "v1" or path.startswith("v1/"):
                raise ApiError(404, "NOT_FOUND", "There is no such API route.", None)
            f = (WEB_DIST / path).resolve()
            if path and f.is_file() and WEB_DIST.resolve() in f.parents:
                return FileResponse(f)
            return FileResponse(WEB_DIST / "index.html", headers={"Cache-Control": "no-cache"})

    else:
        # The website isn't built into this server (development: Vite serves it on ET_PUBLIC_URL). A website link that
        # arrives here, such as a report link from the desktop app, is sent on to the website instead of a bare 404.
        @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
        async def to_website(path: str, request: Request) -> Response:
            if path == "v1" or path.startswith("v1/"):
                raise ApiError(404, "NOT_FOUND", "There is no such API route.", None)
            web = get_settings().public_url.rstrip("/")
            here = str(request.base_url).rstrip("/")
            if web and web != here and path.split("/")[0] in WEB_PREFIXES:
                # fixed destination (the configured website) and a path from a short allowlist: never an open redirect
                safe = "/".join(quote(part) for part in path.split("/"))
                return RedirectResponse(f"{web}/{safe}", status_code=307)
            raise ApiError(404, "NOT_FOUND", "This address serves the EvidenceTruth API only.", f"Open the website at {web}." if web else None)

    return app


app = create_app()
