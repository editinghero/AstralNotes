import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const clientDir = path.join(root, "dist", "client");
const serverDir = path.join(root, "dist", "server");
const targetServerDir = path.join(clientDir, "_server");

// Ensure client directory exists
if (fs.existsSync(serverDir) && fs.existsSync(clientDir)) {
  // Copy server output into dist/client/_server
  fs.cpSync(serverDir, targetServerDir, { recursive: true });

  // Generate Cloudflare Pages _worker.js entry point
  const workerContent = `import server from "./_server/server.js";

export default {
  async fetch(request, env, ctx) {
    try {
      const res = await env.ASSETS.fetch(request);
      if (res.status !== 404) {
        return res;
      }
    } catch {
      // Fallback
    }
    return server.fetch(request, env, ctx);
  }
};
`;

  fs.writeFileSync(path.join(clientDir, "_worker.js"), workerContent, "utf-8");
  console.log("✓ Cloudflare Pages _worker.js generated successfully in dist/client");
}
