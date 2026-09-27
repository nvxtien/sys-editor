package api

import (
	"encoding/json"
	"net/http"
	"time"
)

// Limits and the error shape shared by every /v1/sys provider-backed handler. They lived in the
// Formal Spec drafting handler until the controlled grammar was frozen; nothing about them was
// ever about specs.
const (
	sysMaxRequestBytes = 64 * 1024
	sysMaxOutputBytes  = 32 * 1024
	sysProviderTimeout = 90 * time.Second
)

// Every platform failure reaches a person through here, so it is said once in one shape rather
// than each handler inventing its own.
func writeSysError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
