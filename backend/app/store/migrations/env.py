from __future__ import annotations

from alembic import context

from app.db import Base, engine
from app.store import models  # noqa: F401  (registers tables)

target_metadata = Base.metadata


def run() -> None:
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=target_metadata, render_as_batch=conn.dialect.name == "sqlite", compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


run()
