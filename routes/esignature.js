const express = require('express');
const docusign = require('docusign-esign');
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Get DocuSign client with hybrid approach (user config or platform config)
const getDocuSignClient = async (userId = null, useUserConfig = false) => {
    const apiClient = new docusign.ApiClient();
    let config = {};
    
    try {
        // Try to get user's DocuSign configuration first if requested
        if (useUserConfig && userId) {
            const userConfigResult = await db.query(
                'SELECT * FROM user_docusign_configs WHERE (user_id = $1 OR user_id IS NULL) AND is_active = true',
                [userId]
            );
            
            if (userConfigResult.rows.length > 0) {
                const userConfig = userConfigResult.rows[0];
                config = {
                    integrationKey: userConfig.integration_key,
                    userId: userConfig.user_guid,
                    accountId: userConfig.account_id,
                    basePath: userConfig.base_path,
                    privateKey: userConfig.rsa_private_key,
                    source: 'user'
                };
            }
        }
        
        // Fallback to platform configuration if no user config
        if (!config.integrationKey) {
            // Check if platform DocuSign is enabled
            const platformEnabledResult = await db.query(
                "SELECT config_value FROM platform_config WHERE config_key = 'platform_docusign_enabled'"
            );
            
            const platformEnabled = platformEnabledResult.rows[0]?.config_value === 'true';
            
            if (!platformEnabled) {
                throw new Error('Platform DocuSign is disabled. Please configure your own DocuSign account.');
            }
            
            // Use platform configuration
            let privateKey = process.env.DOCUSIGN_RSA_PRIVATE_KEY;
            
            // Handle private key file reading
            if (privateKey && !privateKey.includes('-----BEGIN')) {
                try {
                    privateKey = await fs.readFile(privateKey, 'utf8');
                } catch (error) {
                    console.error('Error reading private key file from DOCUSIGN_RSA_PRIVATE_KEY:', error);
                    privateKey = null;
                }
            }
            
            if (!privateKey && process.env.DOCUSIGN_RSA_PRIVATE_KEY_PATH) {
                try {
                    privateKey = await fs.readFile(process.env.DOCUSIGN_RSA_PRIVATE_KEY_PATH, 'utf8');
                } catch (error) {
                    console.error('Error reading private key file from DOCUSIGN_RSA_PRIVATE_KEY_PATH:', error);
                    throw new Error('Could not read DocuSign private key file');
                }
            }
            
            config = {
                integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY,
                userId: process.env.DOCUSIGN_USER_ID,
                accountId: process.env.DOCUSIGN_ACCOUNT_ID,
                basePath: process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi',
                privateKey: privateKey,
                source: 'platform'
            };
        }
        
        // Validate configuration
        if (!config.integrationKey || !config.userId || !config.accountId || !config.privateKey) {
            throw new Error('DocuSign configuration incomplete');
        }
        
        apiClient.setBasePath(config.basePath);
        
        // Ensure the private key is in proper format
        config.privateKey = config.privateKey.trim();
        if (!config.privateKey.includes('-----BEGIN') || !config.privateKey.includes('-----END')) {
            throw new Error('Invalid RSA private key format. Key must include BEGIN/END headers.');
        }
        
        const jwtLifeSec = 3600; // 1 hour
        const scopes = ['signature', 'impersonation'];
        
        console.log(`DocuSign Configuration Check (${config.source}):`, {
            integrationKey: config.integrationKey?.substring(0, 8) + '...',
            userId: config.userId?.substring(0, 8) + '...',
            accountId: config.accountId?.substring(0, 8) + '...',
            basePath: config.basePath,
            privateKeyLength: config.privateKey.length,
            source: config.source
        });
        
        const results = await apiClient.requestJWTUserToken(
            config.integrationKey,
            config.userId,
            scopes,
            config.privateKey,
            jwtLifeSec
        );
        
        apiClient.addDefaultHeader('Authorization', 'Bearer ' + results.body.access_token);
        return { apiClient, config };
        
    } catch (error) {
        console.error('DocuSign JWT authentication failed:', error);
        
        const errorBody = error.response?.body || {};
        const errorDescription = errorBody.error_description || '';
        
        if (errorDescription.includes('no_valid_keys_or_signatures') || errorBody.error === 'invalid_grant') {
            const consentUrl = `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${config.integrationKey}&redirect_uri=https://www.docusign.com`;
            
            throw new Error(`DocuSign authentication failed: User consent required or invalid configuration.

REQUIRED STEPS:
1. Grant user consent by visiting: ${consentUrl}
2. Verify your RSA public key is uploaded to DocuSign Admin Console
3. Ensure JWT is enabled for your application
4. Verify Integration Key matches your DocuSign app

Error details: ${errorDescription}`);
        } else if (errorDescription.includes('invalid_client')) {
            throw new Error('DocuSign authentication failed: Invalid Integration Key.');
        } else if (errorDescription.includes('invalid_scope')) {
            throw new Error('DocuSign authentication failed: Invalid scopes.');
        } else {
            throw new Error(`DocuSign authentication failed: ${errorDescription || error.message}`);
        }
    }
};

// Check if user can use platform DocuSign (within limits)
const checkPlatformUsageLimits = async (userId) => {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    
    // Get current usage
    const usageResult = await db.query(
        'SELECT * FROM platform_usage WHERE (user_id = $1 OR user_id IS NULL) AND month_year = $2',
        [userId, currentMonth]
    );
    
    // Get limits from config
    const limitsResult = await db.query(
        "SELECT config_key, config_value FROM platform_config WHERE config_key IN ('free_tier_monthly_limit', 'free_tier_envelope_limit')"
    );
    
    const limits = {};
    limitsResult.rows.forEach(row => {
        limits[row.config_key] = parseInt(row.config_value);
    });
    
    const currentUsage = usageResult.rows[0] || { documents_sent: 0, envelopes_sent: 0 };
    
    return {
        canUse: currentUsage.documents_sent < limits.free_tier_monthly_limit,
        usage: currentUsage,
        limits: limits,
        remaining: {
            documents: Math.max(0, limits.free_tier_monthly_limit - currentUsage.documents_sent),
            envelopes: Math.max(0, limits.free_tier_envelope_limit - currentUsage.envelopes_sent)
        }
    };
};

// Update platform usage
const updatePlatformUsage = async (userId) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    await db.query(`
        INSERT INTO platform_usage (user_id, month_year, documents_sent, envelopes_sent)
        VALUES ($1, $2, 1, 1)
        ON CONFLICT (user_id, month_year)
        DO UPDATE SET 
            documents_sent = platform_usage.documents_sent + 1,
            envelopes_sent = platform_usage.envelopes_sent + 1,
            updated_at = CURRENT_TIMESTAMP
    `, [userId, currentMonth]);
};

// Create envelope for signing
async function createDocuSignEnvelope(documentPath, signers, documentName, userId = null, useUserConfig = false) {
    try {
        const { apiClient, config } = await getDocuSignClient(userId, useUserConfig);
        const envelopesApi = new docusign.EnvelopesApi(apiClient);
        
        // Read document
        const documentBytes = await fs.readFile(documentPath);
        const documentBase64 = documentBytes.toString('base64');
        
        // Create envelope definition
        const envelopeDefinition = new docusign.EnvelopeDefinition();
        envelopeDefinition.emailSubject = `Please sign: ${documentName}`;
        envelopeDefinition.status = 'sent';
        
        // Add document
        const document = new docusign.Document();
        document.documentBase64 = documentBase64;
        document.name = documentName;
        document.fileExtension = path.extname(documentPath).substring(1);
        document.documentId = '1';
        
        envelopeDefinition.documents = [document];
        
        // Add signers
        const signersList = signers.map((signer, index) => {
            const signerObj = new docusign.Signer();
            signerObj.email = signer.email;
            signerObj.name = signer.name;
            signerObj.recipientId = (index + 1).toString();
            signerObj.routingOrder = (index + 1).toString();
            
            // Add signature tab
            const signHere = new docusign.SignHere();
            signHere.documentId = '1';
            signHere.pageNumber = '1';
            signHere.recipientId = signerObj.recipientId;
            signHere.tabLabel = 'SignHereTab';
            signHere.xPosition = '100';
            signHere.yPosition = '100';
            
            const tabs = new docusign.Tabs();
            tabs.signHereTabs = [signHere];
            signerObj.tabs = tabs;
            
            return signerObj;
        });
        
        const recipients = new docusign.Recipients();
        recipients.signers = signersList;
        envelopeDefinition.recipients = recipients;
        
        // Create envelope
        const result = await envelopesApi.createEnvelope(
            config.accountId,
            { envelopeDefinition }
        );
        
        return { envelopeId: result.envelopeId, configSource: config.source };
        
    } catch (error) {
        console.error('DocuSign envelope creation error:', error);
        throw error;
    }
}

// Send document for e-signature
router.post('/send', requireAuth, async (req, res) => {
    try {
        const { documentId, signers, provider = 'docusign' } = req.body;
        
        // Validate input
        if (!documentId || !signers || !Array.isArray(signers) || signers.length === 0) {
            return res.status(400).json({ error: 'Document ID and signers are required' });
        }
        
        // Get document details
        const docResult = await db.query(
            'SELECT * FROM document_history WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [documentId, req.user.id]
        );
        
        if (docResult.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        const document = docResult.rows[0];
        
        // Construct proper file path
        let documentPath;
        if (document.file_path) {
            // If file_path is just a filename, join with uploads directory
            if (!path.isAbsolute(document.file_path)) {
                documentPath = path.join(__dirname, '../uploads', document.file_path);
            } else {
                documentPath = document.file_path;
            }
        } else {
            // Fallback to title-based filename
            documentPath = path.join(__dirname, '../uploads', `${document.title}.pdf`);
        }
        
        // Check if file exists
        try {
            await fs.access(documentPath);
        } catch (error) {
            console.error('Document file not found:', documentPath);
            return res.status(404).json({ error: 'Document file not found. Please regenerate the document.' });
        }
        
        let providerEnvelopeId;
        
        switch (provider) {
            case 'docusign':
                try {
                    // Check if user has their own DocuSign config
                    const hasUserConfig = await db.query(
                        'SELECT id FROM user_docusign_configs WHERE (user_id = $1 OR user_id IS NULL) AND is_active = true',
                        [req.user.id]
                    );
                    
                    let useUserConfig = hasUserConfig.rows.length > 0;
                    let configSource = 'platform';
                    
                    // If no user config, check platform limits
                    if (!useUserConfig) {
                        const usageCheck = await checkPlatformUsageLimits(req.user.id);
                        if (!usageCheck.canUse) {
                            return res.status(429).json({
                                error: 'Monthly limit exceeded',
                                message: `You've reached your free tier limit of ${usageCheck.limits.free_tier_monthly_limit} documents per month.`,
                                suggestion: 'Configure your own DocuSign account for unlimited usage.',
                                usage: usageCheck.usage,
                                limits: usageCheck.limits
                            });
                        }
                    }
                    
                    const result = await createDocuSignEnvelope(
                        documentPath,
                        signers,
                        document.title,
                        req.user.id,
                        useUserConfig
                    );
                    
                    providerEnvelopeId = result.envelopeId;
                    configSource = result.configSource;
                    
                    // Update platform usage if using platform config
                    if (configSource === 'platform') {
                        await updatePlatformUsage(req.user.id);
                    }
                    
                } catch (docusignError) {
                    console.error('DocuSign error, falling back to mock:', docusignError.message);
                    
                    // Fallback to mock implementation
                    providerEnvelopeId = `mock_fallback_${Date.now()}`;
                    let fallbackProvider = 'mock';
                    
                    // Save mock e-signature request
                    const esignResult = await db.query(`
                        INSERT INTO esignature_requests 
                        (document_id, user_id, provider, provider_envelope_id, status, signers, expires_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        RETURNING id
                    `, [
                        documentId,
                        req.user.id,
                        fallbackProvider,
                        providerEnvelopeId,
                        'sent',
                        JSON.stringify(signers),
                        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
                    ]);
                    
                    return res.json({
                        success: true,
                        esignatureId: esignResult.rows[0].id,
                        providerEnvelopeId,
                        message: 'DocuSign authentication failed. Mock e-signature created for testing.',
                        warning: 'Please configure DocuSign properly for production use.',
                        troubleshooting: `Visit: https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${process.env.DOCUSIGN_INTEGRATION_KEY}&redirect_uri=https://www.docusign.com`
                    });
                }
                break;
                
            default:
                return res.status(400).json({ error: 'Unsupported e-signature provider' });
        }
        
        // Save e-signature request (only if not already saved in fallback)
        if (provider === 'docusign') {
            const esignResult = await db.query(`
                INSERT INTO esignature_requests 
                (document_id, user_id, provider, provider_envelope_id, status, signers, expires_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `, [
                documentId,
                req.user.id,
                provider,
                providerEnvelopeId,
                'sent',
                JSON.stringify(signers),
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            ]);
            
            res.json({
                success: true,
                esignatureId: esignResult.rows[0].id,
                providerEnvelopeId,
                message: 'Document sent for e-signature successfully'
            });
        }
        
        
    } catch (error) {
        console.error('E-signature send error:', error);
        res.status(500).json({ error: 'Failed to send document for e-signature' });
    }
});

// Get e-signature status
router.get('/status/:esignatureId', requireAuth, async (req, res) => {
    try {
        const { esignatureId } = req.params;
        
        const result = await db.query(`
            SELECT es.*, dh.title as document_title
            FROM esignature_requests es
            JOIN document_history dh ON es.document_id = dh.id
            WHERE es.id = $1 AND (es.user_id = $2 OR es.user_id IS NULL)
        `, [esignatureId, req.user.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'E-signature request not found' });
        }
        
        const esignRequest = result.rows[0];
        
        // Get updated status from provider
        if (esignRequest.provider === 'docusign') {
            try {
                const apiClient = await getDocuSignClient();
                const envelopesApi = new docusign.EnvelopesApi(apiClient);
                
                const envelope = await envelopesApi.getEnvelope(
                    process.env.DOCUSIGN_ACCOUNT_ID,
                    esignRequest.provider_envelope_id
                );
                
                // Update status if changed
                if (envelope.status !== esignRequest.status) {
                    await db.query(
                        'UPDATE esignature_requests SET status = $1 WHERE id = $2',
                        [envelope.status, esignatureId]
                    );
                    esignRequest.status = envelope.status;
                }
                
            } catch (error) {
                console.error('Error fetching DocuSign status:', error);
            }
        }
        
        res.json({
            success: true,
            esignature: {
                id: esignRequest.id,
                documentTitle: esignRequest.document_title,
                status: esignRequest.status,
                provider: esignRequest.provider,
                signers: esignRequest.signers,
                createdAt: esignRequest.created_at,
                expiresAt: esignRequest.expires_at,
                completedAt: esignRequest.completed_at
            }
        });
        
    } catch (error) {
        console.error('E-signature status error:', error);
        res.status(500).json({ error: 'Failed to get e-signature status' });
    }
});

// List user's e-signature requests
router.get('/list', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT es.*, dh.title as document_title
            FROM esignature_requests es
            JOIN document_history dh ON es.document_id = dh.id
            WHERE (es.user_id = $1 OR es.user_id IS NULL)
            ORDER BY es.created_at DESC
            LIMIT 50
        `, [req.user.id]);
        
        res.json({
            success: true,
            esignatures: result.rows.map(row => ({
                id: row.id,
                documentTitle: row.document_title,
                status: row.status,
                provider: row.provider,
                signers: row.signers,
                createdAt: row.created_at,
                expiresAt: row.expires_at,
                completedAt: row.completed_at
            }))
        });
        
    } catch (error) {
        console.error('E-signature list error:', error);
        res.status(500).json({ error: 'Failed to get e-signature list' });
    }
});

// Webhook endpoint for status updates
router.post('/webhook/:provider', async (req, res) => {
    try {
        const { provider } = req.params;
        
        if (provider === 'docusign') {
            // DocuSign webhook handling
            const { event, data } = req.body;
            
            if (event === 'envelope-completed' || event === 'envelope-signed') {
                const envelopeId = data.envelopeId;
                
                await db.query(`
                    UPDATE esignature_requests 
                    SET status = $1, completed_at = CURRENT_TIMESTAMP
                    WHERE provider_envelope_id = $2
                `, [event === 'envelope-completed' ? 'completed' : 'signed', envelopeId]);
            }
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Test endpoint for DocuSign configuration
router.get('/test-config', async (req, res) => {
    try {
        let privateKeyStatus = 'Missing';
        let privateKeyLength = 0;
        
        // Check private key
        let privateKey = process.env.DOCUSIGN_RSA_PRIVATE_KEY;
        if (privateKey && !privateKey.includes('-----BEGIN')) {
            try {
                privateKey = await fs.readFile(privateKey, 'utf8');
                privateKeyStatus = 'File path (loaded)';
            } catch (error) {
                privateKeyStatus = 'File path (error reading)';
            }
        } else if (privateKey) {
            privateKeyStatus = 'Environment variable';
        } else if (process.env.DOCUSIGN_RSA_PRIVATE_KEY_PATH) {
            try {
                privateKey = await fs.readFile(process.env.DOCUSIGN_RSA_PRIVATE_KEY_PATH, 'utf8');
                privateKeyStatus = 'File path (loaded)';
            } catch (error) {
                privateKeyStatus = `File path (error reading: ${error.message})`;
            }
        }
        
        if (privateKey) {
            privateKeyLength = privateKey.length;
        }
        
        const config = {
            integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY ? 'Set' : 'Missing',
            userId: process.env.DOCUSIGN_USER_ID ? 'Set' : 'Missing',
            accountId: process.env.DOCUSIGN_ACCOUNT_ID ? 'Set' : 'Missing',
            basePath: process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi',
            privateKeyStatus,
            privateKeyLength,
            privateKeyFormat: privateKey ? {
                hasBeginHeader: privateKey.includes('-----BEGIN'),
                hasEndHeader: privateKey.includes('-----END'),
                hasLineBreaks: privateKey.includes('\n')
            } : null
        };
        
        const consentUrl = `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${process.env.DOCUSIGN_INTEGRATION_KEY}&redirect_uri=https://www.docusign.com`;
        
        res.json({
            success: true,
            config,
            message: 'DocuSign configuration check completed',
            troubleshooting: {
                consentUrl,
                steps: [
                    '1. FIRST: Visit the consent URL above to grant user consent (this is usually the issue)',
                    '2. Verify your RSA public key is uploaded to DocuSign Admin Console',
                    '3. Ensure JWT is enabled for your application in DocuSign Admin',
                    '4. Check that Integration Key matches your DocuSign app',
                    '5. Verify User ID is correct (found in DocuSign Admin under Users)'
                ],
                commonIssues: [
                    'User consent not granted - visit consent URL',
                    'RSA key pair mismatch - ensure public key uploaded to DocuSign matches private key',
                    'JWT not enabled in DocuSign application settings',
                    'Wrong environment - demo vs production'
                ]
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test JWT authentication without creating envelope
router.get('/test-auth', async (req, res) => {
    try {
        const { apiClient } = await getDocuSignClient();
        
        // If we get here, authentication worked
        res.json({
            success: true,
            message: 'DocuSign JWT authentication successful!',
            accessToken: 'Valid (hidden for security)'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.body || 'No additional details'
        });
    }
});

// Get user's DocuSign configuration status
router.get('/config', requireAuth, async (req, res) => {
    try {
        const userConfigResult = await db.query(
            'SELECT id, integration_key, user_guid, account_id, base_path, is_active, created_at FROM user_docusign_configs WHERE (user_id = $1 OR user_id IS NULL)',
            [req.user.id]
        );
        
        const usageCheck = await checkPlatformUsageLimits(req.user.id);
        
        res.json({
            success: true,
            hasUserConfig: userConfigResult.rows.length > 0,
            userConfig: userConfigResult.rows[0] || null,
            platformUsage: usageCheck
        });
    } catch (error) {
        console.error('Get DocuSign config error:', error);
        res.status(500).json({ error: 'Failed to get DocuSign configuration' });
    }
});

// Save user's DocuSign configuration
router.post('/config', requireAuth, async (req, res) => {
    try {
        const { integrationKey, userGuid, accountId, basePath, rsaPrivateKey } = req.body;
        
        // Validate required fields
        if (!integrationKey || !userGuid || !accountId || !rsaPrivateKey) {
            return res.status(400).json({ error: 'All DocuSign configuration fields are required' });
        }
        
        // Validate private key format
        if (!rsaPrivateKey.includes('-----BEGIN') || !rsaPrivateKey.includes('-----END')) {
            return res.status(400).json({ error: 'Invalid RSA private key format' });
        }
        
        // Test the configuration before saving
        try {
            const testApiClient = new docusign.ApiClient();
            testApiClient.setBasePath(basePath || 'https://demo.docusign.net/restapi');
            
            await testApiClient.requestJWTUserToken(
                integrationKey,
                userGuid,
                ['signature', 'impersonation'],
                rsaPrivateKey.trim(),
                3600
            );
        } catch (testError) {
            return res.status(400).json({ 
                error: 'DocuSign configuration test failed',
                details: testError.message 
            });
        }
        
        // Save or update configuration
        await db.query(`
            INSERT INTO user_docusign_configs 
            (user_id, integration_key, user_guid, account_id, base_path, rsa_private_key, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, true)
            ON CONFLICT (user_id)
            DO UPDATE SET 
                integration_key = $2,
                user_guid = $3,
                account_id = $4,
                base_path = $5,
                rsa_private_key = $6,
                is_active = true,
                updated_at = CURRENT_TIMESTAMP
        `, [req.user.id, integrationKey, userGuid, accountId, basePath || 'https://demo.docusign.net/restapi', rsaPrivateKey]);
        
        res.json({
            success: true,
            message: 'DocuSign configuration saved successfully'
        });
        
    } catch (error) {
        console.error('Save DocuSign config error:', error);
        res.status(500).json({ error: 'Failed to save DocuSign configuration' });
    }
});

// Delete user's DocuSign configuration
router.delete('/config', requireAuth, async (req, res) => {
    try {
        await db.query(
            'UPDATE user_docusign_configs SET is_active = false WHERE (user_id = $1 OR user_id IS NULL)',
            [req.user.id]
        );
        
        res.json({
            success: true,
            message: 'DocuSign configuration removed successfully'
        });
        
    } catch (error) {
        console.error('Delete DocuSign config error:', error);
        res.status(500).json({ error: 'Failed to remove DocuSign configuration' });
    }
});

// Get platform usage statistics
router.get('/usage', requireAuth, async (req, res) => {
    try {
        const usageCheck = await checkPlatformUsageLimits(req.user.id);
        
        res.json({
            success: true,
            usage: usageCheck
        });
        
    } catch (error) {
        console.error('Get usage error:', error);
        res.status(500).json({ error: 'Failed to get usage statistics' });
    }
});

// Test endpoint to check if API routes are working (no auth required)
router.get('/test', async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'E-signature API is working',
            timestamp: new Date().toISOString(),
            endpoints: {
                config: '/api/esignature/config (requires auth)',
                usage: '/api/esignature/usage (requires auth)',
                testConfig: '/api/esignature/test-config (no auth)',
                testAuth: '/api/esignature/test-auth (no auth)'
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'API test failed' });
    }
});

// Simplified e-signature test (mock implementation)
router.post('/send-mock', async (req, res) => {
    try {
        const { documentId, signers } = req.body;
        
        // Mock implementation for testing without DocuSign
        const mockEnvelopeId = `mock_${Date.now()}`;
        
        // Save mock e-signature request
        const esignResult = await db.query(`
            INSERT INTO esignature_requests 
            (document_id, user_id, provider, provider_envelope_id, status, signers, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [
            documentId,
            req.user?.id || 'anonymous',
            'mock',
            mockEnvelopeId,
            'sent',
            JSON.stringify(signers),
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        ]);
        
        res.json({
            success: true,
            esignatureId: esignResult.rows[0].id,
            providerEnvelopeId: mockEnvelopeId,
            message: 'Mock e-signature request created successfully (DocuSign integration disabled)',
            note: 'This is a test implementation. Configure DocuSign properly for real e-signatures.'
        });
        
    } catch (error) {
        console.error('Mock e-signature error:', error);
        res.status(500).json({ error: 'Failed to create mock e-signature request' });
    }
});

module.exports = router;
