// Regenerates demo data (schedule starts today). Stop the server first, or use Settings → Reset in the app.
import fs from "node:fs";
import path from "node:path";
import { buildSeedDatabase } from "../src/server/seed";

const file = path.resolve(process.env.MCP_DATA_FILE || path.join(process.cwd(), ".data", "monrovia-cinema-plus.json"));
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(buildSeedDatabase(new Date())));
console.log(`Demo data reset: ${file}`);
