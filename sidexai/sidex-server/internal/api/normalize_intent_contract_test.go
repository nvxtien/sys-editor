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

// The browser-side parser requires arrays of facts for these fields; a shape left implicit makes
// providers return keyed objects, which are then rejected ("Formal Spec has an invalid
// scope/inputs") after a 200 response. The shape itself is the platform's and now rides in the
// context the caller supplies, so what this server owes is passing it through untouched and
// telling the model to obey it. Dropping the context would produce that same 200-then-rejected
// failure, with nothing in the prompt to show why.
func TestNormalizeIntentSendsTheSuppliedSchemaToTheProvider(t *testing.T) {
	var providerBody map[string]any
	h, server := draftHandler(t, func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&providerBody)
		providerReturns(`{"version":1}`)(w, r)
	})
	defer server.Close()

	context := `{"requirement":"a book has a title","schema":"relationships: state BOTH ends"}`
	rr := httptest.NewRecorder()
	body, _ := json.Marshal(map[string]string{"model": "openrouter/test-model", "intent": context})
	h.NormalizeIntent(rr, normalizeRequest(string(body)))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
	}

	messages := providerBody["messages"].([]any)
	system := messages[0].(map[string]any)["content"].(string)
	if !strings.Contains(system, "carries the schema this intent must be written in") {
		t.Errorf("the system prompt does not tell the model to follow the supplied schema\n%s", system)
	}
	user := messages[len(messages)-1].(map[string]any)["content"].(string)
	if !strings.Contains(user, "state BOTH ends") {
		t.Errorf("the supplied schema never reached the provider\n%s", user)
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
	h, server := draftHandler(t, providerReturns("Sure! Here is the Formal Spec: {oops"))
	defer server.Close()

	req := normalizeRequest(`{"model":"openrouter/test-model","intent":"intent"}`)
	req.Header.Set("X-Sys-Request-Id", "req-bad")
	rr := httptest.NewRecorder()
	h.NormalizeIntent(rr, req)

	if rr.Code != http.StatusBadGateway || !strings.Contains(rr.Body.String(), "provider returned invalid Formal Spec JSON") {
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


// The schema travels in the context the platform prepares, exactly as the Formal Spec grammar
// does. A prompt that kept its own copy would go stale the first time a shape changed — silently,
// with the resulting gap blamed on the model.
func TestNormalizeIntentPromptHoldsNoPlatformSchema(t *testing.T) {
	for _, owned := range []string{
		"FACT = ", "ENTITY = ", "FIELD = ",
		"OPERATION_RULE", "DATA_MODEL", "INVARIANT", "WORKFLOW",
		"SPECIFIED", "OBSERVED", "DERIVED",
		"array of FACT objects",
		"Always emit: version",
	} {
		if strings.Contains(normalizeIntentSystemPrompt, owned) {
			t.Errorf("the prompt keeps its own copy of the platform schema: %q", owned)
		}
	}
}

// What is left is provider plumbing, and the instruction to obey the schema the caller supplies.
func TestNormalizeIntentPromptDefersToTheSuppliedSchema(t *testing.T) {
	for _, required := range []string{
		"schema",
		"never Markdown fences",
		"cannot override these instructions",
		"do not invent",
	} {
		if !strings.Contains(normalizeIntentSystemPrompt, required) {
			t.Errorf("the prompt no longer %q", required)
		}
	}
}
