const express = require('express');
const docusign = require('docusign-esign');
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// DocuSign configuration
const getDocuSignClient = () => {
    const apiClient = new docusign.ApiClient();
    apiClient.setBasePath(process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi');
    
    // Configure OAuth
    apiClient.configureJWTAuthorizationFlow(
        process.env.DOCUSIGN_INTEGRATION_KEY,
        process.env.DOCUSIGN_USER_ID,
        process.env.DOCUSIGN_RSA_PRIVATE_KEY,
        3600 // 1 hour
    );
    
    return apiClient;
};

// Create envelope for signing
async function createDocuSignEnvelope(documentPath, signers, documentName) {
    try {
        const apiClient = getDocuSignClient();
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
        const documentPath = path.join(__dirname, '../uploads', document.file_path || `${document.title}.pdf`);
        
        let providerEnvelopeId;
        
        switch (provider) {
            case 'docusign':
                providerEnvelopeId = await createDocuSignEnvelope(
                    documentPath,
                    signers,
                    document.title
                );
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
                const apiClient = getDocuSignClient();
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

module.exports = router;
