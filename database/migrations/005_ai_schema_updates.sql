-- =====================================================
-- AI SCHEMA UPDATES
-- Ensures all AI columns exist
-- =====================================================

-- legal_citations: add how_to_use column
ALTER TABLE legal_citations ADD COLUMN IF NOT EXISTS how_to_use TEXT;

-- contract_analysis: ensure all columns
ALTER TABLE contract_analysis ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- voice_transcriptions: ensure all columns
ALTER TABLE voice_transcriptions ADD COLUMN IF NOT EXISTS client_id UUID;

-- ai_calendar_suggestions: ensure all columns
ALTER TABLE ai_calendar_suggestions ADD COLUMN IF NOT EXISTS legal_basis TEXT;

-- document_summaries: ensure case_note_id exists
ALTER TABLE document_summaries ADD COLUMN IF NOT EXISTS case_note_id UUID;

-- ai_billing_suggestions: ensure applied_time_entry_id exists
ALTER TABLE ai_billing_suggestions ADD COLUMN IF NOT EXISTS applied_time_entry_id UUID;

-- ai_case_predictions: ensure all columns
ALTER TABLE ai_case_predictions ADD COLUMN IF NOT EXISTS disclaimer_acknowledged BOOLEAN DEFAULT false;

-- portal_chat_sessions: ensure escalation columns
ALTER TABLE portal_chat_sessions ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP;
ALTER TABLE portal_chat_sessions ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

-- ai_intake_sessions: ensure lead conversion tracking
ALTER TABLE ai_intake_sessions ADD COLUMN IF NOT EXISTS converted_to_lead_id UUID;

-- citation_searches: ensure all columns exist
ALTER TABLE citation_searches ADD COLUMN IF NOT EXISTS research_summary TEXT;
ALTER TABLE citation_searches ADD COLUMN IF NOT EXISTS additional_suggestions TEXT;

-- ai_message_drafts: ensure all columns exist
ALTER TABLE ai_message_drafts ADD COLUMN IF NOT EXISTS subject_line TEXT;
ALTER TABLE ai_message_drafts ADD COLUMN IF NOT EXISTS key_points TEXT;
ALTER TABLE ai_message_drafts ADD COLUMN IF NOT EXISTS follow_up_actions TEXT;
