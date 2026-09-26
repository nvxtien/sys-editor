package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func captureLog(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(os.Stderr) })
	return &buf
}

func providerReturns(content string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		encoded, _ := json.Marshal(content)
		fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%s}}]}\n\ndata: [DONE]\n\n", encoded)
	}
}

// The browser-side parser requires arrays of facts for these fields; a prompt that
// leaves the shape implicit makes providers return keyed objects, which are then
// rejected ("Structured Intent has an invalid scope/inputs") after a 200 response.
func TestNormalizeIntentPromptStatesTheExactStructuredIntentShape(t *testing.T) {
	var providerBody map[string]any
	h, server := draftHandler(t, func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&providerBody)
		providerReturns(`{"version":1}`)(w, r)
	})
	defer server.Close()

	rr := httptest.NewRecorder()
	h.NormalizeIntent(rr, normalizeRequest(`{"model":"openrouter/test-model","intent":"intent"}`))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
	}
	system := providerBody["messages"].([]any)[0].(map[string]any)["content"].(string)
	for _, want := range []string{
		`FACT = {"value": string, "provenance": "SPECIFIED"|"OBSERVED"|"DERIVED"|"INFERRED"|"UNKNOWN"}`,
		`intentStatement, scope and operation are each ONE FACT object`,
		`inputs, constraints, effects and failureBehavior are each an ARRAY of FACT objects`,
		`use [] when there are none`,
		`never an object keyed by name`,
		`requirementId is the supplied id as a plain string`,
		`unknowns is an array of plain strings`,
		`"kind":"OPERATION_RULE"|"DATA_MODEL"|"RELATIONSHIP"|"INVARIANT"|"WORKFLOW"|"UNKNOWN"`,
		`kind is a plain string classifying what the requirement is about`,
		`DATA_MODEL: entities, fields and their types`,
		`never invent an operation to fit a kind`,
	} {
		if !strings.Contains(system, want) {
			t.Errorf("system prompt is missing %q\n%s", want, system)
		}
	}
}

func TestNormalizeIntentLogsOneCorrelationIDAcrossEveryStageAndEchoesIt(t *testing.T) {
	logs := captureLog(t)
	h, server := draftHandler(t, providerReturns("```json\n{\"version\":1}\n```"))
	defer server.Close()

	req := normalizeRequest(`{"model":"openrouter/test-model","intent":"intent"}`)
	req.Header.Set("X-Sys-Request-Id", "req-abc")
	rr := httptest.NewRecorder()
	h.NormalizeIntent(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
	}
	if got := rr.Header().Get("X-Sys-Request-Id"); got != "req-abc" {
		t.Fatalf("echoed request id = %q", got)
	}
	for _, stage := range []string{"received", "provider_start", "provider_done", "parsed", "success"} {
		if !strings.Contains(logs.String(), fmt.Sprintf("[SYS_NORMALIZE_INTENT] id=req-abc stage=%s", stage)) {
			t.Errorf("missing stage %q in log:\n%s", stage, logs.String())
		}
	}
}

func TestNormalizeIntentGeneratesARequestIDWhenTheClientSendsNone(t *testing.T) {
	logs := captureLog(t)
	h, server := draftHandler(t, providerReturns(`{"version":1}`))
	defer server.Close()

	rr := httptest.NewRecorder()
	h.NormalizeIntent(rr, normalizeRequest(`{"model":"openrouter/test-model","intent":"intent"}`))

	id := rr.Header().Get("X-Sys-Request-Id")
	if id == "" || !strings.Contains(logs.String(), "id="+id+" stage=success") {
		t.Fatalf("generated id %q not used in log:\n%s", id, logs.String())
	}
}

func TestNormalizeIntentRejectsInvalidJSONWithAClearErrorAndALoggedStage(t *testing.T) {
	logs := captureLog(t)
	h, server := draftHandler(t, providerReturns("Sure! Here is the Structured Intent: {oops"))
	defer server.Close()

	req := normalizeRequest(`{"model":"openrouter/test-model","intent":"intent"}`)
	req.Header.Set("X-Sys-Request-Id", "req-bad")
	rr := httptest.NewRecorder()
	h.NormalizeIntent(rr, req)

	if rr.Code != http.StatusBadGateway || !strings.Contains(rr.Body.String(), "provider returned invalid Structured Intent JSON") {
		t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
	}
	if !strings.Contains(logs.String(), "[SYS_NORMALIZE_INTENT] id=req-bad stage=invalid_json") {
		t.Fatalf("missing invalid_json stage:\n%s", logs.String())
	}
}

// A custom request header would trigger a CORS preflight that the server's
// Access-Control-Allow-Headers ("Content-Type, Authorization") rejects, so the
// browser client carries the id in the JSON body instead.
func TestNormalizeIntentTakesTheCorrelationIDFromTheJSONBody(t *testing.T) {
	logs := captureLog(t)
	h, server := draftHandler(t, providerReturns(`{"version":1}`))
	defer server.Close()

	rr := httptest.NewRecorder()
	h.NormalizeIntent(rr, normalizeRequest(`{"model":"openrouter/test-model","intent":"intent","requestId":"sys-body-1"}`))

	if got := rr.Header().Get("X-Sys-Request-Id"); got != "sys-body-1" {
		t.Fatalf("echoed request id = %q", got)
	}
	if !strings.Contains(logs.String(), "[SYS_NORMALIZE_INTENT] id=sys-body-1 stage=success") {
		t.Fatalf("body id not used in log:\n%s", logs.String())
	}
}

func TestNormalizeIntentIgnoresAnUnsafeCorrelationID(t *testing.T) {
	logs := captureLog(t)
	h, server := draftHandler(t, providerReturns(`{"version":1}`))
	defer server.Close()

	rr := httptest.NewRecorder()
	h.NormalizeIntent(rr, normalizeRequest(`{"model":"openrouter/test-model","intent":"intent","requestId":"x\ny=1 stage=forged"}`))

	if strings.Contains(logs.String(), "stage=forged") || strings.Contains(rr.Header().Get("X-Sys-Request-Id"), "forged") {
		t.Fatalf("unsafe id leaked into log/header:\n%s", logs.String())
	}
}

// Reproduced with a real provider: a draft with no blank lines fails "missing Operation:", and
// multi-word values ("present in the system") fail "a multi-word value is ambiguous". The grammar
// (docs/architecture/CONTROLLED_NATURAL_LANGUAGE_FORMAL_SPEC.md) makes every declaration and rule its
// own blank-line-separated paragraph and allows only a one-token literal or "the <receiver> <property>".
func TestDraftSpecPromptTeachesTheParagraphAndSingleTokenValueRules(t *testing.T) {
	for _, want := range []string{
		`each in its own paragraph, separated by a blank line`,
		`a <value> is either ONE upper-case symbol`,
		`never a lower-case word such as true`,
		`category state is MISSING`,
		`the <receiver> <property>`,
		`never a multi-word phrase`,
		"Requirement: Transfer funds\n\nOperation: transfer funds\n\nIf source balance is 0, the operation must fail with InsufficientFunds.",
	} {
		if !strings.Contains(draftSpecSystemPrompt, want) {
			t.Errorf("draft-spec prompt is missing %q", want)
		}
	}
}
