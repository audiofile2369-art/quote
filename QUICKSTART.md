# Quick Start Guide

## ✅ What I Built

A simple, deployable estimator/quote builder that:
- Works entirely in the browser (no database needed)
- Lets you add line items with quantities and prices
- Calculates totals automatically with tax
- **Share via URL** - Send a link to someone, they fill in pricing, send link back
- Export/Import JSON for collaboration
- Generate PDF quotes
- Mobile-friendly

## 🚀 Deploy to Vercel (FREE)

### Step 1: Create GitHub Repo
1. Go to github.com
2. Click "New repository"
3. Name it: `estimator`
4. Don't initialize with anything
5. Create repository

### Step 2: Push Code
```bash
cd C:\Users\saarm\estimator
git remote add origin https://github.com/YOUR_USERNAME/estimator.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy on Vercel
1. Go to https://vercel.com
2. Sign up/Login with GitHub
3. Click "New Project"
4. Import your `estimator` repository
5. Click "Deploy"
6. Done! You'll get a URL like: `estimator.vercel.app`

## 📝 How to Use

### Basic Workflow:
1. Fill in client info on "Info" tab
2. Add/edit line items on "Line Items" tab
3. View totals on "Summary" tab
4. Click "Generate PDF" to create quote

### Collaboration Workflow:
1. Fill in line items and quantities
2. Click "Share Link" button
3. Send the URL to your partner/supplier
4. They open the link, fill in their prices
5. They click "Share Link" and send it back
6. You open their link - done!

### Alternative: JSON Export/Import
1. Click "Export JSON"
2. Email the JSON file to someone
3. They click "Import JSON" and select the file
4. They fill in prices
5. They export and send back to you
6. You import their file - it merges the data!

## 🎯 Key Features

- **No Their Price Column** - Just YOUR pricing
- **All Line Items Together** - No separate dispenser tab
- **URL Sharing** - Data encoded in URL, no server needed
- **Auto-merge** - Importing JSON won't overwrite your existing data
- **Auto-save** - Data saves to browser automatically
- **Mobile Friendly** - Works on phone/tablet

## 🔧 Local Testing

```bash
npm run dev
```

Then open: http://localhost:3000

## 💡 Tips

- Use "Share Link" for quick collaboration
- Use "Export JSON" for permanent records
- Data is saved in your browser automatically
- To start fresh, clear your browser data or use incognito mode

## Need Help?

The app is just HTML/CSS/JavaScript - super simple to modify. All code is in:
- `public/index.html` - The page structure
- `public/css/style.css` - The styling
- `public/js/app.js` - The functionality
