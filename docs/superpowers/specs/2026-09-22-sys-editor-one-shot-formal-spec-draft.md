# Sys Editor one-shot Formal Spec draft

## Status

Design and written specification approved by the user on 2026-09-22.

## Goal

Let a user turn a saved plain-language requirement into an editable Formal Spec from Sys Editor without configuring or invoking a provider CLI in a terminal. Use the model already selected in SideX, keep the generated draft out of ordinary chat history, and preserve Sys Platform as the deterministic validator.

## User flow

1. The user saves a requirement and clicks **Draft spec from request**.
2. If the project lacks a Sys Platform workspace, Editor asks before initializing `.sys` through the existing background task transport. Existing requirements remain untouched.
3. Editor sends only the requirement text and the selected model id to a dedicated one-shot endpoint on the local SideX server.
4. The server returns candidate Formal Spec text without creating or appending a chat session.
5. Editor writes the candidate to a temporary file under the initialized `.sys/proposals` directory and invokes the existing CLI with `requirement --file <intent> --draft-file <candidate> --draft-only --json`.
6. Sys Platform validates through the existing Formal Spec parser and Ontology compiler. On success, Editor removes the temporary file, writes the candidate to the requirement's editable spec file, and opens it. On provider or validation failure, Editor removes the temporary file and shows the error; the existing spec is unchanged.
7. The user reviews and edits the draft. No provider output is approved or applied automatically.

## Components and boundary

- **Sys Editor** owns the interaction, the selected model id, the temporary candidate file, and presentation of errors. The draft request uses the existing SideX model selection and local-server endpoint resolution.
- **SideX server** adds one authenticated, non-streaming `POST /sys/draft-spec` endpoint under the protected API router. The request contains only `{ model, intent }`; the response contains `{ draftSpec }`. The server calls the existing provider client with the authenticated user's configured provider and a server-owned prompt. It does not create a session, write a transcript, expose tools, or add repository context.
- **Sys Platform CLI** remains the authority for parsing and compiling the candidate. The existing `--draft-file --draft-only --json` path is reused; no provider command is written to `.sys/config.json`.

The server prompt asks for only a candidate in the existing Formal Spec grammar and forbids invented rules. Parser/compiler errors remain visible to the user; a model claim that its draft is valid is never treated as evidence. The model is never treated as an authority.

## Data handling and failure behavior

- Send the saved requirement text and selected model id only. Do not send source files, workspace paths, chat messages, provider credentials, or hidden chat context.
- Keep provider authentication on the existing SideX server. Never persist credentials in the workspace or draft file.
- Enforce a bounded request body and request timeout on the endpoint; return structured errors for unavailable model/provider and invalid output.
- Use one request per user action; no autonomous retries.
- Clean up the temporary candidate on every success and failure path. Do not overwrite an existing spec without the existing replacement confirmation.
- If the local AI server is unavailable or no model/provider is configured, show an actionable Editor message pointing to SideX Settings. Do not direct the user to a terminal.

## Tests and verification

- Go handler tests prove the endpoint uses the authenticated user and requested model, returns the candidate, does not persist a chat session/transcript, and does not expose tools or workspace context.
- TypeScript tests cover endpoint request/response validation, selected model propagation, server/HTTP failures, and cleanup/validation gating.
- Reuse the Platform preview harness to prove candidate-file mode validates without changing governed Platform state.
- Run affected Go tests, the focused Sys Editor tests, Editor lint and production build, then the Platform draft-preview harness.
- Manually verify in Tauri that no terminal is required, the normal chat history is unchanged, invalid drafts are not opened as valid specs, and a validated candidate opens for user review.

## Scope limits

This change replaces only the **Formal Spec drafting** provider setup. The later code-generation stage still uses Sys Platform's separately configured `codeGenerator`; connecting that stage to the in-app model is a separate design and remains outside this specification. Code proposal verification and explicit Apply approval rules remain unchanged.

## Self-review

- The only persisted candidate is the existing user-owned editable spec, and only after deterministic validation.
- Provider credentials stay behind the SideX server boundary.
- Draft output remains untrusted and cannot mutate governed requirement state.
- The feature does not add a new provider SDK or use chat history as an implicit transport.
- One explicit limitation remains: code generation still needs its own provider integration before the complete flow can avoid CLI-provider configuration end to end.
