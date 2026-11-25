"""Error shape for every API error: {code, message, hint}. No stack traces, no paths, no user text."""

from __future__ import annotations


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, hint: str | None = None, headers: dict[str, str] | None = None) -> None:
        super().__init__(message)
        self.status, self.code, self.message, self.hint, self.headers = status, code, message, hint, headers or {}
