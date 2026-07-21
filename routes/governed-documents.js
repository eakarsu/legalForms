'use strict';

const express = require('express');
const { GovernedDocumentWorkflow } = require('../lib/governedDocumentWorkflow');

function asyncRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function idempotencyKey(req) {
    return req.get('idempotency-key');
}

function sendMutation(res, result) {
    res.set('Idempotency-Replayed', result.replayed ? 'true' : 'false');
    return res.status(result.status).json(result.body);
}

function createGovernedDocumentsRouter({ pool, authenticate, allowedSourceHosts, minRetentionDays, providerClient }) {
    const router = express.Router();
    const workflow = new GovernedDocumentWorkflow(pool, { allowedSourceHosts, minRetentionDays, providerClient });

    router.use(authenticate);

    router.post('/matters/:matterId/access', asyncRoute(async (req, res) => {
        const result = await workflow.grantAccess(req.user.id, req.params.matterId, req.body, idempotencyKey(req));
        return sendMutation(res, result);
    }));

    router.post('/matters/:matterId/access/:grantId/revoke', asyncRoute(async (req, res) => {
        const result = await workflow.revokeAccess(
            req.user.id,
            req.params.matterId,
            req.params.grantId,
            req.body,
            idempotencyKey(req)
        );
        return sendMutation(res, result);
    }));

    router.get('/matters/:matterId/audit', asyncRoute(async (req, res) => {
        const audit = await workflow.verifyMatterAudit(req.user.id, req.params.matterId);
        return res.json({ audit });
    }));

    router.post('/documents', asyncRoute(async (req, res) => {
        const result = await workflow.createDocument(req.user.id, req.body, idempotencyKey(req));
        return sendMutation(res, result);
    }));

    router.get('/documents/:documentId', asyncRoute(async (req, res) => {
        const state = await workflow.getDocument(req.user.id, req.params.documentId);
        return res.json(state);
    }));

    router.post('/documents/:documentId/versions', asyncRoute(async (req, res) => {
        const result = await workflow.addVersion(
            req.user.id,
            req.params.documentId,
            req.body,
            idempotencyKey(req)
        );
        return sendMutation(res, result);
    }));

    router.post('/documents/:documentId/submit-review', asyncRoute(async (req, res) => {
        const result = await workflow.submitForReview(
            req.user.id,
            req.params.documentId,
            req.body,
            idempotencyKey(req)
        );
        return sendMutation(res, result);
    }));

    router.post('/documents/:documentId/reviews', asyncRoute(async (req, res) => {
        const result = await workflow.reviewDocument(
            req.user.id,
            req.params.documentId,
            req.body,
            idempotencyKey(req)
        );
        return sendMutation(res, result);
    }));

    router.post('/documents/:documentId/legal-hold', asyncRoute(async (req, res) => {
        const result = await workflow.setLegalHold(
            req.user.id,
            req.params.documentId,
            req.body,
            idempotencyKey(req)
        );
        return sendMutation(res, result);
    }));

    router.post('/documents/:documentId/provider-operations', asyncRoute(async (req, res) => {
        const result = await workflow.performProviderOperation(
            req.user.id,
            req.params.documentId,
            req.body,
            idempotencyKey(req)
        );
        return sendMutation(res, result);
    }));

    router.post('/documents/:documentId/evidence-export', asyncRoute(async (req, res) => {
        const result = await workflow.exportEvidence(
            req.user.id,
            req.params.documentId,
            req.body,
            idempotencyKey(req)
        );
        res.set('Content-Disposition', `attachment; filename="governed-document-${req.params.documentId}-evidence.json"`);
        return sendMutation(res, result);
    }));

    router.post('/documents/:documentId/disposition', asyncRoute(async (req, res) => {
        const result = await workflow.recordDisposition(
            req.user.id,
            req.params.documentId,
            req.body,
            idempotencyKey(req)
        );
        return sendMutation(res, result);
    }));

    return router;
}

module.exports = { createGovernedDocumentsRouter };
