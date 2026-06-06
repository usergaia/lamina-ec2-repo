# DOCUMENTATION

![Quote of the Day](https://github.com/usergaia/lamina-cloud-labs/actions/workflows/w8-quotes.yml/badge.svg)

Week 8 builds a complete CI/CD pipeline with GitHub Actions that publishes a "Quote of the Day" page to GitHub Pages. A quote is pulled from the API Ninjas quotes API once a day, baked into a static page at build time, and deployed automatically. The pipeline runs unit tests before every deploy, keeps the API key in a secret, and refreshes the quote on a daily schedule.

Live page: `https://usergaia.github.io/lamina-cloud-labs/`

## Quick Start

For anyone cloning this repository who wants to build and preview the page locally.

Prerequisites: Node 20+ and a free API key from api-ninjas.com.

```powershell
cd w8/src

# 1. Create a .env file containing: QUOTES_API_KEY=your-api-key

# 2. Run the unit tests (no network needed)
npm test

# 3. Build the page (fetches one quote, writes dist/)
node build.js

# 4. Preview over a local server (the page fetches data.json)
python -m http.server --directory dist
# then open http://localhost:8000
```

The deployed site is produced by the same `build.js`, run by GitHub Actions. Nothing here runs on a server: GitHub Pages only serves the finished static files.

## I. Why the quote is fetched at build time

GitHub Pages is a static host. It serves files exactly as they are and cannot run any server-side code. That rules out calling the quotes API from the browser for two reasons: the API key would have to be embedded in client-side JavaScript where anyone can read it, and API Ninjas rejects cross-origin browser requests anyway.

The pipeline avoids both problems by fetching on the GitHub Actions runner instead. The runner holds the key (from a secret), calls the API, and writes the result into a plain `data.json` file that ships with the page. The browser then loads `data.json` from the same site, which is an ordinary static file request with no key involved.

Result: the API key never leaves the build environment, and the published page is pure static content.

## II. The Node project

The project lives in `w8/src/` and has no third-party dependencies. It uses Node's built-in `fetch`, test runner, and `.env` loader.

```
w8/src/
  public/          static page served as-is
    index.html     markup, links styles.css and app.js
    styles.css     all styling
    app.js         reads data.json and fills in the page
  render.js        builds data.json from a quote and a date
  render.test.js   unit tests for render.js
  build.js         fetch or reuse a quote, then write dist/
  package.json     scripts: build, test
```

The page is split by concern. `build.js` never edits the HTML: it copies `public/` into `dist/` unchanged and drops a freshly generated `data.json` beside it. `app.js` then fetches that file and fills the page in.

File: `w8/src/render.js`

```js
export function renderData(quote, date) {
  const data = { quote: quote.quote, date };
  if (quote.author) data.author = quote.author;
  if (quote.work) data.work = quote.work;
  if (quote.category && quote.category.length) data.category = quote.category;
  return JSON.stringify(data);
}
```

`quote` is always present; `author`, `work`, and `category` are optional and included only when the API returns them. `category` may be a single string or an array of strings. Keeping this in a small pure function is what lets the test job check it without any network access.

Result: `data.json` always has the quote and date, plus whatever optional fields exist for that quote.

## III. Fetching and the daily cache

To stay well within the API's limits, the pipeline fetches at most once per day and reuses that quote for the rest of the day. `build.js` keeps the day's quote in `cache/quote.json`; if the file is present it is reused, otherwise a new quote is fetched and written.

File: `w8/src/build.js` (cache logic)

```js
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
```

In CI the cache file is persisted between runs by `actions/cache`, keyed by the date so it resets each morning (see Section V). Setting `FORCE_FETCH=true` skips the cache and pulls a fresh quote, which the workflow exposes as a manual `force_fetch` toggle.

Result: the same quote stays on the page all day across any number of pushes or reruns; one fresh quote appears after the daily reset. Net API usage is about one call per day.

## IV. Secrets and the API key

The API key is never written into the code or committed. `build.js` reads it from `process.env.QUOTES_API_KEY`, and Node's `process.loadEnvFile` fills that variable from a local `.env` file:

File: `w8/src/build.js`

```js
// Local dev: load the key from .env. In CI there is no .env,
// so QUOTES_API_KEY comes from the secret instead.
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {}

const API_KEY = process.env.QUOTES_API_KEY;
```

Locally the key lives in a gitignored `.env` (`QUOTES_API_KEY=your-key`), loaded by `process.loadEnvFile`. In CI there is no `.env`, so the `try/catch` quietly does nothing and the workflow injects the key from a GitHub secret into the same variable. Either way `build.js` reads the same `process.env.QUOTES_API_KEY`.

To configure the secret: repo Settings, then Secrets and variables, then Actions, then New repository secret, named `QUOTES_API_KEY`.

Result: the key exists only in the gitignored `.env` (locally) and in GitHub's secret store (CI). It is in no committed file, and not in the deployed page, which can be confirmed with View Source.

## V. The workflow

File: `.github/workflows/w8-quotes.yml`

The pipeline runs on three triggers:

```yaml
on:
  workflow_dispatch:
  push:
    branches: [main]
    paths: ["w8/src/**", ".github/workflows/w8-quotes.yml"]
  schedule:
    - cron: "0 21 * * *" # daily
```

- push: deploys when the quote app or its workflow changes.
- schedule: the daily refresh. GitHub cron is UTC, so `0 21 * * *` is 05:00 PHT. The minimum interval is five minutes and scheduled runs can lag, so cron is not used for testing.
- workflow_dispatch: manual runs, used for testing since they fire instantly.

There are two jobs. `test` runs `npm install` then `npm test`, and `build-and-deploy` has `needs: test`, so a failing test blocks the deploy.

The daily cache resets at 05:00 PHT. GitHub Actions runs in UTC, so the cache key is the date of `UTC + 3h`, which rolls over at 21:00 UTC (05:00 PHT):

```yaml
- name: Compute reset-window key (rolls at 05:00 PHT)
  id: d
  run: echo "key=$(date -u -d '+3 hours' +%F)" >> "$GITHUB_OUTPUT"

- name: Restore cached quote
  if: ${{ inputs.force_fetch != true }}
  uses: actions/cache@v4
  with:
    path: w8/src/cache
    key: quote-${{ steps.d.outputs.key }}
```

Result: the first build after 05:00 PHT misses the cache and fetches once; every build before the next 05:00 reuses it; a manual run with `force_fetch=true` bypasses the cache entirely.

## VI. Deploying to GitHub Pages

The deploy job builds the page and publishes `dist/` with the official GitHub Pages actions.

```yaml
- name: Build page (cache-or-fetch)
  working-directory: w8/src
  env:
    QUOTES_API_KEY: ${{ secrets.QUOTES_API_KEY }}
    FORCE_FETCH: ${{ inputs.force_fetch }}
  run: node build.js

- uses: actions/configure-pages@v5
- uses: actions/upload-pages-artifact@v3
  with: { path: w8/src/dist }
- uses: actions/deploy-pages@v4
  id: deployment
```

This needs `pages: write` and `id-token: write` permissions on the workflow, and the repository must be set to publish from Actions: Settings, then Pages, then Source = GitHub Actions.

Result: each successful run publishes the page to `https://usergaia.github.io/lamina-cloud-labs/`. The URL is also shown on the run's `github-pages` environment.

## VII. Verifying locally

```powershell
cd w8/src
# the key is read from .env (QUOTES_API_KEY=your-key)
npm test                                 # tests pass with no network
node build.js                            # "Cache miss, fetched a quote." -> dist/
node build.js                            # "Cache hit, reusing today's quote."
python -m http.server --directory dist   # open http://localhost:8000
```

Preview over a local server, not by double-clicking `dist/index.html`: the page fetches `data.json`, and browsers block fetch on `file://`. On GitHub Pages it is served over HTTP, so it works. To force a fresh quote locally, set `FORCE_FETCH=true` before running `node build.js`.
