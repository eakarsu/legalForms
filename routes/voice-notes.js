/**
 * Voice-to-Text Routes
 * Transcribes voice recordings and creates case notes
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// File upload for audio
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/voice');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.mp3', '.wav', '.m4a', '.webm', '.ogg'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid audio file type'));
        }
    }
});

// =====================================================
// PAGE ROUTES
// =====================================================

// Voice Notes Dashboard
router.get('/voice-notes', requireAuth, async (req, res) => {
    try {
        const transcriptionsResult = await db.query(`
            SELECT vt.*, c.first_name, c.last_name, cs.title as case_title
            FROM voice_transcriptions vt
            LEFT JOIN clients c ON vt.client_id = c.id
            LEFT JOIN cases cs ON vt.case_id = cs.id
            WHERE vt.user_id = $1
            ORDER BY vt.created_at DESC
            LIMIT 20
        `, [req.user.id]);

        const statsResult = await db.query(`
            SELECT
                COUNT(*) as total_transcriptions,
                COALESCE(SUM(audio_duration_seconds), 0) as total_duration,
                COUNT(CASE WHEN case_note_id IS NOT NULL THEN 1 END) as notes_created
            FROM voice_transcriptions
            WHERE user_id = $1
        `, [req.user.id]);

        res.render('voice/dashboard', {
            title: 'Voice Notes',
            transcriptions: transcriptionsResult.rows,
            stats: statsResult.rows[0],
            req
        });
    } catch (error) {
        console.error('Voice notes dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading voice notes' });
    }
});

// =====================================================
// API ROUTES
// =====================================================

// Save transcription (from browser Web Speech API)
router.post('/api/voice-notes/transcribe', requireAuth, async (req, res) => {
    try {
        const { case_id, client_id, raw_transcription, audio_duration_seconds } = req.body;

        if (!raw_transcription || raw_transcription.trim().length < 10) {
            return res.status(400).json({ error: 'Transcription too short' });
        }

        // Create transcription record
        const result = await db.query(`
            INSERT INTO voice_transcriptions
            (user_id, case_id, client_id, raw_transcription, audio_duration_seconds, transcription_source, status)
            VALUES ($1, $2, $3, $4, $5, 'browser', 'completed')
            RETURNING *
        `, [
            req.user.id,
            case_id || null,
            client_id || null,
            raw_transcription,
            audio_duration_seconds || 0
        ]);

        res.json({
            success: true,
            transcriptionId: result.rows[0].id,
            transcription: result.rows[0]
        });

    } catch (error) {
        console.error('Save transcription error:', error);
        res.status(500).json({ error: 'Failed to save transcription' });
    }
});

// AI cleanup of transcription
router.post('/api/voice-notes/cleanup', requireAuth, async (req, res) => {
    try {
        const { transcription_id, raw_text } = req.body;

        let transcription;
        if (transcription_id) {
            const result = await db.query(
                'SELECT * FROM voice_transcriptions WHERE id = $1 AND user_id = $2',
                [transcription_id, req.user.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Transcription not found' });
            }
            transcription = result.rows[0];
        }

        const textToClean = raw_text || transcription?.raw_transcription;
        if (!textToClean) {
            return res.status(400).json({ error: 'No text to clean' });
        }

        const startTime = Date.now();

        const systemPrompt = `You are a legal transcription editor. Clean up voice transcriptions for case notes.`;

        const userPrompt = `Clean up this voice transcription:

${textToClean}

Tasks:
1. Fix grammar and punctuation
2. Remove filler words (um, uh, like, you know)
3. Format as professional case notes
4. Preserve all factual content exactly

Respond in JSON:
{
  "cleaned_text": "The cleaned transcription",
  "extracted_entities": {
    "dates": [{"original": "string", "normalized": "YYYY-MM-DD"}],
    "names": [{"name": "string", "type": "person|company|court"}],
    "amounts": [{"original": "string", "normalized": 0.00}]
  },
  "suggested_tags": ["relevant tags"],
  "summary": "2-3 sentence summary"
}`;

        const response = await axios.post(OPENROUTER_API_URL, {
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 2000,
            temperature: 0.2
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3000',
                'X-Title': 'LegalForms Voice Notes',
                'Content-Type': 'application/json'
            }
        });

        const processingTime = Date.now() - startTime;
        const content = response.data.choices[0].message.content;
        const usage = response.data.usage || {};

        let cleanupData;
        try {
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
            cleanupData = JSON.parse(jsonStr);
        } catch (e) {
            cleanupData = {
                cleaned_text: content,
                extracted_entities: {},
                suggested_tags: [],
                summary: ''
            };
        }

        // Update transcription if ID provided
        if (transcription_id) {
            await db.query(`
                UPDATE voice_transcriptions
                SET cleaned_transcription = $1, extracted_entities = $2, auto_tags = $3, summary = $4,
                    model_used = $5, tokens_used = $6, processing_time_ms = $7
                WHERE id = $8
            `, [
                cleanupData.cleaned_text,
                JSON.stringify(cleanupData.extracted_entities || {}),
                JSON.stringify(cleanupData.suggested_tags || []),
                cleanupData.summary,
                response.data.model,
                usage.total_tokens || 0,
                processingTime,
                transcription_id
            ]);
        }

        // Log usage
        await db.query(`
            INSERT INTO ai_usage_log
            (user_id, feature, model, input_tokens, output_tokens, total_tokens, response_time_ms, success)
            VALUES ($1, 'voice_cleanup', $2, $3, $4, $5, $6, true)
        `, [
            req.user.id,
            response.data.model,
            usage.prompt_tokens || 0,
            usage.completion_tokens || 0,
            usage.total_tokens || 0,
            processingTime
        ]);

        res.json({
            success: true,
            cleanedText: cleanupData.cleaned_text,
            entities: cleanupData.extracted_entities,
            tags: cleanupData.suggested_tags,
            summary: cleanupData.summary
        });

    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ error: 'Failed to cleanup transcription: ' + error.message });
    }
});

// Create case note from transcription
router.post('/api/voice-notes/:id/create-note', requireAuth, async (req, res) => {
    try {
        const transcriptionResult = await db.query(
            'SELECT * FROM voice_transcriptions WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (transcriptionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Transcription not found' });
        }

        const transcription = transcriptionResult.rows[0];

        if (!transcription.case_id) {
            return res.status(400).json({ error: 'No case associated. Please link a case first.' });
        }

        const content = transcription.cleaned_transcription || transcription.raw_transcription;
        const summary = transcription.summary || '';

        let noteContent = `## Voice Note Transcription\n\n`;
        if (summary) {
            noteContent += `### Summary\n${summary}\n\n`;
        }
        noteContent += `### Full Transcription\n${content}\n\n`;
        noteContent += `---\n*Transcribed on ${new Date(transcription.created_at).toLocaleString()}*`;

        const noteResult = await db.query(`
            INSERT INTO case_notes (case_id, user_id, title, content, note_type, created_at)
            VALUES ($1, $2, $3, $4, 'voice_note', CURRENT_TIMESTAMP)
            RETURNING *
        `, [
            transcription.case_id,
            req.user.id,
            `Voice Note - ${new Date().toLocaleDateString()}`,
            noteContent
        ]);

        await db.query(
            'UPDATE voice_transcriptions SET case_note_id = $1 WHERE id = $2',
            [noteResult.rows[0].id, req.params.id]
        );

        res.json({
            success: true,
            noteId: noteResult.rows[0].id,
            message: 'Case note created'
        });

    } catch (error) {
        console.error('Create note error:', error);
        res.status(500).json({ error: 'Failed to create case note' });
    }
});

// Get transcription
router.get('/api/voice-notes/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM voice_transcriptions WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transcription not found' });
        }

        res.json({ success: true, transcription: result.rows[0] });
    } catch (error) {
        console.error('Get transcription error:', error);
        res.status(500).json({ error: 'Failed to get transcription' });
    }
});

// Delete transcription
router.delete('/api/voice-notes/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM voice_transcriptions WHERE id = $1 AND user_id = $2 RETURNING *',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transcription not found' });
        }

        res.json({ success: true, message: 'Transcription deleted' });
    } catch (error) {
        console.error('Delete transcription error:', error);
        res.status(500).json({ error: 'Failed to delete transcription' });
    }
});

module.exports = router;
