const express = require('express');
const crypto = require('crypto');
const natural = require('natural');
const axios = require('axios');
const db = require('../config/database');
const router = express.Router();

// Initialize NLP tools
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

// Entity extraction patterns
const entityPatterns = {
    name: /(?:my name is|i am|called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    company: /(?:company|business|corporation|llc|inc)\s+(?:name|called)?\s*(?:is)?\s*([A-Z][a-zA-Z\s&.,]+)/gi,
    amount: /\$?([\d,]+(?:\.\d{2})?)\s*(?:dollars?)?/gi,
    date: /(?:on|by|before|after)\s+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
    address: /(?:at|located|address)\s+([0-9]+[^,\n]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)[^,\n]*(?:,\s*[^,\n]+)*)/gi,
    phone: /(?:phone|call|contact)\s*(?:number|me)?\s*(?:is|at)?\s*((?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/gi,
    email: /(?:email|e-mail)\s*(?:is|address)?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi
};

// Intent classification keywords
const intentKeywords = {
    business_formation: ['llc', 'corporation', 'business', 'company', 'incorporate', 'form', 'startup', 'entity'],
    real_estate: ['property', 'house', 'buy', 'sell', 'lease', 'rent', 'real estate', 'purchase agreement'],
    family_law: ['divorce', 'custody', 'marriage', 'prenup', 'separation', 'child support', 'alimony'],
    estate_planning: ['will', 'trust', 'estate', 'inheritance', 'beneficiary', 'executor', 'power of attorney'],
    employment_contracts: ['employment', 'job', 'work', 'employee', 'contractor', 'nda', 'non-compete'],
    civil_litigation: ['lawsuit', 'sue', 'court', 'complaint', 'damages', 'settlement', 'legal action']
};

// Parse natural language input using AI
async function parseWithAI(text) {
    try {
        const prompt = `
Parse the following legal request and extract structured information:

"${text}"

Extract and return a JSON object with the following structure:
{
    "intent": "form_type (business_formation, real_estate, family_law, estate_planning, employment_contracts, civil_litigation)",
    "entities": {
        "names": ["extracted names"],
        "companies": ["company names"],
        "amounts": ["monetary amounts"],
        "dates": ["dates"],
        "addresses": ["addresses"],
        "phones": ["phone numbers"],
        "emails": ["email addresses"]
    },
    "form_fields": {
        "field_name": "extracted_value"
    },
    "confidence": 0.85
}

Only return valid JSON, no additional text.`;

        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1000,
            temperature: 0.1
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const aiResponse = response.data.choices[0].message.content;
        return JSON.parse(aiResponse);
    } catch (error) {
        console.error('AI parsing error:', error);
        return null;
    }
}

// Fallback rule-based parsing
function parseWithRules(text) {
    const entities = {
        names: [],
        companies: [],
        amounts: [],
        dates: [],
        addresses: [],
        phones: [],
        emails: []
    };

    // Extract entities using regex patterns
    Object.keys(entityPatterns).forEach(entityType => {
        const matches = text.match(entityPatterns[entityType]);
        if (matches) {
            const key = entityType === 'name' ? 'names' : 
                       entityType === 'company' ? 'companies' :
                       entityType === 'amount' ? 'amounts' :
                       entityType === 'date' ? 'dates' :
                       entityType === 'address' ? 'addresses' :
                       entityType === 'phone' ? 'phones' :
                       entityType === 'email' ? 'emails' : entityType;
            
            entities[key] = matches.map(match => {
                const groups = entityPatterns[entityType].exec(match);
                return groups ? groups[1] : match;
            });
        }
    });

    // Classify intent
    const tokens = tokenizer.tokenize(text.toLowerCase());
    const stemmedTokens = tokens.map(token => stemmer.stem(token));
    
    let bestIntent = 'general_contracts';
    let bestScore = 0;

    Object.keys(intentKeywords).forEach(intent => {
        const score = intentKeywords[intent].reduce((acc, keyword) => {
            const stemmedKeyword = stemmer.stem(keyword);
            return acc + (stemmedTokens.includes(stemmedKeyword) ? 1 : 0);
        }, 0);
        
        if (score > bestScore) {
            bestScore = score;
            bestIntent = intent;
        }
    });

    // Map entities to form fields
    const form_fields = {};
    
    if (entities.names.length > 0) {
        form_fields.client_name = entities.names[0];
    }
    if (entities.companies.length > 0) {
        form_fields.company_name = entities.companies[0];
    }
    if (entities.addresses.length > 0) {
        form_fields.client_address = entities.addresses[0];
    }
    if (entities.phones.length > 0) {
        form_fields.client_phone = entities.phones[0];
    }
    if (entities.emails.length > 0) {
        form_fields.client_email = entities.emails[0];
    }
    if (entities.amounts.length > 0) {
        form_fields.amount = entities.amounts[0];
    }
    if (entities.dates.length > 0) {
        form_fields.date = entities.dates[0];
    }

    return {
        intent: bestIntent,
        entities,
        form_fields,
        confidence: Math.min(bestScore / 3, 1.0) // Normalize confidence
    };
}

// Main NLP parsing endpoint
router.post('/parse', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Text input is required' });
        }

        // Create hash for caching
        const textHash = crypto.createHash('sha256').update(text.trim()).digest('hex');
        
        // Check cache first
        const cacheResult = await db.query(
            'SELECT parsed_data FROM nlp_cache WHERE input_hash = $1',
            [textHash]
        );
        
        if (cacheResult.rows.length > 0) {
            return res.json({
                success: true,
                cached: true,
                ...cacheResult.rows[0].parsed_data
            });
        }

        // Try AI parsing first, fallback to rules
        let parsed = await parseWithAI(text);
        if (!parsed) {
            parsed = parseWithRules(text);
        }

        // Cache the result
        await db.query(`
            INSERT INTO nlp_cache (input_text, input_hash, parsed_data, form_type, confidence_score)
            VALUES ($1, $2, $3, $4, $5)
        `, [text, textHash, JSON.stringify(parsed), parsed.intent, parsed.confidence]);

        res.json({
            success: true,
            cached: false,
            ...parsed
        });

    } catch (error) {
        console.error('NLP parsing error:', error);
        res.status(500).json({ error: 'Failed to parse natural language input' });
    }
});

// Get parsing suggestions
router.get('/suggestions', (req, res) => {
    const suggestions = [
        "I need to form an LLC for my consulting business in California",
        "I want to buy a house at 123 Main Street for $500,000",
        "I need a divorce petition for John and Jane Smith, married on 01/15/2010",
        "Create a will for Robert Johnson, leaving everything to his wife Mary",
        "I need an employment contract for Software Engineer position at $80,000 salary",
        "I want to sue ABC Company for $10,000 in damages"
    ];
    
    res.json({ suggestions });
});

module.exports = router;
