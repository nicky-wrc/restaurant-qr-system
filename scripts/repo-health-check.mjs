/**
 * Repo health checks (README encoding, table label sort sanity).
 * Writes NDJSON to debug-35451f.log when DEBUG_SESSION=35451f.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOG_PATH = path.resolve(ROOT, "debug-35451f.log");
const SESSION_ID = "35451f";
const ENDPOINT =
  "http://127.0.0.1:7463/ingest/6be736c1-e5b6-4f65-b62f-28679c470d2f";

function log(hypothesisId, location, message, data, runId = "pre-fix") {
  const entry = {
    sessionId: SESSION_ID,
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  fs.appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
  fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": SESSION_ID,
    },
    body: JSON.stringify(entry),
  }).catch(() => {});
}

function detectEncoding(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return "utf-16le-bom";
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return "utf-16be-bom";
  }
  if (buffer.length >= 4 && buffer[1] === 0 && buffer[0] === 0x23) {
    return "utf-16le";
  }
  return "utf-8";
}

function checkReadme() {
  const readmePath = path.join(ROOT, "README.md");
  if (!fs.existsSync(readmePath)) {
    log("H3", "repo-health-check.mjs:readme", "README missing", { readmePath });
    return { ok: false, reason: "missing" };
  }
  const buf = fs.readFileSync(readmePath);
  const encoding = detectEncoding(buf);
  const isUtf16 = encoding.startsWith("utf-16");
  const empty = buf.length < 80;
  const startsWithHash = buf[0] === 0x23;
  log("H1", "repo-health-check.mjs:readme", "Working tree README", {
    size: buf.length,
    encoding,
    isUtf16,
    empty,
    startsWithHash,
    hexHead: buf.slice(0, 8).toString("hex"),
  });
  return { ok: !isUtf16 && !empty && startsWithHash, encoding, size: buf.length };
}

function naturalSortLabels(labels) {
  return [...labels].sort((a, b) =>
    a.localeCompare(b, "th", { numeric: true, sensitivity: "base" }),
  );
}

function checkTableSort() {
  const labels = ["โต๊ะ 1", "โต๊ะ 10", "โต๊ะ 2", "โต๊ะ 3"];
  const lex = [...labels].sort();
  const numeric = naturalSortLabels(labels);
  const lexWrong = lex[1] === "โต๊ะ 10" && lex[2] === "โต๊ะ 2";
  const naturalOk =
    numeric.join("|") === ["โต๊ะ 1", "โต๊ะ 2", "โต๊ะ 3", "โต๊ะ 10"].join("|");
  log("H6", "repo-health-check.mjs:sort", "Table label sort comparison", {
    lex,
    numeric,
    lexWrong,
    naturalOk,
  });
  return { lex, numeric, lexWrong, naturalOk };
}

async function checkGitHubReadme() {
  try {
    const res = await fetch(
      "https://api.github.com/repos/nicky-wrc/restaurant-qr-system/readme",
    );
    if (!res.ok) {
      log("H5", "repo-health-check.mjs:github", "GitHub API failed", {
        status: res.status,
      });
      return { ok: false };
    }
    const j = await res.json();
    const buf = Buffer.from(j.content, "base64");
    const encoding = detectEncoding(buf);
    log("H5", "repo-health-check.mjs:github", "Remote README via API", {
      size: buf.length,
      encoding,
      isUtf16: encoding.startsWith("utf-16"),
      hexHead: buf.slice(0, 8).toString("hex"),
    });
    return { ok: !encoding.startsWith("utf-16") && buf.length > 80 };
  } catch (e) {
    log("H5", "repo-health-check.mjs:github", "GitHub fetch error", {
      error: String(e),
    });
    return { ok: false };
  }
}

const readme = checkReadme();
const sort = checkTableSort();
const github = await checkGitHubReadme();

const failed = [];
if (!readme.ok) failed.push("README encoding or content invalid on disk");
if (!sort.naturalOk) failed.push("Natural table label sort logic broken");
if (!github.ok) failed.push("GitHub README check failed or offline");

log(
  "SUMMARY",
  "repo-health-check.mjs:summary",
  failed.length ? "Checks failed" : "All checks passed",
  { readme, sort, github, failed },
);

if (failed.length) {
  console.error("repo-health-check FAILED:\n", failed.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log("repo-health-check OK");
