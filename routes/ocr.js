/**
 * Document OCR Routes
 * Handles OCR processing, text extraction, and entity recognition
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Tesseract = require('tesseract.js');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/ocr');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
        } catch (e) {}
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.gif', '.bmp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: PDF, PNG, JPG, TIFF, GIF, BMP'));
        }
    }
});

// =====================================================
// PAGE ROUTES
// =====================================================

// OCR dashboard
router.get('/ocr', requireAuth, async (req, res) => {
    try {
        // Get recent OCR jobs
        const jobsResult = await db.query(`
            SELECT oj.*, dh.title as document_title
            FROM ocr_jobs oj
            LEFT JOIN document_history dh ON oj.document_id = dh.id
            WHERE (oj.user_id = $1 OR oj.user_id IS NULL)
            ORDER BY oj.created_at DESC
            LIMIT 20
        `, [req.user.id]);

        // Stats
        const statsResult = await db.query(`
            SELECT
                COUNT(*) as total_jobs,
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COUNT(*) FILTER (WHERE status = 'processing') as processing,
                COALESCE(SUM(page_count), 0) as total_pages
            FROM ocr_jobs
            WHERE (user_id = $1 OR user_id IS NULL)
        `, [req.user.id]);

        res.render('ocr/dashboard', {
            title: 'Document OCR',
            jobs: jobsResult.rows,
            stats: statsResult.rows[0],
            req
        });
    } catch (error) {
        console.error('OCR dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading OCR dashboard' });
    }
});

// OCR job detail
router.get('/ocr/:id', requireAuth, async (req, res) => {
    try {
        const jobResult = await db.query(`
            SELECT * FROM ocr_jobs WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (jobResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'OCR job not found' });
        }

        // Get pages
        const pagesResult = await db.query(`
            SELECT * FROM ocr_pages WHERE job_id = $1 ORDER BY page_number
        `, [req.params.id]);

        // Get entities
        const entitiesResult = await db.query(`
            SELECT * FROM ocr_entities WHERE job_id = $1 ORDER BY entity_type, value
        `, [req.params.id]);

        // Get clients for linking
        const clientsResult = await db.query(`
            SELECT id, first_name, last_name, company_name
            FROM clients
            WHERE (user_id = $1 OR user_id IS NULL) AND status = 'active'
            ORDER BY first_name, last_name
        `, [req.user.id]);

        // Get cases for linking
        const casesResult = await db.query(`
            SELECT id, title, case_number
            FROM cases
            WHERE (user_id = $1 OR user_id IS NULL) AND status != 'closed'
            ORDER BY title
        `, [req.user.id]);

        res.render('ocr/detail', {
            title: 'OCR Results',
            job: jobResult.rows[0],
            pages: pagesResult.rows,
            entities: entitiesResult.rows,
            clients: clientsResult.rows,
            cases: casesResult.rows,
            req
        });
    } catch (error) {
        console.error('OCR detail error:', error);
        res.status(500).render('error', { message: 'Error loading OCR results' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// Upload and start OCR
router.post('/api/ocr/process', requireAuth, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('Multer upload error:', err);
            return res.status(400).json({ error: 'File upload error: ' + err.message });
        }
        next();
    });
}, async (req, res) => {
    try {
        console.log('OCR process request received');
        console.log('File:', req.file);
        console.log('Body:', req.body);

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { document_id, language } = req.body;

        // Create OCR job
        const jobResult = await db.query(`
            INSERT INTO ocr_jobs
            (user_id, document_id, original_file_path, file_name, file_type, file_size, status, language)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
            RETURNING *
        `, [
            req.user.id,
            document_id || null,
            req.file.path,
            req.file.originalname,
            path.extname(req.file.originalname).substring(1).toLowerCase(),
            req.file.size,
            language || 'eng'
        ]);

        const jobId = jobResult.rows[0].id;

        // Start processing asynchronously
        processOCRJob(jobId, req.file.path).catch(err => {
            console.error('OCR processing error:', err);
        });

        res.json({
            success: true,
            job: jobResult.rows[0],
            message: 'OCR processing started'
        });
    } catch (error) {
        console.error('OCR upload error:', error);
        res.status(500).json({ error: 'Failed to start OCR processing' });
    }
});

// Get OCR job status
router.get('/api/ocr/:id/status', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, status, progress, page_count, pages_processed, error_message
            FROM ocr_jobs
            WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json({ success: true, job: result.rows[0] });
    } catch (error) {
        console.error('Get OCR status error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// Get OCR text
router.get('/api/ocr/:id/text', requireAuth, async (req, res) => {
    try {
        // Get full text from search index
        const result = await db.query(`
            SELECT full_text FROM ocr_search_index
            WHERE job_id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            // Fallback to concatenating pages
            const pagesResult = await db.query(`
                SELECT raw_text FROM ocr_pages WHERE job_id = $1 ORDER BY page_number
            `, [req.params.id]);

            const fullText = pagesResult.rows.map(p => p.raw_text).join('\n\n--- Page Break ---\n\n');
            return res.json({ success: true, text: fullText });
        }

        res.json({ success: true, text: result.rows[0].full_text });
    } catch (error) {
        console.error('Get OCR text error:', error);
        res.status(500).json({ error: 'Failed to get text' });
    }
});

// Search OCR content
router.get('/api/ocr/search', requireAuth, async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;

        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'Search query too short' });
        }

        const result = await db.query(`
            SELECT osi.*, oj.file_name, oj.status,
                   ts_headline('english', osi.full_text, plainto_tsquery('english', $1),
                              'StartSel=<mark>, StopSel=</mark>, MaxFragments=3') as snippet
            FROM ocr_search_index osi
            JOIN ocr_jobs oj ON osi.job_id = oj.id
            WHERE (oj.user_id = $2 OR oj.user_id IS NULL) AND osi.search_vector @@ plainto_tsquery('english', $1)
            ORDER BY ts_rank(osi.search_vector, plainto_tsquery('english', $1)) DESC
            LIMIT $3
        `, [q, req.user.id, limit]);

        res.json({ success: true, results: result.rows });
    } catch (error) {
        console.error('OCR search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Get entities from OCR job
router.get('/api/ocr/:id/entities', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM ocr_entities
            WHERE job_id = $1
            ORDER BY entity_type, confidence DESC
        `, [req.params.id]);

        // Group by type
        const grouped = {};
        result.rows.forEach(entity => {
            if (!grouped[entity.entity_type]) {
                grouped[entity.entity_type] = [];
            }
            grouped[entity.entity_type].push(entity);
        });

        res.json({ success: true, entities: grouped });
    } catch (error) {
        console.error('Get entities error:', error);
        res.status(500).json({ error: 'Failed to get entities' });
    }
});

// Delete OCR job
router.delete('/api/ocr/:id', requireAuth, async (req, res) => {
    try {
        // Get file path
        const jobResult = await db.query(
            'SELECT original_file_path FROM ocr_jobs WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
            [req.params.id, req.user.id]
        );

        if (jobResult.rows.length > 0) {
            // Delete file
            try {
                await fs.unlink(jobResult.rows[0].original_file_path);
            } catch (e) {}

            // Delete from database (cascade will handle related records)
            await db.query('DELETE FROM ocr_search_index WHERE job_id = $1', [req.params.id]);
            await db.query('DELETE FROM ocr_entities WHERE job_id = $1', [req.params.id]);
            await db.query('DELETE FROM ocr_pages WHERE job_id = $1', [req.params.id]);
            await db.query('DELETE FROM ocr_jobs WHERE id = $1', [req.params.id]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete OCR job error:', error);
        res.status(500).json({ error: 'Failed to delete job' });
    }
});

// Save OCR result as document (used by detail.ejs)
router.post('/api/ocr/:id/save-document', requireAuth, async (req, res) => {
    try {
        // Get job info
        const jobResult = await db.query(`
            SELECT * FROM ocr_jobs
            WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
        `, [req.params.id, req.user.id]);

        if (jobResult.rows.length === 0) {
            return res.status(404).json({ error: 'OCR job not found' });
        }

        const job = jobResult.rows[0];

        // Get all page text combined
        const pagesResult = await db.query(`
            SELECT raw_text FROM ocr_pages
            WHERE job_id = $1
            ORDER BY page_number
        `, [req.params.id]);

        const fullText = pagesResult.rows.map(p => p.raw_text || '').join('\n\n--- Page Break ---\n\n');

        // Create document from OCR text
        const docResult = await db.query(`
            INSERT INTO document_history (user_id, document_type, title, content, file_format)
            VALUES ($1, 'extracted_text', $2, $3, 'txt')
            RETURNING id
        `, [
            req.user.id,
            (job.original_file_name || 'OCR Document') + ' - Extracted Text',
            fullText || 'No text extracted'
        ]);

        res.json({ success: true, document_id: docResult.rows[0].id });
    } catch (error) {
        console.error('Save OCR as document error:', error);
        res.status(500).json({ error: 'Failed to save as document' });
    }
});


// =====================================================
// OCR PROCESSING FUNCTIONS
// =====================================================

async function processOCRJob(jobId, filePath) {
    try {
        // Update status to processing
        await db.query(`
            UPDATE ocr_jobs SET status = 'processing', processing_started_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [jobId]);

        // Get job details
        const jobResult = await db.query('SELECT * FROM ocr_jobs WHERE id = $1', [jobId]);
        const job = jobResult.rows[0];

        let fullText = '';
        let pageCount = 1; // Default for images

        // Process with Tesseract
        const result = await Tesseract.recognize(filePath, job.language || 'eng', {
            logger: async (m) => {
                if (m.status === 'recognizing text') {
                    const progress = Math.round(m.progress * 100);
                    await db.query(
                        'UPDATE ocr_jobs SET progress = $1 WHERE id = $2',
                        [progress, jobId]
                    );
                }
            }
        });

        fullText = result.data.text;
        const confidence = result.data.confidence;
        const words = result.data.words || [];

        // Save page result
        const pageResult = await db.query(`
            INSERT INTO ocr_pages (job_id, page_number, raw_text, confidence_score, word_count)
            VALUES ($1, 1, $2, $3, $4)
            RETURNING id
        `, [jobId, fullText, confidence, words.length]);

        const pageId = pageResult.rows[0].id;

        // Extract entities
        const entities = extractEntities(fullText);
        for (const entity of entities) {
            await db.query(`
                INSERT INTO ocr_entities (job_id, page_id, entity_type, value, normalized_value, confidence)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [jobId, pageId, entity.type, entity.value, entity.normalized, entity.confidence]);
        }

        // Create search index
        await db.query(`
            INSERT INTO ocr_search_index (job_id, document_id, full_text)
            VALUES ($1, $2, $3)
        `, [jobId, job.document_id, fullText]);

        // Update job as completed
        await db.query(`
            UPDATE ocr_jobs SET
                status = 'completed',
                progress = 100,
                page_count = $1,
                pages_processed = $1,
                processing_completed_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [pageCount, jobId]);

    } catch (error) {
        console.error('OCR processing error:', error);
        await db.query(`
            UPDATE ocr_jobs SET status = 'failed', error_message = $1, processing_completed_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [error.message, jobId]);
    }
}

function extractEntities(text) {
    const entities = [];

    // Email pattern
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    let match;
    while ((match = emailRegex.exec(text)) !== null) {
        entities.push({
            type: 'email',
            value: match[0],
            normalized: match[0].toLowerCase(),
            confidence: 95
        });
    }

    // Phone pattern
    const phoneRegex = /(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
    while ((match = phoneRegex.exec(text)) !== null) {
        const normalized = match[0].replace(/[^\d+]/g, '');
        entities.push({
            type: 'phone',
            value: match[0],
            normalized: normalized,
            confidence: 85
        });
    }

    // Money pattern
    const moneyRegex = /\$[\d,]+\.?\d*/g;
    while ((match = moneyRegex.exec(text)) !== null) {
        const normalized = match[0].replace(/[,$]/g, '');
        entities.push({
            type: 'money',
            value: match[0],
            normalized: normalized,
            confidence: 90
        });
    }

    // Date patterns
    const dateRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi;
    while ((match = dateRegex.exec(text)) !== null) {
        try {
            const date = new Date(match[0]);
            entities.push({
                type: 'date',
                value: match[0],
                normalized: date.toISOString().split('T')[0],
                confidence: 80
            });
        } catch (e) {}
    }

    return entities;
}

module.exports = router;
