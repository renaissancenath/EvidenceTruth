import { useNavigate } from "react-router";
import { api } from "../api";
import { useAuth } from "../auth";
import { ConsentList } from "../components/Consents";
import { Brand } from "../components/ui";

export function Welcome() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const finish = async () => { await api("/me", { method: "PATCH", body: { onboarded: true } }); await refresh(); nav("/app", { replace: true }); };
  return (
    <div className="page stack-lg" style={{ maxWidth: 760 }}>
      <p className="brand"><Brand /></p>
      <h1>Choose where evidence can come from</h1>
      <p className="lede">Each source is off until you allow it. Only the words of one claim or reference are sent, after emails, keys and numbers that look personal are removed. You can change this any time in Settings.</p>
      <ConsentList />
      <div className="note small">
        <p>EvidenceTruth never reads pages on its own. With the browser extension, it reads only the sites you allow, and only when you press Scan.</p>
      </div>
      <div className="row"><button className="btn btn-primary btn-lg" onClick={() => void finish()}>Continue to the app</button></div>
    </div>
  );
}
