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

// sys-core normally lives in a sibling sys-platform checkout, not on $PATH. Resolving it only via
// $PATH leaves every lifecycle call failing with "executable file not found", which the editor shows
// as "Lifecycle unavailable" with no actions at all.
func TestResolveSysCoreBinaryFindsASiblingPlatformCheckout(t *testing.T) {
	root := t.TempDir()
	binary := filepath.Join(root, "sys-platform", "sys-core", "target", "debug", "sys-core")
	if err := os.MkdirAll(filepath.Dir(binary), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(binary, []byte("#!/bin/sh\nexit 0\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	workspace := filepath.Join(root, "a-project")
	if err := os.MkdirAll(workspace, 0o755); err != nil {
		t.Fatal(err)
	}

	t.Setenv("SYS_CORE_BIN", "")
	t.Setenv("SYS_PLATFORM_ROOT", "")
	t.Setenv("PATH", filepath.Join(root, "empty"))
	resolved, err := resolveSysCoreBinary(workspace)
	if err != nil {
		t.Fatalf("sibling checkout not found: %v", err)
	}
	if resolved != binary {
		t.Errorf("resolved %q, want %q", resolved, binary)
	}
}

func TestResolveSysCoreBinaryPrefersAnExplicitSysCoreBin(t *testing.T) {
	root := t.TempDir()
	binary := filepath.Join(root, "chosen-sys-core")
	if err := os.WriteFile(binary, []byte("#!/bin/sh\nexit 0\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("SYS_CORE_BIN", binary)
	resolved, err := resolveSysCoreBinary(root)
	if err != nil {
		t.Fatal(err)
	}
	if resolved != binary {
		t.Errorf("resolved %q, want %q", resolved, binary)
	}

	t.Setenv("SYS_CORE_BIN", filepath.Join(root, "missing"))
	if _, err := resolveSysCoreBinary(root); err == nil {
		t.Error("a SYS_CORE_BIN that points nowhere must be an error, not a silent fallback")
	}
}

func TestResolveSysCoreBinaryHonoursSysPlatformRoot(t *testing.T) {
	root := t.TempDir()
	binary := filepath.Join(root, "platform", "sys-core", "target", "debug", "sys-core")
	if err := os.MkdirAll(filepath.Dir(binary), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(binary, []byte("#!/bin/sh\nexit 0\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("SYS_CORE_BIN", "")
	t.Setenv("PATH", filepath.Join(root, "empty"))
	t.Setenv("SYS_PLATFORM_ROOT", filepath.Join(root, "platform"))
	resolved, err := resolveSysCoreBinary(t.TempDir())
	if err != nil {
		t.Fatalf("SYS_PLATFORM_ROOT not honoured: %v", err)
	}
	if resolved != binary {
		t.Errorf("resolved %q, want %q", resolved, binary)
	}
}
