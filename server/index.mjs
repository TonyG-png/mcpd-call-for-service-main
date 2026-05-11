import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

loadEnv(path.join(rootDir, ".env"));

const PORT = Number(process.env.PORT || 8787);
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "llama3.1:8b";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

const DATASET = {
  domain: "data.montgomerycountymd.gov",
  datasetId: "98cc-bc7d",
  title: "Montgomery County Police Calls for Service Dashboard",
};

const MAX_RECORDS = 50000;
const PAGE_SIZE = 5000;
const MAX_CONTEXT_RECORDS = 8;
const MAX_EMBED_CANDIDATES = 80;
const MIN_SUPPORT_SCORE = 0.18;
const INSUFFICIENT_CONTEXT_ANSWER = "I do not have enough information in the available data to answer that.";

let recordCache = null;
const embeddingCache = new Map();

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsAt = trimmed.indexOf("=");
    if (equalsAt === -1) continue;

    const key = trimmed.slice(0, equalsAt).trim();
    const value = trimmed.slice(equalsAt + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length > 2) || [];
}

function discoverFieldMappings(columns) {
  const mapping = {};

  for (const col of columns) {
    const fn = col.fieldName.toLowerCase();
    const nm = (col.name || "").toLowerCase();
    const isDate = col.dataTypeName === "calendar_date" || col.dataTypeName === "floating_timestamp";
    const isText = col.dataTypeName === "text";
    const isNum = col.dataTypeName === "number";

    if (!mapping.incidentId && ((fn.includes("incident") && (fn.includes("id") || fn.includes("number") || fn.includes("no"))) || fn === "cad_number" || fn === "case_number" || fn === "ccn" || (nm.includes("incident") && (nm.includes("id") || nm.includes("number"))))) mapping.incidentId = col.fieldName;
    if (!mapping.crNumber && (fn === "cr_number" || fn === "cr_no" || fn === "report_number" || (fn.includes("cr") && fn.includes("number")) || nm.includes("crime report") || nm.includes("case report"))) mapping.crNumber = col.fieldName;
    if (!mapping.crashReport && (fn.includes("crash") || fn.includes("collision") || nm.includes("crash") || nm.includes("collision"))) mapping.crashReport = col.fieldName;
    if (!mapping.startTime && isDate && (fn.includes("start") || fn.includes("dispatch") || fn.includes("received") || fn.includes("open") || fn.includes("call") || nm.includes("start") || nm.includes("dispatch"))) mapping.startTime = col.fieldName;
    if (!mapping.endTime && isDate && (fn.includes("end") || fn.includes("close") || fn.includes("clear") || nm.includes("end") || nm.includes("close") || nm.includes("clear"))) mapping.endTime = col.fieldName;
    if (!mapping.callType && isText && (fn.includes("type") || fn.includes("description") || fn.includes("nature") || fn.includes("initial_type") || fn.includes("call_type") || nm.includes("type") || nm.includes("nature") || nm.includes("description")) && !fn.includes("priority") && !fn.includes("address") && !fn.includes("city") && !fn.includes("district") && !fn.includes("beat") && !fn.includes("sector") && !fn.includes("location") && !fn.includes("status")) mapping.callType = col.fieldName;
    if (!mapping.priority && (fn.includes("priority") || fn.includes("severity") || nm.includes("priority"))) mapping.priority = col.fieldName;
    if (!mapping.district && isText && (fn.includes("district") || fn.includes("sector") || fn.includes("psa") || nm.includes("district") || nm.includes("police district")) && !fn.includes("beat") && !fn.includes("address")) mapping.district = col.fieldName;
    if (!mapping.beat && (fn.includes("beat") || fn.includes("reporting_area") || fn.includes("ra") || nm.includes("beat")) && !fn.includes("district") && fn !== "created_at") mapping.beat = col.fieldName;
    if (!mapping.address && isText && (fn.includes("address") || fn.includes("block") || (fn.includes("location") && !fn.includes("type"))) && !fn.includes("city") && !fn.includes("state") && !fn.includes("zip")) mapping.address = col.fieldName;
    if (!mapping.city && isText && (fn.includes("city") || fn === "city")) mapping.city = col.fieldName;
    if (!mapping.latitude && (fn.includes("latitude") || fn === "lat" || fn === "y") && (isNum || col.dataTypeName === "text")) mapping.latitude = col.fieldName;
    if (!mapping.longitude && (fn.includes("longitude") || fn === "lon" || fn === "lng" || fn === "long" || fn === "x") && (isNum || col.dataTypeName === "text")) mapping.longitude = col.fieldName;
    if (!mapping.serviceCategory && isText && (fn.includes("category") || fn.includes("service") || nm.includes("category")) && !fn.includes("type") && !fn.includes("address")) mapping.serviceCategory = col.fieldName;
  }

  if (!mapping.startTime) {
    const dateCol = columns.find((c) => c.dataTypeName === "calendar_date" || c.dataTypeName === "floating_timestamp");
    if (dateCol) mapping.startTime = dateCol.fieldName;
  }

  return mapping;
}

async function fetchSchema() {
  const url = `https://${DATASET.domain}/api/views/${DATASET.datasetId}.json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Schema fetch failed: ${resp.status}`);

  const meta = await resp.json();
  return (meta.columns || [])
    .filter((column) => column.fieldName && !column.fieldName.startsWith(":"))
    .map((column) => ({
      fieldName: column.fieldName,
      name: column.name || column.fieldName,
      dataTypeName: column.dataTypeName || "text",
    }));
}

async function fetchRows(mapping) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 28);

  const startDateISO = startDate.toISOString().split(".")[0];
  const timeField = mapping.startTime || "start_time";
  const baseUrl = `https://${DATASET.domain}/resource/${DATASET.datasetId}.json`;
  const whereClause = `${timeField} >= '${startDateISO}'`;

  const rows = [];
  let offset = 0;

  while (true) {
    const url = `${baseUrl}?$where=${encodeURIComponent(whereClause)}&$order=${timeField} DESC&$limit=${PAGE_SIZE}&$offset=${offset}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`SODA fetch failed: ${resp.status}`);

    const page = await resp.json();
    rows.push(...page);

    if (rows.length > MAX_RECORDS) {
      throw new Error(`RAG indexing stopped after ${MAX_RECORDS.toLocaleString()} records to protect local performance.`);
    }

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

function readMapped(row, mapping, field) {
  const key = mapping[field];
  if (!key) return undefined;
  return row[key];
}

function normalizeRow(row, mapping, index) {
  const incidentId = readMapped(row, mapping, "incidentId");
  const recordId = String(incidentId || row.incident_id || row.cad_number || row.case_number || `row-${index}`);
  const fields = {
    recordId,
    startTime: readMapped(row, mapping, "startTime"),
    endTime: readMapped(row, mapping, "endTime"),
    callType: readMapped(row, mapping, "callType"),
    priority: readMapped(row, mapping, "priority"),
    district: readMapped(row, mapping, "district"),
    beat: readMapped(row, mapping, "beat"),
    address: readMapped(row, mapping, "address"),
    city: readMapped(row, mapping, "city"),
    serviceCategory: readMapped(row, mapping, "serviceCategory"),
    crNumber: readMapped(row, mapping, "crNumber"),
    crashReport: readMapped(row, mapping, "crashReport"),
  };

  const rawSummary = Object.entries(row)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .slice(0, 24)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("; ");

  const text = [
    `Record ID: ${fields.recordId}`,
    fields.startTime && `Start time: ${fields.startTime}`,
    fields.callType && `Call type: ${fields.callType}`,
    fields.priority && `Priority: ${fields.priority}`,
    fields.district && `District: ${fields.district}`,
    fields.beat && `Beat: ${fields.beat}`,
    fields.address && `Address: ${fields.address}`,
    fields.city && `City: ${fields.city}`,
    fields.serviceCategory && `Service category: ${fields.serviceCategory}`,
    fields.crNumber && `Crime report: ${fields.crNumber}`,
    fields.crashReport && `Crash report: ${fields.crashReport}`,
    `Raw public fields: ${rawSummary}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: fields.recordId,
    fields,
    text: text.slice(0, 2600),
    tokens: tokenize(text),
  };
}

async function loadRecords() {
  if (recordCache) return recordCache;

  const columns = await fetchSchema();
  const mapping = discoverFieldMappings(columns);
  const rows = await fetchRows(mapping);
  const records = rows.map((row, index) => normalizeRow(row, mapping, index));

  recordCache = {
    loadedAt: new Date().toISOString(),
    records,
    mapping,
    count: records.length,
  };

  return recordCache;
}

function lexicalCandidates(records, question) {
  const terms = [...new Set(tokenize(question))];
  const scored = records.map((record) => {
    const tokenSet = new Set(record.tokens);
    const score = terms.reduce((total, term) => total + (tokenSet.has(term) ? 1 : 0), 0);
    return { record, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const matches = scored.filter((item) => item.score > 0).slice(0, MAX_EMBED_CANDIDATES);
  return matches.length > 0 ? matches : scored.slice(0, Math.min(25, scored.length));
}

async function embed(input) {
  const inputs = Array.isArray(input) ? input : [input];

  const resp = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, input: inputs }),
  });

  if (resp.ok) {
    const data = await resp.json();
    if (Array.isArray(data.embeddings)) return data.embeddings;
    if (Array.isArray(data.embedding)) return [data.embedding];
  }

  const embeddings = [];
  for (const text of inputs) {
    const fallbackResp = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, prompt: text }),
    });
    if (!fallbackResp.ok) {
      if (fallbackResp.status === 404) {
        throw new Error(`Ollama embedding model "${OLLAMA_EMBED_MODEL}" was not found. Run: ollama pull ${OLLAMA_EMBED_MODEL}`);
      }
      throw new Error(`Ollama embedding failed: ${fallbackResp.status}`);
    }
    const data = await fallbackResp.json();
    embeddings.push(data.embedding);
  }

  return embeddings;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let aMag = 0;
  let bMag = 0;

  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    dot += a[i] * b[i];
    aMag += a[i] * a[i];
    bMag += b[i] * b[i];
  }

  return aMag && bMag ? dot / (Math.sqrt(aMag) * Math.sqrt(bMag)) : 0;
}

async function rankRecords(question, records) {
  const candidates = lexicalCandidates(records, question);
  const questionEmbedding = (await embed(question))[0];

  const missing = candidates.filter(({ record }) => !embeddingCache.has(record.id));
  if (missing.length > 0) {
    const embeddings = await embed(missing.map(({ record }) => record.text));
    missing.forEach(({ record }, index) => embeddingCache.set(record.id, embeddings[index]));
  }

  return candidates
    .map(({ record, score }) => ({
      record,
      lexicalScore: score,
      score: cosineSimilarity(questionEmbedding, embeddingCache.get(record.id)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONTEXT_RECORDS);
}

function buildContext(rankedRecords) {
  return rankedRecords
    .map(({ record, score }, index) => `[${index + 1}] Record ID: ${record.id}\nSimilarity: ${score.toFixed(3)}\n${record.text}`)
    .join("\n\n---\n\n");
}

async function generateAnswer(question, rankedRecords) {
  const context = buildContext(rankedRecords);
  const sourcesUsed = rankedRecords.map(({ record }, index) => `[${index + 1}] ${record.id}`).join("\n");

  // Security-sensitive: the model is explicitly constrained to retrieved public records.
  // Do not add external tools, web access, or hidden data sources to this prompt path.
  const prompt = `You answer questions about public Montgomery County calls-for-service records.

Rules:
1. Answer only from the retrieved context.
2. If the retrieved context is insufficient, say exactly: "${INSUFFICIENT_CONTEXT_ANSWER}"
3. Do not guess.
4. Do not use outside knowledge unless the user asks for evidence-based methods for addressing public safety issues. For example, you may suggest evidence-based ways to address an auto theft trend, but the trend itself must be supported by retrieved context.
5. Cite source records or chunks used with bracketed citations like [1] or [2].
6. Include a short "Sources used" section under the answer.

Use this structure:
Answer:
<answer with citations>

Sources used:
<short bullet list of cited source IDs>

Available source IDs:
${sourcesUsed}

Question:
${question}

Retrieved context:
${context}

Answer:`;

  const resp = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_CHAT_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.1,
        num_ctx: 8192,
      },
    }),
  });

  if (!resp.ok) {
    if (resp.status === 404) {
      throw new Error(`Ollama chat model "${OLLAMA_CHAT_MODEL}" was not found. Run: ollama pull ${OLLAMA_CHAT_MODEL}`);
    }
    throw new Error(`Ollama generation failed: ${resp.status}`);
  }
  const data = await resp.json();
  return data.response || `Answer:\n${INSUFFICIENT_CONTEXT_ANSWER}\n\nSources used:\nNone.`;
}

function citationFromRanked(item, index) {
  const { record, score } = item;
  const snippet = record.text
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("Raw public fields:"))
    .slice(0, 8)
    .join(" | ");

  return {
    citation: `[${index + 1}]`,
    recordId: record.id,
    score: Number(score.toFixed(3)),
    snippet,
    fields: record.fields,
  };
}

async function handleRagSearch(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJson(req);
    const question = String(body.question || "").trim();

    if (question.length < 3) {
      sendJson(res, 400, { error: "Enter a question with at least 3 characters." });
      return;
    }

    const cache = await loadRecords();
    const rankedRecords = await rankRecords(question, cache.records);
    const supportedRecords = rankedRecords.filter((item) => item.score >= MIN_SUPPORT_SCORE);
    const contextRecords = supportedRecords.length > 0 ? supportedRecords : [];

    if (contextRecords.length === 0) {
      sendJson(res, 200, {
        answer: `Answer:\n${INSUFFICIENT_CONTEXT_ANSWER}\n\nSources used:\nNone.`,
        noSupportingRecords: true,
        citations: [],
        recordCount: cache.count,
        indexedAt: cache.loadedAt,
      });
      return;
    }

    const answer = await generateAnswer(question, contextRecords);

    sendJson(res, 200, {
      answer,
      noSupportingRecords: false,
      citations: contextRecords.map(citationFromRanked),
      recordCount: cache.count,
      indexedAt: cache.loadedAt,
    });
  } catch (error) {
    console.error("RAG search failed", error);
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "RAG search failed",
    });
  }
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

async function serveStatic(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const requestPath = decodeURIComponent(url.pathname);
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(distDir, safePath);

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = path.join(filePath, "index.html");
  } catch {
    filePath = path.join(distDir, "index.html");
  }

  try {
    const body = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/rag/search") {
    await handleRagSearch(req, res);
    return;
  }

  if (url.pathname === "/api/rag/health") {
    sendJson(res, 200, {
      ok: true,
      provider: "ollama",
      baseUrl: OLLAMA_BASE_URL,
      chatModel: OLLAMA_CHAT_MODEL,
      embedModel: OLLAMA_EMBED_MODEL,
      cachedRecords: recordCache?.count || 0,
    });
    return;
  }

  await serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`MCPD RAG server listening on http://localhost:${PORT}`);
});
