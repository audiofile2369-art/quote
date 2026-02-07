# Quick Start Guide - Gas Station Project Manager

**Last Updated**: February 7, 2026

---

## 🎯 What This Is

A comprehensive web-based project manager for **gas station construction projects** that includes:

- ✅ **12 Pre-Built Equipment Packages** with detailed line items
- ✅ **Professional PDF Generation** with company/contractor logos
- ✅ **Drag-and-Drop Package Reordering** on page and for PDF
- ✅ **Contractor Management** - Assign, track, and share packages
- ✅ **Save as Default** - Save current line items as template defaults
- ✅ **Scope of Work & Disclaimers** - Per package and general
- ✅ **150 Default Todos** specific to Dallas, Texas gas stations
- ✅ **Cost & Price Tracking** for accurate estimates
- ✅ **Auto-Save** to PostgreSQL database
- ✅ **Multi-Tab Sync** - Changes update across browser tabs

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
- **Project Info**: Client info, station name, company details
- **Equipment Packages**: Manage all equipment line items
- **Scope of Work**: General and per-package scope
- **Disclaimers**: General and per-package disclaimers
- **Todo List**: Track project tasks and milestones
- **Summary**: View cost breakdown and generate PDF

### 2. **Add Equipment Packages**

#### Quick Method:
1. Click "Equipment Packages" tab
2. Click "➕ Add Equipment Package" button
3. Select from 12 pre-built packages
4. Items auto-populate with default line items

#### Reorder Packages:
1. Click "↕️ Reorder" button in toolbar
2. Drag and drop packages to new order
3. Click "Apply Order" - order saved for page and PDF

### 3. **Generate PDF Estimate**

1. Go to Summary tab
2. Click "Generate PDF Quote" button
3. Reorder packages if needed in popup
4. PDF downloads with:
   - Company logo (if uploaded)
   - Station name and client info
   - Price summary with grand total
   - Each package with line items
   - Scope of work per package
   - Disclaimers per package
   - Contractor logos (if assigned)
   - Page numbers

### 4. **Manage Contractors**

#### Assign Contractor to Package:
1. Go to Equipment Packages tab
2. Click contractor dropdown on package header
3. Select existing or type new contractor name
4. Upload logo (saved for future use)

#### Send Package to Contractor:
1. Select packages with checkboxes
2. Click "📤 Send Selected to Contractor"
3. Share generated link

### 5. **Save as Default**

Save current package line items as the default template:
1. Edit line items in a package (qty, cost, price)
2. Click "Save as Default" button in package header
3. Future packages will use these defaults
4. Button shows "Default" when items match saved defaults

### 6. **Upload Logos**

#### Company Logo:
1. Go to Project Info tab
2. Click "Upload Logo" in Company section
3. Logo appears on PDF estimates

#### Contractor Logo:
1. Assign contractor to package
2. Upload logo for that contractor
3. Logo saved and reused automatically

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

### Database Tables

- `jobs` - Project/job records with all metadata
- `job_items` - Equipment line items per job
- `package_templates` - Equipment package templates
- `line_item_templates` - Line item templates with defaults
- `contractor_links` - Short URLs for contractor sharing

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
4. **Tank** - Tank-only package
5. **Tank Equipment** - Fill pipes, vents, spill containers
6. **Tank Monitor Package** - Generic monitoring equipment
7. **Tank Monitor - TLS-450** - Veeder Root TLS-450 system
8. **Tank Monitor - TLS-350** - Veeder Root TLS-350 system  
9. **Dispensers - Wayne Anthem** - Wayne dispenser equipment
10. **Dispensers - Gilbarco** - Gilbarco dispenser equipment
11. **Canopy Equipment** - Canopy structure and lighting
12. **POS - Passport** - Complete point-of-sale system

---

## 💡 Pro Tips

### Cost vs Price
- **Cost**: What YOU pay for the item
- **Price**: What you CHARGE the client
- Markup = Price - Cost

### Package Order
- Reorder once on Equipment Packages page
- Same order used for PDF generation
- Order saves automatically

### Contractor Logos
- Upload once per contractor
- Logo saved and reused across all projects
- Appears on PDF under their assigned packages

### Save as Default
- Only saves for that specific package template
- Includes qty, cost, and price
- Button disappears when items match defaults

---

## 🐛 Troubleshooting

### Modal Won't Close
- Fixed in latest version
- Clear browser cache if issue persists

### Items Not Saving
- Check console for errors
- Verify DATABASE_URL is set
- Check network tab for API calls

### PDF Not Generating
- Check for JavaScript errors
- Ensure pdfMake library loaded
- Try refreshing page

### Package Order Not Saving
- Click "Apply Order" in reorder modal
- Order saves to both page and PDF settings

---

## 📚 Documentation Files

- `README.md` - Project overview and features
- `QUICKSTART.md` - This file
- `SESSION_SUMMARY_FEB_4_2026.md` - Detailed session notes
- `CHANGES_FEB_4_2026.md` - Changes log
- `TODO_ITEMS_PROPOSAL.md` - Default todo reference

---

## 🎉 You're Ready!

The application is live and ready to use. Start by:

1. Opening the deployed site
2. Creating a new project
3. Adding equipment packages
4. Uploading your company logo
5. Generating your first PDF estimate!

**Need more help?** Check `README.md` for detailed feature documentation.

---

**Version**: 3.0  
**Status**: ✅ Production Ready  
**Last Updated**: February 7, 2026
