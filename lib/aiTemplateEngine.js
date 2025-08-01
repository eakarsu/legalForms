const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class AITemplateEngine {
  constructor() {
    this.templatesPath = path.join(__dirname, '../templates');
    this.templateCache = new Map();
  }

  // Load template as a structured prompt for AI
  async loadTemplatePrompt(templateType, specificType) {
    const cacheKey = `${templateType}_${specificType}_prompt`;
    
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey);
    }

    try {
      const templatePath = path.join(this.templatesPath, templateType, `${specificType}.ejs`);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      
      // Convert template to AI prompt
      const prompt = this.convertTemplateToPrompt(templateContent, templateType, specificType);
      
      this.templateCache.set(cacheKey, prompt);
      return prompt;
    } catch (error) {
      console.error(`Template not found: ${templateType}/${specificType}`, error);
      return null;
    }
  }

  // Convert EJS template to AI prompt
  convertTemplateToPrompt(templateContent, templateType, specificType) {
    // Extract the structure and content from the template
    const sections = this.extractTemplateSections(templateContent);
    
    const prompt = `You are a professional legal document generator. Create a ${this.getDocumentTitle(templateType, specificType)} using the following structure and user data.

DOCUMENT STRUCTURE:
${sections.structure}

REQUIRED SECTIONS:
${sections.sections.join('\n')}

LEGAL REQUIREMENTS:
- Use proper legal language and formatting
- Include all necessary clauses for ${templateType}
- Ensure compliance with standard legal practices
- Include proper signature blocks and notarization if required
- Use professional document formatting

INSTRUCTIONS:
1. Generate a complete, professional legal document
2. Replace all placeholder fields with actual user data
3. Maintain the document structure shown above
4. Add appropriate legal language and clauses
5. Ensure the document is court-ready and legally sound
6. Include proper headers, sections, and formatting
7. Add signature blocks for all relevant parties

USER DATA WILL BE PROVIDED SEPARATELY.

Generate the complete document in plain text format with proper formatting for professional presentation.`;

    return prompt;
  }

  // Extract sections from template
  extractTemplateSections(templateContent) {
    const sections = [];
    const structure = templateContent
      .replace(/<%.*?%>/g, '[DYNAMIC_CONTENT]')
      .replace(/<%= data\.\w+ \|\| '\[.*?\]' %>/g, '[USER_DATA]')
      .split('\n')
      .filter(line => line.trim())
      .slice(0, 20) // First 20 lines for structure
      .join('\n');

    // Extract section headers
    const sectionMatches = templateContent.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/g);
    if (sectionMatches) {
      sectionMatches.forEach(match => {
        const sectionTitle = match.replace(/<[^>]*>/g, '').trim();
        if (sectionTitle && !sectionTitle.includes('<%')) {
          sections.push(`- ${sectionTitle}`);
        }
      });
    }

    return { structure, sections };
  }

  // Generate document using AI with template guidance
  async generateDocument(templateType, specificType, userData, options = {}) {
    try {
      // Load the template prompt
      const templatePrompt = await this.loadTemplatePrompt(templateType, specificType);
      if (!templatePrompt) {
        throw new Error(`Template not found: ${templateType}/${specificType}`);
      }

      // Prepare user data for AI
      const userDataPrompt = this.formatUserDataForAI(userData, templateType, specificType);
      
      // Create the complete prompt
      const fullPrompt = `${templatePrompt}

USER DATA:
${userDataPrompt}

ADDITIONAL REQUIREMENTS:
${options.additionalRequirements || 'None'}

Generate the complete legal document now:`;

      // Check if API key is configured
      const apiKey = process.env.OPENROUTER_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('AI service is not configured. Please contact support.');
      }

      // Call OpenRouter API using axios
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku',
        messages: [
          {
            role: 'system',
            content: 'You are an expert legal document generator. Create professional, legally sound documents based on templates and user data.'
          },
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.3 // Lower temperature for more consistent legal documents
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
          'X-Title': 'Legal Forms Generator'
        }
      });

      const generatedDocument = response.data.choices[0].message.content;
      
      // Post-process the document
      const finalDocument = this.postProcessDocument(generatedDocument, userData, templateType, specificType);
      
      return finalDocument;
    } catch (error) {
      console.error('AI document generation error:', error);
      throw new Error(`Failed to generate document: ${error.message}`);
    }
  }

  // Format user data for AI prompt
  formatUserDataForAI(userData, templateType, specificType) {
    const formattedData = [];
    
    // Add all user data fields
    for (const [key, value] of Object.entries(userData)) {
      if (value && value.toString().trim()) {
        formattedData.push(`${key}: ${value}`);
      }
    }

    // Add document-specific context
    formattedData.push(`Document Type: ${templateType}`);
    formattedData.push(`Specific Template: ${specificType}`);
    formattedData.push(`Document Title: ${this.getDocumentTitle(templateType, specificType)}`);
    
    return formattedData.join('\n');
  }

  // Post-process the generated document
  postProcessDocument(document, userData, templateType, specificType) {
    let processedDoc = document;

    // Clean up any markdown formatting for professional documents
    processedDoc = processedDoc.replace(/\*\*(.*?)\*\*/g, '$1');
    processedDoc = processedDoc.replace(/^### (.*$)/gm, '$1');
    processedDoc = processedDoc.replace(/^## (.*$)/gm, '$1');
    processedDoc = processedDoc.replace(/^# (.*$)/gm, '$1');

    // Ensure proper formatting
    processedDoc = processedDoc.trim();

    return processedDoc;
  }

  // Get document title (same as original template engine)
  getDocumentTitle(templateType, specificType) {
    const titles = {
      business_formation: {
        llc_articles: 'ARTICLES OF ORGANIZATION',
        corp_articles: 'ARTICLES OF INCORPORATION',
        llc_operating_agreement: 'LIMITED LIABILITY COMPANY OPERATING AGREEMENT'
      },
      real_estate: {
        purchase_agreement: 'REAL ESTATE PURCHASE AGREEMENT',
        lease_agreement: 'RESIDENTIAL LEASE AGREEMENT',
        lease_agreement_professional: 'PROFESSIONAL LEASE AGREEMENT'
      },
      family_law: {
        divorce_petition: 'PETITION FOR DISSOLUTION OF MARRIAGE'
      },
      estate_planning: {
        last_will: 'LAST WILL AND TESTAMENT'
      },
      employment_contracts: {
        employment_agreement: 'EMPLOYMENT AGREEMENT',
        nda_agreement: 'NON-DISCLOSURE AGREEMENT'
      },
      civil_litigation: {
        civil_complaint: 'CIVIL COMPLAINT'
      },
      general_contracts: {
        service_agreement: 'SERVICE AGREEMENT'
      }
    };

    return titles[templateType]?.[specificType] || 'LEGAL DOCUMENT';
  }

  // Get available templates
  async getAvailableTemplates() {
    try {
      const categories = await fs.readdir(this.templatesPath);
      const templates = {};

      for (const category of categories) {
        if (category === 'base') continue;
        
        const categoryPath = path.join(this.templatesPath, category);
        const stat = await fs.stat(categoryPath);
        
        if (stat.isDirectory()) {
          const files = await fs.readdir(categoryPath);
          templates[category] = files
            .filter(file => file.endsWith('.ejs'))
            .map(file => file.replace('.ejs', ''));
        }
      }

      return templates;
    } catch (error) {
      console.error('Error getting available templates:', error);
      return {};
    }
  }

  // Validate user data
  validateUserData(templateType, specificType, userData) {
    const errors = [];
    
    // Basic validation
    if (!userData.client_name) {
      errors.push('Client name is required');
    }

    // Template-specific validation
    const requiredFields = this.getRequiredFields(templateType, specificType);
    
    for (const field of requiredFields) {
      if (!userData[field.name]) {
        errors.push(`${field.label} is required`);
      }
    }

    return errors;
  }

  // Get required fields for template
  getRequiredFields(templateType, specificType) {
    const fieldMap = {
      business_formation: {
        llc_articles: [
          { name: 'llc_name', label: 'LLC Name' },
          { name: 'state_formation', label: 'State of Formation' }
        ],
        corp_articles: [
          { name: 'corp_name', label: 'Corporation Name' },
          { name: 'state_incorporation', label: 'State of Incorporation' }
        ]
      },
      real_estate: {
        lease_agreement: [
          { name: 'property_address', label: 'Property Address' },
          { name: 'monthly_rent', label: 'Monthly Rent' }
        ],
        purchase_agreement: [
          { name: 'property_address', label: 'Property Address' },
          { name: 'purchase_price', label: 'Purchase Price' }
        ]
      }
    };

    return fieldMap[templateType]?.[specificType] || [];
  }

  // Clear cache
  clearCache() {
    this.templateCache.clear();
  }
}

module.exports = AITemplateEngine;
