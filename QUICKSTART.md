# Quick Start Guide - Gas Station Estimator

**Last Updated**: February 5, 2026

---

## 🎯 What This Is

A comprehensive web-based estimator for **gas station construction projects** that includes:

- ✅ **12 Pre-Built Equipment Packages** with detailed line items
- ✅ **150 Default Todos** specific to Dallas, Texas gas stations
- ✅ **Cost & Price Tracking** for accurate estimates
- ✅ **Priority-Based Workflow** (P1-P4 task priorities)
- ✅ **Auto-Save** to PostgreSQL database
- ✅ **Multi-Tab Sync** - Changes update across browser tabs
- ✅ **Edit Mode** for line items with ✏️/✓ buttons
- ✅ **Comprehensive Summary** with tax calculation

---

## 🚀 Already Deployed!

**The application is LIVE on Vercel with auto-deploy enabled.**

Every push to the `main` branch automatically deploys to production.

### Current Deployment
- **Repository**: github.com/audiofile2369-art/quote
- **Platform**: Vercel
- **Database**: Neon PostgreSQL (serverless)
- **Branch**: `main` (auto-deploy)

---

## 📖 How to Use

### 1. **Navigate Tabs**
- **Info Tab**: Client information (future feature)
- **Equipment Packages Tab**: Manage all equipment line items
- **Todo List Tab**: Track project tasks and milestones
- **Summary Tab**: View cost breakdown and totals
- **Testing & Calibration**: Equipment testing records (future)
- **Calendar**: Task scheduling (future)

### 2. **Add Equipment Items**

#### Quick Method:
1. Click "Equipment Packages" tab
2. Click "Add Package" button
3. Select from 12 pre-built packages
4. Items auto-populate with default line items

#### Manual Method:
1. Click "+ Custom Item" button
2. Select category (or create custom)
3. Enter description (supports multiline)
4. Enter quantity, cost, and price
5. Auto-saves immediately

### 3. **Edit Existing Items**

1. Find the item in Equipment Packages tab
2. Click the **✏️ Edit** button on the right
3. Modify description, qty, cost, or price
4. Click the **✓ Checkmark** button to save
5. Changes sync across all open tabs

### 4. **Manage Todos**

#### General Todos:
- View all 32 project-wide tasks
- Check off completed items
- Set priorities (P1-P4)
- Add deadlines
- Track completion dates

#### Package-Specific Todos:
- View tasks organized by equipment package
- 118 pre-built todos across 8 packages
- Add custom todos per package
- Monitor progress per section

### 5. **View Summary**

1. Click "Summary" tab
2. See breakdown by equipment package
3. Review subtotals and grand total
4. Tax calculated automatically (8.25% Dallas)
5. Print or export report (future feature)

---

## 🛠️ For Developers

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/audiofile2369-art/quote.git
cd quote

# Install dependencies
npm install

# Create .env file
echo "DATABASE_URL=your_postgresql_connection_string" > .env

# Run locally
npm start

# Open browser
# Navigate to http://localhost:3000
```

### Database Setup

The application uses PostgreSQL with these tables:
- `jobs` - Project/job records
- `job_items` - Equipment line items
- `package_templates` - Equipment package templates
- `line_item_templates` - Line item templates

Tables auto-initialize on first run.

### Make Changes

1. Edit files in `public/` directory
2. Test locally: `npm start`
3. Commit changes: `git commit -am "Your message"`
4. Push to GitHub: `git push origin main`
5. Vercel auto-deploys in ~1-2 minutes

---

## 📊 Default Equipment Packages

1. **Tank and Excavation** - Complete excavation, tank supply, structural work
2. **Forecourt Island Equipment** - Crash protectors, sumps, piping
3. **Forecourt Submerged Pump Package** - Pumps, valves, manholes
4. **Tank Equipment** - Fill pipes, vents, spill containers, monitoring
5. **Tank Monitor - TLS-450** - Veeder Root TLS-450 system
6. **Tank Monitor - TLS-350** - Veeder Root TLS-350 system  
7. **Dispensers - Wayne Anthem** - Wayne dispenser equipment
8. **Dispensers - Gilbarco** - Gilbarco dispenser equipment
9. **Canopy Equipment** - Canopy structure and lighting
10. **POS - Passport** - Complete point-of-sale system
11. **Tank** - Tank-only package
12. **Tank Monitor Package** - Generic monitor package

---

## 📋 Default Todo Categories

### General Project (32 todos)
- Pre-construction planning
- Environmental assessments
- Permits and zoning
- Site preparation
- Staffing and training
- Final approvals and launch

### Equipment Packages (118 todos)
- Installation checklists per package
- Testing procedures
- Inspection requirements
- Documentation tasks
- Compliance verification

---

## 💡 Pro Tips

### Cost vs Price
- **Cost**: What YOU pay for the item
- **Price**: What you CHARGE the client
- Markup = Price - Cost
- Always enter Cost first, then set Price

### Priorities
- **P1 (Red)**: Urgent/Critical - Regulatory, safety, inspections
- **P2 (Orange)**: High Priority - Installation, commissioning
- **P3 (Blue)**: Normal - Documentation, finishing touches
- **P4**: Low priority - Nice-to-have items

### Edit Mode
- Only one item editable at a time
- Click ✏️ to edit
- Click ✓ to save
- ESC to cancel (future feature)

### Auto-Save
- All changes save immediately
- No "Save" button needed
- Works across multiple tabs
- Database backup every change

---

## 🔧 Common Tasks

### Add a New Equipment Package
1. Go to Equipment Packages tab
2. Click "+ Add Package"
3. Select from dropdown or create custom
4. Package appears in left sidebar

### Add Line Items from Excel
1. Create Python script with `openpyxl`
2. Parse Excel file
3. Map to equipment packages
4. Insert into database
5. See `parse-excel.py` for example

### Customize Todo Lists
1. Go to Todo List tab
2. Click "+ Add Todo" under any section
3. Enter task description
4. Set priority and deadline
5. Save - appears immediately

### Export Data
Currently manual via database queries.  
Future: Export to Excel/PDF buttons.

---

## 🐛 Troubleshooting

### Items Not Saving
- Check console for errors
- Verify DATABASE_URL is set
- Check network tab for API calls
- Ensure PostgreSQL is accessible

### Todos Not Showing
- Check `section_todos` column format
- Verify package names match exactly
- Run `fix-section-todo-names.mjs` if needed

### Price vs Cost Confusion
- Cost = Your expense
- Price = Client charge
- Run `fix-pos-pricing.mjs` example if needed

---

## 📚 Documentation Files

- `README.md` - Project overview and features
- `PROJECT_STATUS.md` - Current status and roadmap
- `QUICKSTART.md` - This file
- `SESSION_SUMMARY_FEB_4_2026.md` - Detailed session notes
- `TODO_ITEMS_PROPOSAL.md` - Default todo reference

---

## 🎉 You're Ready!

The application is live and ready to use. Start by:

1. Opening the deployed site
2. Viewing the default equipment packages
3. Exploring the 150 pre-built todos
4. Creating your first estimate!

**Need more help?** Check `PROJECT_STATUS.md` for detailed feature documentation.

---

**Version**: 2.0  
**Status**: ✅ Production Ready  
**Last Updated**: February 5, 2026
