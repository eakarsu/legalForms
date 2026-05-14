-- =============================================================
-- Migration 001: Initial Schema
-- Contains all base CREATE TABLE statements from database/schema.sql
-- and database/migrations/002_practice_management.sql through
-- database/migrations/006_oauth_columns.sql
-- =============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- CORE TABLES (from schema.sql)
-- =============================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    -- OAuth columns (from 006_oauth_columns.sql)
    google_id VARCHAR(255),
    microsoft_id VARCHAR(255),
    oauth_provider VARCHAR(50),
    avatar_url TEXT,
    totp_secret VARCHAR(255),
    totp_enabled BOOLEAN DEFAULT FALSE,
    totp_backup_codes JSONB,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(50) DEFAULT 'active',
    stripe_customer_id VARCHAR(255),
    trial_ends_at TIMESTAMP,
    firm_name VARCHAR(255),
    bar_number VARCHAR(100),
    practice_areas JSONB,
    state_bar VARCHAR(50),
    profile_complete BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS document_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    specific_type VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    form_data JSONB,
    file_format VARCHAR(10) DEFAULT 'pdf',
    file_size INTEGER,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS user_sessions (
    sid VARCHAR NOT NULL,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey') THEN
        ALTER TABLE user_sessions ADD CONSTRAINT session_pkey PRIMARY KEY (sid);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS IDX_session_expire ON user_sessions(expire);

CREATE TABLE IF NOT EXISTS compliance_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL,
    form_type VARCHAR(100) NOT NULL,
    field_name VARCHAR(100),
    rule_type VARCHAR(50) NOT NULL,
    rule_data JSONB NOT NULL,
    jurisdiction VARCHAR(10) DEFAULT 'US',
    effective_date DATE DEFAULT NOW()::DATE,
    expiry_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    business_type VARCHAR(100),
    industry VARCHAR(100),
    state_jurisdiction VARCHAR(10),
    experience_level VARCHAR(50),
    preferred_templates JSONB,
    usage_patterns JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS template_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    form_type VARCHAR(100) NOT NULL,
    specific_type VARCHAR(100),
    recommendation_score DECIMAL(3,2),
    recommendation_reason TEXT,
    was_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS esignature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES document_history(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_envelope_id VARCHAR(255),
    signing_url TEXT,
    status VARCHAR(50) DEFAULT 'sent',
    signers JSONB NOT NULL,
    webhook_url VARCHAR(500),
    expires_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nlp_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    input_text TEXT NOT NULL,
    input_hash VARCHAR(64) UNIQUE NOT NULL,
    parsed_data JSONB NOT NULL,
    form_type VARCHAR(100),
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES document_history(id) ON DELETE CASCADE,
    review_type VARCHAR(50) NOT NULL,
    issues_found JSONB,
    suggestions JSONB,
    overall_score DECIMAL(3,2),
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- PRACTICE MANAGEMENT (from 002_practice_management.sql)
-- =============================================

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_type VARCHAR(20) DEFAULT 'individual',
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(200),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    notes TEXT,
    tags JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS client_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(200),
    role VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    case_number VARCHAR(100) UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    case_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    priority VARCHAR(20) DEFAULT 'normal',
    court VARCHAR(255),
    judge VARCHAR(255),
    opposing_counsel VARCHAR(255),
    opposing_firm VARCHAR(255),
    filed_date DATE,
    close_date DATE,
    billing_type VARCHAR(50) DEFAULT 'hourly',
    hourly_rate DECIMAL(10,2),
    flat_fee DECIMAL(10,2),
    contingency_percentage DECIMAL(5,2),
    retainer_amount DECIMAL(10,2),
    tags JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    note_type VARCHAR(50) DEFAULT 'general',
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    reminder_days INTEGER DEFAULT 3,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    hourly_rate DECIMAL(10,2),
    amount DECIMAL(10,2),
    date DATE NOT NULL,
    is_billable BOOLEAN DEFAULT true,
    is_billed BOOLEAN DEFAULT false,
    invoice_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    invoice_number VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'draft',
    subtotal DECIMAL(10,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    due_date DATE,
    paid_date DATE,
    notes TEXT,
    line_items JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    date DATE NOT NULL,
    is_billable BOOLEAN DEFAULT true,
    is_billed BOOLEAN DEFAULT false,
    receipt_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(100),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    location VARCHAR(255),
    is_all_day BOOLEAN DEFAULT false,
    recurrence_rule TEXT,
    status VARCHAR(50) DEFAULT 'scheduled',
    google_event_id VARCHAR(255),
    outlook_event_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'normal',
    due_date DATE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'internal',
    is_read BOOLEAN DEFAULT false,
    parent_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS client_portal_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    portal_token VARCHAR(255),
    token_expires TIMESTAMP,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false}',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trust_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(100),
    bank_name VARCHAR(255),
    routing_number VARCHAR(50),
    account_type VARCHAR(50) DEFAULT 'iolta',
    current_balance DECIMAL(12,2) DEFAULT 0,
    minimum_balance DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS client_trust_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trust_account_id UUID REFERENCES trust_accounts(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    current_balance DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trust_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trust_account_id UUID REFERENCES trust_accounts(id) ON DELETE CASCADE,
    ledger_id UUID REFERENCES client_trust_ledgers(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    reference_number VARCHAR(100),
    transaction_date DATE NOT NULL,
    running_balance DECIMAL(12,2),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conflict_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    check_type VARCHAR(50),
    parties_checked JSONB,
    conflicts_found JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'pending',
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conflict_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conflict_check_id UUID REFERENCES conflict_checks(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100),
    relationship VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conflict_waivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_check_id UUID REFERENCES conflict_checks(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    waiver_text TEXT,
    signed_at TIMESTAMP,
    signed_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_intake_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    practice_area VARCHAR(100),
    form_fields JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    submission_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    form_id UUID REFERENCES lead_intake_forms(id) ON DELETE SET NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    legal_issue TEXT,
    status VARCHAR(50) DEFAULT 'new',
    priority VARCHAR(20) DEFAULT 'normal',
    form_data JSONB DEFAULT '{}',
    notes TEXT,
    converted_to_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- AI TABLES (from 004_ai_comprehensive.sql)
-- =============================================

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
    contract_clauses JSONB DEFAULT '[]',
    risk_factors JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_draft_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    document_type VARCHAR(100),
    template_content TEXT,
    variables JSONB DEFAULT '[]',
    is_public BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_draft_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES ai_draft_templates(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    title VARCHAR(255),
    status VARCHAR(50) DEFAULT 'draft',
    draft_content TEXT,
    variables_used JSONB DEFAULT '{}',
    ai_prompt TEXT,
    total_tokens INTEGER DEFAULT 0,
    cost_estimate DECIMAL(10,6) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_draft_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES ai_draft_sessions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    prompt_used TEXT,
    tokens_used INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    feature VARCHAR(100) NOT NULL,
    model VARCHAR(100),
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_estimate DECIMAL(10,6) DEFAULT 0,
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS citation_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    search_type VARCHAR(50) DEFAULT 'general',
    legal_issue TEXT NOT NULL,
    jurisdiction VARCHAR(100),
    practice_area VARCHAR(100),
    status VARCHAR(50) DEFAULT 'processing',
    research_summary TEXT,
    additional_suggestions JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS legal_citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_id UUID REFERENCES citation_searches(id) ON DELETE CASCADE,
    citation_type VARCHAR(50),
    citation_text VARCHAR(500),
    case_name VARCHAR(300),
    court VARCHAR(200),
    year VARCHAR(10),
    relevance_score INTEGER CHECK (relevance_score >= 0 AND relevance_score <= 100),
    key_holding TEXT,
    how_to_use TEXT,
    saved_to_case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    document_id UUID REFERENCES document_history(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES document_history(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    title VARCHAR(255),
    original_text TEXT,
    summary TEXT,
    key_points JSONB DEFAULT '[]',
    action_items JSONB DEFAULT '[]',
    document_type VARCHAR(100),
    file_path VARCHAR(500),
    file_size INTEGER,
    status VARCHAR(50) DEFAULT 'processing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ocr_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_path VARCHAR(500),
    original_filename VARCHAR(255),
    file_size INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    extracted_text TEXT,
    confidence_score DECIMAL(5,2),
    page_count INTEGER,
    processing_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voice_transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    audio_file_path VARCHAR(500),
    transcription TEXT,
    summary TEXT,
    action_items JSONB DEFAULT '[]',
    duration_seconds INTEGER,
    status VARCHAR(50) DEFAULT 'processing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_billing_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    suggestion_type VARCHAR(100),
    description TEXT,
    suggested_amount DECIMAL(10,2),
    confidence_score DECIMAL(3,2),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_conflict_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conflict_check_id UUID REFERENCES conflict_checks(id) ON DELETE SET NULL,
    analysis_result TEXT,
    risk_level VARCHAR(20),
    recommendations JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    prediction_type VARCHAR(100),
    prediction_data JSONB,
    confidence_score DECIMAL(3,2),
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_scheduling_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(100),
    input_data JSONB,
    recommendations JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    draft_content TEXT,
    message_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_price_id VARCHAR(255),
    plan_name VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    month_year VARCHAR(7) NOT NULL,
    documents_sent INTEGER DEFAULT 0,
    envelopes_sent INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, month_year)
);

CREATE TABLE IF NOT EXISTS user_docusign_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    integration_key VARCHAR(255),
    user_guid VARCHAR(255),
    account_id VARCHAR(255),
    base_path VARCHAR(500) DEFAULT 'https://demo.docusign.net/restapi',
    rsa_private_key TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calendar sync connections
CREATE TABLE IF NOT EXISTS calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    calendar_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calendar_events_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    calendar_connection_id UUID REFERENCES calendar_connections(id) ON DELETE CASCADE,
    external_event_id VARCHAR(255),
    event_data JSONB,
    sync_status VARCHAR(50) DEFAULT 'synced',
    last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Online payment tables
CREATE TABLE IF NOT EXISTS online_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    stripe_payment_intent_id VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'usd',
    status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    installments INTEGER NOT NULL,
    installment_amount DECIMAL(10,2),
    frequency VARCHAR(50) DEFAULT 'monthly',
    status VARCHAR(50) DEFAULT 'active',
    next_payment_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles and permissions
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    changes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OCR documents (legacy table name)
CREATE TABLE IF NOT EXISTS ocr_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_path VARCHAR(500),
    original_filename VARCHAR(255),
    extracted_text TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OCR search index
CREATE TABLE IF NOT EXISTS ocr_search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES ocr_jobs(id) ON DELETE CASCADE,
    search_vector TSVECTOR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- PERFORMANCE INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
CREATE INDEX IF NOT EXISTS idx_document_history_user_id ON document_history(user_id);
CREATE INDEX IF NOT EXISTS idx_document_history_created_at ON document_history(created_at);
CREATE INDEX IF NOT EXISTS idx_document_history_document_type ON document_history(document_type);
CREATE INDEX IF NOT EXISTS idx_compliance_rules_form_type ON compliance_rules(form_type);
CREATE INDEX IF NOT EXISTS idx_compliance_rules_active ON compliance_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_template_recommendations_user_id ON template_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_esignature_requests_document_id ON esignature_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_esignature_requests_status ON esignature_requests(status);
CREATE INDEX IF NOT EXISTS idx_nlp_cache_hash ON nlp_cache(input_hash);
CREATE INDEX IF NOT EXISTS idx_document_reviews_document_id ON document_reviews(document_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_client_id ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_case_id ON time_entries(case_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_deadlines_user_id ON deadlines(user_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_due_date ON deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_trust_accounts_user_id ON trust_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_citation_searches_user_id ON citation_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_citations_search_id ON legal_citations(search_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_id ON ai_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature ON ai_usage_log(feature);
CREATE INDEX IF NOT EXISTS idx_contract_analysis_user_id ON contract_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_document_summaries_user_id ON document_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_user_id ON ocr_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_user_id ON voice_transcriptions(user_id);

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'users', 'document_history', 'user_profiles', 'esignature_requests',
        'clients', 'cases', 'case_notes', 'deadlines', 'time_entries',
        'invoices', 'calendar_events', 'tasks', 'trust_accounts',
        'client_trust_ledgers', 'contract_analysis', 'ai_draft_templates',
        'ai_draft_sessions', 'document_summaries', 'ocr_jobs',
        'voice_transcriptions', 'calendar_connections', 'online_payments',
        'payment_plans', 'ai_scheduling_sessions', 'message_drafts',
        'subscriptions', 'platform_config', 'user_docusign_configs',
        'lead_intake_forms', 'leads'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'update_' || tbl || '_updated_at'
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER update_%I_updated_at
                 BEFORE UPDATE ON %I
                 FOR EACH ROW
                 EXECUTE FUNCTION update_updated_at_column()',
                tbl, tbl
            );
        END IF;
    END LOOP;
END $$;

-- =============================================
-- DEFAULT PLATFORM CONFIG
-- =============================================

INSERT INTO platform_config (config_key, config_value, description)
VALUES
    ('platform_docusign_enabled', 'false', 'Enable platform-level DocuSign integration'),
    ('free_tier_monthly_limit', '5', 'Free tier monthly document limit'),
    ('free_tier_envelope_limit', '5', 'Free tier monthly envelope limit')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO roles (name, description, permissions) VALUES
    ('admin', 'Administrator with full access', '["*"]'),
    ('attorney', 'Licensed attorney', '["cases:*","clients:*","billing:*","documents:*"]'),
    ('paralegal', 'Paralegal staff', '["cases:read","clients:read","documents:*"]'),
    ('billing', 'Billing specialist', '["billing:*","invoices:*"]')
ON CONFLICT (name) DO NOTHING;
