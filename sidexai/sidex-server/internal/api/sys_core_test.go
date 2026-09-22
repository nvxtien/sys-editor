package api

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRunSysCoreDelegatesWorkspaceAndArguments(t *testing.T) {
	root := t.TempDir()
	bin := filepath.Join(root, "sys-core")
	script := "#!/bin/sh\nprintf '%s' '{\"status\":\"INTENT_DRAFT\"}'\nprintf '%s' \"$PWD|$1|$2\" >&2\n"
	if err := os.WriteFile(bin, []byte(script), 0o700); err != nil {
		t.Fatal(err)
	}
	result, err := runSysCore(bin, root, []string{"status", "REQ-001"})
	if err != nil {
		t.Fatal(err)
	}
	if string(result) != `{"status":"INTENT_DRAFT"}` {
		t.Fatalf("unexpected core response: %s", result)
	}
}
