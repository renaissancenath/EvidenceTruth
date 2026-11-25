import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/600.css";
import "@fontsource/atkinson-hyperlegible-next/700.css";
import "@fontsource/atkinson-hyperlegible-mono/400.css";
import "../../../design/tokens.css";
import "../../../frontend/src/styles/app.css";
import "../shared/ext.css";
import { createRoot } from "react-dom/client";
import { Popup } from "./Popup";

createRoot(document.getElementById("root")!).render(<Popup />);
