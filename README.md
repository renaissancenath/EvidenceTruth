<p align="center">
  <img src="docs/images/banner.png" alt="EvidenceTruth: Check AI answers against real sources. A claim card shows 'The Eiffel Tower is 450 metres tall' marked Contradicted, with the evidence 'The tower is 330 metres tall' highlighted.">
</p>

<p align="center">
  <img src="https://img.shields.io/github/last-commit/renaissancenath/EvidenceTruth?color=17181C&label=last%20commit" alt="Last commit">
  <img src="https://img.shields.io/github/stars/renaissancenath/EvidenceTruth?style=flat&color=17181C" alt="GitHub stars">
  <img src="https://img.shields.io/badge/license-source--available-17181C" alt="Source-available licence">
  <br>
  <img src="https://img.shields.io/badge/Python_3.12-17181C?logo=python&logoColor=white" alt="Python 3.12">
  <img src="https://img.shields.io/badge/FastAPI-17181C?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-17181C?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/SQLAlchemy_2-17181C?logo=sqlalchemy&logoColor=white" alt="SQLAlchemy 2">
  <img src="https://img.shields.io/badge/React_19-17181C?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-17181C?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-17181C?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Electron-17181C?logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/Chrome_MV3-17181C?logo=googlechrome&logoColor=white" alt="Chrome Manifest V3">
  <img src="https://img.shields.io/badge/Playwright-17181C?logo=playwright&logoColor=white" alt="Playwright">
  <img src="https://img.shields.io/badge/Docker-17181C?logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/code_style-ruff-17181C?logo=ruff&logoColor=white" alt="Ruff">
</p>

<p align="center">
  <b>Every claim gets a verdict and the exact passage that decided it, quoted word for word.</b><br>
  <a href="#see-it">See it</a> ·
  <a href="#inside-the-backend">Backend</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#measured-accuracy">Accuracy</a>
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/at-a-glance-dark.png">
  <img src="docs/images/at-a-glance-light.png" alt="At a glance: 65.0% accuracy on SciFact dev with DeBERTa-v3-large (word matching 55.3%); the right paper is in the top 3 for 83.5% of claims out of 5,183 abstracts; 3 clients share one engine (web, extension, Windows); 110 automated tests (81 API, 11 desktop unit, 18 desktop end-to-end); $0 to run, no paid API required.">
</picture>

<p align="center"><img src="docs/images/demo-animated.svg" width="880" alt="Animation: three claims are checked one after another; the first is Supported, the second Contradicted with the source sentence 'The tower is 330 metres tall.' highlighted, the third is Not a factual claim."></p>

## The problem

AI answers sound equally sure when they are wrong. **EvidenceTruth checks each claim and shows the source sentence that decided it.**

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/results-dark.png">
  <img src="docs/images/results-light.png" alt="EvidenceTruth results: four claims from a ChatGPT answer. 'The Eiffel Tower is 450 metres tall' is marked Contradicted, and the source passage saying the tower is 330 metres tall is highlighted in yellow.">
</picture>

## See it

<table>
<tr>
<th width="33%">Web app</th>
<th width="33%">Browser extension</th>
<th width="33%">Windows desktop app</th>
</tr>
<tr>
<td valign="top"><img src="docs/images/landing.png" alt="EvidenceTruth website landing page"></td>
<td valign="top" align="center"><img src="docs/images/ext-panel-400.png" width="230" alt="Browser extension side panel listing checked claims, with the contradicted claim open and its evidence highlighted"></td>
<td valign="top" align="center"><img src="docs/images/desktop-panel.png" width="230" alt="Desktop companion panel after checking copied text: one claim Supported, one Contradicted with the 330 metres passage highlighted, one marked as not a factual claim"></td>
</tr>
<tr>
<td valign="top">Paste an answer, add your PDFs and documents, read full reports, history and a dashboard.</td>
<td valign="top">Scan a ChatGPT, Claude or Gemini page. Checked sentences are underlined in place.</td>
<td valign="top">Copy text in <b>any</b> app and press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd>. Right-click the floating button for Check, Hide and Quit.</td>
</tr>
</table>

<p align="center"><img src="docs/images/ext-page-underline.png" width="720" alt="A chat page with the supported sentence underlined in green and the contradicted sentence underlined in red"><br>
<sub>The extension underlines checked sentences without changing the page.</sub></p>

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/how-it-works-dark.png">
  <img src="docs/images/how-it-works-light.png" alt="Pipeline: AI answer, redact, split claims, research, verify. Every claim ends as Supported, Contradicted, Partially supported, Unsubstantiated or Insufficient evidence, with the deciding passage highlighted.">
</picture>

| Verdict | Meaning |
|---|---|
| **Supported** | A trusted source says the same thing |
| **Contradicted** | A trusted source gives a different fact, number or date |
| **Partially supported** | The sentence makes several claims; some are confirmed, some are not (each part is shown) |
| **Unsubstantiated** | Trustworthy sources cover the topic, but none confirms this claim |
| **Insufficient evidence** | Nothing relevant was found, or it was too weak. *That doesn't mean it's false.* |


### How one claim is researched

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/research-dark.png">
  <img src="docs/images/research-light.png" alt="Research engine: a claim becomes support, contradict and context queries; providers are searched and their status recorded (searched, failed, not allowed) within a request and time budget; documents are read in full (snippets are never evidence), must name the claim's subject, pages with instructions for machines are set aside, and copies count once (at most two passages per independent group). Every claim keeps a research record.">
</picture>

## Architecture

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/architecture-dark.png">
  <img src="docs/images/architecture-light.png" alt="Architecture: the web app, browser extension and Windows desktop app connect over HTTPS to one FastAPI service (sign-in and quota, redact, split into claims, research, verify, verdict). The service reads your documents and public sources you allow, and stores data in PostgreSQL on a private network; Stripe and email are used for plans and sign-in links.">
</picture>

## Inside the backend

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/request-lifecycle-dark.png">
  <img src="docs/images/request-lifecycle-light.png" alt="Inside the server: middleware (size limits, client version, origin check, CORS and headers), dependencies (session, rate limit, plan quota, redaction), the request (extract claims, decompose, store, immediate reply), the background task (your documents, research, gate and rank, stance, aggregate) and results (write, combine parents, stream over SSE, render in the client).">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/data-model-dark.png">
  <img src="docs/images/data-model-light.png" alt="Data model: checking tables (scans, claims with parent_id, verdicts, evidence, sources, research_runs, documents and chunks, citation and code checks), accounts and security tables (users, auth_sessions with hashed tokens, magic links and pairing codes, consents and usage) and operations tables (error_events, audit_log, http_cache, attempts and feedback).">
</picture>

<table>
<tr>
<td width="50%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/images/security-dark.png"><img src="docs/images/security-light.png" alt="Defence in depth: client protections, edge and API protections, identity and data protections, and research and verification protections, nested like rings, plus supply chain and change control."></picture></td>
<td width="50%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/images/delivery-dark.png"><img src="docs/images/delivery-light.png" alt="From commit to users: CI gates on every push, a service release that needs a person's approval, a desktop release built on a Windows runner, and error triage after release."></picture></td>
</tr>
</table>

<details>
<summary><b>Engineering details</b> (stack, security, tests, CI)</summary>

| Area | What's in place |
|---|---|
| **Backend** | FastAPI, Pydantic v2, SQLAlchemy 2, PostgreSQL (+ pgvector), Alembic. Pure `core/` with no I/O; network only in `sources/` |
| **Research engine** | Query directions, one `SearchProvider` interface (Wikipedia, Semantic Scholar, arXiv, self-hosted SearXNG), budgets, source-independence groups, injection set-aside, per-claim research record |
| **Frontend** | React 19, React Router 7, Vite, strict TypeScript. Own component set on design tokens |
| **Extension** | Manifest V3: side panel, context menu, CSS Custom Highlight API for underlines |
| **Desktop** | Electron: floating button with menu, tray, global shortcut, token encrypted by the OS, HTTPS only, version check and update offer |
| **Auth** | Passwordless email links and Google (PKCE). Hashed server-side sessions, CSRF protection, revocable devices |
| **Security** | SSRF guard, strict CSP, rate limits, redaction before storage, tenant isolation, sandboxed renderers, validated IPC |
| **Billing** | Free and Pro plans with server-side quotas; Stripe Checkout, Customer Portal and signed webhooks |
| **Tests** | 81 backend tests on SQLite and PostgreSQL (auth, CSRF, tenant isolation, privacy, prompt injection, SSRF, billing, migrations, research failures and budgets). Web, extension and desktop unit tests. Playwright walkthroughs of the real web app, extension and Electron app |
| **CI on every PR** | Lint, types, tests, secret scan, dependency audit, OpenAPI breaking-change check, UI anti-slop check, browser walkthroughs, Docker build |
| **Safe migrations** | Backup first; destructive SQL fails CI without an approval label; the runner needs a one-time code typed by a person |
| **Production errors** | Grouped by fingerprint, scrubbed of user data; a daily triage job files issues with the likely cause |

Write-ups: [Architecture](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md) · [API reference](docs/api/openapi.json) · [Results](docs/RESULTS.md)

</details>

## More than facts

<table>
<tr>
<td width="50%" valign="top"><b>Code that imports things that don't exist</b><br>Every import is checked against the real PyPI or npm registry. Code is never run.<br><br><img src="docs/images/code-check.png" alt="Code check: fastjsonparserx marked 'Doesn't exist' on PyPI, pandas and requests marked as existing, with the likely cause of the error and next steps"></td>
<td width="50%" valign="top"><b>Repeated failed fixes</b><br>When the same error keeps coming back, it explains why it looks stuck and suggests a different experiment.<br><br><img src="docs/images/stuck-loop.png" alt="Attempts page: three identical ModuleNotFoundError attempts, a 'This looks stuck' panel with reasons and suggested next steps"></td>
</tr>
<tr>
<td valign="top"><b>Your history, counted honestly</b><br>Every number on the dashboard comes from stored checks.<br><br><img src="docs/images/dashboard.png" alt="Dashboard with a line chart of claims checked per day, a bar chart of claims by result, and a table of recent problems"></td>
<td valign="top"><b>Also</b><br>Citations: does the paper exist, do title, authors and year match<br>Documents: compare an answer with your PDF or DOCX<br>Calculations: arithmetic, percentages, unit conversions<br>A chat that answers only from stored evidence</td>
</tr>
</table>

## Measured accuracy

SciFact dev (300 expert-labelled claims), never used for training or tuning. Full table: [docs/RESULTS.md](docs/RESULTS.md).

| Verifier | Accuracy | Macro-F1 | Contradiction F1 |
|---|---|---|---|
| Word matching (baseline) | 55.3% | 0.428 | 0.06 |
| DeBERTa-v3-base, zero-shot, 3 selected sentences | 60.0% | 0.595 | 0.64 |
| **DeBERTa-v3-large, zero-shot** | **65.0%** | **0.652** | **0.69** |
| DeBERTa-v3-large, searching all 5,183 abstracts | 54.3% | 0.542 | 0.55 |

Next: MultiVerS and fine-tuning. Target 80%; not reached yet.


<details>
<summary><b>Privacy by design</b></summary>

- Emails, API keys, card and phone numbers are **redacted before** anything is stored or sent.
- Every public source is **off** until you allow it; only the claim's own words are sent.
- The extension and desktop app read only what you ask them to check: no screenshots, no screen watching, no keystrokes.
- History is deleted after 30 days by default. Export or delete everything at any time.

</details>

## Honest limitations

- It doesn't catch every wrong answer. *Unsubstantiated* and *Insufficient evidence* do not mean *false*.
- The app still uses the word-matching verifier: a stronger model goes in only after it passes the benchmark gate
  (accuracy, contradiction handling, evidence relevance, licence, cost).
- Accuracy is measured on SciFact (scientific claims) only so far; everyday claims are next.
- Not yet run against live services: public-source lookups and SearXNG web search (tested with responses in their real
  formats), Google sign-in and Stripe (need your keys), and the desktop app against a deployed service. The Windows EXE
  builds and starts; a Windows checklist is part of the release process.

## Roadmap

| Done | Next |
|---|---|
| Claim, citation, document, code and calculation checks | Recursive and adaptive Deep research; research panel in every client |
| Research engine stage 1: multi-direction queries, providers, budgets, copies counted once | More sources: Wikidata, Crossref as evidence, OpenAlex |
| Web app, extension, Windows desktop app, accounts, plans | Sign in to the desktop app through the browser; first published Windows release |
| CI, safe migrations, error triage; SciFact benchmark with DeBERTa | MultiVerS and fine-tuned models; put the best one into the app |

## About the source code

This repository is the public overview of EvidenceTruth. The source code (backend, research engine, web app, browser extension, desktop app, tests and evaluation) is kept in a private repository. If you are reviewing my work for a role, open an issue or message me through my GitHub profile and I will give you read access or walk you through the code.

## Licence

All rights reserved. The text, diagrams and screenshots here may be viewed on GitHub; any other use needs
written permission. See [LICENSE](LICENSE).

<p align="center">If this project is interesting to you, a star helps others find it.</p>
