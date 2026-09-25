package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/sidex-ai/sidex-server/internal/ai"
	"github.com/sidex-ai/sidex-server/internal/auth"
)

type normalizeIntentRequest struct {
	Model     string `json:"model"`
	Intent    string `json:"intent"`
}

const normalizeIntentSystemPrompt = `Normalize the user's raw requirement into a human-reviewable Structured Intent JSON object.
Return only the JSON object, never Markdown fences or explanation.
Use exactly these fields: version (1), requirementId, kind, intentStatement, scope, operation, inputs, constraints, effects, failureBehavior, unknowns.

Shape:
FACT = {"value": string, "provenance": "SPECIFIED"|"OBSERVED"|"DERIVED"|"INFERRED"|"UNKNOWN"}
intentStatement, scope and operation are each ONE FACT object.
inputs, constraints, effects and failureBehavior are each an ARRAY of FACT objects; use [] when there are none, never an object keyed by name.
requirementId is the supplied id as a plain string, and unknowns is an array of plain strings.

Provenance: SPECIFIED only for facts the user stated, OBSERVED only for supplied authoritative source facts, DERIVED for deterministic consequences, INFERRED for model interpretations, UNKNOWN when a fact is missing. Keep unknowns explicit.

Classification:
"kind":"OPERATION_RULE"|"DATA_MODEL"|"RELATIONSHIP"|"INVARIANT"|"WORKFLOW"|"UNKNOWN"
kind is a plain string classifying what the requirement is about, not a fact object.
OPERATION_RULE: an action with conditions, effects or failures.
DATA_MODEL: entities, fields and their types.
RELATIONSHIP: how entities relate to one another.
INVARIANT: a condition that must always hold.
WORKFLOW: an ordered sequence of steps.
UNKNOWN: the requirement does not settle which of these it is.
Classify from what the requirement says, and never invent an operation to fit a kind: a data model or a relationship has no operation, so its operation FACT is {"value": "UNKNOWN", "provenance": "UNKNOWN"}.
For an OPERATION_RULE the operation is the semantic action the requirement governs, such as "create booking" — never a class, method or qualified source name.
Do not emit Formal Spec declarations or rules.`

func (h *Handler) NormalizeIntent(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, draftSpecMaxRequestBytes)
	var req normalizeIntentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Model) == "" || strings.TrimSpace(req.Intent) == "" {
		writeDraftSpecError(w, http.StatusBadRequest, "model and intent are required")
		return
	}
	user := req.Intent
	var output strings.Builder
	tooLarge := false
	err := h.clientFor(req.Model, auth.UserIDFromContext(r.Context())).WithTimeout(draftSpecTimeout).StreamChat(
		[]ai.Message{{Role: ai.RoleUser, Content: user}}, nil, normalizeIntentSystemPrompt,
		func(chunk ai.StreamChunk) {
			if chunk.Type != "text" || tooLarge { return }
			if output.Len()+len(chunk.Content) > draftSpecMaxOutputBytes { tooLarge = true; return }
			output.WriteString(chunk.Content)
		},
	)
	if err != nil { writeDraftSpecError(w, http.StatusBadGateway, ai.SanitizeErrorForDisplay(err)); return }
	if tooLarge { writeDraftSpecError(w, http.StatusBadGateway, "provider output exceeds 32 KiB"); return }
	structuredIntent := strings.TrimSpace(output.String())
	var value any
	if structuredIntent == "" || json.Unmarshal([]byte(structuredIntent), &value) != nil || value == nil {
		writeDraftSpecError(w, http.StatusBadGateway, "provider returned invalid Structured Intent JSON")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"structuredIntent": structuredIntent})
}
