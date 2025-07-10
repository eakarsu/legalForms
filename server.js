const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(fileUpload());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

// Form types configuration
const FORM_TYPES = {
  business_formation: {
    name: 'Business Formation',
    description: 'LLC and Corporation formation documents',
    promptFile: 'prompts/business_formation.txt'
  },
  real_estate: {
    name: 'Real Estate',
    description: 'Purchase agreements, deeds, and property documents',
    promptFile: 'prompts/real_estate.txt'
  },
  family_law: {
    name: 'Family Law',
    description: 'Divorce, custody, and family-related documents',
    promptFile: 'prompts/family_law.txt'
  },
  estate_planning: {
    name: 'Estate Planning',
    description: 'Wills, trusts, and estate documents',
    promptFile: 'prompts/estate_planning.txt'
  },
  civil_litigation: {
    name: 'Civil Litigation',
    description: 'Complaints, motions, and litigation documents',
    promptFile: 'prompts/civil_litigation.txt'
  },
  employment_contracts: {
    name: 'Employment Contracts',
    description: 'Employment agreements and workplace documents',
    promptFile: 'prompts/employment_contracts.txt'
  },
  general_contracts: {
    name: 'General Contracts',
    description: 'Service agreements and commercial contracts',
    promptFile: 'prompts/general_contracts.txt'
  }
};

// Load prompt template for a specific form type
async function loadPrompt(formType) {
  try {
    const promptFile = FORM_TYPES[formType].promptFile;
    const promptPath = path.join(__dirname, promptFile);
    return await fs.readFile(promptPath, 'utf8');
  } catch (error) {
    console.error('Error loading prompt:', error);
    return null;
  }
}

// Generate legal document using OpenRouter AI
async function generateDocument(formType, userData, specificType = null) {
  const prompt = await loadPrompt(formType);
  if (!prompt) {
    throw new Error('Failed to load prompt template');
  }

  // Add specific document type information to the prompt
  let documentTypeInfo = '';
  if (specificType) {
    const specificTypes = getSpecificFormTypes(formType);
    const typeInfo = specificTypes.find(t => t.value === specificType);
    if (typeInfo) {
      documentTypeInfo = `\n\nSPECIFIC DOCUMENT TYPE: ${typeInfo.label}\nGenerate specifically a ${typeInfo.label} document.`;
    }
  }

  // Combine prompt with user data
  const fullPrompt = `${prompt}${documentTypeInfo}\n\nUSER PROVIDED INFORMATION:\n${JSON.stringify(userData, null, 2)}\n\nGenerate a complete, professional legal document based on the above information.`;

  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku',
      messages: [
        {
          role: 'user',
          content: fullPrompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
        'X-Title': 'Legal Forms Generator'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating document:', error.response?.data || error.message);
    throw new Error('Failed to generate document using AI');
  }
}

// Specific form types within each category
const getSpecificFormTypes = (formType) => {
  const specificTypes = {
    business_formation: [
      { value: 'llc_articles', label: 'LLC Articles of Organization' },
      { value: 'corp_articles', label: 'Corporation Articles of Incorporation' },
      { value: 'llc_operating_agreement', label: 'LLC Operating Agreement' },
      { value: 'corp_bylaws', label: 'Corporate Bylaws' },
      { value: 'partnership_agreement', label: 'Partnership Agreement' },
      { value: 'dba_filing', label: 'DBA (Doing Business As) Filing' }
    ],
    real_estate: [
      { value: 'purchase_agreement', label: 'Real Estate Purchase Agreement' },
      { value: 'lease_agreement', label: 'Residential Lease Agreement' },
      { value: 'commercial_lease', label: 'Commercial Lease Agreement' },
      { value: 'deed_transfer', label: 'Property Deed Transfer' },
      { value: 'disclosure_form', label: 'Property Disclosure Form' },
      { value: 'listing_agreement', label: 'Real Estate Listing Agreement' }
    ],
    family_law: [
      { value: 'divorce_petition', label: 'Divorce Petition' },
      { value: 'custody_agreement', label: 'Child Custody Agreement' },
      { value: 'support_order', label: 'Child Support Order' },
      { value: 'prenuptial_agreement', label: 'Prenuptial Agreement' },
      { value: 'adoption_petition', label: 'Adoption Petition' },
      { value: 'separation_agreement', label: 'Legal Separation Agreement' }
    ],
    estate_planning: [
      { value: 'last_will', label: 'Last Will and Testament' },
      { value: 'living_trust', label: 'Living Trust' },
      { value: 'power_of_attorney', label: 'Power of Attorney' },
      { value: 'healthcare_directive', label: 'Healthcare Directive' },
      { value: 'guardianship_nomination', label: 'Guardianship Nomination' },
      { value: 'beneficiary_designation', label: 'Beneficiary Designation' }
    ],
    civil_litigation: [
      { value: 'civil_complaint', label: 'Civil Complaint' },
      { value: 'motion_dismiss', label: 'Motion to Dismiss' },
      { value: 'discovery_request', label: 'Discovery Request' },
      { value: 'settlement_agreement', label: 'Settlement Agreement' },
      { value: 'subpoena', label: 'Subpoena' },
      { value: 'judgment_collection', label: 'Judgment Collection Documents' }
    ],
    employment_contracts: [
      { value: 'employment_agreement', label: 'Employment Agreement' },
      { value: 'nda_agreement', label: 'Non-Disclosure Agreement' },
      { value: 'noncompete_agreement', label: 'Non-Compete Agreement' },
      { value: 'severance_agreement', label: 'Severance Agreement' },
      { value: 'contractor_agreement', label: 'Independent Contractor Agreement' },
      { value: 'employee_handbook', label: 'Employee Handbook' }
    ],
    general_contracts: [
      { value: 'service_agreement', label: 'Service Agreement' },
      { value: 'purchase_contract', label: 'Purchase Contract' },
      { value: 'licensing_agreement', label: 'Licensing Agreement' },
      { value: 'vendor_contract', label: 'Vendor Contract' },
      { value: 'consulting_agreement', label: 'Consulting Agreement' },
      { value: 'partnership_contract', label: 'Partnership Contract' }
    ]
  };
  
  return specificTypes[formType] || [];
};

// Form field configurations
const getFormFields = (formType, specificType) => {
  const baseFields = [
    { name: 'client_name', label: 'Full Legal Name', type: 'text', required: true },
    { name: 'client_address', label: 'Address', type: 'textarea', required: true },
    { name: 'client_phone', label: 'Phone Number', type: 'tel', required: true },
    { name: 'client_email', label: 'Email Address', type: 'email', required: true }
  ];

  const specificFields = {
    // Business Formation Fields
    llc_articles: [
      ...baseFields,
      { name: 'llc_name', label: 'LLC Name', type: 'text', required: true },
      { name: 'state_formation', label: 'State of Formation', type: 'select', options: ['CA', 'NY', 'TX', 'FL', 'DE', 'NV', 'Other'], required: true },
      { name: 'business_purpose', label: 'Business Purpose', type: 'textarea', required: true },
      { name: 'registered_agent', label: 'Registered Agent Name', type: 'text', required: true },
      { name: 'agent_address', label: 'Registered Agent Address', type: 'textarea', required: true },
      { name: 'management_type', label: 'Management Type', type: 'select', options: ['Member-Managed', 'Manager-Managed'], required: true }
    ],
    corp_articles: [
      ...baseFields,
      { name: 'corp_name', label: 'Corporation Name', type: 'text', required: true },
      { name: 'corp_type', label: 'Corporation Type', type: 'select', options: ['C-Corporation', 'S-Corporation', 'Professional Corporation'], required: true },
      { name: 'state_incorporation', label: 'State of Incorporation', type: 'select', options: ['CA', 'NY', 'TX', 'FL', 'DE', 'NV', 'Other'], required: true },
      { name: 'authorized_shares', label: 'Number of Authorized Shares', type: 'number', required: true },
      { name: 'par_value', label: 'Par Value per Share', type: 'number', required: true },
      { name: 'initial_directors', label: 'Initial Directors (Names)', type: 'textarea', required: true }
    ],
    
    // Real Estate Fields
    purchase_agreement: [
      ...baseFields,
      { name: 'buyer_name', label: 'Buyer Full Name', type: 'text', required: true },
      { name: 'seller_name', label: 'Seller Full Name', type: 'text', required: true },
      { name: 'property_address', label: 'Property Address', type: 'textarea', required: true },
      { name: 'purchase_price', label: 'Purchase Price ($)', type: 'number', required: true },
      { name: 'earnest_money', label: 'Earnest Money Amount ($)', type: 'number', required: true },
      { name: 'closing_date', label: 'Proposed Closing Date', type: 'date', required: true },
      { name: 'financing_contingency', label: 'Financing Contingency Period (days)', type: 'number', required: true }
    ],
    
    // Family Law Fields
    divorce_petition: [
      ...baseFields,
      { name: 'petitioner_name', label: 'Petitioner Full Name', type: 'text', required: true },
      { name: 'respondent_name', label: 'Respondent Full Name', type: 'text', required: true },
      { name: 'marriage_date', label: 'Date of Marriage', type: 'date', required: true },
      { name: 'separation_date', label: 'Date of Separation', type: 'date', required: false },
      { name: 'children_info', label: 'Children Information (Names, Ages)', type: 'textarea', required: false },
      { name: 'grounds_divorce', label: 'Grounds for Divorce', type: 'select', options: ['Irreconcilable Differences', 'Adultery', 'Abandonment', 'Cruelty', 'Other'], required: true }
    ],
    
    // Estate Planning Fields
    last_will: [
      ...baseFields,
      { name: 'testator_name', label: 'Testator Full Name', type: 'text', required: true },
      { name: 'spouse_name', label: 'Spouse Name (if applicable)', type: 'text', required: false },
      { name: 'beneficiaries', label: 'Primary Beneficiaries', type: 'textarea', required: true },
      { name: 'executor_name', label: 'Executor Name', type: 'text', required: true },
      { name: 'guardian_minors', label: 'Guardian for Minor Children', type: 'text', required: false },
      { name: 'assets_description', label: 'Description of Major Assets', type: 'textarea', required: true }
    ],
    
    // Civil Litigation Fields
    civil_complaint: [
      ...baseFields,
      { name: 'plaintiff_name', label: 'Plaintiff Name', type: 'text', required: true },
      { name: 'defendant_name', label: 'Defendant Name', type: 'text', required: true },
      { name: 'case_description', label: 'Case Description', type: 'textarea', required: true },
      { name: 'damages_amount', label: 'Damages Sought ($)', type: 'number', required: true },
      { name: 'court_jurisdiction', label: 'Court Jurisdiction', type: 'text', required: true },
      { name: 'incident_date', label: 'Date of Incident', type: 'date', required: true }
    ],
    
    // Employment Contract Fields
    employment_agreement: [
      ...baseFields,
      { name: 'employer_name', label: 'Employer/Company Name', type: 'text', required: true },
      { name: 'employee_name', label: 'Employee Name', type: 'text', required: true },
      { name: 'position_title', label: 'Position Title', type: 'text', required: true },
      { name: 'salary', label: 'Annual Salary ($)', type: 'number', required: true },
      { name: 'start_date', label: 'Start Date', type: 'date', required: true },
      { name: 'job_duties', label: 'Job Duties and Responsibilities', type: 'textarea', required: true }
    ],
    
    // General Contract Fields
    service_agreement: [
      ...baseFields,
      { name: 'service_provider', label: 'Service Provider Name', type: 'text', required: true },
      { name: 'client_company', label: 'Client/Company Name', type: 'text', required: true },
      { name: 'service_description', label: 'Service Description', type: 'textarea', required: true },
      { name: 'contract_value', label: 'Contract Value ($)', type: 'number', required: true },
      { name: 'start_date', label: 'Service Start Date', type: 'date', required: true },
      { name: 'end_date', label: 'Service End Date', type: 'date', required: true }
    ]
  };

  // Return specific fields if available, otherwise return base fields
  return specificFields[specificType] || baseFields;
};

// Legacy function for backward compatibility
const getLegacyFormFields = (formType) => {
  const formFields = {
    business_formation: [
      { name: 'client_name', label: 'Full Legal Name', type: 'text', required: true },
      { name: 'client_address', label: 'Address', type: 'textarea', required: true },
      { name: 'client_phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'client_email', label: 'Email Address', type: 'email', required: true },
      { name: 'entity_type', label: 'Entity Type', type: 'select', options: ['LLC', 'Corporation'], required: true },
      { name: 'entity_name', label: 'Proposed Entity Name', type: 'text', required: true },
      { name: 'state_formation', label: 'State of Formation', type: 'select', options: ['CA', 'NY', 'TX', 'FL', 'Other'], required: true },
      { name: 'business_purpose', label: 'Business Purpose', type: 'textarea', required: true }
    ],
    real_estate: [
      { name: 'buyer_name', label: 'Buyer Full Name', type: 'text', required: true },
      { name: 'seller_name', label: 'Seller Full Name', type: 'text', required: true },
      { name: 'property_address', label: 'Property Address', type: 'textarea', required: true },
      { name: 'purchase_price', label: 'Purchase Price', type: 'number', required: true },
      { name: 'earnest_money', label: 'Earnest Money Amount', type: 'number', required: true },
      { name: 'closing_date', label: 'Proposed Closing Date', type: 'date', required: true },
      { name: 'property_type', label: 'Property Type', type: 'select', options: ['Single Family', 'Condo', 'Commercial', 'Vacant Land'], required: true }
    ],
    family_law: [
      { name: 'petitioner_name', label: 'Petitioner Full Name', type: 'text', required: true },
      { name: 'respondent_name', label: 'Respondent Full Name', type: 'text', required: true },
      { name: 'marriage_date', label: 'Date of Marriage', type: 'date', required: true },
      { name: 'separation_date', label: 'Date of Separation', type: 'date', required: false },
      { name: 'children_names', label: 'Children Names and Ages', type: 'textarea', required: false },
      { name: 'grounds_divorce', label: 'Grounds for Divorce', type: 'select', options: ['Irreconcilable Differences', 'Adultery', 'Abandonment', 'Other'], required: true }
    ],
    estate_planning: [
      { name: 'testator_name', label: 'Testator Full Name', type: 'text', required: true },
      { name: 'testator_address', label: 'Testator Address', type: 'textarea', required: true },
      { name: 'spouse_name', label: 'Spouse Name (if applicable)', type: 'text', required: false },
      { name: 'beneficiaries', label: 'Primary Beneficiaries', type: 'textarea', required: true },
      { name: 'executor_name', label: 'Executor Name', type: 'text', required: true },
      { name: 'assets_description', label: 'Description of Assets', type: 'textarea', required: true }
    ],
    civil_litigation: [
      { name: 'plaintiff_name', label: 'Plaintiff Name', type: 'text', required: true },
      { name: 'defendant_name', label: 'Defendant Name', type: 'text', required: true },
      { name: 'case_description', label: 'Case Description', type: 'textarea', required: true },
      { name: 'damages_amount', label: 'Damages Sought', type: 'number', required: true },
      { name: 'court_jurisdiction', label: 'Court Jurisdiction', type: 'text', required: true },
      { name: 'incident_date', label: 'Date of Incident', type: 'date', required: true }
    ],
    employment_contracts: [
      { name: 'employer_name', label: 'Employer Name', type: 'text', required: true },
      { name: 'employee_name', label: 'Employee Name', type: 'text', required: true },
      { name: 'position_title', label: 'Position Title', type: 'text', required: true },
      { name: 'salary', label: 'Annual Salary', type: 'number', required: true },
      { name: 'start_date', label: 'Start Date', type: 'date', required: true },
      { name: 'job_duties', label: 'Job Duties', type: 'textarea', required: true }
    ],
    general_contracts: [
      { name: 'party1_name', label: 'First Party Name', type: 'text', required: true },
      { name: 'party2_name', label: 'Second Party Name', type: 'text', required: true },
      { name: 'contract_subject', label: 'Contract Subject Matter', type: 'textarea', required: true },
      { name: 'contract_value', label: 'Contract Value', type: 'number', required: true },
      { name: 'effective_date', label: 'Effective Date', type: 'date', required: true },
      { name: 'terms_conditions', label: 'Key Terms and Conditions', type: 'textarea', required: true }
    ]
  };

  return formFields[formType] || [];
};

// Routes
app.get('/', (req, res) => {
  res.render('index', { 
    formTypes: FORM_TYPES,
    title: 'Legal Forms Generator - Professional AI-Powered Legal Documents'
  });
});

app.get('/home', (req, res) => {
  res.redirect('/');
});

app.get('/services', (req, res) => {
  res.render('index', { 
    formTypes: FORM_TYPES,
    title: 'Legal Forms Generator - Services'
  });
});

app.get('/features', (req, res) => {
  res.render('index', { 
    formTypes: FORM_TYPES,
    title: 'Legal Forms Generator - Features'
  });
});

app.get('/contact', (req, res) => {
  res.render('contact', { 
    title: 'Contact Us - Legal Forms Generator'
  });
});

app.get('/form/:formType', (req, res) => {
  const formType = req.params.formType;
  
  if (!FORM_TYPES[formType]) {
    return res.status(404).render('404');
  }

  const formConfig = FORM_TYPES[formType];
  res.render('form', { 
    formType, 
    formConfig,
    title: `${formConfig.name} - Legal Forms Generator`
  });
});

app.post('/generate', async (req, res) => {
  try {
    const { form_type: formType, specific_type: specificType, form_data: userData } = req.body;

    if (!FORM_TYPES[formType]) {
      return res.status(400).json({ error: 'Invalid form type' });
    }

    // Validate required fields based on specific type
    const requiredFields = specificType ? 
      getFormFields(formType, specificType).filter(field => field.required) :
      getLegacyFormFields(formType).filter(field => field.required);
    
    const missingFields = requiredFields.filter(field => !userData[field.name] || userData[field.name].trim() === '');
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.map(f => f.label).join(', ')}` 
      });
    }

    // Generate the document with specific type information
    const document = await generateDocument(formType, userData, specificType);

    // Save generated document
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const documentType = specificType || formType;
    const filename = `${documentType}_${timestamp}.txt`;
    const filepath = path.join(uploadDir, filename);

    await fs.writeFile(filepath, document, 'utf8');

    res.json({
      success: true,
      document: document,
      filename: filename
    });
  } catch (error) {
    console.error('Error generating document:', error);
    res.status(500).json({ error: 'Failed to generate document. Please try again.' });
  }
});

app.post('/contact', (req, res) => {
  try {
    const { firstName, lastName, email, phone, subject, message } = req.body;
    
    // In a real application, you would send an email or save to database
    console.log('Contact form submission:', { firstName, lastName, email, phone, subject, message });
    
    res.json({ success: true, message: 'Thank you for your message! We will get back to you soon.' });
  } catch (error) {
    console.error('Error processing contact form:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

app.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(uploadDir, filename);
    
    // Check if file exists
    await fs.access(filepath);
    
    res.download(filepath);
  } catch (error) {
    res.status(404).send('File not found');
  }
});

app.get('/api/form-types/:formType', (req, res) => {
  const formType = req.params.formType;
  
  if (!FORM_TYPES[formType]) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  const specificTypes = getSpecificFormTypes(formType);
  res.json(specificTypes);
});

app.get('/api/form-fields/:formType/:specificType?', (req, res) => {
  const formType = req.params.formType;
  const specificType = req.params.specificType;
  
  if (!FORM_TYPES[formType]) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  const fields = specificType ? getFormFields(formType, specificType) : getLegacyFormFields(formType);
  res.json(fields);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

// Start server
app.listen(PORT, () => {
  console.log(`Legal Forms Generator server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the application`);
});

module.exports = app;
