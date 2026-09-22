# Mission: Debug One-Shot Formal Spec Draft v0.1

## Context

The GUI action:

    Draft spec from request

successfully reaches the local SideX server and selected model, but the returned draft is rejected by sys-platform's Formal Spec parser.

Observed real desktop logs:

    [SYS_DRAFT_01] start id=REQ-001
    [SYS_DRAFT_02] requirement loaded ... intentBytes=312
    [SYS_CLI_01] sys status --json
    [SYS_CLI_02] exit=0
    [SYS_DRAFT_05] server endpoint resolved running=true
    [SYS_DRAFT_06] provider request start ... model=anthropic/claude-sonnet-5
    [SYS_DRAFT_07] provider request complete draftBytes=62
    [SYS_CLI_01] sys requirement --file <REQ-001.md> --draft-file <proposal.spec> --draft-only --json
    [SYS_CLI_02] exit=1
    [SYS_CLI_ERR] draft is not a valid Formal Spec (governed state unchanged):
    formal-spec parse failed:
    MALFORMED_SPEC
    missing "Operation:" declaration

A previous run returned only 34 bytes and failed with the same parser error.

The important fact is:

    provider call succeeds
    but generated draft is not valid Formal Spec

Do NOT change the Formal Spec parser merely to accept malformed model output.

---

# Mission

Determine exactly where the invalid short draft is introduced and fix the smallest responsible layer.

Possible failure classes include:

1. the prompt sent to the model does not specify the actual Formal Spec grammar strongly enough;
2. the wrong prompt/body is sent to the one-shot endpoint;
3. the SideX server extracts/truncates the provider response incorrectly;
4. the selected model returns a short paraphrase rather than a Formal Spec;
5. an intermediate JSON/response field is decoded incorrectly;
6. the correct long response exists but only a short field/subfield is returned to the editor;
7. another transport or normalization step strips content.

Do not assume which one is true.

Instrument and prove it.

---

# Required workflow

Use:

    Brainstorming
    → Writing plans
    → TDD
    → Reproduce
    → Instrument
    → Root-cause
    → Minimal fix
    → Verification
    → only then GO / NARROW / STOP

Do not begin by rewriting the parser or guessing a new template.

---

# Reproduction target

Use the real flow from Sys Editor:

    requirement file
    → SideX one-shot endpoint
    → selected model
    → candidate Formal Spec text
    → temporary .sys/proposals/*.spec
    → sys requirement --draft-file ... --draft-only --json
    → Formal Spec parser

Reproduce with the current model if available:

    anthropic/claude-sonnet-5

Use the real REQ-001 request when practical, but do not hard-code user-specific absolute paths into product code.

---

# First required investigation

Locate and inspect all code responsible for:

1. the "Draft spec from request" action in Sys Editor;
2. construction of the one-shot provider request;
3. the local SideX endpoint handling that request;
4. the prompt/system prompt/user prompt passed to the provider;
5. provider response decoding/extraction;
6. the response returned to Sys Editor;
7. writing the proposal .spec file;
8. the sys-platform CLI validation call.

Produce a concrete data-flow map with file/function names before fixing anything.

Example shape:

    REQ markdown
      -> <editor function>
      -> POST <endpoint>
      -> <server handler>
      -> <provider adapter>
      -> <provider raw response>
      -> <extraction function>
      -> response JSON
      -> <editor decoder>
      -> proposal.spec
      -> sys requirement --draft-only

---

# Mandatory diagnostic evidence

Add bounded temporary diagnostics sufficient to distinguish the failure classes.

For ONE debug run, capture:

    A. exact request payload shape sent by editor
    B. prompt text or prompt hash + safe preview
    C. selected model id
    D. provider raw response metadata
    E. raw provider text length
    F. extracted draft text length
    G. exact extracted draft text, or a safely escaped bounded representation
    H. exact proposal file content before CLI validation
    I. parser stderr

The key comparison is:

    provider raw text
    vs
    extracted draft text
    vs
    proposal file text

If they differ, identify the exact transformation that caused it.

Do not log secrets, API keys, authorization headers, cookies, or unrelated user content.

Temporary debug logging must be removed or reduced to safe permanent observability before final commit.

---

# Formal Spec grammar source of truth

Do not invent the grammar from memory.

Find the canonical Formal Spec parser/spec/examples in sys-platform.

Determine the smallest valid Formal Spec for the current requirement and record the actual required structure.

At minimum, the parser error proves that a valid document requires:

    Operation:

but do not assume that is the only required declaration.

Use existing accepted examples/tests as the source of truth.

The generation prompt must be derived from real parser expectations, not a guessed format.

---

# Prompt contract

If root cause is insufficient prompt guidance, fix the generation contract so the model is explicitly asked to return ONLY valid Formal Spec text.

The prompt should include:

- the exact role: generate a candidate Sys Formal Spec;
- no prose explanation;
- no markdown fences;
- no natural-language summary in place of the spec;
- required structural declarations from the actual grammar;
- one or more canonical minimal examples from the repo, if appropriate;
- the user's requirement text;
- any operation/source binding that is actually available and authoritative;
- an instruction to avoid inventing missing facts.

Important:

    LLM may propose.
    LLM may not certify.
    LLM may not approve.

The output remains a candidate draft that sys-platform validates.

Do not make the model response authoritative.

---

# Missing operation handling

The current failure is:

    missing "Operation:" declaration

Investigate whether the requirement already has an operation binding in project state.

If an authoritative operation binding exists:

    include it in the model prompt
    and require the candidate spec to use that exact operation identity

If no operation binding exists:

do NOT silently invent one.

Choose one sound behavior:

    A. block generation with a bounded UI message:
       "Bind this requirement to a source operation before drafting a Formal Spec."

or, only if the Formal Spec grammar supports it soundly:

    B. generate a draft with an explicitly unresolved operation representation.

Do not guess a class/method name from requirement prose.

No source text search.

No model-invented operation accepted as governed identity.

---

# Response extraction contract

If the provider returns structured JSON/content blocks, verify extraction against real provider response shape.

Tests must cover at least:

- a normal single text block;
- multiple text blocks if supported;
- leading/trailing whitespace;
- provider text containing newlines;
- response with markdown fences;
- missing text field;
- empty text;
- provider error object;
- long Formal Spec text is not truncated;
- Unicode survives intact.

Never select an arbitrary "summary", "message", or first short field if the full generated text is elsewhere.

---

# Candidate validation boundary

Keep sys-platform as the authoritative validator.

Correct flow:

    model candidate
    → exact candidate written to temp .spec
    → sys requirement --draft-only --json
    → parser/ontology validation
    → only validated draft enters review flow

Do not add a second permissive parser in the editor.

A light preflight such as empty-output detection is acceptable for UX, but it must not replace platform validation.

---

# Error classification

Introduce or preserve bounded error categories so the UI can distinguish:

    PROVIDER_REQUEST_FAILED
    PROVIDER_EMPTY_RESPONSE
    PROVIDER_INVALID_DRAFT
    FORMAL_SPEC_VALIDATION_FAILED

Do not turn malformed provider output into a semantic verdict.

Governed state must remain unchanged on every failure.

Required invariant:

    INVALID_PROVIDER_DRAFT_MUTATES_GOVERNED_STATE = 0

---

# Tests

Add focused tests at the layer(s) where the bug actually exists.

At minimum cover:

1. the full canonical generation prompt includes the actual Formal Spec constraints;
2. authoritative operation binding, when present, is supplied exactly;
3. no operation binding never causes a guessed operation;
4. provider response extraction returns the full text, not a short summary/subfield;
5. multiline Formal Spec survives transport unchanged;
6. Unicode survives;
7. empty/short malformed output is rejected cleanly;
8. valid candidate reaches sys-platform validation;
9. invalid candidate leaves governed state unchanged;
10. no chat session/history is created by this one-shot route if that is an existing product invariant.

If the bug is server-side, add server-side tests.
If the bug is editor-side, add editor-side tests.
If both are involved, test both boundaries without duplicating parser semantics.

---

# Real end-to-end acceptance

Run the real desktop flow:

    npm run tauri dev

Open the workspace containing REQ-001.

Trigger:

    Draft spec from request

Expected diagnostic progression:

    requirement loaded
    → server resolved
    → provider request
    → provider response
    → candidate proposal file
    → sys requirement --draft-only
    → exit 0

Expected candidate:

    valid Formal Spec
    includes required Operation declaration
    contains no markdown fences
    contains no explanatory prose outside the grammar

Then confirm:

    governed state is still not silently mutated by draft generation
    candidate is available for the intended review/edit flow

If manual desktop interaction cannot be completed, report CHECKPOINT_REACHED rather than fabricating success.

---

# Do NOT

- relax the Formal Spec parser;
- hard-code a 34-byte/62-byte threshold as the fix;
- special-case REQ-001;
- hard-code BookingService/createBooking;
- parse model prose heuristically into a fake Formal Spec;
- accept markdown prose because it "looks close";
- silently add an invented Operation;
- bypass sys-platform validation;
- make provider output governed automatically;
- log secrets;
- leave verbose raw prompt/response logging enabled in production.

---

# Success criteria

Call success only if all are true:

1. exact root cause is identified;
2. raw provider response and extracted draft are compared;
3. the generated candidate follows the actual Formal Spec grammar;
4. sys-platform accepts the candidate with --draft-only;
5. no governed state is changed by generation alone;
6. no operation is guessed;
7. no provider response truncation/extraction bug remains;
8. focused tests pass;
9. temporary unsafe diagnostics are removed or bounded.

On success:

    ONE_SHOT_FORMAL_SPEC_DRAFT_DEBUGGED

---

# Stop conditions

## PROVIDER_PROMPT_GAP

The provider faithfully returns what it was asked for, but the current prompt does not define valid Formal Spec strongly enough.

Fix if bounded and testable.

## RESPONSE_EXTRACTION_GAP

The provider returns valid/full text but SideX/editor extracts the wrong field or truncates it.

Fix the extraction path.

## OPERATION_BINDING_REQUIRED

A valid Formal Spec cannot be generated soundly without an operation identity and the current requirement has none.

Do not guess. Return a product-level requirement to bind first.

## PROVIDER_BEHAVIOR_BLOCKED

The prompt is correct and extraction is correct, but the selected provider/model still fails to produce a valid candidate after bounded retry/testing.

Report evidence; do not weaken validation.

## CONTRACT_GAP

The one-shot endpoint contract cannot carry the information needed for sound Formal Spec generation without a deliberate API change.

## STOP_UNSOUND

Any apparent fix would require guessing semantics, inventing operation identity, weakening validation, or mutating governed state on invalid output.

---

# Required final report

RESULT:
ONE_SHOT_FORMAL_SPEC_DRAFT_DEBUGGED |
PROVIDER_PROMPT_GAP |
RESPONSE_EXTRACTION_GAP |
OPERATION_BINDING_REQUIRED |
PROVIDER_BEHAVIOR_BLOCKED |
CONTRACT_GAP |
CHECKPOINT_REACHED |
STOP_UNSOUND

ROOT_CAUSE:
...

DATA_FLOW:
...

RAW_PROVIDER_TEXT_BYTES:
...

EXTRACTED_DRAFT_BYTES:
...

PROPOSAL_FILE_BYTES:
...

RAW_VS_EXTRACTED:
IDENTICAL | DIFFERENT — explain exact transformation

FORMAL_SPEC_GRAMMAR_SOURCE:
...

OPERATION_SOURCE:
authoritative binding | missing | explain

PROMPT_FIX:
...

EXTRACTION_FIX:
...

PLATFORM_VALIDATION:
PASS | FAIL

GOVERNED_STATE_MUTATION:
0 | explain

TESTS:
commands + counts + failures/skips

MANUAL_TAURI_RESULT:
...

TEMP_DIAGNOSTICS_REMOVED:
YES | NO

NEXT_PRODUCT_GAP:
...

Stop after the exact 34/62-byte failure is explained and the one-shot candidate path either produces a platform-valid Formal Spec or reaches a sound stop condition.
