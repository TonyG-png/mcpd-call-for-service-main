import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { PDFParse } from "pdf-parse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const approvedDir = path.join(rootDir, "data", "approved");

loadEnv(path.join(rootDir, ".env"));

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const dbPath = path.resolve(rootDir, process.env.RAG_DATABASE_PATH || "data/rag/rag.sqlite");
const dbDir = path.dirname(dbPath);
const SUPPORTED_EXTENSIONS = new Set([".csv", ".json", ".txt", ".pdf", ".md", ".markdown"]);
const MIN_CHUNK_WORDS = 500;
const MAX_CHUNK_WORDS = 1000;

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

function assertInsideApproved(filePath) {
  const resolvedApproved = path.resolve(approvedDir);
  const resolvedFile = path.resolve(filePath);
  const relative = path.relative(resolvedApproved, resolvedFile);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to ingest outside data/approved: ${resolvedFile}`);
  }
}

async function listApprovedFiles(dir = approvedDir) {
  if (!existsSync(dir)) return [];

  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    assertInsideApproved(entryPath);

    if (entry.isDirectory()) {
      files.push(...await listApprovedFiles(entryPath));
      continue;
    }

    if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }

  return files;
}

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await readFile(filePath);

  if (buffer.length === 0) return "";
  if (ext === ".pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return parsed.text || "";
    } finally {
      await parser.destroy();
    }
  }

  const text = buffer.toString("utf8");
  if (ext === ".json") {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  return text;
}

function chunkText(text) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const chunks = [];

  for (let start = 0; start < words.length; start += MAX_CHUNK_WORDS) {
    const chunkWords = words.slice(start, start + MAX_CHUNK_WORDS);

    if (chunkWords.length < MIN_CHUNK_WORDS && chunks.length > 0) {
      chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${chunkWords.join(" ")}`;
    } else {
      chunks.push(chunkWords.join(" "));
    }
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}

async function embed(text) {
  const resp = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, input: text }),
  });

  if (resp.ok) {
    const data = await resp.json();
    if (Array.isArray(data.embeddings) && Array.isArray(data.embeddings[0])) return data.embeddings[0];
    if (Array.isArray(data.embedding)) return data.embedding;
  }

  const fallbackResp = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, prompt: text }),
  });

  if (!fallbackResp.ok) {
    throw new Error(`Ollama embedding failed: ${fallbackResp.status} ${fallbackResp.statusText}`);
  }

  const data = await fallbackResp.json();
  return data.embedding;
}

async function openDatabase() {
  await mkdir(dbDir, { recursive: true });

  const SQL = await initSqlJs();
  const db = existsSync(dbPath)
    ? new SQL.Database(new Uint8Array(await readFile(dbPath)))
    : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_path TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      ingested_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      embedding_model TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      UNIQUE (document_id, chunk_index)
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
  `);

  return db;
}

function saveDatabase(db) {
  return writeFile(dbPath, Buffer.from(db.export()));
}

function getDocumentId(db, sourcePath) {
  const stmt = db.prepare("SELECT id FROM documents WHERE source_path = ?");
  try {
    if (stmt.step()) return stmt.getAsObject().id;
    return null;
  } finally {
    stmt.free();
  }
}

function upsertDocument(db, filePath, text, sha256) {
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  const existingId = getDocumentId(db, relativePath);

  if (existingId) {
    db.run("DELETE FROM chunks WHERE document_id = ?", [existingId]);
    db.run(
      "UPDATE documents SET file_name = ?, file_type = ?, sha256 = ?, word_count = ?, ingested_at = ? WHERE id = ?",
      [
        path.basename(filePath),
        path.extname(filePath).toLowerCase().slice(1),
        sha256,
        text.split(/\s+/).filter(Boolean).length,
        new Date().toISOString(),
        existingId,
      ],
    );
    return existingId;
  }

  db.run(
    "INSERT INTO documents (source_path, file_name, file_type, sha256, word_count, ingested_at) VALUES (?, ?, ?, ?, ?, ?)",
    [
      relativePath,
      path.basename(filePath),
      path.extname(filePath).toLowerCase().slice(1),
      sha256,
      text.split(/\s+/).filter(Boolean).length,
      new Date().toISOString(),
    ],
  );

  return db.exec("SELECT last_insert_rowid() AS id")[0].values[0][0];
}

function insertChunk(db, documentId, chunkIndex, text, embedding) {
  db.run(
    "INSERT INTO chunks (document_id, chunk_index, text, word_count, embedding_model, embedding_json) VALUES (?, ?, ?, ?, ?, ?)",
    [
      documentId,
      chunkIndex,
      text,
      text.split(/\s+/).filter(Boolean).length,
      OLLAMA_EMBED_MODEL,
      JSON.stringify(embedding),
    ],
  );
}

async function ingestFile(db, filePath) {
  assertInsideApproved(filePath);

  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  const text = (await extractText(filePath)).trim();

  if (!text) {
    console.warn(`[skip] ${relativePath}: empty file or no extractable text`);
    return { files: 0, chunks: 0 };
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    console.warn(`[skip] ${relativePath}: no text chunks produced`);
    return { files: 0, chunks: 0 };
  }

  const sha256 = createHash("sha256").update(text).digest("hex");
  const documentId = upsertDocument(db, filePath, text, sha256);

  let chunkCount = 0;
  for (const [index, chunk] of chunks.entries()) {
    const embedding = await embed(chunk);
    insertChunk(db, documentId, index, chunk, embedding);
    chunkCount += 1;
  }

  console.log(`[ok] ${relativePath}: ${chunkCount} chunks`);
  return { files: 1, chunks: chunkCount };
}

async function main() {
  console.log(`Approved data folder: ${path.relative(rootDir, approvedDir).replace(/\\/g, "/")}`);
  console.log(`RAG database: ${path.relative(rootDir, dbPath).replace(/\\/g, "/")}`);
  console.log(`Ollama embeddings: ${OLLAMA_EMBED_MODEL} at ${OLLAMA_BASE_URL}`);

  const files = await listApprovedFiles();
  if (files.length === 0) {
    console.warn("[done] No approved files found. Add files under data/approved and run ingestion again.");
    return;
  }

  const db = await openDatabase();
  let ingestedFiles = 0;
  let ingestedChunks = 0;
  let errors = 0;

  for (const filePath of files) {
    try {
      const result = await ingestFile(db, filePath);
      ingestedFiles += result.files;
      ingestedChunks += result.chunks;
      await saveDatabase(db);
    } catch (error) {
      errors += 1;
      const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
      console.error(`[error] ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await saveDatabase(db);
  db.close();

  console.log(`[done] ${ingestedFiles} files ingested, ${ingestedChunks} chunks stored, ${errors} errors`);
  if (errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[fatal] ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exitCode = 1;
});
