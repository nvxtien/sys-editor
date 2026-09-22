# Sys Editor one-shot Formal Spec Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let a Sys Editor user draft a Formal Spec from a saved plain-language requirement with the SideX-selected model, validate it through Sys Platform, and open only the validated candidate for review.

**Architecture:** Sys Editor sends `{ model, intent }` directly to the local SideX server's protected one-shot endpoint; the server uses its existing provider configuration and does not create a chat session. Editor writes the returned text to a temporary `.sys/proposals` file and invokes Sys Platform's existing `--draft-file --draft-only --json` path; it replaces the editable spec only after the Platform reports deterministic validation success.

**Tech Stack:** TypeScript (Sys Editor), Go (SideX server), Rust CLI (existing Sys Platform draft preview), Node tests, Go tests.

**Spec:** `docs/superpowers/specs/2026-09-22-sys-editor-one-shot-formal-spec-draft.md`

## Global Constraints

- Send only the saved requirement text and selected model id to SideX.
- Provider credentials remain on the SideX server.
- Do not create a chat session, append chat history, expose tools, or send workspace/source context.
- Sys Platform remains authoritative for Formal Spec parse and ontology compilation.
- Provider output is untrusted; never approve or apply it automatically.
- Remove the temporary candidate on every success and failure path.
- Do not overwrite a saved spec without the existing replacement confirmation.
- Provider or validation failure leaves the existing editable spec unchanged.
- Keep the later `codeGenerator` integration outside this change.
- Save authored Markdown under `docs/`; commit the spec and plan documents without an AI co-author trailer.

## Review Focus

- Empty or oversized intent: reject it before provider work; test empty and body-limit cases in the Go handler.
- Missing selected model/provider or SideX server: return a readable error that points users to SideX Settings; test missing model and provider failure.
- Provider response containing no text or too much text: reject it without writing a spec; test both cases.
- Malformed Platform JSON or a candidate rejected by the parser/compiler: clean up the temporary file and preserve the existing spec; test validation failure and cleanup.
- Existing non-empty spec: ask for replacement confirmation before requesting a provider draft; preserve it when the user cancels.

---

### Task 1: Add the SideX one-shot draft endpoint

**Files:**
- Create: `/Volumes/Work/dev/sys-editor/sidexai/sidex-server/internal/api/draft_spec.go`
- Create: `/Volumes/Work/dev/sys-editor/sidexai/sidex-server/internal/api/draft_spec_test.go`
- Modify: `/Volumes/Work/dev/sys-editor/sidexai/sidex-server/cmd/server/main.go`
- Modify: `/Volumes/Work/dev/sys-editor/sidexai/sidex-server/internal/ai/client.go`
- Test: `/Volumes/Work/dev/sys-editor/sidexai/sidex-server/internal/ai/client_test.go`

**Interfaces:**
- Consumes: `Handler.clientFor(model, auth.UserIDFromContext(r.Context()))`, `ai.Client.StreamChat`, and the existing `/v1` protected router.
- Produces: `POST /v1/sys/draft-spec`, accepting JSON `{ "model": string, "intent": string }` and returning JSON `{ "draftSpec": string }`.

- [ ] Add handler tests using an `httptest.Server` that returns OpenAI-compatible streaming text. Assert that the selected model is forwarded, the system prompt requests only Formal Spec text, the user message contains only the intent, and the request has no tools.
- [ ] Add handler tests for invalid JSON, missing model, blank intent, body over 64 KiB, empty provider output, output over 32 KiB, and provider failure. Expect 400 for invalid input, 502 for provider/output failures, and no session storage requirement.
- [ ] Run `cd sidexai/sidex-server && go test ./internal/api -run 'TestDraftSpec' -count=1` and confirm the new endpoint tests fail because the handler/route are absent.
- [ ] Add `Client.WithTimeout(timeout time.Duration) *Client` by shallow-copying the `http.Client` and setting the copy's timeout; preserve the existing client and transport configuration.
- [ ] Add an `internal/ai` test proving the returned client has the requested timeout and the original client's timeout is unchanged.
- [ ] Implement `Handler.DraftSpec`: cap input with `http.MaxBytesReader`, validate model/intent, call `h.clientFor` with the request user, pass no tools and a server-owned prompt to `StreamChat`, collect only text chunks up to 32 KiB, reject empty output, and return JSON without touching session or transcript stores.
- [ ] Register the handler at `/v1/sys/draft-spec` under the existing protected router.
- [ ] Run `cd sidexai/sidex-server && go test ./internal/api ./internal/ai -count=1` and confirm all pass.

### Task 2: Add a testable Editor client for one-shot drafts

**Files:**
- Create: `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/common/sysFormalSpecDraft.ts`
- Create: `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/common/test/sysFormalSpecDraft.test.ts`

**Interfaces:**
- Produces: `requestSysFormalSpecDraft(httpUrl: string, model: string, intent: string): Promise<string>`.
- Sends a single JSON `POST` to `${httpUrl}/v1/sys/draft-spec`; returns a non-empty `draftSpec` or throws an actionable error.

- [ ] Add tests with a stubbed `fetch` for exact route, method, selected model and intent body, valid response, non-2xx response, malformed JSON, missing/blank `draftSpec`, and timeout/network failure.
- [ ] Compile the focused test to `/private/tmp/sys-editor-draft-spec-test` with `npx tsc --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --rootDir src/vs/workbench/contrib/sys/common --outDir /private/tmp/sys-editor-draft-spec-test --noEmitOnError false src/vs/workbench/contrib/sys/common/test/sysFormalSpecDraft.test.ts`. Standalone compilation may report missing Node test type declarations; it must emit the test JavaScript. Run `node --test /private/tmp/sys-editor-draft-spec-test/test/sysFormalSpecDraft.test.js` separately and confirm the missing helper causes the expected RED.
- [ ] Implement the request helper with the standard `fetch`, JSON content type, and a bounded request timeout; do not add dependencies or chat/session APIs.
- [ ] Re-run the focused Node test and confirm all cases pass.

### Task 3: Wire draft, Platform validation, and safe persistence in Semantic Workbench

**Files:**
- Modify: `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts`
- Modify: `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/common/sysPlatformFlow.ts`
- Modify: `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/common/test/sysPlatformFlow.test.ts`

**Interfaces:**
- Consumes: `ISidexChatService.serverModel`, `resolveServerEndpoint`, `serverHttpUrl`, `requestSysFormalSpecDraft`, `TaskProcessTransport`, and `decodeDraftPreview`.
- Produces: a Draft spec action that uses no configured Platform `draftProvider`; Platform receives `requirement --file <intent> --draft-file <candidate> --draft-only --json`.
- Produces: `validateDraftCandidate(path, text, writeCandidate, runPreview, removeCandidate): Promise<SysDraftPreview>`, which validates the CLI response and removes its candidate file in `finally`.

- [ ] Extend preview decoding tests to reject invalid JSON, missing/blank `draftSpec`, and any `validationState` other than `VALIDATED`.
- [ ] Add tests for `validateDraftCandidate` proving it writes the provided candidate, passes the same path to Platform, returns only a validated preview, and removes the temporary file after both success and validation/provider failure; confirm the missing helper causes RED.
- [ ] Implement `validateDraftCandidate` in `sysPlatformFlow.ts` with one `try/finally` around write, Platform preview, and decode.
- [ ] Inject `ISidexChatService` into the view. In `_draftSpecFromRequirement`, retain the existing unsaved-intent and replacement-confirmation checks, then resolve the SideX HTTP endpoint and `serverModel`; report a Settings → Models error if the model is unavailable.
- [ ] Request candidate text from the one-shot helper. Write it to a unique temporary `.spec` under `<project>/.sys/proposals/`; invoke Platform with `--draft-file <temporary path> --draft-only --json` and the current project root as `cwd`.
- [ ] Put temporary-file deletion in `finally`. Decode the JSON and require `validationState === 'VALIDATED'` before calling `createSpec`, writing the final spec, or opening it. Keep the existing spec untouched on every earlier failure.
- [ ] Remove the error translation that tells the user to configure `draftProvider`; surface SideX provider/network errors with Settings guidance and Platform parse/compiler errors as draft validation errors.
- [ ] Run focused draft helper and preview decoder tests with `npx tsc --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --rootDir src/vs/workbench/contrib/sys/common --outDir /private/tmp/sys-editor-draft-spec-test --noEmitOnError false src/vs/workbench/contrib/sys/common/test/sysFormalSpecDraft.test.ts src/vs/workbench/contrib/sys/common/test/sysPlatformFlow.test.ts`; standalone compilation may report missing Node test type declarations but must emit the JavaScript. Then run `node --test /private/tmp/sys-editor-draft-spec-test/test/sysFormalSpecDraft.test.js /private/tmp/sys-editor-draft-spec-test/test/sysPlatformFlow.test.js`; run `npm run lint` from `/Volumes/Work/dev/sys-editor`.

### Task 4: Verify the integrated preview contract and desktop flow

**Files:**
- Modify tests from Tasks 1–3 only if integration exposes a defect.

**Interfaces:**
- Consumes: the Go endpoint, Editor one-shot request helper, temporary candidate-file path, and existing Sys Platform preview implementation.
- Produces: evidence that successful candidates open for user review and failed candidates do not replace the existing spec or change governed Platform state.

- [ ] Run `cd /Volumes/Work/dev/sys-platform && bash harness/product-cli/draft-preview/run.sh`; verify valid `--draft-file` preview returns `VALIDATED` and does not persist governed state.
- [ ] Run `cd /Volumes/Work/dev/sys-editor/sidexai/sidex-server && go test ./internal/api ./internal/ai -count=1` and `cd /Volumes/Work/dev/sys-editor && npm run lint`.
- [ ] Run the focused TypeScript tests from Tasks 2–3 and `npm run build` from the Editor repo.
- [ ] Launch the desktop flow and verify no terminal is required, the selected SideX model is used, chat history is unchanged, a valid candidate opens as an editable spec, and provider/validation failures leave any prior spec unchanged.
- [ ] Inspect diffs in both repositories; keep the existing unrelated dirty files untouched and report any pre-existing failures separately.

## Self-Review

- Spec coverage: selected model, one-shot route, no session/transcript, bounded input/output, timeout, temporary candidate, Platform validation, cleanup, replacement confirmation, failure behavior, and scope limit are covered by Tasks 1–4.
- Placeholder scan: no TBD/TODO implementation steps remain; limits, command route, request/response, and CLI argument order are explicit.
- Type consistency: Go route accepts the same `{ model, intent }` and returns `{ draftSpec }` consumed by the TypeScript helper; the candidate path is passed only to the existing Platform preview CLI.
- Review focus: each failure class is assigned to handler/helper/view tests or desktop acceptance verification.
- Cross-repository state: Sys Platform already contains an uncommitted `--draft-file --draft-only --json` implementation and `harness/product-cli/draft-preview`; this plan reuses and verifies it rather than rewriting it.
