"""Settings from environment variables. See .env.example for every key."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ET_", extra="ignore")

    env: Literal["development", "test", "production"] = "development"
    version: str = "0.1.0"
    database_url: str = "sqlite:///./et-dev.db"
    secret_key: str = Field(default="dev-only-change-me-dev-only-change-me", min_length=32)

    public_url: str = "http://localhost:5173"  # where people open the web app (dev: the Vite server; production: your domain)
    extension_ids: str = ""  # comma-separated Chrome/Edge extension IDs allowed to call the API

    # Email (magic links, support mail)
    email_backend: Literal["console", "smtp", "resend"] = "console"
    email_from: str = "EvidenceTruth <no-reply@example.com>"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    resend_api_key: str = ""
    support_email: str = ""  # where "Report a problem" mail goes

    # Google OAuth (optional)
    google_client_id: str = ""
    google_client_secret: str = ""

    # Stripe (optional until you sell)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_pro: str = ""
    pro_price_label: str = "$8 per month"

    # Plans
    free_checks_per_month: int = 50
    pro_checks_per_month: int = 2000
    free_documents: int = 3
    pro_documents: int = 200

    # Verifier and optional LLM (OpenAI-compatible endpoint, e.g. Ollama at http://127.0.0.1:11434/v1)
    verifier: Literal["auto", "lexical", "nli"] = "auto"  # auto: the open NLI model if installed (requirements-ml.txt), else lexical
    nli_model: str = "cross-encoder/nli-deberta-v3-base"
    llm_base_url: str = ""
    llm_model: str = ""
    llm_api_key: str = ""

    # Sources
    contact_email: str = ""  # sent in the User-Agent to Wikipedia/Crossref per their policies
    source_timeout_s: float = 5.0
    semantic_scholar_key: str = ""
    # Web search through a SearXNG instance you run (D-018). Keep its Google engine disabled; we never scrape Google.
    searxng_url: str = ""
    searxng_engines: str = ""  # optional comma-separated engine list sent with each query
    # Desktop app releases (docs/plans/DESKTOP.md). Empty download URL = no download button anywhere (never a fake link).
    desktop_latest_version: str = ""
    desktop_min_version: str = "0.0.0"  # older apps are asked to update (HTTP 426 on API calls)
    desktop_download_url: str = ""  # e.g. https://github.com/OWNER/REPO/releases/latest
    desktop_update_feed_url: str = ""  # the release holding latest.yml, e.g. https://github.com/OWNER/REPO/releases/download/desktop-v0.2.0

    # Monitoring
    sentry_dsn: str = ""  # GlitchTip or any Sentry-compatible DSN
    github_repo: str = ""  # owner/name, used for "Report a problem" links

    @property
    def is_prod(self) -> bool:
        return self.env == "production"

    @property
    def allowed_extension_origins(self) -> set[str]:
        return {f"chrome-extension://{x.strip()}" for x in self.extension_ids.split(",") if x.strip()}


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_prod and s.secret_key.startswith("dev-only"):
        raise RuntimeError("ET_SECRET_KEY must be set in production")
    return s
