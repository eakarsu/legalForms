CREATE TABLE IF NOT EXISTS runtime_ai_results (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,
    prompt JSONB NOT NULL,
    response JSONB NOT NULL,
    provider_id TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_runtime_ai_results_user_created
    ON runtime_ai_results(user_id, created_at DESC);
