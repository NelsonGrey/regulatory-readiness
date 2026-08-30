# @rre/observability

Structured logging, metrics, and trace helpers. OpenTelemetry-compatible so the
backend is swappable (console in dev, CloudWatch/X-Ray via ADOT in production).

**Invariant:** logs and traces exclude raw tokens, document content, claim
values, confidential filenames, and signed URLs (engine TRD §20.3).

Current: a minimal JSON console `Logger`. Metrics and tracing helpers to follow.
