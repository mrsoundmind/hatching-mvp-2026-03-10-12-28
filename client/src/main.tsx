import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installCsrfFetchInterceptor } from "./lib/csrf";

installCsrfFetchInterceptor();

createRoot(document.getElementById("root")!).render(<App />);
