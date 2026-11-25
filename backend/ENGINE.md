# Verification engine (private)

This repository shows the application around EvidenceTruth: the API layer (`app/api`), sign-in and sessions
(`app/auth`), plans and payments (`app/billing`), the database models and migrations (`app/store`), the security
middleware and the error monitor. The packages it imports from `app.core`, `app.research`, `app.checkers`,
`app.sources`, `app.llm` and `app.verifier` are the verification engine: claim extraction and splitting, multi-source
research, evidence selection, stance scoring and the verdict rules. The engine, its tests and the evaluation code are
kept in a private repository, so this backend does not run on its own.

How the engine works is described in [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) and its measured accuracy in
[docs/RESULTS.md](../docs/RESULTS.md).
