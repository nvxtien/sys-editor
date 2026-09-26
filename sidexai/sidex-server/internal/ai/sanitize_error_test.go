package ai

import (
	"errors"
	"strings"
	"testing"
)

// A rate limit is temporary and the reader's next move is to wait. Showing them Anthropic's raw
// JSON instead says nothing they can act on, and reads like the app is misconfigured.
func TestSanitizeErrorExplainsARateLimit(t *testing.T) {
	raw := errors.New(`Anthropic API error 429: {"type":"error","error":{"type":"rate_limit_error","message":"This request would exceed your account's rate limit. Please try again later."},"request_id":"req_011"}`)
	got := SanitizeErrorForDisplay(raw)

	if strings.Contains(got, "{") || strings.Contains(got, "request_id") {
		t.Errorf("raw provider JSON reached the reader: %q", got)
	}
	for _, want := range []string{"rate limit", "again"} {
		if !strings.Contains(strings.ToLower(got), want) {
			t.Errorf("message does not mention %q: %q", want, got)
		}
	}
}

func TestSanitizeErrorExplainsARateLimitFromAnyProvider(t *testing.T) {
	for _, raw := range []string{
		`OpenRouter API error 429: {"error":{"message":"rate limited"}}`,
		`API error 429 from https://api.example.com: too many requests`,
	} {
		got := SanitizeErrorForDisplay(errors.New(raw))
		if !strings.Contains(strings.ToLower(got), "rate limit") {
			t.Errorf("%q → %q", raw, got)
		}
	}
}

// Anything that is not a recognised shape must survive untouched: hiding an unknown error leaves
// the reader with nothing at all.
func TestSanitizeErrorLeavesAnUnknownErrorAlone(t *testing.T) {
	if got := SanitizeErrorForDisplay(errors.New("dial tcp 127.0.0.1:7433: connect: connection refused")); !strings.Contains(got, "connection refused") {
		t.Errorf("unknown error was swallowed: %q", got)
	}
}
