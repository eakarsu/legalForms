const fs = require('fs').promises;
const path = require('path');
const ejs = require('ejs');

class LegalTemplateEngine {
  constructor() {
    this.templatesPath = path.join(__dirname, '../templates');
    this.templateCache = new Map();
  }

  // Load and cache template
  async loadTemplate(templateType, specificType) {
    const cacheKey = `${templateType}_${specificType}`;
    
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey);
    }

    try {
      const templatePath = path.join(this.templatesPath, templateType, `${specificType}.ejs`);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      
      this.templateCache.set(cacheKey, templateContent);
      return templateContent;
    } catch (error) {
      console.error(`Template not found: ${templateType}/${specificType}`, error);
      return null;
    }
  }

  // Render template with data
  async renderTemplate(templateType, specificType, data, options = {}) {
    try {
      const template = await this.loadTemplate(templateType, specificType);
      if (!template) {
        throw new Error(`Template not found: ${templateType}/${specificType}`);
      }

      // Prepare template data
      const templateData = {
        data: data,
        documentTitle: this.getDocumentTitle(templateType, specificType),
        documentType: this.getDocumentType(templateType, specificType),
        jurisdiction: data.state_formation || data.state_jurisdiction || 'United States',
        caseNumber: data.case_number || null,
        signatures: this.prepareSignatures(data, templateType, specificType),
        notarization: this.requiresNotarization(templateType, specificType),
        ...options
      };

      // Render the template
      const rendered = await ejs.render(template, templateData, {
        filename: path.join(this.templatesPath, templateType, `${specificType}.ejs`),
        includeDir: this.templatesPath
      });

      return rendered;
    } catch (error) {
      console.error('Template rendering error:', error);
      throw new Error(`Failed to render template: ${error.message}`);
    }
  }

  // Get document title based on type
  getDocumentTitle(templateType, specificType) {
    const titles = {
      business_formation: {
        llc_articles: 'ARTICLES OF ORGANIZATION',
        corp_articles: 'ARTICLES OF INCORPORATION',
        llc_operating_agreement: 'LIMITED LIABILITY COMPANY OPERATING AGREEMENT',
        corp_bylaws: 'CORPORATE BYLAWS'
      },
      real_estate: {
        purchase_agreement: 'REAL ESTATE PURCHASE AGREEMENT',
        lease_agreement: 'RESIDENTIAL LEASE AGREEMENT',
        commercial_lease: 'COMMERCIAL LEASE AGREEMENT'
      },
      family_law: {
        divorce_petition: 'PETITION FOR DISSOLUTION OF MARRIAGE',
        custody_agreement: 'CHILD CUSTODY AGREEMENT',
        prenuptial_agreement: 'PRENUPTIAL AGREEMENT'
      },
      estate_planning: {
        last_will: 'LAST WILL AND TESTAMENT',
        living_trust: 'REVOCABLE LIVING TRUST',
        power_of_attorney: 'POWER OF ATTORNEY',
        healthcare_directive: 'ADVANCE HEALTHCARE DIRECTIVE'
      },
      employment_contracts: {
        employment_agreement: 'EMPLOYMENT AGREEMENT',
        nda_agreement: 'NON-DISCLOSURE AGREEMENT',
        noncompete_agreement: 'NON-COMPETE AGREEMENT'
      },
      civil_litigation: {
        civil_complaint: 'CIVIL COMPLAINT',
        motion_dismiss: 'MOTION TO DISMISS',
        settlement_agreement: 'SETTLEMENT AGREEMENT'
      },
      general_contracts: {
        service_agreement: 'SERVICE AGREEMENT',
        consulting_agreement: 'CONSULTING AGREEMENT',
        vendor_contract: 'VENDOR AGREEMENT'
      }
    };

    return titles[templateType]?.[specificType] || 'LEGAL DOCUMENT';
  }

  // Get document type description
  getDocumentType(templateType, specificType) {
    const types = {
      business_formation: 'Business Formation Document',
      real_estate: 'Real Estate Document',
      family_law: 'Family Law Document',
      estate_planning: 'Estate Planning Document',
      employment_contracts: 'Employment Document',
      civil_litigation: 'Civil Litigation Document',
      general_contracts: 'Contract Document'
    };

    return types[templateType] || 'Legal Document';
  }

  // Prepare signature blocks
  prepareSignatures(data, templateType, specificType) {
    const signatures = [];

    // Add primary client signature
    if (data.client_name) {
      signatures.push({
        name: data.client_name,
        title: data.client_title || null
      });
    }

    // Add specific signatures based on document type
    switch (templateType) {
      case 'business_formation':
        if (specificType === 'llc_articles' && data.organizer_name && data.organizer_name !== data.client_name) {
          signatures.push({
            name: data.organizer_name,
            title: 'Organizer'
          });
        }
        break;

      case 'real_estate':
        if (data.buyer_name && data.buyer_name !== data.client_name) {
          signatures.push({
            name: data.buyer_name,
            title: 'Buyer'
          });
        }
        if (data.seller_name && data.seller_name !== data.client_name) {
          signatures.push({
            name: data.seller_name,
            title: 'Seller'
          });
        }
        if (data.landlord_name && data.landlord_name !== data.client_name) {
          signatures.push({
            name: data.landlord_name,
            title: 'Landlord'
          });
        }
        if (data.tenant_name && data.tenant_name !== data.client_name) {
          signatures.push({
            name: data.tenant_name,
            title: 'Tenant'
          });
        }
        break;

      case 'family_law':
        if (data.petitioner_name && data.petitioner_name !== data.client_name) {
          signatures.push({
            name: data.petitioner_name,
            title: 'Petitioner'
          });
        }
        if (data.respondent_name && data.respondent_name !== data.client_name) {
          signatures.push({
            name: data.respondent_name,
            title: 'Respondent'
          });
        }
        break;

      case 'employment_contracts':
        if (data.employer_name && data.employer_name !== data.client_name) {
          signatures.push({
            name: data.employer_name,
            title: 'Employer'
          });
        }
        if (data.employee_name && data.employee_name !== data.client_name) {
          signatures.push({
            name: data.employee_name,
            title: 'Employee'
          });
        }
        break;
    }

    return signatures.length > 0 ? signatures : null;
  }

  // Check if document requires notarization
  requiresNotarization(templateType, specificType) {
    const notarizationRequired = {
      business_formation: ['llc_articles', 'corp_articles'],
      real_estate: ['purchase_agreement', 'deed_transfer'],
      estate_planning: ['last_will', 'power_of_attorney', 'healthcare_directive'],
      family_law: ['divorce_petition', 'prenuptial_agreement']
    };

    return notarizationRequired[templateType]?.includes(specificType) || false;
  }

  // Get available templates
  async getAvailableTemplates() {
    try {
      const categories = await fs.readdir(this.templatesPath);
      const templates = {};

      for (const category of categories) {
        if (category === 'base') continue; // Skip base templates
        
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

  // Validate template data
  validateTemplateData(templateType, specificType, data) {
    const errors = [];
    
    // Common required fields
    if (!data.client_name) {
      errors.push('Client name is required');
    }
    if (!data.client_address) {
      errors.push('Client address is required');
    }

    // Template-specific validation
    const validationRules = this.getValidationRules(templateType, specificType);
    
    for (const rule of validationRules) {
      if (rule.required && !data[rule.field]) {
        errors.push(`${rule.label} is required`);
      }
      if (rule.type === 'email' && data[rule.field] && !this.isValidEmail(data[rule.field])) {
        errors.push(`${rule.label} must be a valid email address`);
      }
      if (rule.type === 'date' && data[rule.field] && !this.isValidDate(data[rule.field])) {
        errors.push(`${rule.label} must be a valid date`);
      }
    }

    return errors;
  }

  // Get validation rules for specific template
  getValidationRules(templateType, specificType) {
    // This would contain specific validation rules for each template type
    // For now, returning basic rules
    return [
      { field: 'client_email', label: 'Email', type: 'email', required: false },
      { field: 'client_phone', label: 'Phone', type: 'text', required: false }
    ];
  }

  // Utility functions
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidDate(date) {
    return !isNaN(Date.parse(date));
  }

  // Clear template cache
  clearCache() {
    this.templateCache.clear();
  }
}

module.exports = LegalTemplateEngine;
