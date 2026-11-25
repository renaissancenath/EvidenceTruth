# EvidenceTruth: one container serves the API and the web app.
# Build:  docker build -t evidencetruth .
# Run:    see docker-compose.yml and docs/DEPLOY.md
# pg_dump backs up the database before every migration. It must be at least the server's version, so install the
# PostgreSQL 18 client from the official PGDG repository (Debian's own client is older and refuses newer servers).

FROM node:22-bookworm-slim AS web
WORKDIR /src
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY extension/package.json extension/
RUN npm ci --workspace frontend --include-workspace-root=false --no-audit --no-fund
COPY design design
COPY shared shared
COPY frontend frontend
RUN npm run build -w frontend

FROM python:3.12-slim-bookworm AS app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 ET_ENV=production
# pg_dump backs up the database before every migration. It must be at least the server's version, so install the
# PostgreSQL 17 client from the official PGDG repository (Debian's own client is older and refuses newer servers).
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update && apt-get install -y --no-install-recommends postgresql-client-18 \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 10001 et
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/alembic.ini backend/pyproject.toml ./
COPY backend/app app
COPY --from=web /src/frontend/dist web
COPY infra/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /app/backups && chown -R et /app/backups
USER et
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/v1/health',timeout=4)"
ENTRYPOINT ["/entrypoint.sh"]
