const express = require('express');
const docusign = require('docusign-esign');
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// DocuSign configuration
const getDocuSignClient = async () => {
    const apiClient = new docusign.ApiClient();
    apiClient.setBasePath(process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi');
    
    // Use the new JWT authentication method
    try {
        const jwtLifeSec = 3600; // 1 hour
        const scopes = ['signature', 'impersonation'];
        
        // Validate required environment variables
        if (!process.env.DOCUSIGN_INTEGRATION_KEY) {
            throw new Error('DOCUSIGN_INTEGRATION_KEY is not configured');
        }
        if (!process.env.DOCUSIGN_USER_ID) {
            throw new Error('DOCUSIGN_USER_ID is not configured');
        }
        if (!process.env.DOCUSIGN_ACCOUNT_ID) {
            throw new Error('DOCUSIGN_ACCOUNT_ID is not configured');
        }
        
        // Get private key from environment or file
        let privateKey = process.env.DOCUSIGN_RSA_PRIVATE_KEY;
        
        // Check if DOCUSIGN_RSA_PRIVATE_KEY contains a file path
        if (privateKey && !privateKey.includes('-----BEGIN')) {
            // It's a file path, read the file
            try {
                privateKey = await fs.readFile(privateKey, 'utf8');
            } catch (error) {
                console.error('Error reading private key file from DOCUSIGN_RSA_PRIVATE_KEY:', error);
                privateKey = null;
            }
        }
        
        // If no private key yet, try DOCUSIGN_RSA_PRIVATE_KEY_PATH
        if (!privateKey && process.env.DOCUSIGN_RSA_PRIVATE_KEY_PATH) {
            try {
                privateKey = await fs.readFile(process.env.DOCUSIGN_RSA_PRIVATE_KEY_PATH, 'utf8');
            } catch (error) {
                console.error('Error reading private key file from DOCUSIGN_RSA_PRIVATE_KEY_PATH:', error);
                throw new Error('Could not read DocuSign private key file');
            }
        }
        
        if (!privateKey) {
            throw new Error('DocuSign RSA private key not configured. Set DOCUSIGN_RSA_PRIVATE_KEY or DOCUSIGN_RSA_PRIVATE_KEY_PATH');
        }

        // Ensure the private key is in proper format
        privateKey = privateKey.trim();
        
        // If the key doesn't have proper headers, it might be base64 encoded or malformed
        if (!privateKey.includes('-----BEGIN') || !privateKey.includes('-----END')) {
            throw new Error('Invalid RSA private key format. Key must include BEGIN/END headers.');
        }
        
        console.log('DocuSign Configuration Check:', {
            integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY?.substring(0, 8) + '...',
            userId: process.env.DOCUSIGN_USER_ID?.substring(0, 8) + '...',
            accountId: process.env.DOCUSIGN_ACCOUNT_ID?.substring(0, 8) + '...',
            basePath: process.env.DOCUSIGN_BASE_PATH,
            privateKeyLength: privateKey.length,
            privateKeyFormat: {
                hasBeginHeader: privateKey.includes('-----BEGIN'),
                hasEndHeader: privateKey.includes('-----END'),
                hasLineBreaks: privateKey.includes('\n')
            }
        });
        
        const results = await apiClient.requestJWTUserToken(
            process.env.DOCUSIGN_INTEGRATION_KEY,
            process.env.DOCUSIGN_USER_ID,
            scopes,
            privateKey,
            jwtLifeSec
        );
        
        apiClient.setAccessToken(results.body.access_token);
        return apiClient;
    } catch (error) {
        console.error('DocuSign JWT authentication failed:', error);
        
        // Provide more specific error messages
        if (error.message?.includes('no_valid_keys_or_signatures')) {
            throw new Error('DocuSign authentication failed: Invalid RSA private key or application not properly configured. Please check:\n1. RSA private key is correct\n2. Application has JWT enabled\n3. User consent has been granted\n4. Integration key matches the application');
        } else if (error.message?.includes('invalid_grant')) {
            throw new Error('DocuSign authentication failed: Invalid grant. Please check your Integration Key and User ID.');
        } else {
            throw new Error(`DocuSign authentication failed: ${error.message}`);
        }
    }
};

// Create envelope for signing
async function createDocuSignEnvelope(documentPath, signers, documentName) {
    try {
        const apiClient = await getDocuSignClient();
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
            process.env.DOCUSIGN_ACCOUNT_ID,
            { envelopeDefinition }
        );
        
        return result.envelopeId;
        
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
            'SELECT * FROM document_history WHERE id = $1 AND user_id = $2',
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
                    providerEnvelopeId = await createDocuSignEnvelope(
                        documentPath,
                        signers,
                        document.title
                    );
                } catch (docusignError) {
                    console.error('DocuSign error, falling back to mock:', docusignError.message);
                    
                    // Fallback to mock implementation
                    providerEnvelopeId = `mock_fallback_${Date.now()}`;
                    provider = 'mock';
                    
                    return res.json({
                        success: true,
                        esignatureId: 'mock-id',
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
        
        // Save e-signature request
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
            WHERE es.id = $1 AND es.user_id = $2
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
            WHERE es.user_id = $1
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
        const config = {
            integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY ? 'Set' : 'Missing',
            userId: process.env.DOCUSIGN_USER_ID ? 'Set' : 'Missing',
            accountId: process.env.DOCUSIGN_ACCOUNT_ID ? 'Set' : 'Missing',
            basePath: process.env.DOCUSIGN_BASE_PATH || 'Not set',
            privateKeySource: process.env.DOCUSIGN_RSA_PRIVATE_KEY ? 'Environment variable' : 
                             process.env.DOCUSIGN_RSA_PRIVATE_KEY_PATH ? 'File path' : 'Missing'
        };
        
        res.json({
            success: true,
            config,
            message: 'DocuSign configuration check completed',
            troubleshooting: {
                consentUrl: `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${process.env.DOCUSIGN_INTEGRATION_KEY}&redirect_uri=https://www.docusign.com`,
                steps: [
                    '1. Visit the consent URL above to grant user consent',
                    '2. Verify your RSA public key is uploaded to DocuSign',
                    '3. Ensure JWT is enabled for your application',
                    '4. Check that Integration Key matches your DocuSign app'
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
        const apiClient = await getDocuSignClient();
        
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
