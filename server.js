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
const passport = require('./config/passport');
const { seedDemoDataForUser } = require('./lib/seedUserDemoData');

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

// Import AI feature routes
const contractAnalysisRoutes = require('./routes/contract-analysis');
const documentSummaryRoutes = require('./routes/document-summary');
const aiBillingRoutes = require('./routes/ai-billing');
const aiConflictsRoutes = require('./routes/ai-conflicts');
const aiPredictionsRoutes = require('./routes/ai-predictions');
const voiceNotesRoutes = require('./routes/voice-notes');
const portalAIRoutes = require('./routes/portal-ai');
const aiCalendarRoutes = require('./routes/ai-calendar');
const citationFinderRoutes = require('./routes/citation-finder');
const aiCommunicationsRoutes = require('./routes/ai-communications');
const aiIntakeRoutes = require('./routes/ai-intake');

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
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    proxy: true
}));

// Initialize Passport for OAuth
app.use(passport.initialize());
app.use(passport.session());

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

// AI feature routes
app.use('/', contractAnalysisRoutes);
app.use('/', documentSummaryRoutes);
app.use('/', aiBillingRoutes);
app.use('/', aiConflictsRoutes);
app.use('/', aiPredictionsRoutes);
app.use('/', voiceNotesRoutes);
app.use('/', portalAIRoutes);
app.use('/', aiCalendarRoutes);
app.use('/', citationFinderRoutes);
app.use('/', aiCommunicationsRoutes);
app.use('/', aiIntakeRoutes);

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
    name: 'Business Entity Formation',
    description: 'Comprehensive LLC, Corporation, and Partnership formation with state-specific compliance requirements',
    icon: 'fa-building',
    promptFile: 'prompts/business_formation.txt'
  },
  real_estate: {
    name: 'Real Estate & Property',
    description: 'Residential and commercial transactions including purchase agreements, leases, deeds, and title transfers',
    icon: 'fa-home',
    promptFile: 'prompts/real_estate.txt'
  },
  family_law: {
    name: 'Family Law & Domestic Relations',
    description: 'Divorce petitions, custody agreements, prenuptial contracts, child support, and adoption documents',
    icon: 'fa-users',
    promptFile: 'prompts/family_law.txt'
  },
  estate_planning: {
    name: 'Estate Planning & Asset Protection',
    description: 'Wills, living trusts, powers of attorney, healthcare directives, and comprehensive estate administration',
    icon: 'fa-file-contract',
    promptFile: 'prompts/estate_planning.txt'
  },
  civil_litigation: {
    name: 'Civil Litigation & Disputes',
    description: 'Court filings, complaints, motions, discovery requests, settlement agreements, and judgment enforcement',
    icon: 'fa-gavel',
    promptFile: 'prompts/civil_litigation.txt'
  },
  employment_law: {
    name: 'Employment & Labor Law',
    description: 'Employment contracts, NDAs, non-compete agreements, termination documents, and HR compliance policies',
    icon: 'fa-briefcase',
    promptFile: 'prompts/employment_contracts.txt'
  },
  contracts: {
    name: 'Commercial Contracts & Agreements',
    description: 'Service agreements, vendor contracts, licensing deals, consulting arrangements, and business partnerships',
    icon: 'fa-handshake',
    promptFile: 'prompts/general_contracts.txt'
  },
  intellectual_property: {
    name: 'Intellectual Property',
    description: 'Trademark applications, copyright registrations, licensing agreements, IP assignments, and protection strategies',
    icon: 'fa-lightbulb',
    promptFile: 'prompts/intellectual_property.txt'
  },
  immigration: {
    name: 'Immigration & Visa Documents',
    description: 'Visa applications, sponsorship letters, employment authorization, and immigration compliance documentation',
    icon: 'fa-globe',
    promptFile: 'prompts/immigration.txt'
  },
  healthcare: {
    name: 'Healthcare & Medical',
    description: 'HIPAA compliance, patient consent forms, medical practice agreements, and healthcare provider contracts',
    icon: 'fa-heartbeat',
    promptFile: 'prompts/healthcare.txt'
  },
  nonprofit: {
    name: 'Nonprofit & Tax-Exempt Organizations',
    description: '501(c)(3) applications, bylaws, governance documents, and nonprofit compliance requirements',
    icon: 'fa-hand-holding-heart',
    promptFile: 'prompts/nonprofit.txt'
  },
  bankruptcy: {
    name: 'Bankruptcy & Debt Relief',
    description: 'Chapter 7 and Chapter 13 filings, debt restructuring, creditor negotiations, and financial reorganization',
    icon: 'fa-balance-scale',
    promptFile: 'prompts/bankruptcy.txt'
  },
  criminal_law: {
    name: 'Criminal Law & Defense',
    description: 'Defense motions, plea agreements, expungement petitions, bail applications, and criminal appeals',
    icon: 'fa-shield-alt',
    promptFile: 'prompts/criminal_law.txt'
  },
  tax_law: {
    name: 'Tax Law & IRS Matters',
    description: 'Tax appeals, IRS responses, installment agreements, offer in compromise, and tax controversy documents',
    icon: 'fa-calculator',
    promptFile: 'prompts/tax_law.txt'
  },
  securities_law: {
    name: 'Securities & Investment Law',
    description: 'Private placements, investor agreements, SEC filings, subscription agreements, and securities compliance',
    icon: 'fa-chart-line',
    promptFile: 'prompts/securities_law.txt'
  },
  insurance_law: {
    name: 'Insurance Law & Claims',
    description: 'Insurance claims, coverage disputes, bad faith letters, policy appeals, and settlement demands',
    icon: 'fa-umbrella',
    promptFile: 'prompts/insurance_law.txt'
  },
  environmental_law: {
    name: 'Environmental Law & Compliance',
    description: 'Environmental permits, compliance documentation, remediation agreements, and regulatory filings',
    icon: 'fa-leaf',
    promptFile: 'prompts/environmental_law.txt'
  },
  maritime_law: {
    name: 'Maritime & Admiralty Law',
    description: 'Shipping contracts, cargo claims, vessel documentation, maritime liens, and charter agreements',
    icon: 'fa-ship',
    promptFile: 'prompts/maritime_law.txt'
  },
  consumer_protection: {
    name: 'Consumer Protection',
    description: 'FDCPA violation letters, warranty claims, consumer complaints, and deceptive practices actions',
    icon: 'fa-user-shield',
    promptFile: 'prompts/consumer_protection.txt'
  },
  landlord_tenant: {
    name: 'Landlord-Tenant Law',
    description: 'Eviction notices, rent demands, lease violations, security deposit disputes, and habitability claims',
    icon: 'fa-key',
    promptFile: 'prompts/landlord_tenant.txt'
  },
  debt_collection: {
    name: 'Debt Collection',
    description: 'Collection letters, payment agreements, debt validation, judgment collection, and garnishment forms',
    icon: 'fa-money-bill-wave',
    promptFile: 'prompts/debt_collection.txt'
  },
  entertainment_law: {
    name: 'Sports & Entertainment Law',
    description: 'Talent contracts, licensing agreements, performance deals, royalty arrangements, and media rights',
    icon: 'fa-star',
    promptFile: 'prompts/entertainment_law.txt'
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
      { value: 'dba_filing', label: 'DBA (Doing Business As) Filing' },
      { value: 'shareholder_agreement', label: 'Shareholder Agreement' },
      { value: 'minutes_meeting', label: 'Corporate Minutes' }
    ],
    real_estate: [
      { value: 'purchase_agreement', label: 'Real Estate Purchase Agreement' },
      { value: 'lease_agreement', label: 'Residential Lease Agreement' },
      { value: 'commercial_lease', label: 'Commercial Lease Agreement' },
      { value: 'deed_transfer', label: 'Property Deed Transfer' },
      { value: 'disclosure_form', label: 'Property Disclosure Form' },
      { value: 'listing_agreement', label: 'Real Estate Listing Agreement' },
      { value: 'rental_application', label: 'Rental Application' },
      { value: 'lease_termination', label: 'Lease Termination Notice' },
      { value: 'eviction_notice', label: 'Eviction Notice' },
      { value: 'sublease_agreement', label: 'Sublease Agreement' }
    ],
    family_law: [
      { value: 'divorce_petition', label: 'Divorce Petition' },
      { value: 'custody_agreement', label: 'Child Custody Agreement' },
      { value: 'support_order', label: 'Child Support Order' },
      { value: 'prenuptial_agreement', label: 'Prenuptial Agreement' },
      { value: 'postnuptial_agreement', label: 'Postnuptial Agreement' },
      { value: 'adoption_petition', label: 'Adoption Petition' },
      { value: 'separation_agreement', label: 'Legal Separation Agreement' },
      { value: 'parenting_plan', label: 'Parenting Plan' },
      { value: 'name_change', label: 'Name Change Petition' }
    ],
    estate_planning: [
      { value: 'last_will', label: 'Last Will and Testament' },
      { value: 'living_trust', label: 'Revocable Living Trust' },
      { value: 'irrevocable_trust', label: 'Irrevocable Trust' },
      { value: 'power_of_attorney', label: 'General Power of Attorney' },
      { value: 'financial_poa', label: 'Financial Power of Attorney' },
      { value: 'healthcare_directive', label: 'Healthcare Directive / Living Will' },
      { value: 'healthcare_poa', label: 'Healthcare Power of Attorney' },
      { value: 'guardianship_nomination', label: 'Guardianship Nomination' },
      { value: 'beneficiary_designation', label: 'Beneficiary Designation Form' },
      { value: 'asset_protection_trust', label: 'Asset Protection Trust' }
    ],
    civil_litigation: [
      { value: 'civil_complaint', label: 'Civil Complaint' },
      { value: 'answer_complaint', label: 'Answer to Complaint' },
      { value: 'motion_dismiss', label: 'Motion to Dismiss' },
      { value: 'motion_summary_judgment', label: 'Motion for Summary Judgment' },
      { value: 'discovery_request', label: 'Discovery Request' },
      { value: 'interrogatories', label: 'Interrogatories' },
      { value: 'request_production', label: 'Request for Production of Documents' },
      { value: 'settlement_agreement', label: 'Settlement Agreement' },
      { value: 'subpoena', label: 'Subpoena' },
      { value: 'demand_letter', label: 'Demand Letter' },
      { value: 'cease_desist', label: 'Cease and Desist Letter' }
    ],
    employment_law: [
      { value: 'employment_agreement', label: 'Employment Agreement' },
      { value: 'offer_letter', label: 'Employment Offer Letter' },
      { value: 'nda_agreement', label: 'Non-Disclosure Agreement (NDA)' },
      { value: 'noncompete_agreement', label: 'Non-Compete Agreement' },
      { value: 'nonsolicitation', label: 'Non-Solicitation Agreement' },
      { value: 'severance_agreement', label: 'Severance Agreement' },
      { value: 'contractor_agreement', label: 'Independent Contractor Agreement' },
      { value: 'employee_handbook', label: 'Employee Handbook' },
      { value: 'termination_letter', label: 'Termination Letter' },
      { value: 'workplace_policy', label: 'Workplace Policy Document' }
    ],
    contracts: [
      { value: 'service_agreement', label: 'Service Agreement' },
      { value: 'purchase_contract', label: 'Purchase Contract' },
      { value: 'licensing_agreement', label: 'Licensing Agreement' },
      { value: 'vendor_contract', label: 'Vendor Contract' },
      { value: 'consulting_agreement', label: 'Consulting Agreement' },
      { value: 'partnership_contract', label: 'Partnership Contract' },
      { value: 'master_service_agreement', label: 'Master Service Agreement (MSA)' },
      { value: 'sow', label: 'Statement of Work (SOW)' },
      { value: 'joint_venture', label: 'Joint Venture Agreement' },
      { value: 'distribution_agreement', label: 'Distribution Agreement' }
    ],
    intellectual_property: [
      { value: 'trademark_application', label: 'Trademark Application' },
      { value: 'copyright_registration', label: 'Copyright Registration' },
      { value: 'ip_assignment', label: 'IP Assignment Agreement' },
      { value: 'ip_license', label: 'IP License Agreement' },
      { value: 'work_for_hire', label: 'Work for Hire Agreement' },
      { value: 'invention_assignment', label: 'Invention Assignment Agreement' },
      { value: 'trademark_license', label: 'Trademark License Agreement' },
      { value: 'software_license', label: 'Software License Agreement' }
    ],
    immigration: [
      { value: 'sponsorship_letter', label: 'Employer Sponsorship Letter' },
      { value: 'support_affidavit', label: 'Affidavit of Support (I-864)' },
      { value: 'employment_verification', label: 'Employment Verification Letter' },
      { value: 'invitation_letter', label: 'Visa Invitation Letter' },
      { value: 'adjustment_status', label: 'Adjustment of Status Application' },
      { value: 'naturalization', label: 'Naturalization Application Support' }
    ],
    healthcare: [
      { value: 'hipaa_authorization', label: 'HIPAA Authorization Form' },
      { value: 'patient_consent', label: 'Patient Consent Form' },
      { value: 'medical_release', label: 'Medical Records Release' },
      { value: 'provider_agreement', label: 'Healthcare Provider Agreement' },
      { value: 'baa', label: 'Business Associate Agreement (BAA)' },
      { value: 'informed_consent', label: 'Informed Consent Document' },
      { value: 'telemedicine_consent', label: 'Telemedicine Consent Form' }
    ],
    nonprofit: [
      { value: '501c3_application', label: '501(c)(3) Application Package' },
      { value: 'nonprofit_bylaws', label: 'Nonprofit Bylaws' },
      { value: 'nonprofit_articles', label: 'Nonprofit Articles of Incorporation' },
      { value: 'board_resolution', label: 'Board Resolution' },
      { value: 'conflict_interest', label: 'Conflict of Interest Policy' },
      { value: 'donation_agreement', label: 'Donation Agreement' },
      { value: 'grant_agreement', label: 'Grant Agreement' },
      { value: 'volunteer_agreement', label: 'Volunteer Agreement' }
    ],
    bankruptcy: [
      { value: 'chapter7_petition', label: 'Chapter 7 Bankruptcy Petition' },
      { value: 'chapter13_petition', label: 'Chapter 13 Bankruptcy Petition' },
      { value: 'means_test', label: 'Means Test Calculation' },
      { value: 'creditor_matrix', label: 'Creditor Matrix' },
      { value: 'reaffirmation', label: 'Reaffirmation Agreement' },
      { value: 'debt_settlement', label: 'Debt Settlement Agreement' },
      { value: 'payment_plan', label: 'Payment Plan Agreement' }
    ],
    criminal_law: [
      { value: 'motion_dismiss_criminal', label: 'Motion to Dismiss (Criminal)' },
      { value: 'motion_suppress', label: 'Motion to Suppress Evidence' },
      { value: 'plea_agreement', label: 'Plea Agreement' },
      { value: 'bail_motion', label: 'Bail/Bond Motion' },
      { value: 'expungement_petition', label: 'Expungement Petition' },
      { value: 'record_sealing', label: 'Record Sealing Motion' },
      { value: 'appeal_brief', label: 'Criminal Appeal Brief' },
      { value: 'habeas_corpus', label: 'Habeas Corpus Petition' }
    ],
    tax_law: [
      { value: 'tax_appeal', label: 'Tax Appeal Letter' },
      { value: 'irs_response', label: 'IRS Response Letter' },
      { value: 'installment_agreement', label: 'IRS Installment Agreement Request' },
      { value: 'offer_compromise', label: 'Offer in Compromise' },
      { value: 'penalty_abatement', label: 'Penalty Abatement Request' },
      { value: 'innocent_spouse', label: 'Innocent Spouse Relief Request' },
      { value: 'tax_protest', label: 'Tax Protest Letter' },
      { value: 'audit_response', label: 'Audit Response Letter' }
    ],
    securities_law: [
      { value: 'private_placement', label: 'Private Placement Memorandum' },
      { value: 'subscription_agreement', label: 'Subscription Agreement' },
      { value: 'investor_questionnaire', label: 'Investor Questionnaire' },
      { value: 'accredited_investor', label: 'Accredited Investor Verification' },
      { value: 'stock_purchase', label: 'Stock Purchase Agreement' },
      { value: 'shareholder_rights', label: 'Shareholder Rights Agreement' },
      { value: 'convertible_note', label: 'Convertible Note Agreement' },
      { value: 'safe_agreement', label: 'SAFE Agreement' }
    ],
    insurance_law: [
      { value: 'insurance_claim', label: 'Insurance Claim Letter' },
      { value: 'claim_appeal', label: 'Claim Denial Appeal' },
      { value: 'bad_faith_letter', label: 'Bad Faith Demand Letter' },
      { value: 'coverage_dispute', label: 'Coverage Dispute Letter' },
      { value: 'proof_of_loss', label: 'Proof of Loss Statement' },
      { value: 'subrogation_waiver', label: 'Subrogation Waiver' },
      { value: 'settlement_demand', label: 'Insurance Settlement Demand' }
    ],
    environmental_law: [
      { value: 'permit_application', label: 'Environmental Permit Application' },
      { value: 'compliance_plan', label: 'Environmental Compliance Plan' },
      { value: 'remediation_agreement', label: 'Remediation Agreement' },
      { value: 'environmental_audit', label: 'Environmental Audit Report' },
      { value: 'impact_assessment', label: 'Environmental Impact Assessment' },
      { value: 'waste_disposal', label: 'Waste Disposal Agreement' },
      { value: 'pollution_control', label: 'Pollution Control Plan' }
    ],
    maritime_law: [
      { value: 'charter_agreement', label: 'Charter Party Agreement' },
      { value: 'bill_of_lading', label: 'Bill of Lading' },
      { value: 'cargo_claim', label: 'Cargo Damage Claim' },
      { value: 'maritime_lien', label: 'Maritime Lien Notice' },
      { value: 'vessel_purchase', label: 'Vessel Purchase Agreement' },
      { value: 'crew_agreement', label: 'Crew Employment Agreement' },
      { value: 'salvage_agreement', label: 'Salvage Agreement' },
      { value: 'marine_insurance', label: 'Marine Insurance Claim' }
    ],
    consumer_protection: [
      { value: 'fdcpa_violation', label: 'FDCPA Violation Letter' },
      { value: 'fcra_dispute', label: 'FCRA Credit Dispute Letter' },
      { value: 'warranty_claim', label: 'Warranty Claim Letter' },
      { value: 'lemon_law', label: 'Lemon Law Demand Letter' },
      { value: 'consumer_complaint', label: 'Consumer Protection Complaint' },
      { value: 'class_action_notice', label: 'Class Action Notice' },
      { value: 'refund_demand', label: 'Refund Demand Letter' },
      { value: 'deceptive_practice', label: 'Deceptive Practice Complaint' }
    ],
    landlord_tenant: [
      { value: 'eviction_notice_pay', label: 'Pay or Quit Notice' },
      { value: 'eviction_notice_cure', label: 'Cure or Quit Notice' },
      { value: 'eviction_notice_unconditional', label: 'Unconditional Quit Notice' },
      { value: 'rent_demand', label: 'Rent Demand Letter' },
      { value: 'lease_violation', label: 'Lease Violation Notice' },
      { value: 'security_deposit_demand', label: 'Security Deposit Demand' },
      { value: 'habitability_complaint', label: 'Habitability Complaint' },
      { value: 'rent_increase', label: 'Rent Increase Notice' },
      { value: 'lease_renewal', label: 'Lease Renewal Offer' }
    ],
    debt_collection: [
      { value: 'collection_letter', label: 'Collection Demand Letter' },
      { value: 'payment_agreement', label: 'Payment Plan Agreement' },
      { value: 'debt_validation', label: 'Debt Validation Request' },
      { value: 'settlement_offer', label: 'Debt Settlement Offer' },
      { value: 'judgment_collection', label: 'Judgment Collection Letter' },
      { value: 'garnishment_notice', label: 'Wage Garnishment Notice' },
      { value: 'lien_filing', label: 'Lien Filing Notice' },
      { value: 'final_demand', label: 'Final Demand Before Legal Action' }
    ],
    entertainment_law: [
      { value: 'talent_agreement', label: 'Talent/Artist Agreement' },
      { value: 'management_contract', label: 'Management Contract' },
      { value: 'recording_contract', label: 'Recording Contract' },
      { value: 'performance_agreement', label: 'Performance Agreement' },
      { value: 'royalty_agreement', label: 'Royalty Agreement' },
      { value: 'media_rights', label: 'Media Rights Agreement' },
      { value: 'appearance_release', label: 'Appearance Release' },
      { value: 'merchandising', label: 'Merchandising Agreement' },
      { value: 'sponsorship_agreement', label: 'Sponsorship Agreement' }
    ]
  };
  
  const result = specificTypes[formType] || [];
  console.log('Returning specific types for', formType, ':', result);
  return result;
};

// Form field configurations - Simplified version (details collected via natural language)
const getFormFields = (formType, specificType) => {
  // Minimal base fields - just contact info
  const baseFields = [
    { name: 'client_name', label: 'Your Full Legal Name', type: 'text', required: true },
    { name: 'client_email', label: 'Email Address', type: 'email', required: true }
  ];

  // Simple fields - AI extracts details from natural language input
  const specificFields = {
    // Business Formation
    llc_articles: [...baseFields],
    corp_articles: [...baseFields],
    llc_operating_agreement: [...baseFields],
    corp_bylaws: [...baseFields],
    partnership_agreement: [...baseFields],

    // Real Estate - simplified
    purchase_agreement: [...baseFields],
    lease_agreement: [...baseFields],
    commercial_lease: [...baseFields],
    deed: [...baseFields],
    eviction_notice: [...baseFields],

    // Family Law - simplified
    divorce_petition: [...baseFields],
    prenuptial_agreement: [...baseFields],
    child_custody: [...baseFields],
    child_support: [...baseFields],
    separation_agreement: [...baseFields],

    // Estate Planning - simplified
    last_will: [...baseFields],
    living_trust: [...baseFields],
    power_of_attorney: [...baseFields],
    healthcare_directive: [...baseFields],
    beneficiary_designation: [...baseFields],

    // Civil Litigation - simplified
    civil_complaint: [...baseFields],
    motion_dismiss: [...baseFields],
    settlement_agreement: [...baseFields],
    demand_letter: [...baseFields],
    answer_complaint: [...baseFields],

    // Employment Law - simplified
    employment_agreement: [...baseFields],
    nda_agreement: [...baseFields],
    noncompete_agreement: [...baseFields],
    severance_agreement: [...baseFields],
    independent_contractor: [...baseFields],

    // Contracts - simplified
    service_agreement: [...baseFields],
    consulting_agreement: [...baseFields],
    sales_contract: [...baseFields],
    licensing_agreement: [...baseFields],
    partnership_agreement: [...baseFields],

    // Intellectual Property - simplified
    trademark_application: [...baseFields],
    ip_license: [...baseFields],
    work_for_hire: [...baseFields],
    copyright_registration: [...baseFields],
    ip_assignment: [...baseFields],

    // Immigration - simplified
    sponsorship_letter: [...baseFields],
    support_affidavit: [...baseFields],
    employment_verification: [...baseFields],
    invitation_letter: [...baseFields],
    experience_letter: [...baseFields],

    // Healthcare - simplified
    hipaa_authorization: [...baseFields],
    patient_consent: [...baseFields],
    baa: [...baseFields],
    medical_release: [...baseFields],
    advance_directive: [...baseFields],

    // Nonprofit - simplified
    nonprofit_bylaws: [...baseFields],
    '501c3_application': [...baseFields],
    board_resolution: [...baseFields],
    articles_incorporation: [...baseFields],
    conflict_interest: [...baseFields],

    // Bankruptcy - simplified
    chapter7_petition: [...baseFields],
    debt_settlement: [...baseFields],
    chapter13_plan: [...baseFields],
    reaffirmation: [...baseFields],
    means_test: [...baseFields]
  };

  // Return specific fields if available, otherwise return base fields
  return specificFields[specificType] || baseFields;
};

// Legacy function for backward compatibility - simplified
const getLegacyFormFields = (formType) => {
  const simpleFields = [
    { name: 'client_name', label: 'Your Full Legal Name', type: 'text', required: true },
    { name: 'client_email', label: 'Email Address', type: 'email', required: true }
  ];

  // All form types use the same simple fields - AI extracts details from natural language
  return simpleFields;
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
app.get('/', async (req, res) => {
  // If authenticated, redirect to dashboard
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }

  // Show public landing page for non-authenticated users
  res.render('index', {
    formTypes: FORM_TYPES,
    req: req
  });
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
  let user = null;
  if (req.session && req.session.userId) {
    user = { id: req.session.userId, name: req.session.userName || 'User' };
  }

  if (user) {
    // Logged in - show services with practice nav
    res.render('services-pm', {
      formTypes: FORM_TYPES,
      title: 'Document Generator - Services',
      user: user,
      active: 'documents'
    });
  } else {
    // Not logged in - show public page
    res.render('index', {
      formTypes: FORM_TYPES,
      title: 'Legal Forms Generator - Services',
      req: req,
      user: null
    });
  }
});

app.get('/features', (req, res) => {
  res.render('index', {
    formTypes: FORM_TYPES,
    title: 'Legal Forms Generator - Features',
    req: req,
    user: req.session ? req.session.userId : null
  });
});

// Helper to get user from session
async function getUserFromSession(req) {
  if (req.session && req.session.userId) {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    return result.rows[0] || null;
  }
  return null;
}

app.get('/about', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('about', { title: 'About LegalPracticeAI', req, user });
});

app.get('/faq', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('faq', { title: 'FAQ - LegalPracticeAI', req, user });
});

app.get('/contact', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('contact', { title: 'Contact - LegalPracticeAI', req, user });
});

app.get('/pricing', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('pricing', { title: 'Pricing - LegalPracticeAI', req, user });
});

// Legal pages routes
app.get('/privacy', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('privacy', { title: 'Privacy Policy - LegalPracticeAI', req, user });
});

app.get('/privacy-policy', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('privacy-policy', { title: 'Privacy Policy - LegalPracticeAI', req, user });
});

app.get('/terms', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('terms', { title: 'Terms of Service - LegalPracticeAI', req, user });
});

app.get('/terms-of-service', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('terms-of-service', { title: 'Terms of Service - LegalPracticeAI', req, user });
});

app.get('/disclaimer', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('disclaimer', { title: 'Legal Disclaimer - LegalPracticeAI', req, user });
});

app.get('/cookies', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('cookies', { title: 'Cookie Policy - LegalPracticeAI', req, user });
});

app.get('/cookie-policy', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('cookies', { title: 'Cookie Policy - LegalPracticeAI', req, user });
});

app.get('/refund-policy', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('refund-policy', { title: 'Refund Policy - LegalPracticeAI', req, user });
});

// Feature pages
app.get('/features/client-management', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('features/client-management', { title: 'Client Management for Law Firms - LegalPracticeAI', req, user });
});

app.get('/features/case-management', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('features/case-management', { title: 'Legal Case Management Software - LegalPracticeAI', req, user });
});

app.get('/features/billing', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('features/billing', { title: 'Legal Billing & Invoicing Software - LegalPracticeAI', req, user });
});

app.get('/features/trust-accounting', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('features/trust-accounting', { title: 'IOLTA Trust Accounting Software - LegalPracticeAI', req, user });
});

app.get('/features/conflict-checking', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('features/conflict-checking', { title: 'Conflict of Interest Checking - LegalPracticeAI', req, user });
});

app.get('/features/ai-drafting', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('features/ai-drafting', { title: 'AI Legal Document Drafting - LegalPracticeAI', req, user });
});

app.get('/features/calendar', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('features/calendar', { title: 'Legal Calendar & Deadline Management - LegalPracticeAI', req, user });
});

app.get('/features/lead-management', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('features/lead-management', { title: 'Legal Lead Management & Intake - LegalPracticeAI', req, user });
});

app.get('/features/client-portal', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('features/client-portal', { title: 'Secure Client Portal for Law Firms - LegalPracticeAI', req, user });
});

app.get('/features/ai-efficiency', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('features/ai-efficiency', { title: 'AI-Powered Legal Practice Automation - LegalPracticeAI', req, user });
});

app.get('/features/security', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('features/security', { title: 'Secure & Compliant Legal Software - LegalPracticeAI', req, user });
});

app.get('/features/grow-practice', async (req, res) => {
  const user = await getUserFromSession(req);
  res.render('features/grow-practice', { title: 'Grow Your Law Practice - LegalPracticeAI', req, user });
});

// Register page - with demo data pre-filled
app.get('/register', (req, res) => {
  const demoData = {
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@lawfirm.com'
  };

  res.render('auth/register', {
    title: 'Create Account - LegalPracticeAI',
    errors: [],
    formData: demoData
  });
});

// Register POST handler
app.post('/register', async (req, res) => {
  const { firstName, lastName, email, phone, address, password, confirmPassword } = req.body;
  const errors = [];

  // Validation
  if (!firstName || !lastName) errors.push({ msg: 'First and last name are required' });
  if (!email) errors.push({ msg: 'Email is required' });
  if (!password || password.length < 8) errors.push({ msg: 'Password must be at least 8 characters' });
  if (password !== confirmPassword) errors.push({ msg: 'Passwords do not match' });

  if (errors.length > 0) {
    return res.render('auth/register', {
      title: 'Create Account - LegalPracticeAI',
      errors,
      formData: { firstName, lastName, email, phone, address }
    });
  }

  try {
    // Check if user exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.render('auth/register', {
        title: 'Create Account - LegalPracticeAI',
        errors: [{ msg: 'Email already registered' }],
        formData: { firstName, lastName, email, phone, address }
      });
    }

    // Hash password and create user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (first_name, last_name, email, phone, address, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
      [firstName, lastName, email, phone || null, address || null, hashedPassword]
    );

    const newUserId = result.rows[0].id;

    // Seed demo data for new user
    await seedDemoDataForUser(newUserId);

    // Auto-login after registration
    req.session.userId = newUserId;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Registration error:', error);
    res.render('auth/register', {
      title: 'Create Account - LegalPracticeAI',
      errors: [{ msg: 'Registration failed. Please try again.' }],
      formData: { firstName, lastName, email, phone, address }
    });
  }
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
  
  // Check if user is logged in via session
  let user = null;
  console.log('Form route - session:', req.session ? 'exists' : 'none', 'userId:', req.session?.userId);
  if (req.session && req.session.userId) {
    user = { id: req.session.userId, name: req.session.userName || 'User' };
    console.log('User logged in:', user);
  }

  res.render('form', {
    formType,
    formConfig,
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    canonical: meta.canonical,
    structuredData: structuredData,
    req: req,
    user: user
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

    console.log('Generate request:', { formType, specificType, format, generation_mode, userDataKeys: Object.keys(userData || {}) });

    if (!FORM_TYPES[formType]) {
      console.log('Invalid form type:', formType, 'Available:', Object.keys(FORM_TYPES));
      return res.status(400).json({ error: `Invalid form type: ${formType}` });
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

    console.log('Required fields:', requiredFields.map(f => f.name));
    console.log('User data:', userData);

    const missingFields = requiredFields.filter(field => !userData || !userData[field.name] || String(userData[field.name]).trim() === '');

    if (missingFields.length > 0) {
      console.log('Missing fields:', missingFields.map(f => f.name));
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

    // Force download with octet-stream to prevent browser from opening file
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Transfer-Encoding', 'binary');

    // Stream the file
    const fileStream = require('fs').createReadStream(filepath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('File not found:', error);
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

    // AI-powered risk assessment (optional - skip if it fails)
    try {
      const riskPrompt = `Analyze this legal document excerpt and return ONLY valid JSON (no other text):
{"risks":["risk1","risk2"],"suggestions":["suggestion1","suggestion2"]}

Document: ${document.substring(0, 1500)}`;

      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
        messages: [{ role: 'user', content: riskPrompt }],
        max_tokens: 500,
        temperature: 0
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
          'X-Title': 'Legal Forms Generator'
        }
      });

      let aiResponseContent = response.data.choices[0].message.content || '';

      // Extract JSON from response
      const jsonMatch = aiResponseContent.match(/\{[\s\S]*\}/);
      let aiReview = { risks: [], suggestions: [] };

      if (jsonMatch) {
        try {
          aiReview = JSON.parse(jsonMatch[0]);
        } catch (e) {
          // If still can't parse, use empty defaults
          console.log('Could not parse AI review response, using defaults');
          aiReview = { risks: [], suggestions: ['Document generated successfully. Please review before use.'] };
        }
      }

      if (aiReview.risks && Array.isArray(aiReview.risks)) {
        issues.push(...aiReview.risks.map(risk => ({
          type: 'ai_risk_assessment',
          severity: 'medium',
          message: typeof risk === 'string' ? risk : String(risk)
        })));
      }
      if (aiReview.suggestions && Array.isArray(aiReview.suggestions)) {
        suggestions.push(...aiReview.suggestions.map(s => typeof s === 'string' ? s : String(s)));
      }
    } catch (error) {
      console.error('AI review error:', error.message);
      // Don't fail - just skip AI review
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
