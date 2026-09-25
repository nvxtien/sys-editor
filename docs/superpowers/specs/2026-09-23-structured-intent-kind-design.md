# Structured Intent Kind and Capability-Gated Formalization

## Status

Design approved in conversation; implementation awaits written-spec review.

## Problem

The current normalization path applies an operation-only Structured Intent and
Formal Spec contract to every raw requirement. A data-model requirement such
as `Category`, `Book`, fields, and relationship cardinality is therefore sent
through a grammar that explicitly forbids classes, relationships, lists, and
schema notation. This is an abstraction mismatch, not a prompt wording bug.

The existing lifecycle also exposes `Generate Formal Spec` based on the
current Structured Intent state without first checking whether the intent kind
is supported by the current sys-platform grammar.

## Goal

Represent the semantic kind of a requirement in Structured Intent, preserve
kind-specific meaning through human confirmation, and only expose Formal Spec
generation when sys-platform can represent that kind. Unsupported kinds must
produce an explicit `PLATFORM_FORMAL_SPEC_GAP` result instead of a misleading
operation-only draft.

## Structured Intent contract

Every normalized candidate keeps the existing common fields and adds a
required `kind` field:

```json
{
  "version": 1,
  "requirementId": "REQ-001",
  "kind": "DATA_MODEL",
  "intentStatement": {"value": "...", "provenance": "INFERRED"},
  "scope": {"value": "...", "provenance": "INFERRED"},
  "operation": {"value": "", "provenance": "UNKNOWN"},
  "inputs": [],
  "constraints": [],
  "effects": [],
  "failureBehavior": [],
  "unknowns": [],
  "entities": [],
  "fields": [],
  "relationships": []
}
```

Supported kinds are `OPERATION_RULE`, `DATA_MODEL`, `RELATIONSHIP`,
`INVARIANT`, `WORKFLOW`, and `UNKNOWN`.

For `DATA_MODEL`, `entities`, `fields`, and `relationships` are first-class
structured values. Missing details such as nullability, uniqueness, cascade
behavior, and foreign-key enforcement remain explicit in `unknowns`; the
normalizer must not invent them.

Existing artifacts without `kind` remain readable as `OPERATION_RULE` for a
bounded compatibility period. New provider output must include `kind`.

## Provider boundary

The provider receives a kind-aware normalization contract. It must return JSON
only and preserve the selected kind-specific sections. The server validates
that the response is JSON; the Editor validates the complete Structured Intent
schema before persisting it. Invalid output remains an actionable provider
error and never creates a partial Editor projection.

## Formalization capability gate

The Editor and shared lifecycle expose a capability decision after intent
approval:

```text
OPERATION_RULE + authoritative operation -> FORMAL_SPEC_SUPPORTED
DATA_MODEL, RELATIONSHIP, WORKFLOW, or UNKNOWN -> PLATFORM_FORMAL_SPEC_GAP
```

`Generate Formal Spec` is rendered only for `FORMAL_SPEC_SUPPORTED`. For an
unsupported kind, the workbench renders:

```text
Platform Formal Spec gap: current sys-platform grammar does not represent the selected kind's semantics yet.
```

The raw requirement and confirmed Structured Intent remain valid and reviewable
artifacts. No fake `Operation:` declaration is generated.

## Persistence and lifecycle

The canonical sys-core record stores the kind-specific Structured Intent. The
Editor compatibility projection under `.sys/intents/REQ-ID.intent.json`
stores the same candidate plus source text and remains readable by the current
workbench. Approval is exact-content approval; editing the raw requirement or
kind-specific candidate makes the intent stale and removes downstream actions.

The lifecycle is:

```text
raw requirement
  -> provider normalization
  -> kind-aware Structured Intent draft
  -> human review and confirmation
  -> capability gate
  -> Formal Spec only when supported
```

## UI behavior

- Draft Structured Intent: show `Review intent` and `Confirm intent`.
- Confirmed supported operation intent: show `Bind operation` and `Generate Formal Spec`.
- Confirmed unsupported intent: show the capability-gap message and hide
  `Generate Formal Spec`.
- Existing requirement approval remains separate from Structured Intent
  confirmation; labels must not imply that raw approval created an intent.

## Testing

The implementation must add or update tests for:

1. parsing and compatibility of `kind` and kind-specific fields;
2. data-model normalization retaining entities, fields, relationships, and
   unknowns;
3. capability gating for supported operation rules and unsupported data
   models;
4. exact approval and staleness across kind-specific artifacts;
5. Playwright UI showing `Review intent` after normalization and showing the
   platform-gap state instead of `Generate Formal Spec` for `DATA_MODEL`.

## Non-goals

- Do not extend sys-platform's Formal Spec grammar in this change.
- Do not add provider SDKs or provider calls to sys-core.
- Do not reinterpret data-model semantics as operation rules.
- Do not remove existing operation-rule lifecycle support.
