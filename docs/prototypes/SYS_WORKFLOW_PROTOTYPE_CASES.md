# Sys workflow prototype — the cases

A throwaway prototype of the Sys developer workflow, wired to hand-written verdicts so the design
can be judged by using it rather than by reading it. **Nothing here talks to sys-platform.**

Branch: `prototype/sys-workflow`. Three files, deleted together when the real thing lands:

```
src/vs/workbench/contrib/sys/common/sysPrototypeFixture.ts   the fake verdicts
src/vs/workbench/contrib/sys/browser/sysPrototype.ts         markers, hover, code actions
src/vs/workbench/contrib/sys/browser/sysPrototypeNeedsMe.ts  the "Needs you" list
tests/gui/prototype-cases.spec.mjs                           one harness test per case
```

## What it is testing

The design it came from decides four things, and each case exists to find out whether one of them
survives contact with use:

- a developer is the only user, and they work in the IDE
- diagnostics are continuous, so nothing may cost a separate trip to a panel
- three verdicts, and the common one — `NOT_OBSERVED` — has no line in the code to stand on
- developers do not do ceremony, so anything that feels like governance admin will be ignored

## Running it

```bash
npm run tauri dev                       # from the prototype/sys-workflow branch
SYS_LIVE_SERVER_PORT=<port> npx playwright test tests/gui/prototype-cases.spec.mjs
```

Switching to `main` turns the prototype off: the app runs from the working tree.

To click through it by hand, open a Java project with `Book.java` and `Category.java` — for
example `my-java21-app` — and work through the cases below.

---

## Case 01 — A broken obligation reads as a counterexample, not a code

**Do** — open `Book.java`.

**See** — `public Book() {}` and the non-final `Category` field are marked, and the message names
what broke:

```
public Book() {          ← marked
   A Book cannot exist without its Category — leaves category unset
```

**Why it matters** — a reviewer passes `public Book() {}` nine times out of ten. It looks
harmless, and it breaks exactly the thing the requirement was about. "leaves category unset" is
what makes them stop, and no diff gives you that.

Note that one obligation produced two marks, on two different lines. The map from a governed
statement to code is not one to one, and the UI never pretends it is.

**What would disprove the design** — if the message reads as a rule being enforced rather than a
consequence being pointed out, the counterexample has not actually arrived.

---

## Case 02 — The reason travels with the obligation

**Do** — hover the marked constructor.

**See** —

```
Sys · REQ-001 — ✗ broken
A Book cannot exist without its Category
Here: leaves category unset

Why — orphaned books corrupted the catalogue in March 2024 (2024-03)
Chose: Forbid orphaned books outright
Considered: allow orphans and sweep them periodically · forbid outright
```

**Why it matters** — this is the one moment a person decides whether to change the code or change
the requirement. A checker can decide whether an implementation satisfies a specification. It
cannot decide whether the specification is the right one — there is no proposition to prove. The
reason is what makes that human decision better than a coin flip, and it is the whole argument for
keeping a person at this gate.

With a reason like the one above, nobody retracts. With no reason recorded, retracting is cheap —
and should be.

**What would disprove the design** — if the reason is not the thing people actually use to decide,
the decision layer is decoration and the gate can be automated or dropped.

---

## Case 03 — Silence applies to decoration, not to answers

**Do** — hover `private String title;`, which nothing is wrong with.

**See** — no mark on the line, but a hover:

```
Sys · REQ-001 — ✓ held
Book has a title
```

**Why it matters** — decoration is imposed. Marking code that is fine is how the signal drowns,
which is why a held obligation decorates nothing. But a hover is only ever seen by someone who
pointed at the line and waited: they asked. Answering is not noise.

**This case corrected the design.** It first said a held obligation "shows nothing at all", which
conflated decoration with answers. Using the prototype showed the answer-on-request is the whole
"what am I touching" affordance, and that it costs nothing to anyone who did not ask.

---

## Case 04 — There is no free suppression

**Do** — Quick Fix on the marked constructor.

**See** — two actions, and no third:

```
Sys: this obligation is wrong…
Sys: this location is an exception…
```

Choosing the first shows the reason **before** any button that would remove the obligation:

```
A Book cannot exist without its Category

Why — orphaned books corrupted the catalogue (2024-03).
Chose: Forbid orphaned books outright.
Considered: allow orphans and sweep them periodically · forbid outright.

[ Retract it ]  [ Narrow it instead ]  [ Cancel ]
```

Choosing the second asks why, and refuses an answer shorter than a sentence:

> Say why, in a sentence someone can disagree with.

**Why it matters** — every governance system dies the same way: exceptions become free, and six
months later every obligation carries one. But refusing exceptions outright is worse — a framework
genuinely does need that no-arg constructor, and a tool that cannot say so gets switched off.

The way out is that **an exception is not a suppression, it is a refinement**. "A Book cannot exist
without its Category" was too strong; what is true is "no business operation constructs a Book
without a Category". That is what "Narrow it instead" offers. The obligation stays checkable, and
the next person reads a precise statement instead of a statement plus a hidden carve-out.

Where the vocabulary cannot express the refinement, the exception is recorded as a decision with a
reason and an author — visible and attributable, not a comment nobody will ever question.

**What would disprove the design** — if the dialog feels like an obstacle rather than a reminder,
or the reason box makes people give up, this is ceremony and developers will route around it. That
is the thing to watch for while clicking.

---

## Case 05 — What has no line to stand on

**Do** — open the Sys view.

**See** — a "Needs you" section, broken things first, then things nothing in the code says anything
about:

```
✗  A Book cannot exist without its Category   REQ-001 · broken in Book.java      ← opens the file
—  A Category name is never empty             REQ-001 · nothing in the code says this yet
                                              Why: blank category names made the catalogue unreadable
```

`Book has a title` is held, and is **not listed**.

**Why it matters** — `NOT_OBSERVED` is the common case on real code, and it has no line to mark:
you cannot underline the absence of code. So a list is the only place it can live. It is a to-do,
not a failure, and rendering it as an error would make the product useless on day one.

A list of things that are fine is the noise this whole design avoids, so held obligations never
appear.

**What would disprove the design** — a list nobody opens is the same as nowhere. If this section
goes unread, then `NOT_OBSERVED` has no home at all, and that is worth knowing before building the
ontology that produces it.

---

## Case 06 — Governing something at the moment it is written

**Do** — put the cursor on a line nothing governs, such as `private int id;`, and Quick Fix.

**See** — the sentence is already written for you:

```
Sys: govern this — “Book has an id”…
```

Accepting it is one keystroke. Then one question:

```
Why does it matter?
  Without a reason this stays an observation, not an obligation.
```

Give a reason and it becomes an obligation. Leave it blank (**Case 06c**) and it says so:

> Prototype: this would be kept as an observation, not governed.
> Nothing recorded why it matters, so nothing would enforce it.

**Why it matters** — this is the load-bearing assumption of the whole design.

Approving an intent and resolving a conflict are moments a person has already stopped to think.
Writing the line is the only moment they still remember **why**. If capture does not work here, it
works nowhere: nothing ever becomes governed, and the design has no starting point at all.

Two things carry that bet:

- **The sentence is derived from the line, so governing is editing, not composing.** A developer
  will correct a proposal put in front of them and will not stop to compose one. A wrong guess
  costs a correction, not a refusal — which is why the guess is offered in an editable box.
- **No reason means no obligation.** A statement nobody can say why about will never drift in a way
  anyone minds, so governing it spends review attention and buys nothing. This is the admission
  test the design relies on to keep the governed set small enough to hold in one head, and it is
  what keeps uplift tractable: recovery proposes thousands, and only the ones someone can attach a
  reason to survive.

**What would disprove the design** — if the proposed sentence is wrong often enough that people
stop reading it, or if the reason box is the moment they give up, then governance never accretes
and the "govern on contact" answer to the grey wall does not hold. That is the single most
important thing to watch for while clicking.

---

## Case 07 — From the intent, point at the code

**Do** — open an intent review page and hover a concept name, `Book`.

**See** —

```
Book

✓ Book has a title — Book.java
✗ A Book cannot exist without its Category — Book.java
```

and for `Category`, a line with nowhere to point:

```
— A Category name is never empty — nothing in the code says this yet
```

**Why it matters** — reading code, the question is "what constrains this line". Reading an intent
it is the mirror: "is this real, and where?". Without an answer the intent page is a document
nobody can check, and a document nobody can check rots into fiction — which is what happened to
every SRS in every company.

One concept lists several files when several realise it. The reader **sees** that the map is not
one to one instead of being told so.

**What would disprove the design** — if the answer is usually "nothing in the code says this yet",
the intent is running ahead of the code and the page is aspiration rather than record. Worth
knowing which it is.

---

## Case 08 — From the code, reach the intent

**Do** — hover a governed line in `Book.java`.

**See** — the hover ends with a link:

```
Open REQ-001
```

**Why it matters** — the mirror of Case 07. From an intent you reach the code; from the code you
reach the intent. A reference you cannot follow is a citation nobody checks, and the pair is what
makes the two one thing rather than two that drift apart.

**A hazard this case exposed.** The link only renders if the hover's markdown is trusted. That is
safe here because every word of the content is ours. A real verdict carries text from the
ontology, and text from a store is **data**: trusting it would make a `command:` link written into
a requirement's wording executable. The real implementation must escape it, or keep the content
untrusted and link some other way.

### Case 08b — the requirement shown is the one this workspace has

The fixture names `REQ-001`; a real workspace has whatever it has — `REQ-002`, say. The prototype
reads `.sys/intents/` once and uses what it finds.

Linking to a page that is not there is **worse than not linking**, because it still looks like a
reference. The same silent failure as a link that does not render: the reader cannot tell the
difference between "checked and fine" and "never wired up".

---

## Case 09 — Hovering a type asks about the concept, not the line

**Do** — hover the class name in `Category.java`.

**See** — everything governed about the concept, the same summary the intent page gives, from the
other side:

```
Category

✓ Category is identified — here
— A Category name is never empty — nothing in the code says this yet

Open REQ-002
```

**The link points away from where the reader already is.** Standing in the intent it offers the
code; standing in the code it offers the intent. The first version offered `Category.java` to
someone reading `Category.java` — a reference that goes nowhere, which is the same silent
uselessness as a link that does not render. Naming the file you are in tells the reader nothing;
naming the *others* is the only part that does, which is why several files still appear when
several realise the concept.

**Why it matters** — the declaration is the most obvious place to ask "what is governed about
this?", and it was the one place with no answer. Answering only on witness lines left the
symmetry with Case 07 broken in exactly the spot a reader looks first.

The three questions and where each is asked:

| question | asked at | case |
|---|---|---|
| what constrains this line? | a line of code | 01, 02, 03 |
| what is governed about this concept? | a type name in code | 09 |
| what is governed about this concept? | a concept in the intent | 07 |
| where is this realised? | either | 07, 08 |

---

## Case 10 — A link lands on the line, not the file

**Do** — follow the links in both directions.

**See** — from the code, the intent opens at the concept's heading. From the intent, the code
opens at the witness line.

**Why it matters** — a link without a position leaves the reader at the top of a file, searching
for the thing they just clicked. That search is most of the cost of following a reference, and a
reference that costs a search is one people stop following. The pair of links in Cases 07 and 08
is only worth having if landing is free.

Nothing is guessed: the line is found by matching the page for the concept's heading, or the file
for the witness. With no match the link still opens the file, just without a position.

---

## What the prototype has already changed

Two findings, both from using it rather than reading it:

1. **Case 03** — "a held obligation shows nothing" conflated decoration with answers. Corrected:
   it decorates nothing and answers when asked.
2. **A marker needs no language; a hover and a code action do.** Registering for `language: 'java'`
   in a fork with no Java language contribution left the mark visible with no reason behind it and
   no actions on it — the worst kind of failure, because it looks like it is working.
3. **A markdown link nested inside `**bold**` does not render as a link**, and an untrusted
   hover does not render one at all. Both fail silently, leaving text that looks like a reference
   and cannot be followed.
4. **A selector that matches everything matches the pages that already have an answer.** The
   code hover was registered for `**/*`, which includes the intent page — so both providers fired
   and stacked two blocks, the second telling the reader they were "also in Book.java" while they
   stood in the intent, and offering `Open REQ-002` to someone reading REQ-002. The rule the
   prototype had just adopted, broken by the prototype itself one file over.
5. **Two hovers, two links, and only one was fixed.** The line hover and the concept hover each
   build their own link, so carrying the line number in one left the other landing at the top of
   the file — the same defect, one function over, invisible until both were followed.
6. **A `ServicesAccessor` is only valid while a command runs synchronously.** Every one of these
   actions awaits a dialog, and reaching for a service afterwards throws. From the user's side the
   action simply did nothing — no error, no dialog. Services are now taken before the first await.

## Not built

- The actions report what they would do; nothing is retracted, narrowed, governed or recorded.
- Uplift does not exist: the prototype has no observed side, so "govern this" is offered on any
  declaration rather than on the ones recovery would actually notice.
- Verdicts are fixtures. Real ones need the system ontology, which is on hold.
