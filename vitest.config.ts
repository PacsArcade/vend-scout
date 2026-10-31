import { defineConfig } from "vitest/config";
import path from "path";
// The real photo checker is off in tests so no test touches the model.
export default defineConfig({ test: { env: { VEND_AI_CHECK: "off", OLLAMA_URL: "http://127.0.0.1:1" } }, resolve: { alias: { "@": path.resolve(__dirname, "src") } } });
