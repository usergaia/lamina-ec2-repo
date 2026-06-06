import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { renderData } from "./render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  //local
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {}

const API_KEY = process.env.QUOTES_API_KEY;
const FORCE = process.env.FORCE_FETCH === "true";
const QUOTES_URL = "https://api.api-ninjas.com/v1/quotes";

const PUBLIC = path.join(__dirname, "public");
const DIST = path.join(__dirname, "dist");
const CACHE = path.join(__dirname, "cache", "quote.json");

// Date in PHT (UTC+8), shown on the page.
function today() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

async function fetchQuote() {
  if (!API_KEY) {
    console.error("Missing QUOTES_API_KEY");
    process.exit(1);
  }
  const res = await fetch(QUOTES_URL, { headers: { "X-Api-Key": API_KEY } });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const [data] = await res.json();
  return {
    quote: data.quote,
    author: data.author,
    work: data.work,
    category: data.category,
  };
}

// Reuse today's cached quote, or fetch a new one.
async function getQuote() {
  if (!FORCE && fs.existsSync(CACHE)) {
    console.log("Cache hit, reusing today's quote.");
    return JSON.parse(fs.readFileSync(CACHE, "utf8"));
  }
  const quote = await fetchQuote();
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(quote));
  console.log(FORCE ? "Forced a fresh quote." : "Cache miss, fetched a quote.");
  return quote;
}

// Copy the static page into dist/ and write the generated data.json.
function publish(quote) {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.cpSync(PUBLIC, DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, "data.json"), renderData(quote, today()));
  console.log("Built dist/");
}

async function main() {
  const quote = await getQuote();
  publish(quote);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
