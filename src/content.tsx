import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("Steroid content script loaded.");

// Create a root element to mount the React app
const rootDiv = document.createElement("div");
rootDiv.id = "steroid-root";
document.body.appendChild(rootDiv);

// Mount the React app once
const root = ReactDOM.createRoot(rootDiv);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
