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
	Operation string `json:"operation,omitempty"`
}

const normalizeIntentSystemPrompt = `Normalize the user's raw requirement into a human-reviewable Structured Intent JSON object.
Return JSON only: no Markdown fences, explanation, approval language, or Formal Spec syntax.
Use exactly these fields: version (1), requirementId (copy the supplied id), intentStatement, scope, operation, inputs, constraints, effects, failureBehavior, unknowns.
Each scalar fact is an object with value and provenance. Provenance must be one of SPECIFIED, OBSERVED, DERIVED, INFERRED, UNKNOWN. Use SPECIFIED only for facts stated by the user, OBSERVED only for supplied authoritative source facts, DERIVED for deterministic consequences, INFERRED for model interpretations, and UNKNOWN when a fact is missing. Keep unknowns explicit. Never invent an operation identity; use UNKNOWN unless an authoritative operation is supplied. Do not emit Formal Spec declarations or rules.`

func (h *Handler) NormalizeIntent(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, draftSpecMaxRequestBytes)
	var req normalizeIntentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Model) == "" || strings.TrimSpace(req.Intent) == "" {
		writeDraftSpecError(w, http.StatusBadRequest, "model and intent are required")
		return
	}
	user := req.Intent
	if strings.TrimSpace(req.Operation) != "" {
		user += "\n\nAuthoritative operation binding: " + req.Operation
	}
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
