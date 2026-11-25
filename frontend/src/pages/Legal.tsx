import { Link } from "react-router";

export function Privacy() {
  return (
    <div className="page prose stack">
      <h1>Privacy notice</h1>
      <p className="muted small">Template text for the operator to review with a lawyer before launch. Replace the bracketed parts.</p>
      <h2>What we store</h2>
      <ul>
        <li>Your email address and sign-in sessions.</li>
        <li>Text you ask us to check, after emails, keys, card numbers, phone numbers and ID-like numbers are removed.</li>
        <li>Results: claims, labels, the quoted evidence and its source.</li>
        <li>Documents you add, stored as extracted text, until you delete them.</li>
        <li>Tracked attempts, stored as error signatures and hashes. The prompt text itself is not stored.</li>
        <li>Billing status from Stripe. We never see or store your card number.</li>
      </ul>
      <h2>What we send to other services</h2>
      <ul>
        <li>Only to the public sources you allowed, and only the words of one claim or one reference.</li>
        <li>Sign-in emails go through our email provider. Payments go through Stripe.</li>
        <li>Error reports contain the error type and our own code locations, never your text.</li>
      </ul>
      <h2>How long we keep it</h2>
      <p>Checks are deleted after your retention setting (30 days by default). You can delete one check, all history, or your whole account in Settings, and download all of your data as a file.</p>
      <h2>Contact</h2>
      <p>[Operator name and address]. Write to [support address]. You can also <Link to="/report">report a problem</Link>.</p>
    </div>
  );
}

export function Terms() {
  return (
    <div className="page prose stack">
      <h1>Terms of use</h1>
      <p className="muted small">Template text for the operator to review with a lawyer before launch.</p>
      <ol>
        <li>EvidenceTruth helps you check information. It can be wrong and does not catch every error. You remain responsible for what you rely on.</li>
        <li>Don't use it to check content you have no right to process, or to overload the service.</li>
        <li>Paid plans renew monthly until you cancel. Cancelling stops the next renewal; you keep Pro until the period ends.</li>
        <li>We may change these terms with 30 days' notice by email.</li>
      </ol>
    </div>
  );
}
