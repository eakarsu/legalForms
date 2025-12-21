-- =====================================================
-- AI COMPREHENSIVE FEATURES MIGRATION
-- Legal Practice Management AI Enhancement
-- =====================================================

-- =====================================================
-- 1. CONTRACT ANALYSIS TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS contract_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    document_id UUID,
    ocr_job_id UUID,

    document_name VARCHAR(300),
    document_type VARCHAR(100),
    document_text TEXT,

    overall_risk_score INTEGER CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
    risk_level VARCHAR(20),
    analysis_summary TEXT,

    status VARCHAR(30) DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_notes TEXT,

    model_used VARCHAR(100),
    tokens_used INTEGER,
    processing_time_ms INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contract_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID REFERENCES contract_analysis(id) ON DELETE CASCADE,

    clause_type VARCHAR(100) NOT NULL,
    clause_text TEXT NOT NULL,
    start_position INTEGER,
    end_position INTEGER,

    risk_level VARCHAR(20),
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_explanation TEXT,
    recommendation TEXT,

    is_flagged BOOLEAN DEFAULT false,
    attorney_notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contract_key_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID REFERENCES contract_analysis(id) ON DELETE CASCADE,

    term_type VARCHAR(50) NOT NULL,
    term_label VARCHAR(200),
    term_value TEXT NOT NULL,
    normalized_value TEXT,
    confidence DECIMAL(5,2),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. DOCUMENT SUMMARIZATION TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS document_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    document_id UUID,
    ocr_job_id UUID,

    source_name VARCHAR(300),
    source_type VARCHAR(100),
    original_text TEXT,
    word_count INTEGER,

    executive_summary TEXT,
    detailed_summary TEXT,
    key_points JSONB DEFAULT '[]',

    summary_length VARCHAR(20) DEFAULT 'medium',
    target_audience VARCHAR(50) DEFAULT 'attorney',

    status VARCHAR(30) DEFAULT 'pending',

    case_note_id UUID,

    model_used VARCHAR(100),
    tokens_used INTEGER,
    processing_time_ms INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS summary_key_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_id UUID REFERENCES document_summaries(id) ON DELETE CASCADE,

    point_number INTEGER NOT NULL,
    category VARCHAR(100),
    content TEXT NOT NULL,
    importance VARCHAR(20) DEFAULT 'normal',
    source_excerpt TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. CITATION FINDER TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS citation_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    draft_session_id UUID,

    search_type VARCHAR(50) DEFAULT 'issue',
    legal_issue TEXT,
    jurisdiction VARCHAR(100),
    practice_area VARCHAR(100),
    context_text TEXT,

    status VARCHAR(30) DEFAULT 'pending',

    model_used VARCHAR(100),
    tokens_used INTEGER,
    processing_time_ms INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS legal_citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_id UUID REFERENCES citation_searches(id) ON DELETE CASCADE,

    citation_type VARCHAR(50) NOT NULL,
    citation_text VARCHAR(500) NOT NULL,
    case_name VARCHAR(500),
    court VARCHAR(200),
    year INTEGER,
    jurisdiction VARCHAR(100),

    relevance_score INTEGER CHECK (relevance_score >= 0 AND relevance_score <= 100),
    relevance_explanation TEXT,
    key_holding TEXT,
    applicable_facts TEXT,
    how_to_use TEXT,

    is_selected BOOLEAN DEFAULT false,
    used_in_draft BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add how_to_use column if table exists but column doesn't
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'legal_citations' AND column_name = 'how_to_use') THEN
        ALTER TABLE legal_citations ADD COLUMN how_to_use TEXT;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS citation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    citation_id UUID REFERENCES legal_citations(id) ON DELETE SET NULL,
    citation_text VARCHAR(500) NOT NULL,
    short_form VARCHAR(200),
    pinpoint_cite VARCHAR(100),
    signal VARCHAR(50),
    parenthetical TEXT,

    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 4. PORTAL CHATBOT TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS portal_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,

    status VARCHAR(30) DEFAULT 'active',
    escalated_at TIMESTAMP,
    escalated_to UUID REFERENCES users(id) ON DELETE SET NULL,
    escalation_reason TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES portal_chat_sessions(id) ON DELETE CASCADE,

    sender_type VARCHAR(20) NOT NULL,
    sender_id UUID,
    content TEXT NOT NULL,
    content_type VARCHAR(30) DEFAULT 'text',

    ai_confidence DECIMAL(5,2),
    metadata JSONB DEFAULT '{}',
    is_verified BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_ai_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    category VARCHAR(100),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords JSONB DEFAULT '[]',
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portal_chat_escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES portal_chat_sessions(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    attorney_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message_id UUID REFERENCES portal_chat_messages(id) ON DELETE SET NULL,

    reason VARCHAR(100),
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(30) DEFAULT 'pending',
    attorney_response TEXT,
    resolved_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 5. COMMUNICATION ASSISTANT TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_message_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    original_message_id UUID,

    draft_type VARCHAR(50) NOT NULL,
    original_content TEXT,
    ai_draft TEXT NOT NULL,
    tone VARCHAR(30),
    suggested_subject VARCHAR(300),

    status VARCHAR(30) DEFAULT 'pending',
    edited_content TEXT,

    model_used VARCHAR(100),
    tokens_used INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    sent_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID,

    category VARCHAR(100) NOT NULL,
    confidence DECIMAL(5,2),
    sentiment VARCHAR(30),
    suggested_action VARCHAR(100),
    auto_classified BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_response_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    trigger_keywords JSONB DEFAULT '[]',
    template_content TEXT NOT NULL,
    tone VARCHAR(30) DEFAULT 'professional',
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. INTELLIGENT INTAKE TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_intake_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID,
    session_token VARCHAR(255) UNIQUE NOT NULL,

    conversation_state JSONB DEFAULT '{}',
    collected_data JSONB DEFAULT '{}',
    current_step INTEGER DEFAULT 0,
    practice_area VARCHAR(100),
    lead_score INTEGER DEFAULT 0,
    qualification_status VARCHAR(30) DEFAULT 'pending',

    ip_address VARCHAR(45),
    user_agent TEXT,

    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    converted_to_lead_id UUID
);

CREATE TABLE IF NOT EXISTS ai_intake_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES ai_intake_sessions(id) ON DELETE CASCADE,

    question_text TEXT NOT NULL,
    question_type VARCHAR(30),
    options JSONB,
    context_reason TEXT,
    response TEXT,
    step_number INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS intake_field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    form_id UUID,

    source_field VARCHAR(100) NOT NULL,
    target_table VARCHAR(50) NOT NULL,
    target_field VARCHAR(100) NOT NULL,
    transformation VARCHAR(100),
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 7. AI CONFLICT DETECTION TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_conflict_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_check_id UUID,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    analysis_type VARCHAR(50) NOT NULL,
    input_data JSONB NOT NULL,
    ai_response JSONB NOT NULL,
    confidence_score DECIMAL(5,2),

    potential_conflicts JSONB DEFAULT '[]',
    corporate_relationships JSONB DEFAULT '[]',
    fuzzy_matches JSONB DEFAULT '[]',
    recommendations TEXT,

    model_used VARCHAR(100),
    tokens_used INTEGER,
    processing_time_ms INTEGER,

    reviewed BOOLEAN DEFAULT false,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 8. CASE PREDICTIONS TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_case_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    prediction_type VARCHAR(50) NOT NULL,
    input_factors JSONB NOT NULL,
    prediction_result JSONB NOT NULL,

    likelihood_assessment JSONB,
    similar_cases JSONB DEFAULT '[]',
    risk_factors JSONB DEFAULT '[]',
    strengths JSONB DEFAULT '[]',
    weaknesses JSONB DEFAULT '[]',
    recommended_strategy TEXT,

    disclaimer_acknowledged BOOLEAN DEFAULT false,

    model_used VARCHAR(100),
    tokens_used INTEGER,
    processing_time_ms INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 9. BILLING OPTIMIZATION TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_billing_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    suggestion_type VARCHAR(50) NOT NULL,
    source_type VARCHAR(50),
    source_id UUID,

    suggestion_data JSONB NOT NULL,
    suggested_description TEXT,
    suggested_duration_minutes INTEGER,
    suggested_amount DECIMAL(10,2),
    suggested_category VARCHAR(100),

    confidence_score DECIMAL(5,2),
    status VARCHAR(30) DEFAULT 'pending',
    applied_time_entry_id UUID,

    model_used VARCHAR(100),
    tokens_used INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 10. VOICE TRANSCRIPTION TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS voice_transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

    audio_file_path VARCHAR(500),
    audio_duration_seconds INTEGER,

    raw_transcription TEXT,
    cleaned_transcription TEXT,
    extracted_entities JSONB DEFAULT '{}',
    auto_tags JSONB DEFAULT '[]',
    summary TEXT,

    transcription_source VARCHAR(50) DEFAULT 'browser',

    model_used VARCHAR(100),
    tokens_used INTEGER,
    processing_time_ms INTEGER,

    status VARCHAR(30) DEFAULT 'completed',
    case_note_id UUID,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 11. CALENDAR ASSISTANT TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_calendar_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,

    suggestion_type VARCHAR(50) NOT NULL,
    source_type VARCHAR(50),
    source_id UUID,

    extracted_data JSONB NOT NULL,
    suggested_title VARCHAR(300),
    suggested_date DATE,
    suggested_time TIME,
    suggested_deadline_type VARCHAR(50),
    warning_days INTEGER,
    is_critical BOOLEAN DEFAULT false,
    jurisdiction VARCHAR(100),
    legal_basis TEXT,

    confidence_score DECIMAL(5,2),
    status VARCHAR(30) DEFAULT 'pending',
    applied_event_id UUID,
    applied_deadline_id UUID,

    model_used VARCHAR(100),
    tokens_used INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS statute_of_limitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction VARCHAR(100) NOT NULL,
    case_type VARCHAR(100) NOT NULL,
    cause_of_action VARCHAR(200) NOT NULL,

    limitation_period_days INTEGER NOT NULL,
    limitation_period_text VARCHAR(100),
    tolling_provisions TEXT,
    discovery_rule BOOLEAN DEFAULT false,
    statutory_reference VARCHAR(200),
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(jurisdiction, case_type, cause_of_action)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Contract Analysis
CREATE INDEX IF NOT EXISTS idx_contract_analysis_user ON contract_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_analysis_case ON contract_analysis(case_id);
CREATE INDEX IF NOT EXISTS idx_contract_analysis_status ON contract_analysis(status);
CREATE INDEX IF NOT EXISTS idx_contract_clauses_analysis ON contract_clauses(analysis_id);
CREATE INDEX IF NOT EXISTS idx_contract_clauses_type ON contract_clauses(clause_type);
CREATE INDEX IF NOT EXISTS idx_contract_key_terms_analysis ON contract_key_terms(analysis_id);

-- Document Summarization
CREATE INDEX IF NOT EXISTS idx_document_summaries_user ON document_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_document_summaries_case ON document_summaries(case_id);
CREATE INDEX IF NOT EXISTS idx_document_summaries_status ON document_summaries(status);
CREATE INDEX IF NOT EXISTS idx_summary_key_points_summary ON summary_key_points(summary_id);

-- Citation Finder
CREATE INDEX IF NOT EXISTS idx_citation_searches_user ON citation_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_citation_searches_case ON citation_searches(case_id);
CREATE INDEX IF NOT EXISTS idx_legal_citations_search ON legal_citations(search_id);
CREATE INDEX IF NOT EXISTS idx_citation_templates_user ON citation_templates(user_id);

-- Portal Chatbot
CREATE INDEX IF NOT EXISTS idx_portal_chat_sessions_client ON portal_chat_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_portal_chat_messages_session ON portal_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_portal_chat_escalations_attorney ON portal_chat_escalations(attorney_id, status);
CREATE INDEX IF NOT EXISTS idx_portal_ai_kb_user ON portal_ai_knowledge_base(user_id);
CREATE INDEX IF NOT EXISTS idx_portal_ai_kb_category ON portal_ai_knowledge_base(category);

-- Communication Assistant
CREATE INDEX IF NOT EXISTS idx_ai_message_drafts_user ON ai_message_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_message_drafts_status ON ai_message_drafts(status);
CREATE INDEX IF NOT EXISTS idx_message_classifications_message ON message_classifications(message_id);
CREATE INDEX IF NOT EXISTS idx_ai_response_templates_user ON ai_response_templates(user_id);

-- Intelligent Intake
CREATE INDEX IF NOT EXISTS idx_ai_intake_sessions_token ON ai_intake_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_ai_intake_sessions_form ON ai_intake_sessions(form_id);
CREATE INDEX IF NOT EXISTS idx_ai_intake_questions_session ON ai_intake_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_intake_field_mappings_form ON intake_field_mappings(form_id);

-- AI Conflicts
CREATE INDEX IF NOT EXISTS idx_ai_conflict_analyses_check ON ai_conflict_analyses(conflict_check_id);
CREATE INDEX IF NOT EXISTS idx_ai_conflict_analyses_user ON ai_conflict_analyses(user_id);

-- Case Predictions
CREATE INDEX IF NOT EXISTS idx_ai_case_predictions_case ON ai_case_predictions(case_id);
CREATE INDEX IF NOT EXISTS idx_ai_case_predictions_user ON ai_case_predictions(user_id);

-- Billing Optimization
CREATE INDEX IF NOT EXISTS idx_ai_billing_suggestions_case ON ai_billing_suggestions(case_id);
CREATE INDEX IF NOT EXISTS idx_ai_billing_suggestions_user ON ai_billing_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_billing_suggestions_status ON ai_billing_suggestions(status);

-- Voice Transcription
CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_user ON voice_transcriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_case ON voice_transcriptions(case_id);

-- Calendar Assistant
CREATE INDEX IF NOT EXISTS idx_ai_calendar_suggestions_case ON ai_calendar_suggestions(case_id);
CREATE INDEX IF NOT EXISTS idx_ai_calendar_suggestions_user ON ai_calendar_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_calendar_suggestions_status ON ai_calendar_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_sol_jurisdiction ON statute_of_limitations(jurisdiction, case_type);

-- =====================================================
-- SEED DATA: Common Statute of Limitations
-- =====================================================

INSERT INTO statute_of_limitations (jurisdiction, case_type, cause_of_action, limitation_period_days, limitation_period_text, discovery_rule, statutory_reference) VALUES
('Federal', 'Civil Rights', 'Section 1983', 730, '2 years', false, '42 U.S.C. § 1983'),
('Federal', 'Employment', 'Title VII', 300, '300 days (with state agency)', false, '42 U.S.C. § 2000e-5'),
('Federal', 'Employment', 'ADEA', 300, '300 days (with state agency)', false, '29 U.S.C. § 626'),
('California', 'Personal Injury', 'General', 730, '2 years', true, 'CCP § 335.1'),
('California', 'Medical Malpractice', 'General', 1095, '3 years or 1 year from discovery', true, 'CCP § 340.5'),
('California', 'Contract', 'Written', 1460, '4 years', false, 'CCP § 337'),
('California', 'Contract', 'Oral', 730, '2 years', false, 'CCP § 339'),
('California', 'Property Damage', 'General', 1095, '3 years', false, 'CCP § 338'),
('New York', 'Personal Injury', 'General', 1095, '3 years', false, 'CPLR § 214'),
('New York', 'Medical Malpractice', 'General', 912, '2.5 years', true, 'CPLR § 214-a'),
('New York', 'Contract', 'General', 2190, '6 years', false, 'CPLR § 213'),
('Texas', 'Personal Injury', 'General', 730, '2 years', true, 'Tex. Civ. Prac. & Rem. Code § 16.003'),
('Texas', 'Medical Malpractice', 'General', 730, '2 years', true, 'Tex. Civ. Prac. & Rem. Code § 74.251'),
('Texas', 'Contract', 'Written', 1460, '4 years', false, 'Tex. Civ. Prac. & Rem. Code § 16.004'),
('Florida', 'Personal Injury', 'General', 1460, '4 years', false, 'Fla. Stat. § 95.11'),
('Florida', 'Medical Malpractice', 'General', 730, '2 years', true, 'Fla. Stat. § 95.11'),
('Florida', 'Contract', 'Written', 1825, '5 years', false, 'Fla. Stat. § 95.11')
ON CONFLICT (jurisdiction, case_type, cause_of_action) DO NOTHING;
