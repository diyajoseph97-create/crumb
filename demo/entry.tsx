// Entry point for the standalone demo (no server; data stays in the browser).
import { createRoot } from "react-dom/client";
import { CrumbApp } from "@/components/CrumbApp";
import { DemoStore } from "@/lib/store";

createRoot(document.getElementById("root")!).render(<CrumbApp store={DemoStore} />);
