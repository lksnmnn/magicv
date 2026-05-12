import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { llmRoutes } from "./routes/llm.ts";
import { profileRoutes } from "./routes/profile.ts";
import { projectRoutes } from "./routes/projects.ts";
import { renderRoutes } from "./routes/render.ts";
import { runRoutes } from "./routes/runs.ts";
import { skillRoutes } from "./routes/skills.ts";
import { tailorRoutes } from "./routes/tailor.ts";

const SERVE_STATIC = process.env.MAGICV_SERVE_STATIC === "1";

const app = new Hono();

// CORS: only allow the Vite dev origin; production serves SPA same-origin.
const ALLOWED_ORIGIN = /^http:\/\/(?:127\.0\.0\.1|localhost):5174$/;

app.use(async (c, next) => {
  await next();
  const origin = c.req.header("origin");
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    c.res.headers.set("Access-Control-Allow-Origin", origin);
  }
});

app.options("*", (c) => {
  const origin = c.req.header("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return new Response(null, { status: 204, headers });
});

app.route("/api/profile", profileRoutes);
app.route("/api/projects", projectRoutes);
app.route("/api", skillRoutes); // exposes /api/skills/* and /api/match
app.route("/api/tailor", tailorRoutes);
app.route("/api/llm", llmRoutes);
app.route("/api", renderRoutes); // exposes /api/preview and /api/render
app.route("/api/runs", runRoutes);

// Uploaded photos and bundled SVGs are served from the repo's ./assets/.
app.get("/assets/*", serveStatic({ root: "./" }));

if (SERVE_STATIC) {
  app.get("*", serveStatic({ root: "./web/dist" }));
}

const port = Number(process.env.PORT ?? 5173);

console.log(`[magiCV] listening on http://127.0.0.1:${port}`);

export default {
  hostname: "127.0.0.1",
  port,
  fetch: app.fetch,
};
