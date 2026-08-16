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
    const url = new URL(request.url);

    // 1. API routes must always bypass static asset fetching and route directly to the server
    if (url.pathname.startsWith("/api/")) {
      return server.fetch(request, env, ctx);
    }

    // 2. Only GET and HEAD requests should attempt static asset fetching
    if (request.method === "GET" || request.method === "HEAD") {
      try {
        const res = await env.ASSETS.fetch(request);
        if (res.status === 200 || res.status === 304) {
          return res;
        }
      } catch {
        // Fallback to SSR
      }
    }

    // 3. Dynamic routes, SSR pages, mutations
    return server.fetch(request, env, ctx);
  }
};
`;

  fs.writeFileSync(path.join(clientDir, "_worker.js"), workerContent, "utf-8");
  console.log(
    "✓ Cloudflare Pages _worker.js generated successfully in dist/client",
  );
}
