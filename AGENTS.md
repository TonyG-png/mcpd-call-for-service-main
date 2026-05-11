# Agent Instructions

These rules apply to all changes made in this repository.

## Security And Secrets

1. Do not place API keys, database passwords, tokens, credentials, or other secrets in source code.
2. Use environment variables for configuration values that differ by environment.
3. When adding new configuration, update `.env.example` with safe placeholder values and a short description when useful.
4. Do not send sensitive law enforcement data to any external LLM provider.
5. Keep all LLM calls server-side only. Do not expose LLM provider calls, API keys, or prompt orchestration in browser/client code.
6. Add clear comments for any security-sensitive code so reviewers can understand the threat model and intended safeguards.
7. The Montgomery County calls-for-service data used by this application is public data. Local Ollama-based indexing, embedding, retrieval, and search may use the full public dataset.
8. Do not treat local Ollama as an external LLM provider when it runs on the user's machine or trusted local infrastructure.

## LLM Architecture

1. Prefer a retrieval-augmented generation (RAG) design over model fine tuning.
2. Keep sensitive data access, filtering, redaction, and LLM request construction on trusted server-side code.
3. Ollama search should be implemented as local/server-side RAG over the public dataset, using a local embedding model such as `nomic-embed-text`.

## Documentation

1. When adding features, update `README.md` with setup and testing instructions.
2. Document any new environment variables in `.env.example`.

## Verification

Before finalizing changes, run lint, typecheck, and build commands if they are available in this repository.
