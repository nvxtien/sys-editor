# sys-core Structured Intent Lifecycle

`sys-core` is the shared Rust lifecycle owner in the sibling `sys-platform`
repository (`sys-core/`). It owns workspace-scoped identities, Structured
Intent persistence, exact approval, operation-binding checks, Formal Spec
candidate persistence, and derived staleness status.

The dependency direction is:

```text
sys-editor  -> server adapter -> sys-core
product-cli -> sys-core
sys-core    -> (future/injected) sys-platform validation
```

`product-cli` consumes the crate directly through a path dependency and
exposes `sys core status`, `sys core intent approve`, and `sys core spec
approve`. The Editor uses `/v1/sys/core`; the server adapter invokes the
provider-agnostic `sys-core` binary and does not decide lifecycle state.

The adapter is deliberately transitional. The existing Editor JSON files are
kept as a presentation-compatible projection while the authoritative core
state is stored under `.sys/core/`. Formal Spec provider transport and
sys-platform parser validation remain outside the core until a follow-up
change adds the injected `ProposalProvider` boundary and platform call.
