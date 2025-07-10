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
const puppeteer = require('puppeteer');
const officegen = require('officegen');
const pdf = require('html-pdf');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware with relaxed CSP for development
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://code.jquery.com",
        "https://cdnjs.cloudflare.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));
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

// Load specific prompt based on document type
async function loadSpecificPrompt(specificType) {
  try {
    const promptPath = path.join(__dirname, `prompts/${specificType}.txt`);
    return await fs.readFile(promptPath, 'utf8');
  } catch (error) {
    console.error('Error loading specific prompt:', error);
    return null;
  }
}

// Generate legal document using OpenRouter AI
async function generateDocument(formType, userData, specificType = null) {
  let prompt;
  
  // Use specific prompt if available, otherwise fall back to general prompt
  if (specificType) {
    prompt = await loadSpecificPrompt(specificType);
  }
  
  if (!prompt) {
    prompt = await loadPrompt(formType);
  }
  
  if (!prompt) {
    throw new Error('Failed to load prompt template');
  }

  // Replace placeholders in prompt with actual user data
  let processedPrompt = prompt;
  Object.keys(userData).forEach(key => {
    const placeholder = `[${key.toUpperCase()}]`;
    processedPrompt = processedPrompt.replace(new RegExp(placeholder, 'g'), userData[key] || '');
  });

  // Combine processed prompt with user data
  const fullPrompt = `${processedPrompt}\n\nUSER PROVIDED INFORMATION:\n${JSON.stringify(userData, null, 2)}\n\nGenerate a complete, professional legal document based on the above information and template.`;

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
  console.log('getSpecificFormTypes called with:', formType);
  
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
      { value: 'listing_agreement', label: 'Real Estate Listing Agreement' },
      { value: 'rental_application', label: 'Rental Application' },
      { value: 'lease_termination', label: 'Lease Termination Notice' }
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
  
  const result = specificTypes[formType] || [];
  console.log('Returning specific types for', formType, ':', result);
  return result;
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
    llc_operating_agreement: [
      ...baseFields,
      { name: 'llc_name', label: 'LLC Name', type: 'text', required: true },
      { name: 'state_formation', label: 'State of Formation', type: 'select', options: ['CA', 'NY', 'TX', 'FL', 'DE', 'NV', 'Other'], required: true },
      { name: 'members_info', label: 'Members Information', type: 'textarea', required: true },
      { name: 'management_structure', label: 'Management Structure', type: 'select', options: ['Member-Managed', 'Manager-Managed'], required: true },
      { name: 'capital_contributions', label: 'Capital Contributions', type: 'textarea', required: true },
      { name: 'profit_distribution', label: 'Profit Distribution Method', type: 'textarea', required: true }
    ],
    corp_bylaws: [
      ...baseFields,
      { name: 'corp_name', label: 'Corporation Name', type: 'text', required: true },
      { name: 'state_incorporation', label: 'State of Incorporation', type: 'select', options: ['CA', 'NY', 'TX', 'FL', 'DE', 'NV', 'Other'], required: true },
      { name: 'board_size', label: 'Number of Directors', type: 'number', required: true },
      { name: 'meeting_frequency', label: 'Board Meeting Frequency', type: 'select', options: ['Monthly', 'Quarterly', 'Annually', 'As Needed'], required: true },
      { name: 'fiscal_year_end', label: 'Fiscal Year End', type: 'date', required: true },
      { name: 'stock_classes', label: 'Stock Classes', type: 'textarea', required: true }
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
    lease_agreement: [
      ...baseFields,
      { name: 'landlord_name', label: 'Landlord Name', type: 'text', required: true },
      { name: 'tenant_name', label: 'Tenant Name', type: 'text', required: true },
      { name: 'property_address', label: 'Rental Property Address', type: 'textarea', required: true },
      { name: 'monthly_rent', label: 'Monthly Rent ($)', type: 'number', required: true },
      { name: 'security_deposit', label: 'Security Deposit ($)', type: 'number', required: true },
      { name: 'lease_start', label: 'Lease Start Date', type: 'date', required: true },
      { name: 'lease_end', label: 'Lease End Date', type: 'date', required: true }
    ],
    commercial_lease: [
      ...baseFields,
      { name: 'landlord_name', label: 'Landlord/Company Name', type: 'text', required: true },
      { name: 'tenant_name', label: 'Tenant/Business Name', type: 'text', required: true },
      { name: 'property_address', label: 'Commercial Property Address', type: 'textarea', required: true },
      { name: 'monthly_rent', label: 'Monthly Base Rent ($)', type: 'number', required: true },
      { name: 'square_footage', label: 'Square Footage', type: 'number', required: true },
      { name: 'lease_term', label: 'Lease Term (years)', type: 'number', required: true },
      { name: 'permitted_use', label: 'Permitted Use', type: 'textarea', required: true }
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
    motion_dismiss: [
      ...baseFields,
      { name: 'case_number', label: 'Case Number', type: 'text', required: true },
      { name: 'court_name', label: 'Court Name', type: 'text', required: true },
      { name: 'moving_party', label: 'Moving Party', type: 'text', required: true },
      { name: 'grounds_dismissal', label: 'Grounds for Dismissal', type: 'textarea', required: true },
      { name: 'legal_authority', label: 'Legal Authority/Citations', type: 'textarea', required: true }
    ],
    settlement_agreement: [
      ...baseFields,
      { name: 'party1_name', label: 'First Party Name', type: 'text', required: true },
      { name: 'party2_name', label: 'Second Party Name', type: 'text', required: true },
      { name: 'dispute_description', label: 'Dispute Description', type: 'textarea', required: true },
      { name: 'settlement_amount', label: 'Settlement Amount ($)', type: 'number', required: true },
      { name: 'payment_terms', label: 'Payment Terms', type: 'textarea', required: true },
      { name: 'release_scope', label: 'Scope of Release', type: 'textarea', required: true }
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
    nda_agreement: [
      ...baseFields,
      { name: 'disclosing_party', label: 'Disclosing Party Name', type: 'text', required: true },
      { name: 'receiving_party', label: 'Receiving Party Name', type: 'text', required: true },
      { name: 'confidential_info', label: 'Description of Confidential Information', type: 'textarea', required: true },
      { name: 'agreement_term', label: 'Agreement Term (years)', type: 'number', required: true },
      { name: 'permitted_use', label: 'Permitted Use of Information', type: 'textarea', required: true }
    ],
    noncompete_agreement: [
      ...baseFields,
      { name: 'employer_name', label: 'Employer Name', type: 'text', required: true },
      { name: 'employee_name', label: 'Employee Name', type: 'text', required: true },
      { name: 'restricted_activities', label: 'Restricted Activities', type: 'textarea', required: true },
      { name: 'geographic_scope', label: 'Geographic Scope', type: 'text', required: true },
      { name: 'time_period', label: 'Time Period (months)', type: 'number', required: true },
      { name: 'consideration', label: 'Consideration Provided', type: 'textarea', required: true }
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

// Clean document content for different formats
function cleanDocumentContent(content, format) {
  let cleanedContent = content;
  
  if (format === 'pdf' || format === 'docx') {
    // Remove markdown-style formatting for professional documents
    
    // Convert **text** to bold (for HTML) or remove ** for plain formatting
    cleanedContent = cleanedContent.replace(/\*\*(.*?)\*\*/g, '$1');
    
    // Remove ### headers and convert to proper headers
    cleanedContent = cleanedContent.replace(/^### (.*$)/gm, '$1');
    cleanedContent = cleanedContent.replace(/^## (.*$)/gm, '$1');
    cleanedContent = cleanedContent.replace(/^# (.*$)/gm, '$1');
    
    // Remove horizontal rules (---)
    cleanedContent = cleanedContent.replace(/^---+$/gm, '');
    
    // Clean up extra whitespace
    cleanedContent = cleanedContent.replace(/\n\n\n+/g, '\n\n');
    cleanedContent = cleanedContent.trim();
  }
  
  return cleanedContent;
}

// Convert content to HTML with proper formatting
function convertToHTML(content) {
  let htmlContent = content;
  
  // Convert **text** to <strong>text</strong>
  htmlContent = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert ### to h3, ## to h2, # to h1
  htmlContent = htmlContent.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  htmlContent = htmlContent.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  htmlContent = htmlContent.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  
  // Convert --- to horizontal rules
  htmlContent = htmlContent.replace(/^---+$/gm, '<hr>');
  
  // Convert line breaks to <br> tags and paragraphs
  htmlContent = htmlContent.replace(/\n\n/g, '</p><p>');
  htmlContent = '<p>' + htmlContent + '</p>';
  
  // Clean up empty paragraphs
  htmlContent = htmlContent.replace(/<p><\/p>/g, '');
  htmlContent = htmlContent.replace(/<p>\s*<\/p>/g, '');
  
  return htmlContent;
}

// Document format conversion functions
async function generatePDF(content, filename) {
  // Clean the content and convert to HTML
  const cleanedContent = cleanDocumentContent(content, 'pdf');
  const htmlFormattedContent = convertToHTML(cleanedContent);
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { 
          font-family: 'Times New Roman', serif; 
          line-height: 1.6; 
          margin: 40px; 
          color: #000;
        }
        h1 { 
          color: #000; 
          margin-top: 30px; 
          margin-bottom: 20px;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
        }
        h2 { 
          color: #000; 
          margin-top: 25px; 
          margin-bottom: 15px;
          font-size: 16px;
          font-weight: bold;
        }
        h3 { 
          color: #000; 
          margin-top: 20px; 
          margin-bottom: 10px;
          font-size: 14px;
          font-weight: bold;
        }
        p { 
          margin-bottom: 12px; 
          text-align: justify;
        }
        strong { 
          font-weight: bold; 
        }
        hr { 
          border: none; 
          border-top: 1px solid #000; 
          margin: 20px 0; 
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
        }
        .signature-section { 
          margin-top: 50px; 
          page-break-inside: avoid;
        }
        .signature-line { 
          border-bottom: 1px solid #000; 
          width: 300px; 
          margin: 20px 0 10px 0;
        }
        .date-line { 
          margin-top: 30px; 
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Legal Document</h1>
      </div>
      ${htmlFormattedContent}
      <div class="signature-section">
        <div class="signature-line"></div>
        <p>Signature</p>
        <div class="date-line">Date: _________________</div>
      </div>
    </body>
    </html>
  `;

  return new Promise((resolve, reject) => {
    const options = {
      format: 'Letter',
      border: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in"
      },
      type: 'pdf',
      quality: '75'
    };

    pdf.create(htmlContent, options).toFile(filename, (err, result) => {
      if (err) reject(err);
      else resolve(result.filename);
    });
  });
}

async function generateWord(content, filename) {
  return new Promise((resolve, reject) => {
    const docx = officegen('docx');
    
    // Add document properties
    docx.setDocTitle('Legal Document');
    docx.setDocSubject('Generated Legal Document');
    docx.setDocKeywords('legal, document, generated');
    
    // Clean the content for Word format
    const cleanedContent = cleanDocumentContent(content, 'docx');
    
    // Split content into lines and process formatting
    const lines = cleanedContent.split('\n');
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        // Add empty paragraph for spacing
        docx.createP();
      } else if (trimmedLine.startsWith('# ')) {
        // Main heading
        const heading = docx.createP();
        heading.addText(trimmedLine.substring(2), { bold: true, font_size: 16 });
        heading.options.align = 'center';
      } else if (trimmedLine.startsWith('## ')) {
        // Sub heading
        const heading = docx.createP();
        heading.addText(trimmedLine.substring(3), { bold: true, font_size: 14 });
      } else if (trimmedLine.startsWith('### ')) {
        // Sub-sub heading
        const heading = docx.createP();
        heading.addText(trimmedLine.substring(4), { bold: true, font_size: 12 });
      } else {
        // Regular paragraph
        const paragraph = docx.createP();
        
        // Handle bold text within paragraphs
        if (trimmedLine.includes('**')) {
          const parts = trimmedLine.split(/(\*\*.*?\*\*)/);
          parts.forEach(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
              paragraph.addText(part.slice(2, -2), { bold: true });
            } else {
              paragraph.addText(part);
            }
          });
        } else {
          paragraph.addText(trimmedLine);
        }
      }
    });
    
    // Add signature section
    docx.createP();
    docx.createP();
    const sigLine = docx.createP();
    sigLine.addText('_'.repeat(50));
    const sigLabel = docx.createP();
    sigLabel.addText('Signature');
    docx.createP();
    const dateLine = docx.createP();
    dateLine.addText('Date: _________________');
    
    // Generate the document
    const output = require('fs').createWriteStream(filename);
    docx.generate(output);
    
    output.on('close', () => {
      resolve(filename);
    });
    
    output.on('error', (err) => {
      reject(err);
    });
  });
}

app.post('/generate', async (req, res) => {
  try {
    const { form_type: formType, specific_type: specificType, form_data: userData, format = 'txt' } = req.body;

    if (!FORM_TYPES[formType]) {
      return res.status(400).json({ error: 'Invalid form type' });
    }

    // Validate format
    const allowedFormats = ['txt', 'pdf', 'docx'];
    if (!allowedFormats.includes(format)) {
      return res.status(400).json({ error: 'Invalid document format' });
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

    // Save generated document in requested format
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const documentType = specificType || formType;
    const baseFilename = `${documentType}_${timestamp}`;
    
    let filename, filepath;
    
    switch (format) {
      case 'pdf':
        filename = `${baseFilename}.pdf`;
        filepath = path.join(uploadDir, filename);
        await generatePDF(document, filepath);
        break;
        
      case 'docx':
        filename = `${baseFilename}.docx`;
        filepath = path.join(uploadDir, filename);
        await generateWord(document, filepath);
        break;
        
      default: // txt
        filename = `${baseFilename}.txt`;
        filepath = path.join(uploadDir, filename);
        // For text format, keep the original formatting
        await fs.writeFile(filepath, document, 'utf8');
        break;
    }

    res.json({
      success: true,
      document: document,
      filename: filename,
      format: format
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
    
    // Set appropriate content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case '.txt':
        contentType = 'text/plain';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.download(filepath);
  } catch (error) {
    res.status(404).send('File not found');
  }
});

app.get('/api/form-types/:formType', (req, res) => {
  const formType = req.params.formType;
  console.log('API request for form types:', formType);
  console.log('Available form types:', Object.keys(FORM_TYPES));
  
  if (!FORM_TYPES[formType]) {
    console.log('Invalid form type:', formType);
    return res.status(400).json({ error: 'Invalid form type' });
  }

  try {
    const specificTypes = getSpecificFormTypes(formType);
    console.log('Returning specific types for', formType, ':', specificTypes);
    console.log('Number of types:', specificTypes.length);
    
    // Ensure we return a proper JSON response with CORS headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(specificTypes);
  } catch (error) {
    console.error('Error getting specific types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test endpoint to verify API is working
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working', 
    timestamp: new Date().toISOString(),
    formTypes: Object.keys(FORM_TYPES)
  });
});

app.get('/api/form-fields/:formType/:specificType?', (req, res) => {
  const formType = req.params.formType;
  const specificType = req.params.specificType;
  
  if (!FORM_TYPES[formType]) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  const fields = specificType ? getFormFields(formType, specificType) : getLegacyFormFields(formType);
  res.setHeader('Content-Type', 'application/json');
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
