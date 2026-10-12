// Local examples only: filling a preset never submits an AI request.
(() => {
    const examples = {
        draftForm: [
            { label: 'Demand letter', values: { document_type: 'letter', category: 'letter', title: 'Illustrative demand letter for vehicle sale dispute', prompt: 'Draft a review copy of a demand letter about a used vehicle sold with an undisclosed prior collision. The buyer paid $18,500 and later found a repair history. Identify facts and evidence counsel must verify, request a response within 14 days, and avoid stating unverified law as fact.', context: 'Illustrative facts only. Purchase agreement, advertisement, repair invoice, and vehicle history report require review. Jurisdiction and client identity must be confirmed.', style: 'firm', length: 'detailed', include_citations: false, review_mode: true } },
            { label: 'Services agreement', values: { document_type: 'agreement', category: 'agreement', title: 'Illustrative software services agreement', prompt: 'Draft a review copy of a software services agreement with phased delivery, acceptance criteria, payment milestones, confidentiality, intellectual property ownership, and termination rights. Flag terms requiring lawyer approval.', context: 'Illustrative project: a six month CRM implementation with three milestones. Party names, governing law, dates, and amounts must be confirmed.', style: 'formal', length: 'standard', include_citations: false, review_mode: true } },
            { label: 'Case memo', values: { document_type: 'memo', category: 'memo', title: 'Illustrative intake evidence memo', prompt: 'Prepare an internal memo that organizes a contract dispute timeline, disputed obligations, available records, missing evidence, and questions for counsel. Do not predict an outcome or invent authorities.', context: 'Illustrative records: signed agreement, two invoices, email thread, and delivery log. Dates, jurisdiction, and client instructions must be checked.', style: 'neutral', length: 'concise', include_citations: false, review_mode: true } }
        ],
        analysisForm: [
            { label: 'Service contract', values: { document_name: 'Illustrative software services agreement', document_type: 'service', document_text: 'SOFTWARE SERVICES AGREEMENT\nThe customer engages the developer for a six month CRM implementation. Delivery occurs in three milestones, each subject to written acceptance. The fixed fee is payable in three installments after acceptance. Each party must protect confidential information for three years. The customer owns accepted deliverables; the developer retains pre-existing tools. Either party may terminate for material breach after 30 days to cure. Liability is limited to fees paid, except for confidentiality breaches. Governing law and signatory authority require confirmation.' } },
            { label: 'Employment agreement', values: { document_name: 'Illustrative employment agreement', document_type: 'employment', document_text: 'EMPLOYMENT AGREEMENT\nThe employer offers a full time role beginning on a date to be confirmed. Salary is payable twice monthly and is subject to payroll deductions. The employee will follow confidentiality and data security policies and return company property on separation. The agreement contains a 30 day notice provision, an intellectual property assignment, and a dispute resolution clause. Counsel must verify jurisdiction, wage rules, restrictive covenants, and the parties before any use.' } },
            { label: 'Commercial lease', values: { document_name: 'Illustrative commercial lease', document_type: 'lease', document_text: 'COMMERCIAL LEASE\nThe landlord leases office space to the tenant for a three year term. Base rent is due monthly, with annual adjustments stated in an attached schedule. The tenant handles ordinary interior maintenance, and the landlord handles structural repairs. The tenant must maintain liability insurance and obtain consent before assignment. Either party may seek remedies after written notice and an opportunity to cure. Exact premises, amounts, dates, and local requirements require confirmation.' } }
        ],
        summaryForm: [
            { label: 'Court filing', values: { source_name: 'Illustrative motion to dismiss', source_type: 'pleading', summary_length: 'detailed', target_audience: 'attorney', original_text: 'ILLUSTRATIVE MOTION TO DISMISS\nA defendant asks the court to dismiss a commercial lease claim. The filing argues that the complaint does not identify a breached lease provision and disputes the alleged maintenance obligation. It cites a signed lease, inspection notes, and correspondence, but the underlying exhibits and procedural posture have not been verified. The motion asks for dismissal; no ruling has been entered.' } },
            { label: 'Client letter', values: { source_name: 'Illustrative client status letter', source_type: 'correspondence', summary_length: 'medium', target_audience: 'client', original_text: 'ILLUSTRATIVE CLIENT STATUS LETTER\nCounsel reports that the parties exchanged initial documents about a service agreement dispute. The letter identifies an invoice, delivery records, and several emails for review. It asks the client to confirm the chronology and provide any missing amendments. A response deadline is mentioned but must be checked against the actual correspondence. The letter offers no outcome prediction.' } },
            { label: 'Contract excerpt', values: { source_name: 'Illustrative vendor agreement excerpt', source_type: 'contract', summary_length: 'brief', target_audience: 'attorney', original_text: 'ILLUSTRATIVE VENDOR AGREEMENT EXCERPT\nThe vendor will provide hosted software for one year. The customer pays a monthly subscription fee and may terminate after a material breach that remains uncured for thirty days. The vendor promises reasonable security measures and will notify the customer after discovering a security incident. Liability is capped at the prior twelve months of fees, subject to listed exceptions. The complete agreement and exhibits are needed for reliable analysis.' } }
        ]
    };

    const form = Object.keys(examples).map(id => document.getElementById(id)).find(Boolean);
    if (!form) return;
    const container = form.querySelector('[data-ai-presets]');
    if (!container) return;
    const note = document.createElement('p');
    note.className = 'small text-muted mt-2';
    note.setAttribute('role', 'status');
    container.append(note);

    examples[form.id].forEach(example => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-outline-info me-2 mb-2';
        button.textContent = example.label;
        button.addEventListener('click', () => {
            for (const [name, value] of Object.entries(example.values)) {
                const field = form.elements.namedItem(name);
                if (!field) continue;
                if (field.type === 'checkbox') field.checked = value;
                else field.value = value;
                field.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const missing = [];
            for (const name of ['client_id', 'case_id', 'template_id']) {
                const select = form.elements.namedItem(name);
                if (!select) continue;
                // Keep an actual selection; otherwise choose an actual option if present.
                if (!select.value) {
                    const category = form.elements.namedItem('category')?.value;
                    const available = [...select.options].find(option => option.value &&
                        (name !== 'template_id' || !category || option.dataset.category === category));
                    if (available) select.value = available.value;
                }
                if (!select.value) missing.push(name.replace('_', ' '));
            }
            note.textContent = missing.length
                ? 'Example filled. Select an actual ' + missing.join(', ') + ' when needed; no reference was invented.'
                : 'All available fields filled. Review real record references before generating.';
        });
        container.insertBefore(button, note);
    });
})();
