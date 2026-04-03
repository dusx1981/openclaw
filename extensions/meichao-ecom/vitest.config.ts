import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
  },
  resolve: {
    alias: [
      {
        find: "openclaw/plugin-sdk/meichao-ecom",
        replacement: path.join(repoRoot, "src/plugin-sdk/meichao-ecom.ts"),
      },
    ],
  },
});
