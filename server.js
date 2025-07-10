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
async function generateDocument(formType, userData) {
  const prompt = await loadPrompt(formType);
  if (!prompt) {
    throw new Error('Failed to load prompt template');
  }

  // Combine prompt with user data
  const fullPrompt = `${prompt}\n\nUSER PROVIDED INFORMATION:\n${JSON.stringify(userData, null, 2)}\n\nGenerate a complete, professional legal document based on the above information.`;

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

// Form field configurations
const getFormFields = (formType) => {
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
  res.render('index', { formTypes: FORM_TYPES });
});

app.get('/form/:formType', (req, res) => {
  const formType = req.params.formType;
  
  if (!FORM_TYPES[formType]) {
    return res.status(404).send('Form type not found');
  }

  const formConfig = FORM_TYPES[formType];
  res.render('form', { formType, formConfig });
});

app.post('/generate', async (req, res) => {
  try {
    const { form_type: formType, form_data: userData } = req.body;

    if (!FORM_TYPES[formType]) {
      return res.status(400).json({ error: 'Invalid form type' });
    }

    // Generate the document
    const document = await generateDocument(formType, userData);

    // Save generated document
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const filename = `${formType}_${timestamp}.txt`;
    const filepath = path.join(uploadDir, filename);

    await fs.writeFile(filepath, document, 'utf8');

    res.json({
      success: true,
      document: document,
      filename: filename
    });
  } catch (error) {
    console.error('Error generating document:', error);
    res.status(500).json({ error: 'Failed to generate document' });
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

app.get('/api/form-fields/:formType', (req, res) => {
  const formType = req.params.formType;
  
  if (!FORM_TYPES[formType]) {
    return res.status(400).json({ error: 'Invalid form type' });
  }

  const fields = getFormFields(formType);
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
