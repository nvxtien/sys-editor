# sys-platform is the backend; sys-editor is the frontend

sys-editor does not decide anything about meaning. It authors, renders, and shows what
sys-platform decided.

```
sys-platform   the ontology, capability, verdicts, the grammar, conventions,
               how an intent is realised as code, what an answer means
sys-editor     editing, review pages, buttons, calling the platform,
               writing files where the platform said, showing verdicts
```

## The test

Before adding logic to sys-editor, ask whether it **decides** something or only **shows** a
decision. Deciding belongs in sys-platform.

A decision made editor-side stops being verifiable, and no other client can reuse it. It also
goes stale silently: the platform changes, the editor's copy does not, and the resulting failure
blames whoever is downstream.

## The trap

sys-editor ships its own Go server, `sidexai/sidex-server`. It is **the editor's LLM plumbing** —
it talks to model providers, applies timeouts and size caps, and returns what came back. Nothing
more. Because "there is already a server here", platform logic drifts into it easily, and every
prompt it holds is a place for platform knowledge to hide.

Three things were found there and moved out:

| what | was | now |
|---|---|---|
| the Formal Spec grammar | a const in `draft_spec.go` | `formal-spec::grammar_guidance()`, shipped by `sys-core spec prepare` |
| language and layout detection | `projectLanguage()` in `sysGeneratedCode.ts` | `sys-core code prepare` |
| how to realise an intent as code, and how to read the answer | `generate_code.go` | `sys-core::project::CODE_GUIDANCE` and `sys-core code accept` |

## Why the grammar case is the model to copy

The guidance now lives beside the parser that defines the grammar, with a test that every example
in it parses. The grammar cannot describe something the parser rejects. The same rule applies to
the code answer format: `CODE_GUIDANCE` states it and `parse_generated_files` reads it, in one
crate, tested together.

**A format described in one repo and parsed in another will drift.** That is the whole reason for
this boundary, stated concretely.

## How it is enforced

Tests, not goodwill:

- `TestDraftSpecPromptHoldsNoPlatformGrammar` — the draft prompt must not contain grammar
- `TestGenerateCodePromptHoldsNoPlatformKnowledge` — the code prompt must not contain conventions
- `formal-spec`: `every_example_in_the_guidance_parses`
- `sys-core`: `the_platform_reads_the_format_its_own_guidance_states`

Add the equivalent test whenever a new prompt or a new decision appears.

## The shape of a feature that spans both

```
sys-core <verb> prepare <id>   → context: the approved record + everything needed to act on it
sidex-server                   → sends it to a provider, returns the answer unread
sys-core <verb> accept         → reads the answer, returns what it means
sys-editor                     → writes files, opens editors, renders the result
```

The editor forwards and displays. It never reads a context it was given, and never interprets an
answer it received.
