import { defineConfig } from "vitest/config";
import path from "path";
// The real photo checker is off in tests so no test touches the model.
export default defineConfig({ test: { env: { VEND_AI_CHECK: "off" } }, resolve: { alias: { "@": path.resolve(__dirname, "src") } } });
