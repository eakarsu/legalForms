#  Legal Forms Generator

A comprehensive web application for generating professional legal documents using AI-powered templates. This application covers all major areas of legal practice including business formation, real estate, family law, estate planning, civil litigation, employment contracts, and general contracts.

## Features

- **7 Major Form Categories**: Business Formation, Real Estate, Family Law, Estate Planning, Civil Litigation, Employment Contracts, and General Contracts
- **AI-Powered Document Generation**: Uses advanced AI to create comprehensive, legally-compliant documents
- **Dynamic Form Fields**: Intelligent forms that adapt based on document type
- **Professional Templates**: Industry-standard formatting and legal language
- **Download Capability**: Generate and download documents in multiple formats
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **State-Specific Compliance**: Handles jurisdiction-specific requirements

## Form Types Supported

### 1. Business Formation
- LLC Formation Documents
- Corporation Formation Documents
- Articles of Organization/Incorporation
- Operating Agreements and Bylaws
- Initial Resolutions

### 2. Real Estate
- Purchase Agreements
- Property Deeds
- Lease Agreements
- Disclosure Forms
- Closing Documents

### 3. Family Law
- Divorce Petitions
- Custody Agreements
- Child Support Documents
- Prenuptial Agreements
- Adoption Papers

### 4. Estate Planning
- Last Will and Testament
- Living Trusts
- Power of Attorney
- Healthcare Directives
- Beneficiary Designations

### 5. Civil Litigation
- Civil Complaints
- Motions and Briefs
- Discovery Documents
- Settlement Agreements
- Court Filings

### 6. Employment Contracts
- Employment Agreements
- Non-Disclosure Agreements
- Non-Compete Clauses
- Severance Agreements
- Independent Contractor Agreements

### 7. General Contracts
- Service Agreements
- Purchase Contracts
- Licensing Agreements
- Partnership Agreements
- Vendor Contracts

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd legal-forms-generator
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env file with your actual values
   ```

4. **Configure OpenRouter API** (Required for AI document generation):
   - Get an API key from OpenRouter (https://openrouter.ai/)
   - Add it to your `.env` file: `OPENROUTER_API_KEY=your-key-here`

## Usage

1. **Start the application**:
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

2. **Access the web interface**:
   - Open your browser to `http://localhost:3000`
   - Select the type of legal form you need
   - Fill out the required information
   - Generate and download your document

## Configuration

### Environment Variables

- `PORT`: Port number for the web server (default: 3000)
- `NODE_ENV`: Environment mode ('development' or 'production')
- `OPENROUTER_API_KEY`: Your OpenRouter API key for document generation
- `OPENROUTER_MODEL`: AI model to use (default: 'anthropic/claude-3-haiku')
- `SITE_URL`: Your site URL for OpenRouter API
- `SESSION_SECRET`: Secret key for session management

### Customization

- **Add new form types**: Create new prompt files in the `prompts/` directory
- **Modify existing forms**: Edit the corresponding prompt files
- **Customize styling**: Modify `static/css/custom.css`
- **Add form fields**: Update the form field configurations in `app.py`

## File Structure

```
legal-forms-generator/
├── server.js              # Main Express application
├── package.json           # Node.js dependencies and scripts
├── .env.example          # Environment variables template
├── README.md             # This file
├── prompts/              # AI prompt templates
│   ├── business_formation.txt
│   ├── real_estate.txt
│   ├── family_law.txt
│   ├── estate_planning.txt
│   ├── civil_litigation.txt
│   ├── employment_contracts.txt
│   └── general_contracts.txt
├── views/                # EJS templates
│   ├── base.ejs
│   ├── index.ejs
│   ├── form.ejs
│   └── 404.ejs
├── public/               # Static assets
│   └── css/
│       └── custom.css
└── uploads/              # Generated documents storage
```

## API Endpoints

- `GET /` - Main page with form type selection
- `GET /form/<form_type>` - Form page for specific document type
- `POST /generate` - Generate document from form data
- `GET /download/<filename>` - Download generated document
- `GET /api/form-fields/<form_type>` - Get form field configuration

## Legal Disclaimer

**IMPORTANT**: This application generates legal document templates for informational purposes only. The generated documents should always be reviewed by a qualified attorney before use. Laws vary by jurisdiction, and professional legal advice is recommended for all legal matters.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please contact [your-email@example.com] or create an issue in the repository.

## Roadmap

- [ ] Add more form types
- [ ] Implement user authentication
- [ ] Add document versioning
- [ ] Create mobile app
- [ ] Add e-signature integration
- [ ] Implement document collaboration features
- [ ] Add multi-language support
