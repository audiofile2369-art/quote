// Script to add parsed Excel items to equipment packages
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Read parsed JSON
const packages = JSON.parse(fs.readFileSync('parsed-items.json', 'utf8'));

async function addExcelItems() {
    const client = await pool.connect();
    try {
        // Get the most recent job
        const result = await client.query('SELECT id FROM jobs ORDER BY id DESC LIMIT 1');
        const jobId = result.rows[0].id;
        console.log(`Adding line items to Job ID: ${jobId}\n`);
        
        // Map package names to database category names
        const categoryMap = {
            'Forecourt Island Equipment': 'A. Forecourt Island Equipment',
            'Forecourt Submerged Pump Package': 'B. Forecourt Submerged Pump Package',
            'Tank Equipment': 'C. Tank Equipment'
        };
        
        let totalAdded = 0;
        let grandTotal = 0;
        
        for (const [packageName, items] of Object.entries(packages)) {
            if (items.length === 0) continue;
            
            const categoryName = categoryMap[packageName];
            console.log(`Adding ${items.length} items to ${categoryName}...`);
            
            let packageCost = 0;
            for (const item of items) {
                // Format description: Description (PartNumber)
                const description = `${item.desc} (${item.partNum})`;
                
                await client.query(
                    'INSERT INTO job_items (job_id, category, description, qty, cost, price) VALUES ($1, $2, $3, $4, $5, $6)',
                    [jobId, categoryName, description, item.qty, item.cost, 0]
                );
                
                const itemCost = item.cost * item.qty;
                packageCost += itemCost;
                
                console.log(`  ✓ ${item.desc.substring(0, 45)}... (${item.partNum})`);
                console.log(`    Qty: ${item.qty}, Cost: $${item.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })} = $${itemCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
                
                totalAdded++;
            }
            
            grandTotal += packageCost;
            console.log(`  Package subtotal: $${packageCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`);
        }
        
        console.log('✅ Successfully added all line items from Excel!');
        console.log(`Total items added: ${totalAdded}`);
        console.log(`Packages updated: 3`);
        console.log(`Total cost added: $${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        console.log('\nAll prices set to $0 - you can now set your selling prices with markup');
        
    } catch (error) {
        console.error('Error adding items:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

addExcelItems();
