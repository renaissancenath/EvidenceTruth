"""Random tokens and hashing. Only sha256 hashes of tokens are stored; comparisons are constant time."""

from __future__ import annotations

import hashlib
import hmac
import secrets


def new_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def equal(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def six_digit_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"
