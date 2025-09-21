import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import styleText from "./index.css?inline"; // Import CSS as a string

console.log("Steroid content script loaded.");

// Create a host element for the Shadow DOM
const host = document.createElement("div");
host.id = "steroid-host";
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
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
