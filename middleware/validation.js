'use strict';

/**
 * Input validation middleware using express-validator.
 *
 * Provides reusable validation chains for the main form creation
 * and AI analysis endpoints, plus a standard error-response helper.
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Standard middleware that reads validationResult and returns 422 on errors.
 * Place after validator chains in a route definition.
 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            error: 'Validation failed',
            details: errors.array().map(e => ({
                field: e.path,
                message: e.msg,
                value: e.value
            }))
        });
    }
    next();
}

// =============================================
// AI DRAFTING — POST /api/ai-drafting/generate
// =============================================
const validateAiDraftGenerate = [
    body('title')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Title must be 500 characters or fewer'),

    body('custom_prompt')
        .optional()
        .trim()
        .isLength({ max: 20000 })
        .withMessage('Custom prompt must be 20,000 characters or fewer'),

    body('prompt')
        .optional()
        .trim()
        .isLength({ max: 20000 })
        .withMessage('Prompt must be 20,000 characters or fewer'),

    body('style')
        .optional()
        .trim()
        .isIn(['formal', 'plain', 'technical', 'persuasive', ''])
        .withMessage('Style must be one of: formal, plain, technical, persuasive'),

    body('length')
        .optional()
        .trim()
        .isIn(['short', 'medium', 'long', 'detailed', ''])
        .withMessage('Length must be one of: short, medium, long, detailed'),

    body('template_id')
        .optional({ nullable: true })
        .trim()
        .isUUID()
        .withMessage('template_id must be a valid UUID'),

    body('client_id')
        .optional({ nullable: true })
        .trim()
        .isUUID()
        .withMessage('client_id must be a valid UUID'),

    body('case_id')
        .optional({ nullable: true })
        .trim()
        .isUUID()
        .withMessage('case_id must be a valid UUID'),

    handleValidationErrors
];

// =============================================
// CONTRACT ANALYSIS — POST /api/contract-analysis/analyze
// =============================================
const validateContractAnalyze = [
    body('document_text')
        .notEmpty()
        .withMessage('document_text is required')
        .trim()
        .isLength({ min: 100, max: 500000 })
        .withMessage('document_text must be between 100 and 500,000 characters'),

    body('document_name')
        .optional()
        .trim()
        .isLength({ max: 300 })
        .withMessage('document_name must be 300 characters or fewer'),

    body('document_type')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('document_type must be 100 characters or fewer'),

    body('client_id')
        .optional({ nullable: true })
        .trim()
        .isUUID()
        .withMessage('client_id must be a valid UUID'),

    body('case_id')
        .optional({ nullable: true })
        .trim()
        .isUUID()
        .withMessage('case_id must be a valid UUID'),

    handleValidationErrors
];

// =============================================
// CITATION FINDER — POST /api/citation-finder/search
// =============================================
const validateCitationSearch = [
    body('legal_issue')
        .notEmpty()
        .withMessage('legal_issue is required')
        .trim()
        .isLength({ min: 10, max: 5000 })
        .withMessage('legal_issue must be between 10 and 5,000 characters'),

    body('jurisdiction')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('jurisdiction must be 100 characters or fewer'),

    body('practice_area')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('practice_area must be 100 characters or fewer'),

    body('search_type')
        .optional()
        .trim()
        .isIn(['general', 'case_law', 'statute', 'regulation', ''])
        .withMessage('search_type must be one of: general, case_law, statute, regulation'),

    body('case_id')
        .optional({ nullable: true })
        .trim()
        .isUUID()
        .withMessage('case_id must be a valid UUID'),

    handleValidationErrors
];

// =============================================
// CLIENT CREATION — POST /api/clients
// =============================================
const validateClientCreate = [
    body('first_name')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('first_name must be 100 characters or fewer'),

    body('last_name')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('last_name must be 100 characters or fewer'),

    body('company_name')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('company_name must be 200 characters or fewer'),

    body('email')
        .optional({ nullable: true })
        .trim()
        .normalizeEmail()
        .isEmail()
        .withMessage('email must be a valid email address'),

    body('phone')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('phone must be 50 characters or fewer'),

    body('client_type')
        .optional()
        .trim()
        .isIn(['individual', 'business'])
        .withMessage('client_type must be individual or business'),

    body('status')
        .optional()
        .trim()
        .isIn(['active', 'inactive', 'archived'])
        .withMessage('status must be active, inactive, or archived'),

    handleValidationErrors
];

// =============================================
// CASE CREATION — POST /api/cases
// =============================================
const validateCaseCreate = [
    body('title')
        .notEmpty()
        .withMessage('title is required')
        .trim()
        .isLength({ min: 1, max: 255 })
        .withMessage('title must be 255 characters or fewer'),

    body('client_id')
        .optional({ nullable: true })
        .trim()
        .isUUID()
        .withMessage('client_id must be a valid UUID'),

    body('case_type')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('case_type must be 100 characters or fewer'),

    body('billing_type')
        .optional()
        .trim()
        .isIn(['hourly', 'flat_fee', 'contingency', 'retainer', ''])
        .withMessage('billing_type must be one of: hourly, flat_fee, contingency, retainer'),

    body('hourly_rate')
        .optional({ nullable: true })
        .isFloat({ min: 0, max: 10000 })
        .withMessage('hourly_rate must be a positive number up to 10,000'),

    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    validateAiDraftGenerate,
    validateContractAnalyze,
    validateCitationSearch,
    validateClientCreate,
    validateCaseCreate
};
