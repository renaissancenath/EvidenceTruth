import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../api";
import { useAuth } from "../auth";

type DesktopRelease = { latest_version: string | null; download_url: string | null };

/* Shown only when the service names a published release: never a link that might not exist. */
function DesktopDownload() {
  const [rel, setRel] = useState<DesktopRelease | null>(null);
  useEffect(() => { api<DesktopRelease>("/clients/desktop").then(setRel).catch(() => setRel(null)); }, []);
  if (!rel?.download_url || !rel.latest_version) return null;
  return (
    <section className="section prose" aria-labelledby="desktop-h">
      <h2 id="desktop-h">On your Windows desktop</h2>
      <p>Copy text in any app and press <kbd className="mono">Ctrl+Shift+E</kbd>. The desktop companion checks it with your account, using the same sources and engine as this website.</p>
      <p><a className="btn" href={rel.download_url} rel="noopener">Download for Windows (version {rel.latest_version})</a></p>
      <p className="small muted">Not code-signed yet: Windows may show a SmartScreen warning the first time.</p>
    </section>
  );
}

export function Landing() {
  const { user, config } = useAuth();
  const cta = user ? <Link className="btn btn-primary btn-lg" to="/app">Open the app</Link>
    : <Link className="btn btn-primary btn-lg" to="/login">Create a free account</Link>;
  return (
    <div className="page">
      <section className="hero">
        <div className="stack-lg">
          <h1>Check AI answers against real sources.</h1>
          <p className="lede">Paste an answer from ChatGPT, Claude or Gemini, or check it in the page with the browser extension. EvidenceTruth finds each claim, looks for evidence in sources you allow and in your own documents, and shows you the passage that decided the result. It also checks citations, code imports and calculations, and notices when you keep repeating a fix that isn't working.</p>
          <div className="row">{cta}<Link to="/pricing">See plans</Link></div>
          <p className="small muted">Free plan: {config?.free_checks_per_month ?? 50} checks a month. No card needed.</p>
        </div>
        <figure className="shot">
          <img src="/screenshots/claim-card.png" width="1280" height="900" alt="A checked answer. One claim is marked Contradicted, with the source passage that decided it highlighted in yellow." />
          <figcaption className="xs muted">Screenshot of the app checking an answer against a document the user added.</figcaption>
        </figure>
      </section>

      <section className="section prose">
        <h2>How it works</h2>
        <ol className="numbered">
          <li><span><strong>Pick the text.</strong> Paste an answer, or select it on the page with the extension. Nothing is read until you ask.</span></li>
          <li><span><strong>Claims are split out.</strong> Each sentence that states a fact is checked. Opinions and predictions are marked as not checkable.</span></li>
          <li><span><strong>Evidence is gathered.</strong> From your documents first, then from the public sources you allowed: Wikipedia, Crossref, Semantic Scholar, arXiv, PyPI and npm.</span></li>
          <li><span><strong>Each claim gets its own verdict.</strong> Supported, Contradicted, Partially supported, Unsubstantiated or Insufficient evidence, with the deciding passage highlighted and quoted word for word. A sentence that makes several claims is split, and each part is checked.</span></li>
          <li><span><strong>You decide.</strong> Open the source, read the passage, and follow the next step. EvidenceTruth never changes your text or your code.</span></li>
        </ol>
      </section>

      <DesktopDownload />

      <section className="section prose">
        <h2>What it checks</h2>
        <table>
          <tbody>
            <tr><th scope="row">Facts in an answer</th><td>Against your documents and allowed public sources.</td></tr>
            <tr><th scope="row">Citations</th><td>Does the paper exist in Crossref, does the link open, do the title, authors and year match, does the abstract support the sentence.</td></tr>
            <tr><th scope="row">Documents</th><td>Compares an answer with a PDF, DOCX or text file you add: missing statements, contradictions, wrong numbers.</td></tr>
            <tr><th scope="row">Code</th><td>Syntax and lint problems, and imports of packages that don't exist on PyPI or npm. Your code is never run.</td></tr>
            <tr><th scope="row">Calculations</th><td>Recomputes arithmetic, percentages and unit conversions.</td></tr>
            <tr><th scope="row">Repeated failed fixes</th><td>Track your attempts and it tells you when the same error keeps coming back, and what to try instead.</td></tr>
          </tbody>
        </table>
      </section>

      <section className="section prose" id="limitations">
        <h2>Limitations</h2>
        <ul>
          <li>It does not catch every wrong answer. A claim marked Unsubstantiated or Insufficient evidence is not automatically false.</li>
          <li>Results depend on the sources you allow. With no sources allowed, only your own documents are used.</li>
          <li>The default checker compares wording, numbers and dates. It can miss a claim that is phrased very differently from the source.</li>
          <li>We haven't published accuracy numbers yet. We will only publish numbers measured on public, human-labelled datasets, with the dataset and run listed.</li>
        </ul>
      </section>

      <section className="section prose">
        <h2>Privacy</h2>
        <p>Emails, keys, card numbers and phone numbers are removed from your text before it is stored or sent anywhere. Each public source is off until you allow it, and only the claim's own words are sent to it. Your documents are never sent to other services. History is deleted after 30 days by default, and you can delete it, or your whole account, at any time. <Link to="/privacy">Read the privacy notice</Link>.</p>
      </section>

      <section className="section">
        <div className="row">{cta}</div>
      </section>
    </div>
  );
}
