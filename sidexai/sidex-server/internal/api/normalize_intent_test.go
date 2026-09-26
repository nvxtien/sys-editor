package api

import (
	"os"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func normalizeRequest(body string) *http.Request {
	req := httptestRequestForUser(http.MethodPost, "/v1/sys/normalize-intent", "local")
	req.Body = io.NopCloser(strings.NewReader(body))
	req.ContentLength = int64(len(body))
	return req
}

func TestNormalizeIntentReturnsTheStructuredIntentAndSendsNoSourceBinding(t *testing.T) {
	var providerBody map[string]any
	h, server := draftHandler(t, func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&providerBody)
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"{\\\"version\\\":1,\\\"requirementId\\\":\\\"REQ-001\\\"}\"}}]}\n\ndata: [DONE]\n\n")
	})
	defer server.Close()

	rr := httptest.NewRecorder()
	// An "operation" in the request is a leftover from manual source binding and must be ignored:
	// what code implements an intent is sys-platform's to recover, never the author's to declare.
	h.NormalizeIntent(rr, normalizeRequest(`{"model":"openrouter/test-model","intent":"A booking needs a seat.","operation":"BookingService.createBooking"}`))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
	}
	user := providerBody["messages"].([]any)[1].(map[string]any)["content"].(string)
	if strings.Contains(user, "BookingService.createBooking") {
		t.Fatalf("a source symbol reached the model: %q", user)
	}
	if user != "A booking needs a seat." {
		t.Fatalf("the model was sent more than the requirement: %q", user)
	}
}

func TestNormalizeIntentRejectsNonJSONProviderOutput(t *testing.T) {
	h, server := draftHandler(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"not json\"}}]}\n\ndata: [DONE]\n\n")
	})
	defer server.Close()
	rr := httptest.NewRecorder()
	h.NormalizeIntent(rr, normalizeRequest(`{"model":"openrouter/test-model","intent":"intent"}`))
	if rr.Code != http.StatusBadGateway { t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String()) }
}

// "Authoritative operation binding" was how a user-supplied Class.method reached the model. Source
// binding is not the editor's or the server's to own, so neither the request nor the prompt may
// carry one — otherwise the removed lifecycle step has a live path back in.
func TestNormalizeIntentCarriesNoSourceOperationBinding(t *testing.T) {
	source, err := os.ReadFile("normalize_intent.go")
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"Authoritative operation binding", "req.Operation", "operation,omitempty"} {
		if strings.Contains(string(source), forbidden) {
			t.Errorf("normalize_intent.go still carries %q", forbidden)
		}
	}
	if strings.Contains(normalizeIntentSystemPrompt, "authoritative operation") {
		t.Error("the prompt still asks for an authoritative operation")
	}
}

// A data model states entities, fields and relationships. Putting its fields in `inputs` and its
// relationships in `constraints` named them wrongly, and an operation of UNKNOWN read as a question
// the user still had to answer. The shape a kind uses is part of the contract.
func TestNormalizeIntentPromptStatesTheKindAwareShape(t *testing.T) {
	for _, want := range []string{
		`ENTITY = {"name": string, "fields": [FIELD]}`,
		`FIELD = {"name": string, "type": string, "provenance":`,
		`DATA_MODEL: entities (required)`,
		`relationships is an ARRAY of FACT objects`,
		`"operation": null`,
	} {
		if !strings.Contains(normalizeIntentSystemPrompt, want) {
			t.Errorf("prompt is missing %q", want)
		}
	}
}

