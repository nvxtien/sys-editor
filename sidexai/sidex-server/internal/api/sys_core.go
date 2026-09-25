package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type sysCoreRequest struct {
	Workspace string   `json:"workspace"`
	Args      []string `json:"args"`
	Input     string   `json:"input,omitempty"`
}

func runSysCore(binary, workspace string, args []string) ([]byte, error) {
	return runSysCoreWithInput(binary, workspace, args, "")
}

func runSysCoreWithInput(binary, workspace string, args []string, input string) ([]byte, error) {
	if strings.TrimSpace(workspace) == "" || !filepath.IsAbs(workspace) {
		return nil, fmt.Errorf("workspace must be an absolute path")
	}
	command := exec.CommandContext(context.Background(), binary, args...)
	command.Dir = workspace
	if input != "" {
		command.Stdin = strings.NewReader(input)
	}
	var stderr bytes.Buffer
	command.Stderr = &stderr
	output, err := command.Output()
	if err != nil {
		if text := strings.TrimSpace(stderr.String()); text != "" {
			return nil, fmt.Errorf("sys-core failed: %s (%w)", text, err)
		}
		return nil, fmt.Errorf("sys-core failed: %w", err)
	}
	return output, nil
}

// sys-core normally lives in a sibling sys-platform checkout rather than on $PATH. An explicit
// SYS_CORE_BIN wins and is never silently ignored; otherwise $PATH, then SYS_PLATFORM_ROOT, the
// working directory and its parent, and the workspace's parent are searched for a built binary.
func resolveSysCoreBinary(workspace string) (string, error) {
	if configured := strings.TrimSpace(os.Getenv("SYS_CORE_BIN")); configured != "" {
		if filepath.IsAbs(configured) {
			if info, err := os.Stat(configured); err == nil && !info.IsDir() && info.Mode()&0o111 != 0 {
				return configured, nil
			}
			return "", fmt.Errorf("SYS_CORE_BIN does not point to an executable: %s", configured)
		}
		if resolved, err := exec.LookPath(configured); err == nil {
			return resolved, nil
		}
		return "", fmt.Errorf("SYS_CORE_BIN command not found in PATH: %s", configured)
	}
	if resolved, err := exec.LookPath("sys-core"); err == nil {
		return resolved, nil
	}

	roots := []string{}
	if configured := strings.TrimSpace(os.Getenv("SYS_PLATFORM_ROOT")); configured != "" {
		roots = append(roots, configured)
	}
	if cwd, err := os.Getwd(); err == nil {
		roots = append(roots, cwd, filepath.Dir(cwd))
	}
	if workspace != "" {
		roots = append(roots, filepath.Dir(workspace))
	}
	for _, root := range roots {
		for _, candidate := range []string{
			filepath.Join(root, "sys-core", "target", "debug", "sys-core"),
			filepath.Join(root, "sys-platform", "sys-core", "target", "debug", "sys-core"),
		} {
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() && info.Mode()&0o111 != 0 {
				return candidate, nil
			}
		}
	}
	return "", fmt.Errorf("sys-core was not found: set SYS_CORE_BIN to the binary, or SYS_PLATFORM_ROOT to a sys-platform checkout with sys-core/target/debug/sys-core built")
}

func (h *Handler) SysCore(w http.ResponseWriter, r *http.Request) {
	var req sysCoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Args) == 0 {
		writeDraftSpecError(w, http.StatusBadRequest, "workspace and sys-core arguments are required")
		return
	}
	binary, err := resolveSysCoreBinary(req.Workspace)
	if err != nil {
		writeDraftSpecError(w, http.StatusBadGateway, err.Error())
		return
	}
	output, err := runSysCoreWithInput(binary, req.Workspace, req.Args, req.Input)
	if err != nil {
		writeDraftSpecError(w, http.StatusBadGateway, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(output)
}
