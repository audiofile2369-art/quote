# Gas Station Estimator

**A comprehensive web-based estimator for gas station construction projects**

Featuring equipment package management, PDF estimate generation, contractor collaboration, logo management, and comprehensive project tracking - specifically designed for Dallas, Texas gas station construction projects.

---

## 🎯 Key Features

### Equipment Management
- **12 Pre-Built Equipment Packages** with detailed line items
- **Line Item Editing** with inline edit/save functionality
- **Drag-and-Drop Reordering** of equipment packages
- **Save as Default** - Save current line items as template defaults
- **Quantity, Cost & Pricing** tracking per item
- **Auto-Save** functionality across all changes

### PDF Estimate Generation
- **Professional PDF Output** with customizable formatting
- **Company Logo Support** - Add your logo to estimates
- **Contractor Logos** - Per-package contractor branding
- **Equipment Package Reordering** before PDF generation
- **Price Summary** with grand total
- **Scope of Work & Disclaimers** per equipment package
- **Page Numbers** and professional styling

### Contractor Collaboration
- **Contractor Assignment** per equipment package
- **Contractor Management** - Save and reuse contractor list
- **Contractor Logos** - Upload once, reuse automatically
- **Send to Contractor** functionality for package sharing

### Project Management
- **Station Name & Client Info** tracking
- **Project Info Page** with all details
- **Scope of Work** - General and per-package
- **Disclaimers** - General and per-package
- **Tax Calculation** with customizable rate
- **Discount Support**

### Todo Management
- **150 Default Todos** specific to Dallas, Texas gas stations
- **Priority Levels** (P1-P4) for workflow management
- **Deadline Tracking** with overdue notifications
- **Package-Specific** and **General Project** todos
- **Completion Tracking** with timestamps

### Equipment Packages Include
- Tank and Excavation
- Tank Equipment (Veeder Root parts)
- Tank Monitor - TLS-450 & TLS-350
- Forecourt Island & Pump Equipment
- Dispensers (Wayne Anthem & Gilbarco)
- Canopy Equipment
- POS - Passport

---

## 🚀 Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript, pdfMake
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Neon serverless)
- **Deployment**: Vercel (auto-deploy on push)
- **Version Control**: Git/GitHub

---

## 📁 Project Structure

```
estimator/
├── api/
│   └── index.js              # Express API server & endpoints
├── public/
│   ├── index.html            # Main application
│   ├── home.html             # Project list/home page
│   ├── settings.html         # Settings page
│   ├── js/
│   │   ├── app.js            # Frontend application logic
│   │   └── sync.js           # Multi-tab sync
│   └── css/
│       └── styles.css        # Application styles
├── *.mjs                     # Migration & utility scripts
├── *.md                      # Documentation files
└── package.json              # Dependencies
```

---

## 🏃 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/audiofile2369-art/quote.git
   cd quote
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create `.env` file:
   ```
   DATABASE_URL=your_postgresql_connection_string
   ```

4. **Run locally**
   ```bash
   npm start
   ```
   
5. **Open browser**
   Navigate to `http://localhost:3000`

### Deploy to Vercel

1. Push repo to GitHub
2. Import project in Vercel
3. Add `DATABASE_URL` environment variable
4. Deploy - done!

Auto-deploys on every push to `main` branch.

---

## 📊 Current Statistics

- **Total Equipment Packages**: 12
- **Total Line Items**: 100+
- **Default Todos**: 150 (32 general + 118 package-specific)
- **Database Tables**: 6 (jobs, job_items, package_templates, line_item_templates, contractor_links)

---

## 📝 Recent Updates (February 2026)

### February 7, 2026
- ✅ **PDF Improvements** - Professional formatting with grand total, page numbers, better styling
- ✅ **Package Reordering** - Drag-and-drop reorder on Equipment Packages page
- ✅ **Modal Fixes** - Fixed scope/disclaimers modals not closing after save
- ✅ **Database Fix** - Fixed INSERT parameter count mismatch

### February 6, 2026
- ✅ **Company Logo** - Upload and display on PDF estimates
- ✅ **Contractor Logos** - Per-package contractor branding
- ✅ **Station Name Field** - Added to project info
- ✅ **Contractor Management** - Save/reuse contractor list with logos
- ✅ **PDF Customization Modal** - Reorder packages before generating

### Earlier Updates
- ✅ Save as Default for equipment packages
- ✅ Removed letter prefixes from package names
- ✅ Equipment package scope of work & disclaimers
- ✅ PDF generation with disclaimers

---

## 📝 Documentation

- `README.md` - This file
- `QUICKSTART.md` - Getting started guide
- `SESSION_SUMMARY_FEB_4_2026.md` - Session details
- `CHANGES_FEB_4_2026.md` - Changes log
- `TODO_ITEMS_PROPOSAL.md` - Default todo list reference

---

## 🎯 Roadmap

### ✅ Completed
- Equipment package management
- PDF estimate generation with logos
- Contractor assignment & collaboration
- Todo system with priorities
- Cost tracking (cost + price)
- Edit mode for line items
- Auto-save functionality
- Default templates & todos
- Package reordering
- Save as default functionality

### 📋 Planned
- Labor tracking
- Materials management
- Payment milestones
- Invoice generation
- Advanced reporting
- Testing & calibration tracking

---

## 💡 Use Cases

- **Construction Companies**: Create detailed bids for gas station projects
- **Project Managers**: Track equipment, costs, and progress
- **Equipment Suppliers**: Generate quotes with detailed specs
- **Estimators**: Accurate cost calculations with real pricing
- **Contractors**: Collaborate on equipment packages

---

## 🔗 Links

- **Live Site**: [Deployed on Vercel]
- **Repository**: github.com/audiofile2369-art/quote
- **Database**: Neon PostgreSQL (serverless)

---

## 📄 License

MIT

---

## 🙏 Credits

Built for gas station construction projects with focus on Dallas, Texas requirements. Pricing researched from multiple petroleum equipment suppliers including JF Petroleum, SPATCO, Westech Equipment, and others.

**Version**: 3.0  
**Last Updated**: February 7, 2026  
**Status**: ✅ Production Ready

