const db = require('../config/database');

// Real-time compliance checker middleware
class ComplianceChecker {
    constructor() {
        this.rules = new Map();
        this.loadRules();
    }

    async loadRules() {
        try {
            const result = await db.query(`
                SELECT * FROM compliance_rules 
                WHERE is_active = true 
                AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)
                ORDER BY form_type, field_name
            `);
            
            result.rows.forEach(rule => {
                const key = `${rule.form_type}_${rule.field_name || 'general'}`;
                if (!this.rules.has(key)) {
                    this.rules.set(key, []);
                }
                this.rules.get(key).push(rule);
            });
            
            console.log(`Loaded ${result.rows.length} compliance rules`);
        } catch (error) {
            console.error('Error loading compliance rules:', error);
        }
    }

    // Validate a single field value
    validateField(formType, fieldName, value, jurisdiction = 'US') {
        const issues = [];
        const suggestions = [];
        
        const generalKey = `${formType}_general`;
        const fieldKey = `${formType}_${fieldName}`;
        
        // Check general rules for form type
        const generalRules = this.rules.get(generalKey) || [];
        const fieldRules = this.rules.get(fieldKey) || [];
        
        [...generalRules, ...fieldRules].forEach(rule => {
            if (rule.jurisdiction !== jurisdiction && rule.jurisdiction !== 'ALL') {
                return;
            }
            
            const ruleData = rule.rule_data;
            
            switch (rule.rule_type) {
                case 'required':
                    if (ruleData.required && (!value || value.trim() === '')) {
                        issues.push({
                            type: 'required',
                            severity: 'high',
                            message: `${fieldName} is required by ${jurisdiction} law`,
                            rule_name: rule.rule_name
                        });
                    }
                    break;
                    
                case 'format':
                    if (value && ruleData.pattern) {
                        const regex = new RegExp(ruleData.pattern);
                        if (!regex.test(value)) {
                            issues.push({
                                type: 'format',
                                severity: 'medium',
                                message: ruleData.error_message || `Invalid format for ${fieldName}`,
                                rule_name: rule.rule_name
                            });
                            if (ruleData.suggestion) {
                                suggestions.push(ruleData.suggestion);
                            }
                        }
                    }
                    break;
                    
                case 'range':
                    if (value && (ruleData.min !== undefined || ruleData.max !== undefined)) {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                            if (ruleData.min !== undefined && numValue < ruleData.min) {
                                issues.push({
                                    type: 'range',
                                    severity: 'medium',
                                    message: `${fieldName} must be at least ${ruleData.min}`,
                                    rule_name: rule.rule_name
                                });
                            }
                            if (ruleData.max !== undefined && numValue > ruleData.max) {
                                issues.push({
                                    type: 'range',
                                    severity: 'medium',
                                    message: `${fieldName} cannot exceed ${ruleData.max}`,
                                    rule_name: rule.rule_name
                                });
                            }
                        }
                    }
                    break;
                    
                case 'validation':
                    if (value && ruleData.forbidden_terms) {
                        const lowerValue = value.toLowerCase();
                        ruleData.forbidden_terms.forEach(term => {
                            if (lowerValue.includes(term.toLowerCase())) {
                                issues.push({
                                    type: 'validation',
                                    severity: ruleData.severity || 'medium',
                                    message: `${fieldName} contains potentially problematic term: "${term}"`,
                                    rule_name: rule.rule_name
                                });
                            }
                        });
                    }
                    break;
            }
        });
        
        return { issues, suggestions };
    }

    // Validate entire form data
    validateForm(formType, formData, jurisdiction = 'US') {
        const allIssues = [];
        const allSuggestions = [];
        
        Object.keys(formData).forEach(fieldName => {
            const { issues, suggestions } = this.validateField(
                formType, 
                fieldName, 
                formData[fieldName], 
                jurisdiction
            );
            allIssues.push(...issues);
            allSuggestions.push(...suggestions);
        });
        
        return {
            isCompliant: allIssues.filter(issue => issue.severity === 'high').length === 0,
            issues: allIssues,
            suggestions: [...new Set(allSuggestions)] // Remove duplicates
        };
    }

    // Refresh rules cache
    async refreshRules() {
        this.rules.clear();
        await this.loadRules();
    }
}

// Create singleton instance
const complianceChecker = new ComplianceChecker();

// Middleware function for real-time validation
const validateCompliance = async (req, res, next) => {
    try {
        const { form_type, form_data, jurisdiction = 'US' } = req.body;
        
        if (form_type && form_data) {
            const validation = complianceChecker.validateForm(form_type, form_data, jurisdiction);
            req.complianceValidation = validation;
        }
        
        next();
    } catch (error) {
        console.error('Compliance validation error:', error);
        next(); // Continue even if validation fails
    }
};

module.exports = {
    ComplianceChecker,
    complianceChecker,
    validateCompliance
};
