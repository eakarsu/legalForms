// Real-time compliance checking functionality
class ComplianceValidator {
    constructor(socket) {
        this.socket = socket;
        this.validationTimeout = null;
        this.validationCache = new Map();
    }

    // Validate field with debouncing
    validateField(formType, fieldName, value, jurisdiction = 'US') {
        clearTimeout(this.validationTimeout);
        
        const cacheKey = `${formType}_${fieldName}_${value}_${jurisdiction}`;
        if (this.validationCache.has(cacheKey)) {
            const cached = this.validationCache.get(cacheKey);
            this.displayValidation(fieldName, cached.issues, cached.suggestions);
            return;
        }

        // Show loading state
        this.showValidationLoading(fieldName);

        this.validationTimeout = setTimeout(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('validate_field', {
                    form_type: formType,
                    field_name: fieldName,
                    value: value,
                    jurisdiction: jurisdiction
                });
            } else {
                // Fallback to HTTP request
                this.validateFieldHTTP(formType, fieldName, value, jurisdiction);
            }
        }, 500); // 500ms debounce
    }

    // HTTP fallback for validation
    async validateFieldHTTP(formType, fieldName, value, jurisdiction) {
        try {
            const response = await fetch('/api/compliance/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    form_type: formType,
                    field_name: fieldName,
                    value: value,
                    jurisdiction: jurisdiction
                })
            });

            const result = await response.json();
            if (result.success) {
                const cacheKey = `${formType}_${fieldName}_${value}_${jurisdiction}`;
                this.validationCache.set(cacheKey, {
                    issues: result.issues,
                    suggestions: result.suggestions
                });
                this.displayValidation(fieldName, result.issues, result.suggestions);
            }
        } catch (error) {
            console.error('Validation HTTP request failed:', error);
            this.hideValidationLoading(fieldName);
        }
    }

    // Show validation loading state
    showValidationLoading(fieldName) {
        const field = document.getElementById(fieldName);
        if (field) {
            field.classList.add('validating');
            field.classList.remove('valid', 'invalid');
        }
    }

    // Hide validation loading state
    hideValidationLoading(fieldName) {
        const field = document.getElementById(fieldName);
        if (field) {
            field.classList.remove('validating');
        }
    }

    // Display validation results
    displayValidation(fieldName, issues, suggestions) {
        const field = document.getElementById(fieldName);
        if (!field) return;

        this.hideValidationLoading(fieldName);

        // Remove existing validation display
        const existingValidation = field.parentNode.querySelector('.field-validation');
        if (existingValidation) {
            existingValidation.remove();
        }

        // Update field styling
        if (issues.length > 0) {
            const hasHighSeverity = issues.some(issue => issue.severity === 'high');
            field.classList.add(hasHighSeverity ? 'invalid' : 'valid');
            field.classList.remove(hasHighSeverity ? 'valid' : 'invalid');
        } else {
            field.classList.add('valid');
            field.classList.remove('invalid');
        }

        // Create validation display
        if (issues.length > 0 || suggestions.length > 0) {
            const validationDiv = document.createElement('div');
            validationDiv.className = 'field-validation fade-in';

            // Display issues
            issues.forEach(issue => {
                const issueDiv = document.createElement('div');
                issueDiv.className = `validation-issue ${issue.severity}`;
                issueDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${issue.message}`;
                validationDiv.appendChild(issueDiv);
            });

            // Display suggestions
            suggestions.forEach(suggestion => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.className = 'validation-suggestion';
                suggestionDiv.innerHTML = `<i class="fas fa-lightbulb"></i> ${suggestion}`;
                validationDiv.appendChild(suggestionDiv);
            });

            field.parentNode.appendChild(validationDiv);
        }

        // Update global compliance status
        this.updateGlobalComplianceStatus();
    }

    // Update global compliance status display
    updateGlobalComplianceStatus() {
        const allIssues = document.querySelectorAll('.validation-issue.high');
        const complianceDiv = document.getElementById('complianceIssues');
        const issuesList = document.getElementById('complianceIssuesList');

        if (allIssues.length > 0) {
            const issues = Array.from(allIssues).map(issue => issue.textContent);
            issuesList.innerHTML = issues.map(issue => `<li>${issue}</li>`).join('');
            complianceDiv.style.display = 'block';
        } else {
            complianceDiv.style.display = 'none';
        }
    }

    // Setup field listeners
    setupFieldListeners(formType) {
        document.addEventListener('input', (e) => {
            if (e.target.matches('input, textarea, select')) {
                const fieldName = e.target.name || e.target.id;
                if (fieldName && e.target.value) {
                    this.validateField(formType, fieldName, e.target.value);
                }
            }
        });

        document.addEventListener('blur', (e) => {
            if (e.target.matches('input, textarea, select')) {
                const fieldName = e.target.name || e.target.id;
                if (fieldName && e.target.value) {
                    this.validateField(formType, fieldName, e.target.value);
                }
            }
        });
    }
}

// Initialize compliance validator when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (typeof io !== 'undefined') {
        const socket = io();
        window.complianceValidator = new ComplianceValidator(socket);
    }
});
