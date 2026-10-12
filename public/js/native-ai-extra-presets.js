// Illustrative local inputs. Presets only change form fields; they never submit.
(() => {
    const examples = {
        conflictForm: [
            ['Supplier conflict', { party_names: 'Harbor Supply LLC\nAvery Chen\nNorthline Holdings Inc.' }],
            ['Employment conflict', { party_names: 'Summit Design Studio\nJordan Ellis\nBeacon Staffing LLC' }],
            ['Estate conflict', { party_names: 'Morgan Family Trust\nTaylor Morgan\nRiverbend Bank' }]
        ],
        scanForm: [
            ['Settlement call', { days: '30', sample_notes: 'Illustrative note: counsel discussed a settlement proposal with the client for 45 minutes and documented next steps. Confirm the real matter and time entry before billing.' }],
            ['Document review', { days: '14', sample_notes: 'Illustrative note: counsel reviewed a draft services agreement and marked termination and confidentiality provisions for follow up. Confirm work performed and duration.' }],
            ['Hearing preparation', { days: '90', sample_notes: 'Illustrative note: counsel prepared a hearing outline, checked exhibits, and discussed witness availability. Confirm dates, matter, and actual time spent.' }]
        ],
        solForm: [
            ['Injury intake', { jurisdiction: 'California', case_type: 'Personal Injury', incident_date: '2024-06-15', discovery_date: '2024-07-01' }],
            ['Contract intake', { jurisdiction: 'New York', case_type: 'Contract', incident_date: '2024-02-12', discovery_date: '2024-03-01' }],
            ['Property intake', { jurisdiction: 'Texas', case_type: 'Property Damage', incident_date: '2024-09-20', discovery_date: '2024-10-03' }]
        ],
        extractForm: [
            ['Court order', { document_text: 'Illustrative court order: The parties shall exchange initial disclosures by March 15, 2027. A status conference is set for April 12, 2027. Verify against the signed order.' }],
            ['Discovery letter', { document_text: 'Illustrative discovery letter: Please respond to the document requests by May 10, 2027. Counsel will meet and confer on May 17, 2027. Verify service and applicable rules.' }],
            ['Lease notice', { document_text: 'Illustrative lease notice: Tenant must cure the alleged maintenance default within 30 days after actual receipt of notice. The notice date and lease terms require verification.' }]
        ],
        searchForm: [
            ['Premises liability', { legal_issue: 'What duty, if any, does a commercial landlord owe for foreseeable third party criminal acts on the premises? Identify controlling authority and limits.', jurisdiction: 'California', practice_area: 'Personal Injury', search_type: 'case_law' }],
            ['Contract notice', { legal_issue: 'How do courts interpret written notice and cure provisions in a commercial services agreement after an alleged material breach?', jurisdiction: 'New York', practice_area: 'Business Law', search_type: 'supporting' }],
            ['Wage claim', { legal_issue: 'What statutory requirements govern final wage payment after employee separation, and what exceptions or defenses may apply?', jurisdiction: 'California', practice_area: 'Employment Law', search_type: 'statutes' }]
        ],
        draftForm: [
            ['Status update', { subject: 'Illustrative matter status update', draft_type: 'email', tone: 'professional', context: 'Draft a review copy telling the client that initial records were received, the timeline still needs confirmation, and counsel will provide next steps after reviewing the documents. Do not invent a deadline.' }],
            ['Records request', { subject: 'Illustrative request for missing records', draft_type: 'letter', tone: 'friendly', context: 'Ask the client for the signed agreement, amendments, invoices, and relevant correspondence. Explain that dates and legal positions will be confirmed by counsel.' }],
            ['Internal memo', { subject: 'Illustrative intake follow up memo', draft_type: 'memo', tone: 'formal', context: 'Organize open questions about parties, jurisdiction, chronology, available evidence, and missing records for attorney review. Do not state a legal conclusion.' }]
        ],
        classifyForm: [
            ['Scheduling request', { message_content: 'Hello, could we arrange a call next week to review the documents I sent? Please let me know available times.' }],
            ['Urgent deadline', { message_content: 'I received a court notice today that mentions a hearing next week. Please confirm the date and tell me what records you need.' }],
            ['Invoice question', { message_content: 'Could you explain the entries on my latest invoice and whether the retainer has been applied?' }]
        ],
        chatForm: [
            ['Contract concern', { messageInput: 'I need help reviewing a services agreement. What information should I provide about the parties, dates, and disputed terms?' }],
            ['Employment concern', { messageInput: 'I have a question about a separation agreement. Which documents and dates should I gather for a lawyer to review?' }],
            ['Property concern', { messageInput: 'I received a lease notice. What facts and documents should I organize before speaking with counsel?' }]
        ]
    };
    const selectExisting = (field, wanted) => {
        if (['case_id', 'client_id'].includes(field.name) && field.value) return true; // Keep real record references.
        const option = [...field.options].find(item => item.value && item.value === wanted)
            || [...field.options].find(item => item.value);
        if (option) field.value = option.value;
        return Boolean(option);
    };
    for (const [id, presets] of Object.entries(examples)) {
        const form = document.getElementById(id);
        if (!form) continue;
        const submit = form.querySelector('[type="submit"]');
        if (!submit) continue;
        const holder = document.createElement('div');
        holder.className = 'mb-2';
        const status = document.createElement('p');
        status.className = 'small text-muted mb-0';
        status.setAttribute('role', 'status');
        presets.forEach(([label, values]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-outline-info btn-sm me-2 mb-2';
            button.textContent = label;
            button.addEventListener('click', () => {
                const missing = [];
                for (const [name, value] of Object.entries(values)) {
                    const field = form.elements.namedItem(name) || document.querySelector('[name="' + name + '"]') || document.getElementById(name);
                    if (!field) continue;
                    if (field.tagName === 'SELECT') {
                        if (!selectExisting(field, value)) missing.push(name.replaceAll('_', ' '));
                    } else field.value = value;
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                }
                for (const field of form.querySelectorAll('select[name="case_id"],select[name="client_id"]')) {
                    if (!selectExisting(field, values[field.name])) missing.push(field.name.replaceAll('_', ' '));
                }
                if (id === 'scanForm') document.getElementById('exampleSection').style.display = 'block';
                status.textContent = missing.length
                    ? 'Example filled. Select an actual ' + [...new Set(missing)].join(', ') + ' when available; no record was invented.'
                    : 'Example filled for review. No request was sent.';
            });
            holder.append(button);
        });
        holder.append(status);
        submit.before(holder);
    }
    const refine = document.getElementById('refinePrompt');
    if (refine) {
        const holder = document.createElement('div'); holder.className = 'mb-2';
        for (const [label, value] of [
            ['Clarify facts', 'Clarify which facts are supported by the supplied record, and flag missing evidence for counsel.'],
            ['Simplify wording', 'Use clearer language while preserving the meaning of the reviewed draft. Flag any legal terms that require attorney approval.'],
            ['Review structure', 'Organize the existing draft into clear sections and identify clauses requiring counsel review. Do not add unverified facts.']
        ]) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-outline-info btn-sm me-2 mb-2'; button.textContent = label;
            button.addEventListener('click', () => { refine.value = value; refine.dispatchEvent(new Event('input', { bubbles: true })); });
            holder.append(button);
        }
        refine.after(holder);
    }
})();
