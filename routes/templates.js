const express = require('express');
const db = require('../config/database');
const { optionalAuth } = require('../middleware/auth');
const router = express.Router();

// AI-powered template recommendation engine
class TemplateRecommendationEngine {
    constructor() {
        this.userProfiles = new Map();
        this.templateUsage = new Map();
    }

    async getUserProfile(userId) {
        if (!this.userProfiles.has(userId)) {
            const result = await db.query(
                'SELECT * FROM user_profiles WHERE user_id = $1',
                [userId]
            );
            
            if (result.rows.length > 0) {
                this.userProfiles.set(userId, result.rows[0]);
            } else {
                // Create default profile
                const defaultProfile = {
                    business_type: null,
                    industry: null,
                    state_jurisdiction: 'US',
                    experience_level: 'beginner',
                    preferred_templates: {},
                    usage_patterns: {}
                };
                this.userProfiles.set(userId, defaultProfile);
            }
        }
        
        return this.userProfiles.get(userId);
    }

    async getRecommendations(userId, formType) {
        const profile = await this.getUserProfile(userId);
        const recommendations = [];

        // Get user's document history for pattern analysis
        const historyResult = await db.query(`
            SELECT document_type, specific_type, COUNT(*) as usage_count
            FROM document_history 
            WHERE user_id = $1 
            GROUP BY document_type, specific_type
            ORDER BY usage_count DESC
        `, [userId]);

        const usagePatterns = {};
        historyResult.rows.forEach(row => {
            usagePatterns[`${row.document_type}_${row.specific_type}`] = row.usage_count;
        });

        // Business formation recommendations
        if (formType === 'business_formation') {
            if (profile.business_type === 'consulting' || profile.industry === 'technology') {
                recommendations.push({
                    specific_type: 'llc_articles',
                    score: 0.9,
                    reason: 'LLCs are popular for consulting and tech businesses due to flexibility'
                });
            }
            
            if (profile.experience_level === 'beginner') {
                recommendations.push({
                    specific_type: 'llc_operating_agreement',
                    score: 0.8,
                    reason: 'Operating agreements provide clear structure for new business owners'
                });
            }
        }

        // Real estate recommendations
        if (formType === 'real_estate') {
            if (profile.state_jurisdiction === 'CA') {
                recommendations.push({
                    specific_type: 'purchase_agreement',
                    score: 0.85,
                    reason: 'California-specific purchase agreements include required disclosures'
                });
            }
        }

        // Family law recommendations
        if (formType === 'family_law') {
            if (profile.state_jurisdiction) {
                recommendations.push({
                    specific_type: 'divorce_petition',
                    score: 0.8,
                    reason: `Divorce petitions vary by state - ${profile.state_jurisdiction} specific forms recommended`
                });
            }
        }

        // Estate planning recommendations
        if (formType === 'estate_planning') {
            if (profile.experience_level === 'beginner') {
                recommendations.push({
                    specific_type: 'last_will',
                    score: 0.9,
                    reason: 'Basic wills are a good starting point for estate planning'
                });
            } else {
                recommendations.push({
                    specific_type: 'living_trust',
                    score: 0.85,
                    reason: 'Living trusts offer more sophisticated estate planning options'
                });
            }
        }

        // Factor in usage patterns
        Object.keys(usagePatterns).forEach(pattern => {
            const [docType, specificType] = pattern.split('_');
            if (docType === formType) {
                const existingRec = recommendations.find(r => r.specific_type === specificType);
                if (existingRec) {
                    existingRec.score = Math.min(existingRec.score + 0.1, 1.0);
                    existingRec.reason += ' (frequently used by you)';
                } else {
                    recommendations.push({
                        specific_type: specificType,
                        score: 0.7,
                        reason: 'Based on your previous document history'
                    });
                }
            }
        });

        // Sort by score and return top recommendations
        return recommendations
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
    }

    async updateUserProfile(userId, profileData) {
        const existingProfile = await this.getUserProfile(userId);
        
        const updatedProfile = {
            ...existingProfile,
            ...profileData,
            usage_patterns: {
                ...existingProfile.usage_patterns,
                ...profileData.usage_patterns
            }
        };

        await db.query(`
            INSERT INTO user_profiles (user_id, business_type, industry, state_jurisdiction, experience_level, preferred_templates, usage_patterns)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                business_type = EXCLUDED.business_type,
                industry = EXCLUDED.industry,
                state_jurisdiction = EXCLUDED.state_jurisdiction,
                experience_level = EXCLUDED.experience_level,
                preferred_templates = EXCLUDED.preferred_templates,
                usage_patterns = EXCLUDED.usage_patterns,
                updated_at = CURRENT_TIMESTAMP
        `, [
            userId,
            updatedProfile.business_type,
            updatedProfile.industry,
            updatedProfile.state_jurisdiction,
            updatedProfile.experience_level,
            JSON.stringify(updatedProfile.preferred_templates || {}),
            JSON.stringify(updatedProfile.usage_patterns || {})
        ]);

        this.userProfiles.set(userId, updatedProfile);
    }
}

const recommendationEngine = new TemplateRecommendationEngine();

// Get template recommendations
router.get('/recommendations/:formType', optionalAuth, async (req, res) => {
    try {
        const { formType } = req.params;
        
        if (!req.user) {
            // Return generic recommendations for non-authenticated users
            return res.json({
                success: true,
                recommendations: [
                    {
                        specific_type: getDefaultTemplate(formType),
                        score: 0.8,
                        reason: 'Most commonly used template for this category'
                    }
                ]
            });
        }

        const recommendations = await recommendationEngine.getRecommendations(req.user.id, formType);
        
        // Save recommendations for analytics
        for (const rec of recommendations) {
            await db.query(`
                INSERT INTO template_recommendations (user_id, form_type, specific_type, recommendation_score, recommendation_reason)
                VALUES ($1, $2, $3, $4, $5)
            `, [req.user.id, formType, rec.specific_type, rec.score, rec.reason]);
        }

        res.json({
            success: true,
            recommendations
        });

    } catch (error) {
        console.error('Template recommendation error:', error);
        res.status(500).json({ error: 'Failed to get template recommendations' });
    }
});

// Update user profile for better recommendations
router.post('/profile', optionalAuth, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { business_type, industry, state_jurisdiction, experience_level } = req.body;
        
        await recommendationEngine.updateUserProfile(req.user.id, {
            business_type,
            industry,
            state_jurisdiction,
            experience_level
        });

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Track template usage for recommendations
router.post('/usage', optionalAuth, async (req, res) => {
    try {
        if (!req.user) {
            return res.json({ success: true }); // Silent success for non-authenticated users
        }

        const { form_type, specific_type, recommendation_id } = req.body;
        
        // Mark recommendation as used if provided
        if (recommendation_id) {
            await db.query(
                'UPDATE template_recommendations SET was_used = true WHERE id = $1',
                [recommendation_id]
            );
        }

        // Update usage patterns in user profile
        const profile = await recommendationEngine.getUserProfile(req.user.id);
        const usageKey = `${form_type}_${specific_type}`;
        const currentUsage = profile.usage_patterns[usageKey] || 0;
        
        await recommendationEngine.updateUserProfile(req.user.id, {
            usage_patterns: {
                ...profile.usage_patterns,
                [usageKey]: currentUsage + 1
            }
        });

        res.json({ success: true });

    } catch (error) {
        console.error('Usage tracking error:', error);
        res.status(500).json({ error: 'Failed to track usage' });
    }
});

// Get user's template preferences
router.get('/preferences', optionalAuth, async (req, res) => {
    try {
        if (!req.user) {
            return res.json({
                success: true,
                preferences: {
                    business_type: null,
                    industry: null,
                    state_jurisdiction: 'US',
                    experience_level: 'beginner'
                }
            });
        }

        const profile = await recommendationEngine.getUserProfile(req.user.id);
        
        res.json({
            success: true,
            preferences: {
                business_type: profile.business_type,
                industry: profile.industry,
                state_jurisdiction: profile.state_jurisdiction,
                experience_level: profile.experience_level
            }
        });

    } catch (error) {
        console.error('Preferences fetch error:', error);
        res.status(500).json({ error: 'Failed to get preferences' });
    }
});

// Helper function to get default template
function getDefaultTemplate(formType) {
    const defaults = {
        business_formation: 'llc_articles',
        real_estate: 'purchase_agreement',
        family_law: 'divorce_petition',
        estate_planning: 'last_will',
        employment_contracts: 'employment_agreement',
        civil_litigation: 'civil_complaint',
        general_contracts: 'service_agreement'
    };
    
    return defaults[formType] || 'service_agreement';
}

module.exports = router;
