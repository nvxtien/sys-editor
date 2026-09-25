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

func TestNormalizeIntentReturnsStructuredIntentAndForwardsBinding(t *testing.T) {
	var providerBody map[string]any
	h, server := draftHandler(t, func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&providerBody)
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"{\\\"version\\\":1,\\\"requirementId\\\":\\\"REQ-001\\\"}\"}}]}\n\ndata: [DONE]\n\n")
	})
	defer server.Close()

	rr := httptest.NewRecorder()
	h.NormalizeIntent(rr, normalizeRequest(`{"model":"openrouter/test-model","intent":"A booking needs a seat.","operation":"BookingService.createBooking"}`))
	if rr.Code != http.StatusOK { t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String()) }
	if !strings.Contains(providerBody["messages"].([]any)[1].(map[string]any)["content"].(string), "BookingService.createBooking") { t.Fatalf("binding missing from provider input: %#v", providerBody) }
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
