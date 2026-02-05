// Script to add line items from Excel to equipment packages
import pg from 'pg';
import dotenv from 'dotenv';
import openpyxl from 'openpyxl';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Read Excel file
const excelPath = 'C:/Users/saarm/Downloads/Clark Rd - EmcoList Price (1).xlsx';

async function parseAndAddItems() {
    const client = await pool.connect();
    try {
        // Get the most recent job
        const result = await client.query('SELECT id FROM jobs ORDER BY id DESC LIMIT 1');
        const jobId = result.rows[0].id;
        console.log(`Adding line items to Job ID: ${jobId}`);
        
        // Read Excel data
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        const pythonScript = `
import openpyxl
import json

wb = openpyxl.load_workbook('${excelPath}')
ws = wb.active
rows = []

for row in ws.iter_rows(values_only=True):
    rows.append([str(cell) if cell is not None else None for cell in row])

print(json.dumps(rows))
`;
        
        const { stdout } = await execAsync(`python -c "${pythonScript.replace(/\n/g, '; ')}"`);
        const rows = JSON.parse(stdout);
        
        // Parse data and group by equipment package
        const packages = {
            'Forecourt Island Equipment': [],
            'Forecourt Submerged Pump Package': [],
            'Tank Equipment': []
        };
        
        let currentPackage = null;
        
        for (let i = 1; i < rows.length; i++) { // Skip header
            const [partNum, desc, listPrice, qty, total] = rows[i];
            
            // Check if this is a package header
            if (desc && packages.hasOwnProperty(desc)) {
                currentPackage = desc;
                console.log(`\nFound package: ${currentPackage}`);
                continue;
            }
            
            // Skip total rows and empty rows
            if (!partNum || partNum === 'None' || !desc || desc === 'None' || qty === 'Total:') {
                continue;
            }
            
            // Add item to current package
            if (currentPackage && listPrice && qty) {
                const price = parseFloat(listPrice);
                const quantity = parseFloat(qty);
                if (!isNaN(price) && !isNaN(quantity)) {
                    packages[currentPackage].push({
                        partNum,
                        desc,
                        cost: price,
                        qty: quantity
                    });
                }
            }
        }
        
        // Find category names in database
        const categoryMap = {
            'Forecourt Island Equipment': 'A. Forecourt Island Equipment',
            'Forecourt Submerged Pump Package': 'B. Forecourt Submerged Pump Package',
            'Tank Equipment': 'C. Tank Equipment'
        };
        
        // Add items to database
        let totalAdded = 0;
        
        for (const [packageName, items] of Object.entries(packages)) {
            if (items.length === 0) continue;
            
            const categoryName = categoryMap[packageName];
            console.log(`\nAdding ${items.length} items to ${categoryName}...`);
            
            let packageCost = 0;
            for (const item of items) {
                const description = `${item.desc} (${item.partNum})`;
                await client.query(
                    'INSERT INTO job_items (job_id, category, description, qty, cost, price) VALUES ($1, $2, $3, $4, $5, $6)',
                    [jobId, categoryName, description, item.qty, item.cost, 0]
                );
                const itemCost = item.cost * item.qty;
                packageCost += itemCost;
                console.log(`  ✓ ${item.desc.substring(0, 50)}... (${item.partNum}) - Qty: ${item.qty}, Cost: $${item.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })} = $${itemCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
                totalAdded++;
            }
            
            console.log(`  Package subtotal: $${packageCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        }
        
        console.log('\n✅ Successfully added all line items!');
        console.log(`Total items added: ${totalAdded}`);
        console.log(`Packages updated: ${Object.keys(packages).filter(k => packages[k].length > 0).length}`);
        
    } catch (error) {
        console.error('Error adding items:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

parseAndAddItems();
