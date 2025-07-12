-- Add table for storing user DocuSign configurations
CREATE TABLE IF NOT EXISTS user_docusign_configs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    integration_key VARCHAR(255) NOT NULL,
    user_guid VARCHAR(255) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    base_path VARCHAR(255) DEFAULT 'https://demo.docusign.net/restapi',
    rsa_private_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Add table for tracking platform usage limits
CREATE TABLE IF NOT EXISTS platform_usage (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    month_year VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    documents_sent INTEGER DEFAULT 0,
    envelopes_sent INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, month_year)
);

-- Add configuration table for platform limits
CREATE TABLE IF NOT EXISTS platform_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default platform limits (only if they don't exist)
INSERT INTO platform_config (config_key, config_value, description) 
SELECT 'free_tier_monthly_limit', '5', 'Number of documents free users can send per month'
WHERE NOT EXISTS (SELECT 1 FROM platform_config WHERE config_key = 'free_tier_monthly_limit');

INSERT INTO platform_config (config_key, config_value, description) 
SELECT 'free_tier_envelope_limit', '10', 'Number of envelopes free users can send per month'
WHERE NOT EXISTS (SELECT 1 FROM platform_config WHERE config_key = 'free_tier_envelope_limit');

INSERT INTO platform_config (config_key, config_value, description) 
SELECT 'platform_docusign_enabled', 'true', 'Whether platform DocuSign account is available'
WHERE NOT EXISTS (SELECT 1 FROM platform_config WHERE config_key = 'platform_docusign_enabled');
