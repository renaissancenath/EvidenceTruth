import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/600.css";
import "@fontsource/atkinson-hyperlegible-next/700.css";
import "@fontsource/atkinson-hyperlegible-mono/400.css";
import "../../design/tokens.css";
import "../../frontend/src/styles/app.css";
import "../../extension/src/shared/ext.css";
import "./desktop.css";
import { createRoot } from "react-dom/client";
import { Panel } from "./Panel";

createRoot(document.getElementById("root")!).render(<Panel />);
