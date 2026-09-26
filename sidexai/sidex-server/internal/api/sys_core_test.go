package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A stand-in sys-core that prints what the test wants on stdout and stderr and exits with `code`.
func fakeSysCore(t *testing.T, stdout, stderr string, code int) string {
	t.Helper()
	bin := filepath.Join(t.TempDir(), "sys-core")
	script := fmt.Sprintf("#!/bin/sh\nprintf '%%s' %s\nprintf '%%s' %s >&2\nexit %d\n",
		shellQuote(stdout), shellQuote(stderr), code)
	if err := os.WriteFile(bin, []byte(script), 0o700); err != nil {
		t.Fatal(err)
	}
	return bin
}

func shellQuote(text string) string {
	return "'" + strings.ReplaceAll(text, "'", `'\''`) + "'"
}

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

// The server's working directory is src-tauri, one level below the repo, so a search that climbs
// only to the parent never reaches the checkout's own sibling directory.
func TestResolveSysCoreBinaryClimbsPastTheServerWorkingDirectory(t *testing.T) {
	root := t.TempDir()
	binary := filepath.Join(root, "sys-platform", "sys-core", "target", "debug", "sys-core")
	if err := os.MkdirAll(filepath.Dir(binary), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(binary, []byte("#!/bin/sh\nexit 0\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	// Mirror the real layout: <root>/an-editor/src-tauri is the working directory.
	workdir := filepath.Join(root, "an-editor", "src-tauri")
	if err := os.MkdirAll(workdir, 0o755); err != nil {
		t.Fatal(err)
	}
	t.Chdir(workdir)

	t.Setenv("SYS_CORE_BIN", "")
	t.Setenv("SYS_PLATFORM_ROOT", "")
	t.Setenv("PATH", filepath.Join(root, "empty"))
	resolved, err := resolveSysCoreBinary(filepath.Join(root, "elsewhere", "a-project"))
	if err != nil {
		t.Fatalf("not found from src-tauri working directory: %v", err)
	}
	if resolved != binary {
		t.Errorf("resolved %q, want %q", resolved, binary)
	}
}

// The bridge is transport. When sys-core states a wire error, it reaches the product exactly as
// the platform wrote it: wrapping it in prose and an exit status leaves the product parsing a
// code back out of a sentence.
func TestSysCorePassesThePlatformsWireErrorThrough(t *testing.T) {
	wire := `{"error":"UNKNOWN_PROJECT_LANGUAGE","detail":"pom.xml, go.mod"}`
	_, err := runSysCoreWithInput(fakeSysCore(t, "", wire, 1), t.TempDir(), []string{"code", "prepare", "REQ-001"}, "")
	if err == nil {
		t.Fatal("a failing sys-core must be an error")
	}
	if err.Error() != wire {
		t.Errorf("the platform's error was mangled on the way through:\n got  %s\n want %s", err.Error(), wire)
	}
}

// A crash, a missing binary, a panic: nothing structured to pass through, so say what happened.
func TestSysCoreExplainsAFailureThatIsNotAWireError(t *testing.T) {
	_, err := runSysCoreWithInput(fakeSysCore(t, "", "thread 'main' panicked", 101), t.TempDir(), []string{"x"}, "")
	if err == nil || !strings.Contains(err.Error(), "sys-core failed") || !strings.Contains(err.Error(), "panicked") {
		t.Errorf("err = %v", err)
	}
}

// The handler must not wrap the wire error a second time: {"error":"{\"error\":…}"} leaves the
// product unwrapping a string to find the code the platform already stated plainly.
func TestSysCoreHandlerReturnsTheWireErrorAsTheBody(t *testing.T) {
	wire := `{"error":"UNKNOWN_PROJECT_LANGUAGE","detail":"pom.xml"}`
	t.Setenv("SYS_CORE_BIN", fakeSysCore(t, "", wire, 1))
	req := httptestRequestForUser(http.MethodPost, "/v1/sys/core", "local")
	req.Body = io.NopCloser(strings.NewReader(`{"workspace":"` + t.TempDir() + `","args":["code","prepare","REQ-001"]}`))

	rr := httptest.NewRecorder()
	(&Handler{}).SysCore(rr, req)

	if rr.Code != http.StatusBadGateway {
		t.Fatalf("status = %d", rr.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["error"] != "UNKNOWN_PROJECT_LANGUAGE" || body["detail"] != "pom.xml" {
		t.Errorf("the wire error was wrapped again: %s", rr.Body.String())
	}
}
