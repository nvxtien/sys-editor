package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sidex-ai/sidex-server/internal/ai"
)

func draftHandler(t *testing.T, provider http.HandlerFunc) (*Handler, *httptest.Server) {
	t.Helper()
	server := httptest.NewServer(provider)
	t.Setenv("OPENROUTER_BASE_URL", server.URL)
	t.Setenv("OPENROUTER_API_KEY", "test-key")
	return &Handler{aiClient: ai.NewClient()}, server
}

func draftRequest(body string) *http.Request {
	req := httptestRequestForUser(http.MethodPost, "/v1/sys/draft-spec", "local")
	req.Body = io.NopCloser(strings.NewReader(body))
	req.ContentLength = int64(len(body))
	return req
}

func TestDraftSpecUsesSelectedModelAndOnlyIntent(t *testing.T) {
	intent := "A booking must have a seat."
	var providerBody map[string]any
	h, server := draftHandler(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Errorf("provider path = %q", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&providerBody); err != nil {
			t.Errorf("decode provider request: %v", err)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"Requirement: Booking\"}}]}\n\ndata: [DONE]\n\n")
	})
	defer server.Close()

	req := draftRequest(fmt.Sprintf(`{"model":"openrouter/test-model","intent":%q}`, intent))
	rr := httptest.NewRecorder()
	h.DraftSpec(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
	}
	var result struct {
		DraftSpec string `json:"draftSpec"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if result.DraftSpec != "Requirement: Booking" {
		t.Fatalf("draftSpec = %q", result.DraftSpec)
	}
	if providerBody["model"] != "openrouter/test-model" {
		t.Fatalf("provider model = %v", providerBody["model"])
	}
	if _, exists := providerBody["tools"]; exists {
		t.Fatalf("one-shot request exposed tools: %v", providerBody["tools"])
	}
	messages, ok := providerBody["messages"].([]any)
	if !ok || len(messages) != 2 {
		t.Fatalf("provider messages = %#v", providerBody["messages"])
	}
	system := messages[0].(map[string]any)["content"].(string)
	user := messages[1].(map[string]any)["content"].(string)
	if !strings.Contains(system, "Formal Spec") || !strings.Contains(strings.ToLower(system), "only") {
		t.Fatalf("system prompt must request only Formal Spec output: %q", system)
	}
	for _, declaration := range []string{"Requirement:", "Operation:", "Markdown fences"} {
		if !strings.Contains(system, declaration) {
			t.Fatalf("system prompt missing %q contract: %q", declaration, system)
		}
	}
	if user != intent {
		t.Fatalf("provider user content = %q, want only intent %q", user, intent)
	}
}

func TestDraftSpecPreservesAllProviderTextChunks(t *testing.T) {
	draft := "Requirement: Booking\n\nOperation: create booking\n\nWhen the operation succeeds,\nstatus becomes CONFIRMED.\n\n日本語"
	h, server := draftHandler(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"Requirement: Booking\\n\\nOperation: create booking\\n\\nWhen the operation succeeds,\\n\"}}]}\n\n")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"status becomes CONFIRMED.\\n\\n日本語\"}}]}\n\ndata: [DONE]\n\n")
	})
	defer server.Close()

	rr := httptest.NewRecorder()
	h.DraftSpec(rr, draftRequest(`{"model":"openrouter/test-model","intent":"A booking must have a seat."}`))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
	}
	var result draftSpecResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if result.DraftSpec != draft {
		t.Fatalf("draftSpec = %q, want %q", result.DraftSpec, draft)
	}
}

func TestDraftSpecRejectsInvalidRequestsBeforeProvider(t *testing.T) {
	h := &Handler{}
	for _, tc := range []struct {
		name string
		body string
	}{
		{name: "invalid json", body: "{"},
		{name: "missing model", body: `{"intent":"A booking must have a seat."}`},
		{name: "blank model", body: `{"model":"  ","intent":"A booking must have a seat."}`},
		{name: "blank intent", body: `{"model":"openrouter/test-model","intent":"  "}`},
		{name: "oversized body", body: `{"model":"openrouter/test-model","intent":"` + strings.Repeat("x", 64*1024) + `"}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			h.DraftSpec(rr, draftRequest(tc.body))
			if rr.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
			}
		})
	}
}

func TestDraftSpecRejectsEmptyProviderOutput(t *testing.T) {
	h, server := draftHandler(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: [DONE]\n\n")
	})
	defer server.Close()
	rr := httptest.NewRecorder()
	h.DraftSpec(rr, draftRequest(`{"model":"openrouter/test-model","intent":"A booking must have a seat."}`))
	if rr.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
	}
}

func TestDraftSpecRejectsProviderOutputOver32KiB(t *testing.T) {
	h, server := draftHandler(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%q}}]}\n\ndata: [DONE]\n\n", strings.Repeat("x", 32*1024+1))
	})
	defer server.Close()
	rr := httptest.NewRecorder()
	h.DraftSpec(rr, draftRequest(`{"model":"openrouter/test-model","intent":"A booking must have a seat."}`))
	if rr.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
	}
}

func TestDraftSpecReportsProviderFailure(t *testing.T) {
	h, server := draftHandler(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"error":"provider unavailable"}`, http.StatusServiceUnavailable)
	})
	defer server.Close()
	rr := httptest.NewRecorder()
	h.DraftSpec(rr, draftRequest(`{"model":"openrouter/test-model","intent":"A booking must have a seat."}`))
	if rr.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
	}
}
