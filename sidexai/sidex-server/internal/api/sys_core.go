package api

import (
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
	output, err := command.Output()
	if err != nil {
		return nil, fmt.Errorf("sys-core failed: %w", err)
	}
	return output, nil
}

func (h *Handler) SysCore(w http.ResponseWriter, r *http.Request) {
	var req sysCoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Args) == 0 {
		writeDraftSpecError(w, http.StatusBadRequest, "workspace and sys-core arguments are required")
		return
	}
	binary := os.Getenv("SYS_CORE_BIN")
	if binary == "" {
		binary = "sys-core"
	}
	output, err := runSysCoreWithInput(binary, req.Workspace, req.Args, req.Input)
	if err != nil {
		writeDraftSpecError(w, http.StatusBadGateway, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(output)
}
