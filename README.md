<p align="center">
  <img src="docs/images/banner.png" alt="EvidenceTruth: Check AI answers against real sources. A claim card shows 'The Eiffel Tower is 450 metres tall' marked Contradicted, with the evidence 'The tower is 330 metres tall' highlighted.">
</p>

<p align="center">
  <img src="https://img.shields.io/github/last-commit/renaissancenath/EvidenceTruth?color=17181C&label=last%20commit" alt="Last commit">
  <img src="https://img.shields.io/github/languages/top/renaissancenath/EvidenceTruth?color=17181C" alt="Top language">
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
  <a href="https://evidencetruth.onrender.com"><img src="https://img.shields.io/badge/Live_demo-evidencetruth.onrender.com-17181C?style=for-the-badge" alt="Live demo: evidencetruth.onrender.com"></a>
</p>

<p align="center">
  <b>Every claim gets a verdict and the exact passage that decided it, quoted word for word.</b><br>
  <a href="#see-it">See it</a> ·
  <a href="#inside-the-backend">Backend</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#measured-accuracy">Accuracy</a> ·
  <a href="#skills-and-tools">Skills and tools</a>
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/at-a-glance-dark.png">
  <img src="docs/images/at-a-glance-light.png" alt="At a glance: 72.7% accuracy on SciFact dev with MultiVerS (word matching 55.3%); 70.0% when it must find the paper among 5,183 abstracts; 3 clients share one engine (web, extension, Windows); 124 automated tests (83 API, 12 evaluation, 11 desktop unit, 18 desktop end-to-end); $0 to run, no paid API required.">
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
| **Tests** | 83 backend tests on SQLite and PostgreSQL (auth, CSRF, tenant isolation, privacy, prompt injection, SSRF, billing, migrations, research failures and budgets). Web, extension and desktop unit tests. Playwright walkthroughs of the real web app, extension and Electron app |
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

SciFact dev split (300 expert-labelled scientific claims), never used for training or tuning. One notebook run on a
free Colab T4 GPU, 25 Nov 2026. Full table with per-class scores: [docs/RESULTS.md](docs/RESULTS.md).

| Verifier | Accuracy (cited abstract) | Accuracy (search all 5,183) | Macro-F1 | Contradiction F1 |
|---|---|---|---|---|
| Majority class | | | 0.195 | |
| Word matching (transparent baseline) | 55.3% | 52.3% | 0.428 | 0.06 |
| DeBERTa-v3-base, 3 selected sentences | 61.3% | 54.3% | 0.609 | 0.64 |
| DeBERTa-v3-large | 67.0% | 52.7% | 0.670 | **0.67** |
| **MultiVerS** (never trained on SciFact) | **72.7%** | **70.0%** | **0.670** | 0.46 |

MultiVerS is the most accurate and keeps its accuracy when it has to find the paper itself; DeBERTa-v3-large is the
strongest at spotting contradictions.

### Benchmark evidence
Raw, unedited output from the evaluation notebook on Google Colab. Each run prints the threshold chosen on training
data, accuracy, per-class precision, recall and F1, and the confusion matrix.

<p align="center"><img src="docs/images/proof/colab-gpu.png" width="420" alt="Colab output: GPU: Tesla T4"></p>
<p align="center"><img src="docs/images/proof/colab-multivers-oracle.png" alt="Colab output for run 20261125-161857-scifact-oracle-multivers-fever_sci: tau 0.05 (train macro-F1 0.6662); DEV accuracy 0.7267, macro-F1 0.6701; supported P 0.723 R 0.798 F1 0.759 n=124; contradicted P 0.778 R 0.328 F1 0.462 n=64; nei P 0.721 R 0.875 F1 0.790 n=112; confusion supported 99/4/21, contradicted 26/21/17, nei 12/2/98."></p>

<details>
<summary><b>More runs: MultiVerS with search, DeBERTa-v3-large, and the summary of every run</b></summary>

<img src="docs/images/proof/colab-multivers-retrieval.png" alt="Colab output for run 20261125-163406-scifact-retrieval-multivers-fever_sci: DEV accuracy 0.7, macro-F1 0.6401.">
<img src="docs/images/proof/colab-deberta-large-oracle.png" alt="Colab output for run 20261125-154933-scifact-oracle-nli-deberta-v3-large: DEV accuracy 0.67, macro-F1 0.6701; contradicted F1 0.672.">
<img src="docs/images/proof/colab-summary.png" alt="Colab summary table of every run in the repository: accuracy, macro-F1 and per-class F1 for word matching, learned verifiers, DeBERTa base and large with and without sentence selection, and MultiVerS, in both settings.">

</details>

## Skills and tools

| Area | Used in this project |
|---|---|
| Languages | ![Python](https://img.shields.io/badge/Python-17181C?logo=python&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-17181C?logo=typescript&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-17181C?logo=javascript&logoColor=white) ![SQL](https://img.shields.io/badge/SQL-17181C?logo=postgresql&logoColor=white) ![HTML](https://img.shields.io/badge/HTML-17181C?logo=html5&logoColor=white) ![CSS](https://img.shields.io/badge/CSS-17181C?logo=css&logoColor=white) |
| Backend | ![FastAPI](https://img.shields.io/badge/FastAPI-17181C?logo=fastapi&logoColor=white) ![Pydantic](https://img.shields.io/badge/Pydantic_v2-17181C?logo=pydantic&logoColor=white) ![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy_2-17181C?logo=sqlalchemy&logoColor=white) ![Alembic](https://img.shields.io/badge/Alembic-17181C) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17181C?logo=postgresql&logoColor=white) ![SQLite](https://img.shields.io/badge/SQLite-17181C?logo=sqlite&logoColor=white) ![REST](https://img.shields.io/badge/REST_+_SSE-17181C) |
| Machine learning and NLP | ![PyTorch](https://img.shields.io/badge/PyTorch-17181C?logo=pytorch&logoColor=white) ![Transformers](https://img.shields.io/badge/Hugging_Face_Transformers-17181C?logo=huggingface&logoColor=white) ![DeBERTa](https://img.shields.io/badge/DeBERTa--v3_NLI-17181C) ![Longformer](https://img.shields.io/badge/MultiVerS_Longformer-17181C) ![scikit-learn](https://img.shields.io/badge/scikit--learn-17181C?logo=scikitlearn&logoColor=white) ![spaCy](https://img.shields.io/badge/spaCy-17181C?logo=spacy&logoColor=white) ![BM25](https://img.shields.io/badge/BM25_retrieval-17181C) ![Colab](https://img.shields.io/badge/Google_Colab_T4-17181C?logo=googlecolab&logoColor=white) |
| Frontend | ![React](https://img.shields.io/badge/React_19-17181C?logo=react&logoColor=white) ![React Router](https://img.shields.io/badge/React_Router_7-17181C?logo=reactrouter&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-17181C?logo=vite&logoColor=white) ![Design tokens](https://img.shields.io/badge/Design_system-17181C) |
| Clients | ![Chrome extension](https://img.shields.io/badge/Chrome_extension_MV3-17181C?logo=googlechrome&logoColor=white) ![Electron](https://img.shields.io/badge/Electron_desktop-17181C?logo=electron&logoColor=white) ![Windows](https://img.shields.io/badge/Windows_EXE-17181C?logo=windows&logoColor=white) |
| Security | ![Auth](https://img.shields.io/badge/Magic_link_+_Google_OAuth-17181C) ![CSRF](https://img.shields.io/badge/CSRF_+_CSP-17181C) ![SSRF](https://img.shields.io/badge/SSRF_guard-17181C) ![Secrets](https://img.shields.io/badge/gitleaks_+_pip--audit-17181C) |
| Payments and email | ![Stripe](https://img.shields.io/badge/Stripe-17181C?logo=stripe&logoColor=white) ![Email](https://img.shields.io/badge/Transactional_email-17181C?logo=gmail&logoColor=white) |
| Testing | ![pytest](https://img.shields.io/badge/pytest-17181C?logo=pytest&logoColor=white) ![Vitest](https://img.shields.io/badge/Vitest-17181C?logo=vitest&logoColor=white) ![Playwright](https://img.shields.io/badge/Playwright-17181C?logo=playwright&logoColor=white) ![Ruff](https://img.shields.io/badge/Ruff-17181C?logo=ruff&logoColor=white) ![Pyright](https://img.shields.io/badge/Pyright-17181C) |
| DevOps | ![Docker](https://img.shields.io/badge/Docker-17181C?logo=docker&logoColor=white) ![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-17181C?logo=githubactions&logoColor=white) ![Render](https://img.shields.io/badge/Render-17181C?logo=render&logoColor=white) ![Git](https://img.shields.io/badge/Git-17181C?logo=git&logoColor=white) |


<details>
<summary><b>Privacy by design</b></summary>

- Emails, API keys, card and phone numbers are **redacted before** anything is stored or sent.
- Every public source is **off** until you allow it; only the claim's own words are sent.
- The extension and desktop app read only what you ask them to check: no screenshots, no screen watching, no keystrokes.
- History is deleted after 30 days by default. Export or delete everything at any time.

</details>

## Prototype scope

| What it does | What it does not claim |
|---|---|
| Checks factual claims, citations, documents, code imports and calculations, and shows the deciding source sentence | To catch every wrong answer: *Unsubstantiated* and *Insufficient evidence* mean "not confirmed", not "false" |
| Runs on free infrastructure with a transparent word-matching verifier, small enough for a free host | The MultiVerS and DeBERTa figures above come from the offline benchmark on a GPU, not from the free deployed instance |
| Web app, Chrome extension and Windows desktop app on one account and one engine | Certified handling of regulated data (health records, card numbers, government IDs) |

## What is in this repository

| Public here | Private |
|---|---|
| Web app (React), Chrome extension, Windows desktop app (Electron), shared UI and design system | Verification engine: claim extraction, research, evidence selection, verdict rules |
| API layer, sign-in and sessions, plans and payments, database models and migrations, security middleware | Engine tests and the evaluation and training code |
| Browser walkthroughs, Docker and deployment files, architecture and security write-ups, API reference | Internal design notes and tuning |

If you are reviewing my work for a role, open an issue or message me through my GitHub profile and I will give you read access to the full repository or walk you through the code.

## Licence

All rights reserved. The code, text, diagrams and screenshots here may be viewed on GitHub; any other use needs
written permission. See [LICENSE](LICENSE).

<p align="center">If this project is interesting to you, a star helps others find it.</p>
