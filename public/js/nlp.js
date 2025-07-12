// Natural Language Processing functionality
class NLPProcessor {
    constructor() {
        this.suggestions = [];
        this.loadSuggestions();
    }

    // Load example suggestions
    async loadSuggestions() {
        try {
            const response = await fetch('/api/nlp/suggestions');
            const data = await response.json();
            this.suggestions = data.suggestions || [];
        } catch (error) {
            console.error('Failed to load NLP suggestions:', error);
        }
    }

    // Parse natural language input
    async parseInput(text) {
        if (!text || text.trim().length === 0) {
            throw new Error('Please enter a description of your legal needs');
        }

        try {
            const response = await fetch('/api/nlp/parse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: text.trim() })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to parse input');
            }

            return result;
        } catch (error) {
            console.error('NLP parsing error:', error);
            throw error;
        }
    }

    // Apply parsed data to form
    applyParsedData(parsedData) {
        // Set form type if detected
        if (parsedData.intent) {
            const formTypeSelect = document.getElementById('specificFormType');
            if (formTypeSelect) {
                // Trigger form type loading for the detected intent
                window.location.hash = `#${parsedData.intent}`;
                // You might need to trigger a form reload here
            }
        }

        // Fill form fields
        if (parsedData.form_fields) {
            Object.keys(parsedData.form_fields).forEach(fieldName => {
                const field = document.getElementById(fieldName) || 
                             document.querySelector(`[name="${fieldName}"]`);
                if (field) {
                    field.value = parsedData.form_fields[fieldName];
                    field.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        }

        // Show confidence and entities
        this.displayParseResults(parsedData);
    }

    // Display parsing results
    displayParseResults(parsedData) {
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'alert alert-success fade-in';
        resultsDiv.innerHTML = `
            <h6><i class="fas fa-check-circle"></i> Parsing Results</h6>
            <p><strong>Detected Intent:</strong> ${this.formatIntent(parsedData.intent)}</p>
            <p><strong>Confidence:</strong> ${Math.round(parsedData.confidence * 100)}%</p>
            ${this.formatEntities(parsedData.entities)}
        `;

        // Insert after NLP input
        const nlpInput = document.getElementById('naturalLanguageInput');
        if (nlpInput && nlpInput.parentNode) {
            const existingResults = nlpInput.parentNode.querySelector('.alert-success');
            if (existingResults) {
                existingResults.remove();
            }
            nlpInput.parentNode.insertBefore(resultsDiv, nlpInput.nextSibling);
        }

        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (resultsDiv.parentNode) {
                resultsDiv.remove();
            }
        }, 10000);
    }

    // Format intent for display
    formatIntent(intent) {
        const intentMap = {
            business_formation: 'Business Formation',
            real_estate: 'Real Estate',
            family_law: 'Family Law',
            estate_planning: 'Estate Planning',
            employment_contracts: 'Employment Contracts',
            civil_litigation: 'Civil Litigation',
            general_contracts: 'General Contracts'
        };
        return intentMap[intent] || intent;
    }

    // Format entities for display
    formatEntities(entities) {
        if (!entities) return '';

        const entityList = [];
        Object.keys(entities).forEach(entityType => {
            if (entities[entityType] && entities[entityType].length > 0) {
                entityList.push(`<strong>${entityType}:</strong> ${entities[entityType].join(', ')}`);
            }
        });

        return entityList.length > 0 ? 
            `<p><strong>Extracted Information:</strong><br>${entityList.join('<br>')}</p>` : '';
    }

    // Setup autocomplete suggestions
    setupAutocomplete(inputElement) {
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'nlp-suggestions';
        suggestionsContainer.style.display = 'none';

        inputElement.parentNode.style.position = 'relative';
        inputElement.parentNode.appendChild(suggestionsContainer);

        inputElement.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase();
            if (value.length < 3) {
                suggestionsContainer.style.display = 'none';
                return;
            }

            const matchingSuggestions = this.suggestions.filter(suggestion =>
                suggestion.toLowerCase().includes(value)
            );

            if (matchingSuggestions.length > 0) {
                suggestionsContainer.innerHTML = matchingSuggestions
                    .slice(0, 5)
                    .map(suggestion => 
                        `<div class="nlp-suggestion-item">${suggestion}</div>`
                    ).join('');
                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.style.display = 'none';
            }
        });

        // Handle suggestion clicks
        suggestionsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('nlp-suggestion-item')) {
                inputElement.value = e.target.textContent;
                suggestionsContainer.style.display = 'none';
                inputElement.focus();
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!inputElement.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                suggestionsContainer.style.display = 'none';
            }
        });
    }
}

// Initialize NLP processor when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.nlpProcessor = new NLPProcessor();
    
    const nlpInput = document.getElementById('naturalLanguageInput');
    if (nlpInput) {
        window.nlpProcessor.setupAutocomplete(nlpInput);
    }
});
