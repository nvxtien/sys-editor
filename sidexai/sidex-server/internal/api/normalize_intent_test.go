package api

import (
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
