import { defineConfig } from "vite";

const sandboxPort = process.env.BB_SANDBOX_PORT ?? "3030";
if (!/^\d{1,5}$/.test(sandboxPort) || Number(sandboxPort) < 1 || Number(sandboxPort) > 65535) {
  throw new Error("BB_SANDBOX_PORT must be a valid TCP port.");
}

export default defineConfig({
  resolve: { preserveSymlinks: true },
  server: { strictPort: true },
  preview: { strictPort: true },
  plugins: [{
    name: "budgetbranch-sandbox-views",
    configureServer(server) {
      server.middlewares.use("/sandbox-rpc", forwardSandboxView);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/sandbox-rpc", forwardSandboxView);
    },
  }],
});

// Sandbox's RPC also exposes privileged local operations. Forward only the two
// reads this screen uses, to a fixed loopback endpoint.
async function forwardSandboxView(request, response) {
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  try {
    if (request.method !== "POST" || request.url !== "/") {
      response.writeHead(405).end();
      return;
    }
    const length = Number(request.headers["content-length"]);
    if (!Number.isInteger(length) || length < 1 || length > 2048) {
      response.writeHead(400).end();
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      response.writeHead(400).end();
      return;
    }
    const query = body?.params;
    const isSnapshot = body?.method === "query"
      && query?.request_type === "call_function"
      && query?.finality === "final"
      && typeof query?.account_id === "string"
      && query.account_id.length <= 64
      && query?.method_name === "get_snapshot"
      && query?.args_base64 === "e30=";
    if (body?.jsonrpc !== "2.0" || (body.method !== "status" && !isSnapshot)) {
      response.writeHead(403).end();
      return;
    }
    // Reconstruct parameters so callers cannot attach extra RPC query fields.
    const params = isSnapshot ? {
      request_type: "call_function",
      finality: "final",
      account_id: query.account_id,
      method_name: "get_snapshot",
      args_base64: "e30=",
    } : [];
    const rpc = await fetch(`http://127.0.0.1:${sandboxPort}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: body.id, method: body.method, params }),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    const payload = await rpc.text();
    response.writeHead(rpc.status).end(payload);
  } catch {
    response.writeHead(502).end(JSON.stringify({ error: "Local Sandbox RPC unavailable or invalid request" }));
  }
}
