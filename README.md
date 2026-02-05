# Gas Station Estimator

**A comprehensive web-based estimator for gas station construction projects**

Featuring equipment package management, comprehensive todo tracking, cost management, and payment tracking - specifically designed for Dallas, Texas gas station construction projects.

---

## 🎯 Key Features

### Equipment Management
- **12 Pre-Built Equipment Packages** with detailed line items
- **Line Item Editing** with edit/save button interface
- **Multiline Descriptions** with proper text wrapping
- **Quantity & Pricing** tracking (cost + selling price)
- **Auto-Save** functionality across all changes

### Todo Management
- **150 Default Todos** specific to Dallas, Texas gas stations
- **Priority Levels** (P1-P4) for workflow management
- **Deadline Tracking** with overdue notifications
- **Package-Specific** and **General Project** todos
- **Completion Tracking** with timestamps

### Project Tracking
- **Summary Page** with cost breakdown by package
- **Tax Calculation** (8.25% Dallas County)
- **Category Organization** for easy navigation
- **Real-Time Updates** across browser tabs
- **PostgreSQL Backend** for reliable data storage

### Equipment Packages Include
- Tank and Excavation ($184k+ with construction details)
- Tank Equipment (18 items with Veeder Root parts)
- Tank Monitor - TLS-450 & TLS-350 (Complete monitoring systems)
- Forecourt Island & Pump Equipment
- Dispensers (Wayne Anthem & Gilbarco)
- Canopy Equipment
- POS - Passport (Complete POS system)

---

## 🚀 Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
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
│   ├── js/
│   │   └── app.js            # Frontend application logic
│   └── css/
│       └── styles.css        # Application styles
├── scripts/                  # Migration & utility scripts
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
- **Sample Project Value**: ~$256,000
- **Database Tables**: 6

---

## 📝 Documentation

- `README.md` - This file
- `PROJECT_STATUS.md` - Current status and roadmap
- `QUICKSTART.md` - Getting started guide
- `SESSION_SUMMARY_FEB_4_2026.md` - Recent session details
- `CHANGES_FEB_4_2026.md` - Recent changes log
- `TODO_ITEMS_PROPOSAL.md` - Default todo list reference

---

## 🎯 Roadmap

### ✅ Completed
- Equipment package management
- Todo system with priorities
- Cost tracking (cost + price)
- Edit mode for line items
- Auto-save functionality
- Default templates & todos

### 🚧 In Progress
- Custom package management
- Dual progress bars (todos + payments)
- Testing & calibration page

### 📋 Planned
- Labor tracking
- Materials management
- Payment milestones
- Invoice generation
- Advanced reporting

---

## 💡 Use Cases

- **Construction Companies**: Create detailed bids for gas station projects
- **Project Managers**: Track equipment, costs, and progress
- **Equipment Suppliers**: Generate quotes with detailed specs
- **Estimators**: Accurate cost calculations with real pricing

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

**Version**: 2.0  
**Last Updated**: February 5, 2026  
**Status**: ✅ Production Ready

