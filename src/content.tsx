import ReactDOM from "react-dom/client";
import App from "./App";
import styleText from "./index.css?inline"; // Import CSS as a string

const HOST_ELEMENT_ID = "steroid-host";

/**
 * Mount the Steroid command palette into an isolated Shadow DOM.
 * Runs exactly once per document; safe to call again as a no-op.
 */
function mountSteroid(): void {
  // Re-entry guard: the content script can be injected both declaratively
  // (manifest content_scripts) and dynamically (background service worker).
  // Bail out if a host element already exists to avoid a second React root
  // and duplicate keydown listeners.
  if (document.getElementById(HOST_ELEMENT_ID)) {
    return;
  }

  // Create a host element for the Shadow DOM
  const host = document.createElement("div");
  host.id = HOST_ELEMENT_ID;
  document.body.appendChild(host);

  // Attach Shadow DOM
  const shadowRoot = host.attachShadow({ mode: "open" });

  // Create a div for the React app inside the Shadow DOM
  const rootDiv = document.createElement("div");
  rootDiv.id = "steroid-root";
  shadowRoot.appendChild(rootDiv);

  // Inject styles into the Shadow DOM
  const styleElement = document.createElement("style");
  styleElement.textContent = styleText;
  shadowRoot.appendChild(styleElement);

  // Mount the React app once
  const root = ReactDOM.createRoot(rootDiv);
  root.render(<App />);
}

mountSteroid();
