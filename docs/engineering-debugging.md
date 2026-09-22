# Engineering Debugging

## Use runtime evidence before forming a diagnosis

When a feature fails, use the application's debug log to identify the failing stage and the concrete error before proposing a cause or changing code. Do not rely on screenshots, assumptions, or an inferred provider/server state when runtime evidence is available.

For multi-stage flows, add or use structured log markers at each boundary so the investigation can distinguish failures in:

- UI action dispatch
- local server readiness
- provider request and response
- CLI or external process execution
- validation and file persistence

Record the relevant safe context with each marker, such as the stage, exit code, endpoint, model name, working directory, and sanitized stdout/stderr. Never log credentials, access tokens, or other secrets.

The debugging loop is:

1. Reproduce the failure.
2. Read the debug log from the failing run.
3. Locate the first failed stage and capture its concrete error.
4. Fix the root cause at that boundary.
5. Reproduce the flow and verify the result.

