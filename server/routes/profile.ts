import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getProfile, putProfile } from "../db.ts";
import { Profile } from "../schema.ts";

const ROOT = resolve(import.meta.dir, "..", "..");
const UPLOADS_DIR = resolve(ROOT, "assets", "uploads");

const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const profileRoutes = new Hono()
  .get("/", (c) => c.json(getProfile()))
  .put("/", zValidator("json", Profile), (c) => {
    putProfile(c.req.valid("json"));
    return c.json(getProfile());
  })
  .post("/photo", async (c) => {
    const form = await c.req.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) {
      return c.json({ error: "missing 'photo' file field" }, 400);
    }
    const ext = ALLOWED_PHOTO_TYPES[file.type];
    if (!ext) {
      return c.json(
        { error: `unsupported type ${file.type}; use jpeg/png/webp` },
        400,
      );
    }
    if (file.size > 8 * 1024 * 1024) {
      return c.json({ error: "image too large (max 8 MB)" }, 400);
    }
    const filename = `profile-${Date.now()}${ext}`;
    const rel = `assets/uploads/${filename}`;
    const abs = resolve(UPLOADS_DIR, filename);
    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(abs, Buffer.from(await file.arrayBuffer()));
    const profile = getProfile();
    profile.photo_path = rel;
    putProfile(profile);
    return c.json(getProfile());
  });
