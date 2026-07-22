import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { DialogProvider } from "./contexts/DialogContext";
import "./styles/index.css";
import "reactflow/dist/style.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <DialogProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </DialogProvider>
    </BrowserRouter>
  </React.StrictMode>
);
