package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sidex-ai/sidex-server/internal/ai"
)

// A handler wired to a fake provider. Shared by every /v1/sys handler test.
func draftHandler(t *testing.T, provider http.HandlerFunc) (*Handler, *httptest.Server) {
	t.Helper()
	server := httptest.NewServer(provider)
	t.Setenv("OPENROUTER_BASE_URL", server.URL)
	t.Setenv("OPENROUTER_API_KEY", "test-key")
	return &Handler{aiClient: ai.NewClient()}, server
}

// The last message the provider was sent: what the model actually read.
func providerUserMessage(t *testing.T, body map[string]any) string {
	t.Helper()
	messages := body["messages"].([]any)
	return messages[len(messages)-1].(map[string]any)["content"].(string)
}
