# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

The dashboard date filters include 7 days, 14 days, 28 days, and YTD. These ranges use complete calendar days and exclude the current partial day. Longer historical analysis should use server-side aggregate queries or cached reports instead of loading prior full-year raw records into the browser.

Response time metrics exclude Telephone Reporting Unit (TRU) calls. TRU calls are identified by call-type codes ending in `T`.

The Operations dashboard excludes `DT-Detail` calls from its cards and charts.

Operations call-type summaries group by the call-type code before the dash, so values such as `STAB` and `STAB-Stabbing` are treated as the same call type.

## Location Trend Summary

The Locations tab uses a precomputed static file for fast 12-month detail views:

```sh
npm run locations:summary
```

This command fetches the past 12 complete months of public calls-for-service records, groups them by normalized location and month, and writes `public/data/top-location-monthly-summary.json`. The generated file keeps high-interest locations only: top locations overall, top locations by district, and top locations by beat. This keeps location clicks fast without fetching a year of raw records in the browser.

The GitHub Actions workflow `.github/workflows/refresh-location-summary.yml` refreshes this file monthly and also supports manual runs from the GitHub Actions tab.

## Response Time Benchmarks

The Response Times tab compares the current filtered period against precomputed annual averages for the last three full calendar years:

```sh
npm run response-times:benchmarks
```

This writes `public/data/response-time-annual-benchmarks.json`. The script excludes TRU calls and automatically rolls forward each year by using the current year minus one, two, and three. The GitHub Actions workflow `.github/workflows/refresh-response-time-benchmarks.yml` refreshes this file monthly and supports manual `workflow_dispatch` runs from GitHub.

## Overview Benchmarks

The Overview tab compares the current filtered period against both a broad 3-year annual baseline and the same calendar window from the prior three full years:

```sh
npm run overview:benchmarks
```

This writes `public/data/overview-annual-benchmarks.json`. It stores annual totals plus daily summary rows, so the browser can compare YTD, 7-day, 14-day, or 28-day windows against the matching historical calendar window without pulling multiple years of raw records. The workflow `.github/workflows/refresh-overview-benchmarks.yml` refreshes the file monthly and can be run manually from GitHub.

For local RAG search during development, run the API server in a second terminal:

```sh
npm run server
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Local Ollama Search

The Montgomery County calls-for-service dataset used by this application is public data. The RAG search page may index and search the full public dataset with local Ollama.

Use local Ollama only for this workflow. Do not send calls-for-service records to external LLM providers.

Recommended local models:

```sh
ollama pull llama3.1:8b
ollama pull nomic-embed-text
```

Configuration lives in `.env` and should mirror `.env.example`:

```sh
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=llama3.1:8b
OLLAMA_EMBED_MODEL=nomic-embed-text
RAG_INDEX_SCOPE=all_public_records
```

The browser calls only `/api/rag/search`. The server route fetches approved public Socrata records, retrieves source records with local embeddings, and sends only retrieved context to local Ollama. Ollama calls must stay server-side.

Development:

```sh
npm run server
npm run dev
```

Production-style local run:

```sh
npm run build
npm start
```

Then open `http://localhost:8787/search`.

### Approved File Ingestion

Local RAG ingestion only reads files from `data/approved`. Do not place source files elsewhere for ingestion; the script refuses paths outside that folder.

Supported formats:

- `.csv`
- `.json`
- `.txt`
- `.pdf`
- `.md`
- `.markdown`

Add approved files under `data/approved`, then make sure Ollama is running and the embedding model is available:

```sh
ollama pull nomic-embed-text
```

Run ingestion:

```sh
npm run rag:ingest
```

The script splits extractable text into roughly 500 to 1,000 word chunks, generates embeddings through local Ollama, and stores documents/chunks in `data/rag/rag.sqlite`. Empty files are skipped, and file-level errors are logged clearly.

Before submitting feature changes, run the available checks:

```sh
npm run typecheck
npm run lint
npm run build
```

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
