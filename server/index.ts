import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hostHeaderValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { createBridge, deleteBridge, getBridgeEvents, updateBridge } from "./bridge-store.js";
import { environmentSnapshotSchema } from "./schemas.js";
import { mcpHandler } from "./mcp.js";

const port = Number(process.env.PORT ?? 8080);
const distDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist");
const allowedHostnames = (process.env.ALLOWED_HOSTNAMES ?? "localhost,127.0.0.1,sensorium-devsnorte.fly.dev")
  .split(",")
  .map((hostname) => hostname.trim())
  .filter(Boolean);
const validateHost = hostHeaderValidation(allowedHostnames);
const validateOrigin = originValidation(allowedHostnames);
const handleMcp = toNodeHandler(mcpHandler, { onerror: (error) => console.error("[mcp]", error) });

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

function setSecurityHeaders(res: ServerResponse) {
  res.setHeader("Origin-Agent-Cluster", "?1");
  res.setHeader("Permissions-Policy", "tools=(self), camera=(self), microphone=(self), geolocation=(self), bluetooth=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self), ambient-light-sensor=(self)");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function json(res: ServerResponse, status: number, body: unknown) {
  setSecurityHeaders(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function writeToken(req: IncomingMessage) {
  const authorization = req.headers.authorization;
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL) {
  if (!validateHost(req, res) || !validateOrigin(req, res)) return;
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "POST" && url.pathname === "/api/bridges") {
    const parsed = environmentSnapshotSchema.safeParse(await readJson(req));
    if (!parsed.success) return json(res, 400, { error: "Invalid environment snapshot.", issues: parsed.error.issues });
    const bridge = await createBridge(parsed.data);
    return json(res, 201, {
      code: bridge.code,
      writeToken: bridge.writeToken,
      expiresAt: bridge.expiresAt,
      mcpUrl: `${url.protocol}//${url.host}/mcp`,
    });
  }

  if (parts[0] === "api" && parts[1] === "bridges" && parts[2]) {
    const code = parts[2];
    const secret = writeToken(req);
    if (req.method === "PUT" && parts.length === 3) {
      const parsed = environmentSnapshotSchema.safeParse(await readJson(req));
      if (!parsed.success) return json(res, 400, { error: "Invalid environment snapshot." });
      const updated = await updateBridge(code, secret, parsed.data);
      return json(res, updated ? 200 : 404, { updated });
    }
    if (req.method === "DELETE" && parts.length === 3) {
      const deleted = await deleteBridge(code, secret);
      return json(res, deleted ? 200 : 404, { deleted });
    }
    if (req.method === "GET" && parts[3] === "events") {
      const events = await getBridgeEvents(code, secret, url.searchParams.get("after") ?? undefined);
      return events ? json(res, 200, { events }) : json(res, 404, { error: "Bridge not found." });
    }
  }

  return json(res, 404, { error: "Not found." });
}

async function serveStatic(res: ServerResponse, pathname: string) {
  let candidate = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  let filePath = path.resolve(distDirectory, candidate);
  if (!filePath.startsWith(`${distDirectory}${path.sep}`)) return json(res, 403, { error: "Forbidden." });

  try {
    if (!(await stat(filePath)).isFile()) throw new Error("not a file");
  } catch {
    candidate = "index.html";
    filePath = path.resolve(distDirectory, candidate);
  }

  setSecurityHeaders(res);
  const immutable = candidate.startsWith("assets/");
  res.writeHead(200, {
    "Content-Type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host ?? "localhost";
    const forwardedProtocol = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
    const protocol = forwardedProtocol === "https" ? "https" : "http";
    const url = new URL(req.url ?? "/", `${protocol}://${host}`);
    if (url.pathname === "/healthz") return json(res, 200, { status: "ok", service: "sensorium", mcp: "/mcp" });
    if (url.pathname === "/mcp") {
      if (!validateHost(req, res) || !validateOrigin(req, res)) return;
      return void handleMcp(req, res);
    }
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "Method not allowed." });
    return await serveStatic(res, url.pathname);
  } catch (error) {
    console.error("[http]", error);
    if (!res.headersSent) json(res, 500, { error: "Internal server error." });
    else res.end();
  }
});

server.listen(port, "0.0.0.0", () => {
  console.error(`[sensorium] web + MCP listening on http://0.0.0.0:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await mcpHandler.close();
    server.close(() => process.exit(0));
  });
}
