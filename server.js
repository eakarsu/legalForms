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
const compression = require('compression');
const { SitemapStream, streamToPromise } = require('sitemap');

// Import the template engines
const LegalTemplateEngine = require('./lib/templateEngine');
const AITemplateEngine = require('./lib/aiTemplateEngine');

//add
// Add these imports at the top
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('./config/database');
const authRoutes = require('./routes/auth');
const { optionalAuth } = require('./middleware/auth');

// Import new feature modules
const { validateCompliance, complianceChecker } = require('./middleware/compliance');
const nlpRoutes = require('./routes/nlp');
const esignatureRoutes = require('./routes/esignature');
const templatesRoutes = require('./routes/templates');
const http = require('http');
const socketIo = require('socket.io');

// Import practice management routes
const clientsRoutes = require('./routes/clients');
const casesRoutes = require('./routes/cases');
const billingRoutes = require('./routes/billing');
const calendarRoutes = require('./routes/calendar');
const communicationsRoutes = require('./routes/communications');
const collaborationRoutes = require('./routes/collaboration');
const reportsRoutes = require('./routes/reports');

// Import advanced feature routes
const clientPortalRoutes = require('./routes/client-portal');
const paymentsRoutes = require('./routes/payments');
const trustAccountingRoutes = require('./routes/trust-accounting');
const conflictsRoutes = require('./routes/conflicts');
const twoFactorRoutes = require('./routes/two-factor');
const aiDraftingRoutes = require('./routes/ai-drafting');
const calendarSyncRoutes = require('./routes/calendar-sync');
const leadsRoutes = require('./routes/leads');
const ocrRoutes = require('./routes/ocr');
//add

require('dotenv').config();

// Debug: Check if .env file is loaded
console.log('=== Environment Variables Check ===');
console.log('OPENROUTER_API_KEY loaded:', !!process.env.OPENROUTER_API_KEY);
console.log('OPENROUTER_MODEL loaded:', process.env.OPENROUTER_MODEL || 'not set');
console.log('PORT loaded:', process.env.PORT || 'using default 3000');
console.log('===================================');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3000;

// Initialize template engines
const templateEngine = new LegalTemplateEngine();
const aiTemplateEngine = new AITemplateEngine();

app.set('trust proxy', 1);

// Make io available to routes
app.set('io', io);

// Security middleware with relaxed CSP for development
// Enable compression for better performance (skip CSV downloads)
app.use(compression({
    filter: (req, res) => {
        // Don't compress CSV exports - they need to download properly
        if (req.path.includes('export-csv')) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://cdn.jsdelivr.net",
        "https://code.jquery.com",
        "https://cdnjs.cloudflare.com",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "blob:"
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
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
      connectSrc: ["'self'", "https://www.google-analytics.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "wss:", "ws:", "blob:"]
    }
  }
}));
app.use(cors());

// Rate limiting - more permissive for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  skip: (req) => req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/images')
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// File upload middleware (exclude routes that use multer)
app.use((req, res, next) => {
  // Skip fileUpload for OCR routes which use multer
  if (req.path.startsWith('/ocr') || req.path.startsWith('/api/ocr')) {
    return next();
  }
  fileUpload()(req, res, next);
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//add
// Add session configuration after existing middleware
app.use(session({
    store: new pgSession({
        pool: db,
        tableName: 'user_sessions'
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Add optional auth middleware to all routes
app.use(optionalAuth);

// Add auth routes
app.use('/', authRoutes);

// Add new feature routes AFTER session and auth setup
app.use('/api/nlp', nlpRoutes);
app.use('/api/esignature', esignatureRoutes);
app.use('/api/templates', templatesRoutes);

// Register practice management routes
app.use('/', clientsRoutes);
app.use('/', casesRoutes);
app.use('/', billingRoutes);
app.use('/', calendarRoutes);
app.use('/', communicationsRoutes);
app.use('/', collaborationRoutes);
app.use('/', reportsRoutes);

// Advanced feature routes
app.use('/', clientPortalRoutes);
app.use('/', paymentsRoutes);
app.use('/', trustAccountingRoutes);
app.use('/', conflictsRoutes);
app.use('/', twoFactorRoutes);
app.use('/', aiDraftingRoutes);
app.use('/', calendarSyncRoutes);
app.use('/', leadsRoutes);
app.use('/', ocrRoutes);

// Debug: Log registered routes
console.log('Registered API routes:');
console.log('- /api/nlp/*');
console.log('- /api/esignature/*');
console.log('- /api/templates/*');
console.log('- /api/clients/*');
console.log('- /api/cases/*');
console.log('- /api/billing/*');
console.log('- /api/calendar/*');
console.log('- /api/communications/*');
console.log('- /api/collaboration/*');
console.log('- /api/reports/*');
//add

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
  // Debug environment variables
  console.log('Environment check:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('OPENROUTER_API_KEY exists:', !!process.env.OPENROUTER_API_KEY);
  console.log('OPENROUTER_API_KEY length:', process.env.OPENROUTER_API_KEY?.length);
  console.log('OPENROUTER_MODEL:', process.env.OPENROUTER_MODEL);
  
  // Check if API key is configured and clean
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY environment variable is not set or empty');
    console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('OPENROUTER')));
    throw new Error('AI service is not configured. Please contact support.');
  }

  // Validate API key format
  if (!apiKey.startsWith('sk-or-v1-')) {
    console.error('Invalid OpenRouter API key format. Key starts with:', apiKey.substring(0, 10));
    throw new Error('AI service configuration error. Please contact support.');
  }
  
  console.log('API key validation passed. Key starts with:', apiKey.substring(0, 10));

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
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
        'X-Title': 'Legal Forms Generator'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating document:', error.response?.data || error.message);
    
    // Provide more specific error messages
    if (error.response?.status === 401) {
      throw new Error('AI service authentication failed. Please check your API key configuration.');
    } else if (error.response?.status === 429) {
      throw new Error('AI service is temporarily busy. Please try again in a moment.');
    } else if (error.response?.status >= 500) {
      throw new Error('AI service is temporarily unavailable. Please try again later.');
    } else {
      throw new Error('Failed to generate document using AI. Please try again.');
    }
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
      // Basic LLC Information
      { name: 'llc_name', label: 'Exact LLC Name (as it will appear on filing)', type: 'text', required: true, placeholder: 'Example: ABC Consulting Services, LLC' },
      { name: 'alternate_names', label: 'Alternative Names or DBAs', type: 'textarea', required: false, placeholder: 'List any alternate names or "doing business as" names' },
      { name: 'state_formation', label: 'State of Formation', type: 'select', options: ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'], required: true },
      { name: 'county_formation', label: 'County of Formation', type: 'text', required: true, placeholder: 'County where LLC is being formed' },
      
      // Detailed Business Purpose
      { name: 'business_purpose', label: 'Detailed Business Purpose and Activities', type: 'textarea', required: true, placeholder: 'Describe in detail what your LLC will do, including all business activities, services, products, and any specific industry focus' },
      { name: 'naics_code', label: 'NAICS Industry Code (if known)', type: 'text', required: false, placeholder: 'North American Industry Classification System code' },
      { name: 'business_classification', label: 'Business Classification', type: 'select', options: ['Professional Services', 'Retail Trade', 'Manufacturing', 'Construction', 'Real Estate', 'Technology', 'Healthcare', 'Food Service', 'Transportation', 'Other'], required: true },
      { name: 'special_licenses', label: 'Special Licenses or Permits Required', type: 'textarea', required: false, placeholder: 'List any professional licenses, permits, or certifications required for your business' },
      
      // Registered Agent Information
      { name: 'registered_agent_type', label: 'Registered Agent Type', type: 'select', options: ['Individual', 'Professional Service Company', 'Member of LLC'], required: true },
      { name: 'registered_agent', label: 'Registered Agent Full Legal Name', type: 'text', required: true },
      { name: 'agent_address_street', label: 'Registered Agent Street Address', type: 'text', required: true, placeholder: 'Street address (no P.O. boxes)' },
      { name: 'agent_address_city', label: 'Registered Agent City', type: 'text', required: true },
      { name: 'agent_address_state', label: 'Registered Agent State', type: 'text', required: true },
      { name: 'agent_address_zip', label: 'Registered Agent ZIP Code', type: 'text', required: true },
      { name: 'agent_phone', label: 'Registered Agent Phone Number', type: 'tel', required: true },
      { name: 'agent_email', label: 'Registered Agent Email', type: 'email', required: false },
      { name: 'agent_consent', label: 'Registered Agent Consent', type: 'select', options: ['Yes - Agent has consented to serve', 'No - Need to obtain consent'], required: true },
      
      // Management Structure
      { name: 'management_type', label: 'Management Structure', type: 'select', options: ['Member-Managed', 'Manager-Managed'], required: true },
      { name: 'management_details', label: 'Management Structure Details', type: 'textarea', required: true, placeholder: 'Explain how the LLC will be managed, who has authority to make decisions, and voting procedures' },
      
      // Member Information
      { name: 'number_of_members', label: 'Total Number of Initial Members', type: 'number', required: true, min: 1 },
      { name: 'member1_name', label: 'Member 1 - Full Legal Name', type: 'text', required: true },
      { name: 'member1_address', label: 'Member 1 - Complete Address', type: 'textarea', required: true },
      { name: 'member1_ownership', label: 'Member 1 - Ownership Percentage', type: 'number', required: true, min: 0, max: 100 },
      { name: 'member1_contribution', label: 'Member 1 - Initial Capital Contribution', type: 'textarea', required: true, placeholder: 'Describe cash, property, or services contributed' },
      { name: 'member1_ssn', label: 'Member 1 - SSN or Tax ID', type: 'text', required: false, placeholder: 'For tax reporting purposes' },
      
      { name: 'member2_name', label: 'Member 2 - Full Legal Name (if applicable)', type: 'text', required: false },
      { name: 'member2_address', label: 'Member 2 - Complete Address', type: 'textarea', required: false },
      { name: 'member2_ownership', label: 'Member 2 - Ownership Percentage', type: 'number', required: false, min: 0, max: 100 },
      { name: 'member2_contribution', label: 'Member 2 - Initial Capital Contribution', type: 'textarea', required: false },
      { name: 'member2_ssn', label: 'Member 2 - SSN or Tax ID', type: 'text', required: false },
      
      { name: 'additional_members', label: 'Additional Members (if more than 2)', type: 'textarea', required: false, placeholder: 'List additional members with names, addresses, ownership percentages, and contributions' },
      
      // Manager Information (if Manager-Managed)
      { name: 'manager1_name', label: 'Manager 1 - Full Legal Name (if Manager-Managed)', type: 'text', required: false },
      { name: 'manager1_address', label: 'Manager 1 - Complete Address', type: 'textarea', required: false },
      { name: 'manager1_title', label: 'Manager 1 - Title/Position', type: 'text', required: false, placeholder: 'e.g., Managing Member, General Manager' },
      { name: 'manager_powers', label: 'Manager Powers and Authority', type: 'textarea', required: false, placeholder: 'Describe the scope of authority granted to managers' },
      
      // Organizer Information
      { name: 'organizer_name', label: 'Organizer Full Legal Name', type: 'text', required: true },
      { name: 'organizer_address', label: 'Organizer Complete Address', type: 'textarea', required: true },
      { name: 'organizer_phone', label: 'Organizer Phone Number', type: 'tel', required: true },
      { name: 'organizer_email', label: 'Organizer Email Address', type: 'email', required: true },
      { name: 'organizer_title', label: 'Organizer Title/Position', type: 'text', required: false, placeholder: 'e.g., Attorney, Incorporator, Member' },
      { name: 'organizer_relationship', label: 'Organizer Relationship to LLC', type: 'select', options: ['Member', 'Attorney', 'Professional Service', 'Other'], required: true },
      
      // Business Operations
      { name: 'principal_office_street', label: 'Principal Office Street Address', type: 'text', required: true },
      { name: 'principal_office_city', label: 'Principal Office City', type: 'text', required: true },
      { name: 'principal_office_state', label: 'Principal Office State', type: 'text', required: true },
      { name: 'principal_office_zip', label: 'Principal Office ZIP Code', type: 'text', required: true },
      { name: 'mailing_address_different', label: 'Is Mailing Address Different?', type: 'select', options: ['No - Same as Principal Office', 'Yes - Different Address'], required: true },
      { name: 'mailing_address', label: 'Mailing Address (if different)', type: 'textarea', required: false },
      
      // Financial and Tax Information
      { name: 'initial_capital', label: 'Total Initial Capital Investment', type: 'number', required: true, placeholder: 'Total amount of initial investment' },
      { name: 'capital_structure', label: 'Capital Structure Details', type: 'textarea', required: true, placeholder: 'Describe how capital contributions are structured (cash, property, services, etc.)' },
      { name: 'tax_election', label: 'Federal Tax Election', type: 'select', options: ['Default (Partnership/Disregarded Entity)', 'S-Corporation Election', 'C-Corporation Election'], required: true },
      { name: 'fiscal_year_end', label: 'Fiscal Year End', type: 'select', options: ['December 31', 'January 31', 'February 28', 'March 31', 'April 30', 'May 31', 'June 30', 'July 31', 'August 31', 'September 30', 'October 31', 'November 30'], required: true },
      
      // Duration and Dissolution
      { name: 'duration', label: 'Duration of LLC', type: 'select', options: ['Perpetual', 'Specific Date', 'Specific Event'], required: true },
      { name: 'duration_date', label: 'Dissolution Date (if applicable)', type: 'date', required: false },
      { name: 'dissolution_events', label: 'Dissolution Events', type: 'textarea', required: false, placeholder: 'Describe specific events that would cause dissolution' },
      
      // Filing Information
      { name: 'effective_date', label: 'Requested Effective Date', type: 'date', required: true },
      { name: 'expedited_filing', label: 'Expedited Filing Requested?', type: 'select', options: ['No - Standard Processing', 'Yes - Expedited (Additional Fee)'], required: true },
      { name: 'filing_fee', label: 'Expected Filing Fee Amount', type: 'number', required: false, placeholder: 'State filing fee amount' },
      
      // Additional Provisions
      { name: 'operating_agreement', label: 'Operating Agreement Status', type: 'select', options: ['Will be created separately', 'Included with Articles', 'Not needed at this time'], required: true },
      { name: 'special_provisions', label: 'Special Provisions or Restrictions', type: 'textarea', required: false, placeholder: 'Any special provisions, restrictions, or requirements to include in the Articles' },
      { name: 'professional_llc', label: 'Is this a Professional LLC (PLLC)?', type: 'select', options: ['No', 'Yes - Professional Services'], required: true },
      { name: 'professional_license', label: 'Professional License Information (if PLLC)', type: 'textarea', required: false, placeholder: 'Describe professional licenses held by members' },
      
      // Contact and Service Information
      { name: 'contact_person', label: 'Primary Contact Person', type: 'text', required: true },
      { name: 'contact_phone', label: 'Primary Contact Phone', type: 'tel', required: true },
      { name: 'contact_email', label: 'Primary Contact Email', type: 'email', required: true },
      { name: 'preferred_communication', label: 'Preferred Communication Method', type: 'select', options: ['Email', 'Phone', 'Mail', 'Text'], required: true },
      
      // Legal and Compliance
      { name: 'foreign_qualification', label: 'Will LLC operate in other states?', type: 'select', options: ['No - Only in formation state', 'Yes - Will need foreign qualification'], required: true },
      { name: 'other_states', label: 'Other States of Operation', type: 'textarea', required: false, placeholder: 'List states where LLC will conduct business' },
      { name: 'regulatory_compliance', label: 'Special Regulatory Requirements', type: 'textarea', required: false, placeholder: 'Any industry-specific regulations or compliance requirements' },
      { name: 'insurance_requirements', label: 'Insurance Requirements', type: 'textarea', required: false, placeholder: 'Professional liability, general liability, or other required insurance' }
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
      { name: 'buyer_name', label: 'Buyer Full Legal Name', type: 'text', required: true },
      { name: 'buyer_address', label: 'Buyer Complete Address', type: 'textarea', required: true },
      { name: 'buyer_phone', label: 'Buyer Phone Number', type: 'tel', required: true },
      { name: 'buyer_email', label: 'Buyer Email Address', type: 'email', required: true },
      { name: 'seller_name', label: 'Seller Full Legal Name', type: 'text', required: true },
      { name: 'seller_address', label: 'Seller Complete Address', type: 'textarea', required: true },
      { name: 'seller_phone', label: 'Seller Phone Number', type: 'tel', required: true },
      { name: 'seller_email', label: 'Seller Email Address', type: 'email', required: true },
      { name: 'property_address', label: 'Complete Property Address', type: 'textarea', required: true, placeholder: 'Include street address, city, state, ZIP code' },
      { name: 'legal_description', label: 'Legal Property Description', type: 'textarea', required: true, placeholder: 'Legal description from deed or survey' },
      { name: 'property_type', label: 'Property Type', type: 'select', options: ['Single Family Home', 'Condominium', 'Townhouse', 'Multi-Family', 'Commercial', 'Vacant Land', 'Other'], required: true },
      { name: 'purchase_price', label: 'Total Purchase Price ($)', type: 'number', required: true },
      { name: 'earnest_money', label: 'Earnest Money Deposit ($)', type: 'number', required: true },
      { name: 'down_payment', label: 'Down Payment Amount ($)', type: 'number', required: true },
      { name: 'financing_amount', label: 'Loan/Financing Amount ($)', type: 'number', required: false },
      { name: 'closing_date', label: 'Proposed Closing Date', type: 'date', required: true },
      { name: 'possession_date', label: 'Possession Date', type: 'date', required: true },
      { name: 'financing_contingency', label: 'Financing Contingency Period (days)', type: 'number', required: true },
      { name: 'inspection_contingency', label: 'Inspection Contingency Period (days)', type: 'number', required: true },
      { name: 'appraisal_contingency', label: 'Appraisal Contingency Period (days)', type: 'number', required: true },
      { name: 'title_company', label: 'Title Company/Closing Agent', type: 'text', required: false },
      { name: 'real_estate_agent_buyer', label: 'Buyer\'s Real Estate Agent', type: 'text', required: false },
      { name: 'real_estate_agent_seller', label: 'Seller\'s Real Estate Agent', type: 'text', required: false },
      { name: 'included_items', label: 'Items Included in Sale', type: 'textarea', required: false, placeholder: 'List appliances, fixtures, and other items included' },
      { name: 'excluded_items', label: 'Items Excluded from Sale', type: 'textarea', required: false, placeholder: 'List any items specifically excluded' },
      { name: 'special_conditions', label: 'Special Conditions or Contingencies', type: 'textarea', required: false, placeholder: 'Any additional terms or conditions' }
    ],
    lease_agreement: [
      ...baseFields,
      { name: 'landlord_name', label: 'Landlord Full Legal Name', type: 'text', required: true },
      { name: 'landlord_address', label: 'Landlord Mailing Address', type: 'textarea', required: true },
      { name: 'landlord_phone', label: 'Landlord Phone Number', type: 'tel', required: true },
      { name: 'landlord_email', label: 'Landlord Email Address', type: 'email', required: true },
      { name: 'tenant_name', label: 'Tenant Full Legal Name', type: 'text', required: true },
      { name: 'tenant_phone', label: 'Tenant Phone Number', type: 'tel', required: true },
      { name: 'tenant_email', label: 'Tenant Email Address', type: 'email', required: true },
      { name: 'additional_tenants', label: 'Additional Tenants/Occupants', type: 'textarea', required: false, placeholder: 'List all other adults who will live in the property' },
      { name: 'property_address', label: 'Complete Rental Property Address', type: 'textarea', required: true, placeholder: 'Include unit number if applicable' },
      { name: 'property_type', label: 'Property Type', type: 'select', options: ['Apartment', 'House', 'Condominium', 'Townhouse', 'Room', 'Other'], required: true },
      { name: 'furnished_status', label: 'Furnished Status', type: 'select', options: ['Unfurnished', 'Partially Furnished', 'Fully Furnished'], required: true },
      { name: 'monthly_rent', label: 'Monthly Rent Amount ($)', type: 'number', required: true },
      { name: 'rent_due_date', label: 'Rent Due Date Each Month', type: 'number', required: true, placeholder: 'Day of month (1-31)' },
      { name: 'late_fee', label: 'Late Fee Amount ($)', type: 'number', required: false },
      { name: 'grace_period', label: 'Grace Period for Late Payment (days)', type: 'number', required: false },
      { name: 'security_deposit', label: 'Security Deposit Amount ($)', type: 'number', required: true },
      { name: 'pet_deposit', label: 'Pet Deposit Amount ($)', type: 'number', required: false },
      { name: 'lease_start', label: 'Lease Start Date', type: 'date', required: true },
      { name: 'lease_end', label: 'Lease End Date', type: 'date', required: true },
      { name: 'lease_term_months', label: 'Lease Term (months)', type: 'number', required: true },
      { name: 'renewal_option', label: 'Automatic Renewal Option', type: 'select', options: ['No automatic renewal', 'Month-to-month after term', 'Annual renewal option'], required: true },
      { name: 'utilities_included', label: 'Utilities Included in Rent', type: 'textarea', required: false, placeholder: 'List which utilities are included (water, electric, gas, internet, etc.)' },
      { name: 'utilities_tenant', label: 'Utilities Paid by Tenant', type: 'textarea', required: false, placeholder: 'List which utilities tenant is responsible for' },
      { name: 'parking_included', label: 'Parking Included', type: 'select', options: ['No parking', '1 space', '2 spaces', '3+ spaces', 'Street parking only'], required: true },
      { name: 'pets_allowed', label: 'Pet Policy', type: 'select', options: ['No pets allowed', 'Cats only', 'Dogs only', 'Cats and dogs allowed', 'All pets allowed with approval'], required: true },
      { name: 'smoking_policy', label: 'Smoking Policy', type: 'select', options: ['No smoking anywhere', 'Smoking allowed outside only', 'Smoking allowed'], required: true },
      { name: 'maintenance_responsibilities', label: 'Tenant Maintenance Responsibilities', type: 'textarea', required: false, placeholder: 'Describe what maintenance tasks tenant is responsible for' },
      { name: 'house_rules', label: 'House Rules and Restrictions', type: 'textarea', required: false, placeholder: 'Any specific rules about noise, guests, use of property, etc.' }
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
      { name: 'testator_name', label: 'Testator Full Legal Name', type: 'text', required: true },
      { name: 'testator_address', label: 'Testator Complete Address', type: 'textarea', required: true },
      { name: 'testator_ssn', label: 'Testator Social Security Number', type: 'text', required: false, placeholder: 'Optional - for identification purposes' },
      { name: 'testator_birthdate', label: 'Testator Date of Birth', type: 'date', required: true },
      { name: 'marital_status', label: 'Marital Status', type: 'select', options: ['Single', 'Married', 'Divorced', 'Widowed', 'Separated'], required: true },
      { name: 'spouse_name', label: 'Spouse Full Legal Name', type: 'text', required: false },
      { name: 'spouse_address', label: 'Spouse Address (if different)', type: 'textarea', required: false },
      { name: 'children_info', label: 'Children Information', type: 'textarea', required: false, placeholder: 'List all children with full names, birthdates, and addresses' },
      { name: 'primary_beneficiaries', label: 'Primary Beneficiaries', type: 'textarea', required: true, placeholder: 'List beneficiaries with their relationship to you and percentage of inheritance' },
      { name: 'contingent_beneficiaries', label: 'Contingent Beneficiaries', type: 'textarea', required: false, placeholder: 'Backup beneficiaries if primary beneficiaries cannot inherit' },
      { name: 'executor_name', label: 'Primary Executor Full Name', type: 'text', required: true },
      { name: 'executor_address', label: 'Primary Executor Address', type: 'textarea', required: true },
      { name: 'executor_phone', label: 'Primary Executor Phone', type: 'tel', required: true },
      { name: 'alternate_executor', label: 'Alternate Executor Name', type: 'text', required: false },
      { name: 'alternate_executor_address', label: 'Alternate Executor Address', type: 'textarea', required: false },
      { name: 'guardian_minors', label: 'Guardian for Minor Children', type: 'text', required: false },
      { name: 'guardian_address', label: 'Guardian Address', type: 'textarea', required: false },
      { name: 'alternate_guardian', label: 'Alternate Guardian for Minors', type: 'text', required: false },
      { name: 'real_estate_assets', label: 'Real Estate Assets', type: 'textarea', required: false, placeholder: 'List all real estate properties with addresses and approximate values' },
      { name: 'financial_assets', label: 'Financial Assets', type: 'textarea', required: false, placeholder: 'Bank accounts, investments, retirement accounts, etc.' },
      { name: 'personal_property', label: 'Significant Personal Property', type: 'textarea', required: false, placeholder: 'Vehicles, jewelry, artwork, collections, etc.' },
      { name: 'business_interests', label: 'Business Interests', type: 'textarea', required: false, placeholder: 'Ownership in businesses, partnerships, etc.' },
      { name: 'specific_bequests', label: 'Specific Bequests', type: 'textarea', required: false, placeholder: 'Specific items or amounts to be given to particular people' },
      { name: 'charitable_bequests', label: 'Charitable Bequests', type: 'textarea', required: false, placeholder: 'Donations to charities or organizations' },
      { name: 'funeral_instructions', label: 'Funeral and Burial Instructions', type: 'textarea', required: false, placeholder: 'Preferences for funeral arrangements, burial, or cremation' },
      { name: 'special_instructions', label: 'Special Instructions', type: 'textarea', required: false, placeholder: 'Any other specific wishes or instructions' }
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

// SEO helper function to generate page metadata
function generatePageMeta(page, formType = null) {
  const baseUrl = process.env.SITE_URL || 'https://legalaiforms.com';
  
  const pageMeta = {
    home: {
      title: 'Legal Forms Generator - AI-Powered Legal Documents | LegalFormsAI',
      description: 'Generate professional legal documents instantly with AI. Business formation, real estate contracts, family law, estate planning & more. Trusted by 10,000+ users.',
      keywords: 'legal forms generator, AI legal documents, business formation documents, real estate contracts, family law forms, estate planning documents',
      canonical: baseUrl + '/'
    },
    business_formation: {
      title: 'Business Formation Documents - LLC & Corporation Forms | LegalFormsAI',
      description: 'Create LLC articles, corporation bylaws, operating agreements & more. AI-generated business formation documents with state-specific compliance.',
      keywords: 'LLC formation, corporation documents, business formation, articles of incorporation, operating agreement, business bylaws',
      canonical: baseUrl + '/form/business_formation'
    },
    real_estate: {
      title: 'Real Estate Legal Forms - Purchase Agreements & Contracts | LegalFormsAI',
      description: 'Generate real estate purchase agreements, lease contracts, property deeds & disclosure forms. Professional real estate legal documents.',
      keywords: 'real estate contracts, purchase agreement, lease agreement, property deed, real estate forms',
      canonical: baseUrl + '/form/real_estate'
    },
    family_law: {
      title: 'Family Law Documents - Divorce, Custody & Legal Forms | LegalFormsAI',
      description: 'Create divorce petitions, custody agreements, prenuptial agreements & family law documents. State-compliant family legal forms.',
      keywords: 'divorce petition, custody agreement, family law forms, prenuptial agreement, legal separation',
      canonical: baseUrl + '/form/family_law'
    },
    estate_planning: {
      title: 'Estate Planning Documents - Wills, Trusts & Legal Forms | LegalFormsAI',
      description: 'Generate last wills, living trusts, power of attorney & healthcare directives. Professional estate planning legal documents.',
      keywords: 'last will testament, living trust, power of attorney, estate planning, healthcare directive',
      canonical: baseUrl + '/form/estate_planning'
    },
    contact: {
      title: 'Contact LegalFormsAI - Legal Document Generation Support',
      description: 'Contact our legal document generation experts. Get help with AI-powered legal forms, business documents, and professional legal templates.',
      keywords: 'legal forms support, contact legal AI, legal document help',
      canonical: baseUrl + '/contact'
    }
  };
  
  return pageMeta[formType || page] || pageMeta.home;
}

// Routes
app.get('/', (req, res) => {
  // Redirect to login if not authenticated
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }

  // Redirect to dashboard if authenticated
  res.redirect('/dashboard');
});

// Dashboard route - redirect to practice management
app.get('/dashboard', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  // Redirect to practice management clients page
  res.redirect('/clients');
});

app.get('/home', (req, res) => {
  res.redirect('/');
});

app.get('/services', (req, res) => {
  res.render('index', {
    formTypes: FORM_TYPES,
    title: 'Legal Forms Generator - Services',
    req: req,
    user: req.session ? req.session.userId : null
  });
});

app.get('/features', (req, res) => {
  res.render('index', {
    formTypes: FORM_TYPES,
    title: 'Legal Forms Generator - Features',
    req: req,
    user: req.session ? req.session.userId : null
  });
});

app.get('/about', (req, res) => {
  res.render('about', { 
    title: 'About LegalFormsAI - Professional Legal Document Generation',
    description: 'Learn about LegalFormsAI\'s mission to democratize legal document creation through AI technology. Trusted by attorneys, businesses, and individuals nationwide.',
    keywords: 'about legal forms AI, legal document automation, AI legal technology, professional legal services',
    canonical: process.env.SITE_URL + '/about' || 'https://legalaiforms.com/about',
    req: req
  });
});

app.get('/faq', (req, res) => {
  res.render('faq', { 
    title: 'FAQ - Legal Forms Generator | LegalFormsAI',
    description: 'Frequently asked questions about LegalFormsAI\'s legal document generation service. Get answers about pricing, legal compliance, document formats, and more.',
    keywords: 'legal forms FAQ, legal document questions, AI legal help, legal template questions',
    canonical: process.env.SITE_URL + '/faq' || 'https://legalaiforms.com/faq',
    req: req
  });
});

app.get('/contact', (req, res) => {
  const meta = generatePageMeta('contact');
  res.render('contact', { 
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    canonical: meta.canonical,
    req: req
  });
});

// Legal pages routes
app.get('/privacy', (req, res) => {
  res.render('privacy', { 
    title: 'Privacy Policy - LegalFormsAI',
    description: 'LegalFormsAI Privacy Policy - Learn how we collect, use, and protect your personal information when using our legal document generation service.',
    keywords: 'privacy policy, data protection, legal forms privacy, personal information',
    canonical: process.env.SITE_URL + '/privacy' || 'https://legalaiforms.com/privacy',
    req: req
  });
});

app.get('/terms', (req, res) => {
  res.render('terms', { 
    title: 'Terms of Service - LegalFormsAI',
    description: 'LegalFormsAI Terms of Service - Read our terms and conditions for using our AI-powered legal document generation platform.',
    keywords: 'terms of service, terms and conditions, legal forms terms, user agreement',
    canonical: process.env.SITE_URL + '/terms' || 'https://legalaiforms.com/terms',
    req: req
  });
});

app.get('/disclaimer', (req, res) => {
  res.render('disclaimer', { 
    title: 'Legal Disclaimer - LegalFormsAI',
    description: 'LegalFormsAI Legal Disclaimer - Important information about the limitations and proper use of our legal document generation service.',
    keywords: 'legal disclaimer, limitations, legal advice disclaimer, document templates',
    canonical: process.env.SITE_URL + '/disclaimer' || 'https://legalaiforms.com/disclaimer',
    req: req
  });
});

app.get('/cookies', (req, res) => {
  res.render('cookies', { 
    title: 'Cookie Policy - LegalFormsAI',
    description: 'LegalFormsAI Cookie Policy - Learn about how we use cookies and similar technologies to improve your experience on our website.',
    keywords: 'cookie policy, cookies, tracking, website analytics, user experience',
    canonical: process.env.SITE_URL + '/cookies' || 'https://legalaiforms.com/cookies',
    req: req
  });
});

// SEO Routes
app.get('/sitemap.xml', async (req, res) => {
  try {
    const sitemap = new SitemapStream({ hostname: process.env.SITE_URL || 'https://legalaiforms.com' });
    
    // Add static pages
    sitemap.write({ url: '/', changefreq: 'weekly', priority: 1.0 });
    sitemap.write({ url: '/about', changefreq: 'monthly', priority: 0.8 });
    sitemap.write({ url: '/faq', changefreq: 'monthly', priority: 0.8 });
    sitemap.write({ url: '/contact', changefreq: 'monthly', priority: 0.8 });
    sitemap.write({ url: '/privacy', changefreq: 'yearly', priority: 0.6 });
    sitemap.write({ url: '/terms', changefreq: 'yearly', priority: 0.6 });
    sitemap.write({ url: '/disclaimer', changefreq: 'yearly', priority: 0.6 });
    sitemap.write({ url: '/cookies', changefreq: 'yearly', priority: 0.6 });
    
    // Add form pages
    Object.keys(FORM_TYPES).forEach(formType => {
      sitemap.write({ 
        url: `/form/${formType}`, 
        changefreq: 'monthly', 
        priority: 0.9 
      });
    });
    
    sitemap.end();
    
    const sitemapXML = await streamToPromise(sitemap);
    res.header('Content-Type', 'application/xml');
    res.send(sitemapXML.toString());
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

app.get('/robots.txt', (req, res) => {
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /uploads/
Disallow: /api/
Disallow: /download/

Sitemap: ${process.env.SITE_URL || 'https://legalaiforms.com'}/sitemap.xml`;
  
  res.type('text/plain');
  res.send(robotsTxt);
});

app.get('/form/:formType', (req, res) => {
  const formType = req.params.formType;
  
  if (!FORM_TYPES[formType]) {
    return res.status(404).render('404');
  }

  const formConfig = FORM_TYPES[formType];
  const meta = generatePageMeta('form', formType);
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": formConfig.name,
    "description": formConfig.description,
    "provider": {
      "@type": "Organization",
      "name": "LegalFormsAI"
    },
    "serviceType": "Legal Document Generation",
    "areaServed": "United States"
  };
  
  res.render('form', { 
    formType, 
    formConfig,
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    canonical: meta.canonical,
    structuredData: structuredData,
    req: req
  });
});

// Clean document content for different formats
function cleanDocumentContent(content, format) {
  let cleanedContent = content;
  
  if (format === 'pdf' || format === 'docx') {
    // Remove markdown-style formatting for professional documents while preserving line breaks
    
    // Convert **text** to plain text but preserve the content structure
    cleanedContent = cleanedContent.replace(/\*\*(.*?)\*\*/g, '$1');
    
    // Remove ### headers but keep the text and add line break after
    cleanedContent = cleanedContent.replace(/^### (.*$)/gm, '$1\n');
    cleanedContent = cleanedContent.replace(/^## (.*$)/gm, '$1\n');
    cleanedContent = cleanedContent.replace(/^# (.*$)/gm, '$1\n');
    
    // Convert horizontal rules (---) to line breaks
    cleanedContent = cleanedContent.replace(/^---+$/gm, '\n');
    
    // Preserve important line breaks - add extra line break after colons and important sections
    cleanedContent = cleanedContent.replace(/^(.*?:)\s*$/gm, '$1\n');
    
    // Clean up excessive whitespace but preserve intentional spacing
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
  
  // Convert ### to h3, ## to h2, # to h1 with proper spacing
  htmlContent = htmlContent.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  htmlContent = htmlContent.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  htmlContent = htmlContent.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  
  // Convert --- to horizontal rules
  htmlContent = htmlContent.replace(/^---+$/gm, '<hr>');
  
  // Handle multi-line field values (like addresses) - process before single line fields
  // Look for pattern: Label:\nValue1\nValue2\n etc.
  htmlContent = htmlContent.replace(/^([A-Z][^:]*:)\s*\n((?:(?!^[A-Z][^:]*:)[^\n]+\n?)+)/gm, function(match, label, value) {
    const cleanValue = value.trim().replace(/\n/g, '<br>');
    return `<p class="field-line"><strong>${label}</strong><br>${cleanValue}</p>`;
  });
  
  // Handle single-line field values (like "Phone: (804) 360-1129")
  htmlContent = htmlContent.replace(/^([A-Z][^:]*:)\s*(.+)$/gm, '<p class="field-line"><strong>$1</strong> $2</p>');
  
  // Handle labels without values (like "Address:" on its own line) - only if not already processed
  htmlContent = htmlContent.replace(/^([A-Z][^:]*:)\s*$/gm, '<p class="field-label"><strong>$1</strong></p>');
  
  // Convert double line breaks to paragraph breaks
  htmlContent = htmlContent.replace(/\n\n/g, '</p><p>');
  
  // Convert remaining single line breaks to <br> tags
  htmlContent = htmlContent.replace(/\n/g, '<br>');
  
  // Wrap remaining content in paragraphs
  htmlContent = '<p>' + htmlContent + '</p>';
  
  // Clean up empty paragraphs and fix nested tags
  htmlContent = htmlContent.replace(/<p><\/p>/g, '');
  htmlContent = htmlContent.replace(/<p>\s*<\/p>/g, '');
  htmlContent = htmlContent.replace(/<p>(<h[1-6]>.*?<\/h[1-6]>)<\/p>/g, '$1');
  htmlContent = htmlContent.replace(/<p>(<hr>)<\/p>/g, '$1');
  htmlContent = htmlContent.replace(/<p>(<p class="field-line">.*?<\/p>)<\/p>/g, '$1');
  htmlContent = htmlContent.replace(/<p>(<p class="field-label">.*?<\/p>)<\/p>/g, '$1');
  
  return htmlContent;
}

// Modified generatePDF function that saves to file AND returns filename
async function generatePDF(content, filename) {
  const cleanedContent = cleanDocumentContent(content, 'pdf');
  const htmlFormattedContent = convertToHTML(cleanedContent);
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Legal Document</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1, h2, h3 { color: #333; margin-top: 30px; }
        p { margin-bottom: 15px; }
        .signature-line { border-bottom: 1px solid #000; width: 300px; margin: 20px 0; }
      </style>
    </head>
    <body>
      ${htmlFormattedContent}
      <div style="margin-top: 50px;">
        <p><strong>Signature:</strong></p>
        <div class="signature-line"></div>
        <p>Date: _______________</p>
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });
    
    // Fix: Use only the filename, not full path
    const safeFilename = path.basename(filename);
    const fullPath = path.join(__dirname, 'uploads', safeFilename);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    // Write the PDF buffer to file
    await fs.writeFile(fullPath, pdfBuffer);
    
    return fullPath;
    
  } finally {
    await browser.close();
  }
}


// Endpoint that works with file-based approach
app.post('/generate-pdf', async (req, res) => {
  try {
    const filename = `${formType}_${Date.now()}.pdf`;
    const filePath = await generatePDF(documentContent, filename);
    
    // Send file and optionally clean up
    res.download(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Optionally delete file after sending
      // fs.unlink(filePath).catch(console.error);
    });
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF document' });
  }
});


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
        // Add spacing after heading
        docx.createP();
      } else if (trimmedLine.startsWith('## ')) {
        // Sub heading
        const heading = docx.createP();
        heading.addText(trimmedLine.substring(3), { bold: true, font_size: 14 });
        // Add spacing after heading
        docx.createP();
      } else if (trimmedLine.startsWith('### ')) {
        // Sub-sub heading
        const heading = docx.createP();
        heading.addText(trimmedLine.substring(4), { bold: true, font_size: 12 });
        // Add spacing after heading
        docx.createP();
      } else if (trimmedLine.includes(':') && !trimmedLine.includes('**')) {
        // Handle field labels (like "Organizer: Name")
        const colonIndex = trimmedLine.indexOf(':');
        const label = trimmedLine.substring(0, colonIndex + 1);
        const value = trimmedLine.substring(colonIndex + 1).trim();
        
        const paragraph = docx.createP();
        paragraph.addText(label, { bold: true });
        if (value) {
          paragraph.addText(' ' + value);
        }
        // Add line break after field
        docx.createP();
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

// Enhanced document generation with compliance checking and review
app.post('/generate', validateCompliance, async (req, res) => {
  try {
    const { 
      form_type: formType, 
      specific_type: specificType, 
      form_data: userData, 
      format = 'txt',
      generation_mode = 'ai_summary' // 'ai_summary' or 'professional_template'
    } = req.body;

    if (!FORM_TYPES[formType]) {
      return res.status(400).json({ error: 'Invalid form type' });
    }

    // Validate format
    const allowedFormats = ['txt', 'pdf', 'docx'];
    if (!allowedFormats.includes(format)) {
      return res.status(400).json({ error: 'Invalid document format' });
    }

    // Check compliance validation results
    if (req.complianceValidation && !req.complianceValidation.isCompliant) {
      const highSeverityIssues = req.complianceValidation.issues.filter(issue => issue.severity === 'high');
      if (highSeverityIssues.length > 0) {
        return res.status(400).json({ 
          error: 'Compliance issues must be resolved before generating document',
          complianceIssues: req.complianceValidation.issues,
          suggestions: req.complianceValidation.suggestions
        });
      }
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

    let document;
    
    // Choose generation method based on user selection
    if (generation_mode === 'professional_template' && specificType) {
      // Use AI Template Engine with professional templates
      try {
        document = await aiTemplateEngine.generateDocument(formType, specificType, userData);
      } catch (error) {
        console.error('AI Template Engine error:', error);
        // Fallback to regular AI generation
        document = await generateDocument(formType, userData, specificType);
      }
    } else {
      // Use regular AI generation (original method)
      document = await generateDocument(formType, userData, specificType);
    }

    // Save generated document in requested format
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const documentType = specificType || formType;
    const baseFilename = `${documentType}_${timestamp}`;
    
    let filename, filepath;
    
    switch (format) {
      case 'pdf':
        filename = `${baseFilename}.pdf`;
        await generatePDF(document, filename );
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

    // Save to database if user is authenticated
    let documentId = null;
    if (req.user) {
      const docResult = await db.query(`
        INSERT INTO document_history (user_id, document_type, specific_type, title, content, form_data, file_format, file_path)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        req.user.id,
        formType,
        specificType,
        `${documentType}_${timestamp}`,
        document,
        JSON.stringify(userData),
        format,
        filename
      ]);
      documentId = docResult.rows[0].id;
    }

    // Perform automated review
    const reviewResults = await performDocumentReview(document, formType, userData);
    
    // Save review results if document was saved
    if (documentId && reviewResults) {
      await db.query(`
        INSERT INTO document_reviews (document_id, review_type, issues_found, suggestions, overall_score)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        documentId,
        'automated_review',
        JSON.stringify(reviewResults.issues),
        JSON.stringify(reviewResults.suggestions),
        reviewResults.score
      ]);
    }

    res.json({
      success: true,
      document: document,
      filename: filename,
      format: format,
      documentId: documentId,
      complianceValidation: req.complianceValidation,
      reviewResults: reviewResults
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
    formTypes: Object.keys(FORM_TYPES),
    envCheck: {
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      keyLength: process.env.OPENROUTER_API_KEY?.length || 0,
      model: process.env.OPENROUTER_MODEL || 'not set',
      nodeEnv: process.env.NODE_ENV || 'not set'
    }
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

// Real-time compliance checking endpoint
app.post('/api/compliance/validate', async (req, res) => {
  try {
    const { form_type, field_name, value, jurisdiction = 'US' } = req.body;
    
    const validation = complianceChecker.validateField(form_type, field_name, value, jurisdiction);
    
    res.json({
      success: true,
      ...validation
    });
  } catch (error) {
    console.error('Compliance validation error:', error);
    res.status(500).json({ error: 'Validation failed' });
  }
});

// Automated document review function
async function performDocumentReview(document, formType, userData) {
  try {
    const issues = [];
    const suggestions = [];
    let score = 1.0;

    // Check for missing critical information
    const criticalFields = ['client_name', 'client_address'];
    criticalFields.forEach(field => {
      if (!userData[field] || userData[field].trim() === '') {
        issues.push({
          type: 'missing_info',
          severity: 'high',
          field: field,
          message: `Missing critical information: ${field}`
        });
        score -= 0.2;
      }
    });

    // Check document length (too short might indicate incomplete generation)
    if (document.length < 500) {
      issues.push({
        type: 'completeness',
        severity: 'medium',
        message: 'Document appears to be unusually short'
      });
      score -= 0.1;
    }

    // Check for placeholder text that wasn't replaced
    const placeholders = document.match(/\[.*?\]/g);
    if (placeholders && placeholders.length > 0) {
      issues.push({
        type: 'incomplete_generation',
        severity: 'high',
        message: `Document contains unreplaced placeholders: ${placeholders.join(', ')}`
      });
      score -= 0.3;
    }

    // AI-powered risk assessment
    try {
      const riskPrompt = `
Review this legal document for potential risks or issues:

${document.substring(0, 2000)}...

Identify any:
1. Ambiguous language
2. Missing standard clauses
3. Potential legal risks
4. Inconsistencies

Return a JSON object with "risks" array and "suggestions" array.`;

      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: riskPrompt }],
        max_tokens: 1000,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      let aiResponseContent = response.data.choices[0].message.content;
      console.log (` aiResponseConten: ${aiResponseContent}`)
      
      // Remove markdown code blocks if present
      if (aiResponseContent.includes('```json')) {
        aiResponseContent = aiResponseContent.replace(/```json\s*/, '').replace(/\s*```$/, '');
      } else if (aiResponseContent.includes('```')) {
        aiResponseContent = aiResponseContent.replace(/```\s*/, '').replace(/\s*```$/, '');
      }
      
      const aiReview = JSON.parse(aiResponseContent.trim());
      if (aiReview.risks) {
        issues.push(...aiReview.risks.map(risk => ({
          type: 'ai_risk_assessment',
          severity: 'medium',
          message: risk
        })));
      }
      if (aiReview.suggestions) {
        suggestions.push(...aiReview.suggestions);
      }
    } catch (error) {
      console.error('AI review error:', error);
    }

    return {
      issues,
      suggestions,
      score: Math.max(score, 0)
    };
  } catch (error) {
    console.error('Document review error:', error);
    return null;
  }
}

// Socket.io for real-time features
io.on('connection', (socket) => {
  console.log('User connected for real-time features');
  
  // Real-time compliance checking
  socket.on('validate_field', async (data) => {
    try {
      const { form_type, field_name, value, jurisdiction } = data;
      const validation = complianceChecker.validateField(form_type, field_name, value, jurisdiction);
      socket.emit('validation_result', { field_name, ...validation });
    } catch (error) {
      socket.emit('validation_error', { field_name: data.field_name, error: 'Validation failed' });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Legal Forms Generator server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the application`);
  console.log('Real-time features enabled via Socket.io');
});

module.exports = app;
