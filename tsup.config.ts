import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "middleware/next": "src/middleware/next.ts",
    "middleware/express": "src/middleware/express.ts",
    "middleware/vercel": "src/middleware/vercel.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["next", "next-axiom", "express"],
});
