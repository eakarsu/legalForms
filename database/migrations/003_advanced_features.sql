-- Advanced Features Migration
-- Adds: Client Portal, Online Payments, Trust Accounting, Conflict Checking,
-- Two-Factor Auth, AI Drafting, Calendar Sync, Lead Intake, PWA, Document OCR

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- FEATURE 1: CLIENT PORTAL (Enhanced)
-- =====================================================

-- Add portal tokens and settings to client_portal_access
ALTER TABLE client_portal_access
ADD COLUMN IF NOT EXISTS portal_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS token_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "sms": false}';

-- Client portal sessions
CREATE TABLE IF NOT EXISTS client_portal_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_access_id UUID REFERENCES client_portal_access(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client document access (what documents clients can view)
CREATE TABLE IF NOT EXISTS client_document_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    document_id UUID REFERENCES document_history(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    access_type VARCHAR(20) DEFAULT 'view', -- view, download
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(client_id, document_id)
);

-- Client portal activity log
CREATE TABLE IF NOT EXISTS client_portal_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_portal_sessions_token ON client_portal_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_client_portal_sessions_expires ON client_portal_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_client_document_access_client ON client_document_access(client_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_activity_client ON client_portal_activity(client_id);

-- =====================================================
-- FEATURE 2: ONLINE PAYMENTS (Stripe)
-- =====================================================

-- Stripe customer records
CREATE TABLE IF NOT EXISTS stripe_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
    default_payment_method VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id)
);

-- Payment methods stored
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- card, bank_account, ach
    last_four VARCHAR(4),
    brand VARCHAR(50), -- visa, mastercard, amex
    exp_month INTEGER,
    exp_year INTEGER,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Online payment transactions
CREATE TABLE IF NOT EXISTS online_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_charge_id VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'usd',
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, succeeded, failed, refunded
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    fee_amount DECIMAL(10,2) DEFAULT 0,
    net_amount DECIMAL(10,2),
    failure_reason TEXT,
    receipt_url VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment links for easy client payments
CREATE TABLE IF NOT EXISTS payment_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    token VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    viewed_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_client ON stripe_customers(client_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_client ON payment_methods(client_id);
CREATE INDEX IF NOT EXISTS idx_online_payments_invoice ON online_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_online_payments_status ON online_payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_links_token ON payment_links(token);

-- =====================================================
-- FEATURE 3: TRUST/IOLTA ACCOUNTING
-- =====================================================

-- Trust accounts (IOLTA)
CREATE TABLE IF NOT EXISTS trust_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_name VARCHAR(200) NOT NULL,
    bank_name VARCHAR(200) NOT NULL,
    account_number_last4 VARCHAR(4),
    routing_number_last4 VARCHAR(4),
    account_type VARCHAR(50) DEFAULT 'iolta', -- iolta, client_trust, operating
    current_balance DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client trust ledgers (per-client trust balances)
CREATE TABLE IF NOT EXISTS client_trust_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trust_account_id UUID REFERENCES trust_accounts(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    current_balance DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trust_account_id, client_id, case_id)
);

-- Trust transactions
CREATE TABLE IF NOT EXISTS trust_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trust_account_id UUID REFERENCES trust_accounts(id) ON DELETE CASCADE,
    client_trust_ledger_id UUID REFERENCES client_trust_ledgers(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- deposit, withdrawal, transfer, fee, interest
    amount DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    description TEXT NOT NULL,
    reference_number VARCHAR(100),
    check_number VARCHAR(50),
    payee VARCHAR(200),
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    reconciled BOOLEAN DEFAULT false,
    reconciled_at TIMESTAMP,
    reconciled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    transaction_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trust account reconciliations
CREATE TABLE IF NOT EXISTS trust_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trust_account_id UUID REFERENCES trust_accounts(id) ON DELETE CASCADE,
    statement_date DATE NOT NULL,
    statement_balance DECIMAL(12,2) NOT NULL,
    book_balance DECIMAL(12,2) NOT NULL,
    adjusted_balance DECIMAL(12,2),
    is_balanced BOOLEAN DEFAULT false,
    notes TEXT,
    reconciled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trust_accounts_user ON trust_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_client_trust_ledgers_account ON client_trust_ledgers(trust_account_id);
CREATE INDEX IF NOT EXISTS idx_client_trust_ledgers_client ON client_trust_ledgers(client_id);
CREATE INDEX IF NOT EXISTS idx_trust_transactions_ledger ON trust_transactions(client_trust_ledger_id);
CREATE INDEX IF NOT EXISTS idx_trust_transactions_date ON trust_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_trust_reconciliations_account ON trust_reconciliations(trust_account_id);

-- =====================================================
-- FEATURE 4: CONFLICT CHECKING
-- =====================================================

-- Conflict parties (all parties to check against)
CREATE TABLE IF NOT EXISTS conflict_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    party_type VARCHAR(50) NOT NULL, -- individual, business, opposing_party, witness, related_party
    name VARCHAR(300) NOT NULL,
    aliases JSONB DEFAULT '[]', -- Alternative names
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(200),
    address TEXT,
    identifiers JSONB DEFAULT '{}', -- SSN last 4, EIN, etc.
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    relationship VARCHAR(100), -- client, opposing, co-counsel, witness
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conflict checks performed
CREATE TABLE IF NOT EXISTS conflict_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    check_type VARCHAR(50) DEFAULT 'new_matter', -- new_matter, new_client, periodic
    search_terms JSONB NOT NULL, -- Names, companies searched
    status VARCHAR(30) DEFAULT 'pending', -- pending, clear, conflict_found, waived
    results JSONB, -- Array of potential conflicts
    conflict_count INTEGER DEFAULT 0,
    checked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    waiver_obtained BOOLEAN DEFAULT false,
    waiver_notes TEXT,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conflict waivers
CREATE TABLE IF NOT EXISTS conflict_waivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_check_id UUID REFERENCES conflict_checks(id) ON DELETE CASCADE,
    waiver_type VARCHAR(50), -- informed_consent, advance_waiver
    parties_involved JSONB, -- Array of party IDs involved
    waiver_text TEXT,
    obtained_from VARCHAR(200),
    obtained_date DATE,
    document_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conflict_parties_user ON conflict_parties(user_id);
CREATE INDEX IF NOT EXISTS idx_conflict_parties_name ON conflict_parties(name);
CREATE INDEX IF NOT EXISTS idx_conflict_parties_case ON conflict_parties(case_id);
CREATE INDEX IF NOT EXISTS idx_conflict_checks_user ON conflict_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_conflict_checks_status ON conflict_checks(status);

-- =====================================================
-- FEATURE 5: TWO-FACTOR AUTHENTICATION
-- =====================================================

-- Add 2FA fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB,
ADD COLUMN IF NOT EXISTS two_factor_verified_at TIMESTAMP;

-- 2FA verification attempts
CREATE TABLE IF NOT EXISTS two_factor_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    attempt_type VARCHAR(30) NOT NULL, -- totp, backup_code, sms
    success BOOLEAN NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trusted devices for 2FA
CREATE TABLE IF NOT EXISTS trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_token VARCHAR(255) UNIQUE NOT NULL,
    device_name VARCHAR(200),
    device_type VARCHAR(50), -- desktop, mobile, tablet
    browser VARCHAR(100),
    os VARCHAR(100),
    ip_address VARCHAR(45),
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security audit log
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL, -- login, logout, 2fa_enabled, password_changed, etc.
    severity VARCHAR(20) DEFAULT 'info', -- info, warning, critical
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_user ON two_factor_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_token ON trusted_devices(device_token);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_type ON security_audit_log(event_type);

-- =====================================================
-- FEATURE 6: AI DOCUMENT DRAFTING
-- =====================================================

-- AI draft templates
CREATE TABLE IF NOT EXISTS ai_draft_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- contract, letter, motion, brief, memo
    document_type VARCHAR(100),
    prompt_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]', -- Required variables for the template
    example_output TEXT,
    is_public BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI draft sessions
CREATE TABLE IF NOT EXISTS ai_draft_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES ai_draft_templates(id) ON DELETE SET NULL,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    title VARCHAR(300),
    input_data JSONB, -- User-provided context and variables
    status VARCHAR(30) DEFAULT 'draft', -- draft, generating, completed, error
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI draft versions (multiple iterations)
CREATE TABLE IF NOT EXISTS ai_draft_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES ai_draft_sessions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    prompt_used TEXT,
    model_used VARCHAR(100),
    tokens_used INTEGER,
    generation_time_ms INTEGER,
    feedback VARCHAR(50), -- thumbs_up, thumbs_down, null
    feedback_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI usage tracking
CREATE TABLE IF NOT EXISTS ai_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    feature VARCHAR(100) NOT NULL, -- document_draft, summarize, analyze, chat
    model VARCHAR(100),
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    cost_estimate DECIMAL(10,6),
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_draft_templates_user ON ai_draft_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_draft_templates_category ON ai_draft_templates(category);
CREATE INDEX IF NOT EXISTS idx_ai_draft_sessions_user ON ai_draft_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_draft_versions_session ON ai_draft_versions(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user ON ai_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature ON ai_usage_log(feature);

-- =====================================================
-- FEATURE 7: CALENDAR SYNC (Google/Outlook)
-- =====================================================

-- Calendar sync connections
CREATE TABLE IF NOT EXISTS calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- google, outlook, apple
    provider_account_id VARCHAR(255),
    provider_email VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    calendar_id VARCHAR(255), -- Specific calendar to sync
    sync_direction VARCHAR(20) DEFAULT 'both', -- to_provider, from_provider, both
    last_sync_at TIMESTAMP,
    sync_status VARCHAR(30) DEFAULT 'active', -- active, paused, error
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Synced events mapping
CREATE TABLE IF NOT EXISTS calendar_sync_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES calendar_connections(id) ON DELETE CASCADE,
    local_event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
    provider_event_id VARCHAR(255) NOT NULL,
    provider_etag VARCHAR(255), -- For change detection
    last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_status VARCHAR(30) DEFAULT 'synced', -- synced, pending, conflict, error
    UNIQUE(connection_id, local_event_id),
    UNIQUE(connection_id, provider_event_id)
);

-- Sync history log
CREATE TABLE IF NOT EXISTS calendar_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES calendar_connections(id) ON DELETE CASCADE,
    sync_type VARCHAR(30), -- full, incremental, manual
    events_created INTEGER DEFAULT 0,
    events_updated INTEGER DEFAULT 0,
    events_deleted INTEGER DEFAULT 0,
    errors JSONB,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(30) DEFAULT 'running' -- running, completed, failed
);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider ON calendar_connections(provider);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_mapping_connection ON calendar_sync_mapping(connection_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_mapping_local ON calendar_sync_mapping(local_event_id);

-- =====================================================
-- FEATURE 8: LEAD INTAKE FORMS
-- =====================================================

-- Intake form templates
CREATE TABLE IF NOT EXISTS intake_form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    practice_area VARCHAR(100), -- personal_injury, family, criminal, corporate
    fields JSONB NOT NULL, -- Array of form field definitions
    settings JSONB DEFAULT '{}', -- Notifications, redirect, etc.
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT true,
    slug VARCHAR(100) UNIQUE,
    submission_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leads from intake forms
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    form_id UUID REFERENCES intake_form_templates(id) ON DELETE SET NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(200),
    practice_area VARCHAR(100),
    case_description TEXT,
    form_data JSONB, -- All submitted form data
    source VARCHAR(100), -- website, referral, advertisement
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    ip_address VARCHAR(45),
    status VARCHAR(30) DEFAULT 'new', -- new, contacted, qualified, converted, lost
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    converted_to_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    notes TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    follow_up_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lead activity tracking
CREATE TABLE IF NOT EXISTS lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_type VARCHAR(50) NOT NULL, -- call, email, meeting, note, status_change
    description TEXT,
    outcome VARCHAR(100),
    next_action VARCHAR(200),
    next_action_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lead scoring rules
CREATE TABLE IF NOT EXISTS lead_scoring_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    condition_field VARCHAR(100),
    condition_operator VARCHAR(30), -- equals, contains, greater_than, etc.
    condition_value TEXT,
    score_adjustment INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intake_forms_user ON intake_form_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_intake_forms_slug ON intake_form_templates(slug);
CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id);

-- =====================================================
-- FEATURE 9: PWA / MOBILE SUPPORT
-- =====================================================

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    device_type VARCHAR(50), -- web, ios, android
    device_name VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Push notification history
CREATE TABLE IF NOT EXISTS push_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    icon VARCHAR(500),
    url VARCHAR(500),
    data JSONB,
    status VARCHAR(30) DEFAULT 'pending', -- pending, sent, failed, clicked
    sent_at TIMESTAMP,
    clicked_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Offline sync queue
CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- create, update, delete
    entity_type VARCHAR(50) NOT NULL, -- time_entry, task, note, etc.
    entity_id UUID,
    payload JSONB NOT NULL,
    status VARCHAR(30) DEFAULT 'pending', -- pending, synced, conflict, failed
    device_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_user ON push_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_status ON push_notifications(status);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_user ON offline_sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_status ON offline_sync_queue(status);

-- =====================================================
-- FEATURE 10: DOCUMENT OCR
-- =====================================================

-- OCR processing jobs
CREATE TABLE IF NOT EXISTS ocr_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES document_history(id) ON DELETE SET NULL,
    original_file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255),
    file_type VARCHAR(50), -- pdf, png, jpg, tiff
    file_size INTEGER,
    status VARCHAR(30) DEFAULT 'pending', -- pending, processing, completed, failed
    progress INTEGER DEFAULT 0,
    page_count INTEGER,
    pages_processed INTEGER DEFAULT 0,
    language VARCHAR(10) DEFAULT 'eng',
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OCR results per page
CREATE TABLE IF NOT EXISTS ocr_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES ocr_jobs(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    raw_text TEXT,
    confidence_score DECIMAL(5,2),
    word_count INTEGER,
    bounding_boxes JSONB, -- Word positions for highlighting
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OCR extracted entities (names, dates, amounts)
CREATE TABLE IF NOT EXISTS ocr_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES ocr_jobs(id) ON DELETE CASCADE,
    page_id UUID REFERENCES ocr_pages(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- person, organization, date, money, address, phone, email
    value TEXT NOT NULL,
    normalized_value TEXT, -- Standardized format
    confidence DECIMAL(5,2),
    position JSONB, -- Location in document
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Full-text search index for OCR content
CREATE TABLE IF NOT EXISTS ocr_search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES ocr_jobs(id) ON DELETE CASCADE,
    document_id UUID REFERENCES document_history(id) ON DELETE SET NULL,
    full_text TEXT,
    search_vector tsvector,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ocr_jobs_user ON ocr_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status ON ocr_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_document ON ocr_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_ocr_pages_job ON ocr_pages(job_id);
CREATE INDEX IF NOT EXISTS idx_ocr_entities_job ON ocr_entities(job_id);
CREATE INDEX IF NOT EXISTS idx_ocr_entities_type ON ocr_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_ocr_search_vector ON ocr_search_index USING GIN(search_vector);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update search vector trigger
CREATE OR REPLACE FUNCTION ocr_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.full_text, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ocr_search_vector_trigger ON ocr_search_index;
CREATE TRIGGER ocr_search_vector_trigger
    BEFORE INSERT OR UPDATE ON ocr_search_index
    FOR EACH ROW EXECUTE FUNCTION ocr_search_vector_update();

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Advanced Features migration completed successfully!';
END $$;
