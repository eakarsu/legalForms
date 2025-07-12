-- Complete database setup for LegalFormsAI
-- Run this script to create all necessary tables and indexes

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
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
    last_login TIMESTAMP
);

-- Document history table
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

-- User sessions table (for connect-pg-simple)
CREATE TABLE IF NOT EXISTS user_sessions (
    sid VARCHAR NOT NULL,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

-- Create primary key and index for sessions
ALTER TABLE user_sessions ADD CONSTRAINT session_pkey PRIMARY KEY (sid);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON user_sessions(expire);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

CREATE INDEX IF NOT EXISTS idx_document_history_user_id ON document_history(user_id);
CREATE INDEX IF NOT EXISTS idx_document_history_created_at ON document_history(created_at);
CREATE INDEX IF NOT EXISTS idx_document_history_document_type ON document_history(document_type);

-- Compliance rules table for real-time validation
CREATE TABLE IF NOT EXISTS compliance_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL,
    form_type VARCHAR(100) NOT NULL,
    field_name VARCHAR(100),
    rule_type VARCHAR(50) NOT NULL, -- 'validation', 'format', 'required', 'range'
    rule_data JSONB NOT NULL, -- Contains validation logic, regex patterns, etc.
    jurisdiction VARCHAR(10) DEFAULT 'US',
    effective_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User profiles for template personalization
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    business_type VARCHAR(100),
    industry VARCHAR(100),
    state_jurisdiction VARCHAR(10),
    experience_level VARCHAR(50), -- 'beginner', 'intermediate', 'advanced'
    preferred_templates JSONB,
    usage_patterns JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Template recommendations tracking
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

-- E-signature tracking
CREATE TABLE IF NOT EXISTS esignature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES document_history(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'docusign', 'adobe', 'hellosign'
    provider_envelope_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'signed', 'completed', 'declined', 'voided'
    signers JSONB NOT NULL, -- Array of signer information
    webhook_url VARCHAR(500),
    expires_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Natural language processing cache
CREATE TABLE IF NOT EXISTS nlp_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    input_text TEXT NOT NULL,
    input_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash of input
    parsed_data JSONB NOT NULL,
    form_type VARCHAR(100),
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document review results
CREATE TABLE IF NOT EXISTS document_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES document_history(id) ON DELETE CASCADE,
    review_type VARCHAR(50) NOT NULL, -- 'compliance', 'completeness', 'risk_assessment'
    issues_found JSONB, -- Array of issues with severity levels
    suggestions JSONB, -- Array of improvement suggestions
    overall_score DECIMAL(3,2),
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create triggers for automatic updated_at updates
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_history_updated_at 
    BEFORE UPDATE ON document_history 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_esignature_requests_updated_at 
    BEFORE UPDATE ON esignature_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_compliance_rules_form_type ON compliance_rules(form_type);
CREATE INDEX IF NOT EXISTS idx_compliance_rules_active ON compliance_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_template_recommendations_user_id ON template_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_esignature_requests_document_id ON esignature_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_esignature_requests_status ON esignature_requests(status);
CREATE INDEX IF NOT EXISTS idx_nlp_cache_hash ON nlp_cache(input_hash);
CREATE INDEX IF NOT EXISTS idx_document_reviews_document_id ON document_reviews(document_id);

