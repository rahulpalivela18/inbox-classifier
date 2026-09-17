import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

// Side-effect module: loads .env into process.env as soon as it is imported.
//
// It MUST stay the first import in src/index.ts. ES modules evaluate their
// imports depth-first, before the importing file's own code runs — so config
// placed in index.ts's body would execute only after the app -> routes -> db
// chain below has already loaded, and the DB client throws without
// DATABASE_URL. As an import listed first, this runs before all of that.
//
// dotenv only looks in the working directory by default, but npm runs
// workspace scripts with cwd set to the package folder
// (artifacts/api-server) while .env lives at the repo root, hence the
// upward walk.
let dir: string | null = process.cwd();
for (let depth = 0; depth < 8 && dir; depth++) {
  const candidate = path.join(dir, ".env");
  if (existsSync(candidate)) {
    loadEnv({ path: candidate });
    break;
  }
  const parent = path.dirname(dir);
  dir = parent === dir ? null : parent;
}
