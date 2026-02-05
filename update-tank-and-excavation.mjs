// Script to rename Tank Specifications to Tank and Excavation and add new line items
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// New line items to add (using midpoint of ranges for cost)
const newLineItems = [
    { description: 'Tank Supply & Delivery\n30,000 gal fiberglass-coated steel UST', qty: 1, cost: 90000.00, price: 0 },
    { description: 'Crane & Rigging\nTank set', qty: 1, cost: 5000.00, price: 0 },
    { description: 'Excavation\nOSHA sloped', qty: 1402, cost: 12.50, price: 0 },
    { description: 'Haul-Off Native Soil\nExpansive clay/fill', qty: 971, cost: 20.00, price: 0 },
    { description: 'Pea Gravel Import\nDelivered', qty: 210, cost: 40.00, price: 0 },
    { description: 'Fabric Liner Installation\nTank envelope', qty: 1, cost: 2500.00, price: 0 },
    { description: 'Deadman Anchors\nReinforced concrete', qty: 14, cost: 175.00, price: 0 },
    { description: 'Structural Slab (8")\nReinforced concrete', qty: 67, cost: 175.00, price: 0 },
    { description: 'Rebar Supply & Placement\nSlab + anchors', qty: 6000, cost: 0.90, price: 0 },
    { description: 'Concrete Finishing & Curing\nJoints, slope, curing', qty: 1, cost: 2500.00, price: 0 },
    { description: 'Compaction & Testing\nGeotech oversight', qty: 1, cost: 4000.00, price: 0 },
    { description: 'Traffic Control\nLane closure', qty: 1, cost: 2000.00, price: 0 },
    { description: 'Permits & Inspections\nCity, fire marshal, TCEQ', qty: 1, cost: 3000.00, price: 0 },
    { description: 'Contingency\nAllowance (7.5%)', qty: 1, cost: 11000.00, price: 0 }
];

async function updateTankAndExcavation() {
    const client = await pool.connect();
    try {
        // Get the most recent job
        const result = await client.query('SELECT id FROM jobs ORDER BY id DESC LIMIT 1');
        const jobId = result.rows[0].id;
        console.log(`Updating Tank and Excavation package for Job ID: ${jobId}`);
        
        // Find the Tank Specifications category
        const categoryCheck = await client.query(
            'SELECT DISTINCT category FROM job_items WHERE job_id = $1 AND category LIKE $2',
            [jobId, '%Tank Specification%']
        );
        
        let oldCategoryName = 'E. Tank Specifications';
        if (categoryCheck.rows.length > 0) {
            oldCategoryName = categoryCheck.rows[0].category;
            console.log(`Found existing category: ${oldCategoryName}`);
        }
        
        const newCategoryName = oldCategoryName.replace('Tank Specifications', 'Tank and Excavation');
        console.log(`New category name: ${newCategoryName}`);
        
        // Update existing items to new category name
        const updateResult = await client.query(
            'UPDATE job_items SET category = $1 WHERE job_id = $2 AND category = $3',
            [newCategoryName, jobId, oldCategoryName]
        );
        console.log(`\nUpdated ${updateResult.rowCount} existing items to new category name`);
        
        // Add new line items
        console.log(`\nAdding ${newLineItems.length} new line items...`);
        
        let totalCost = 0;
        for (const item of newLineItems) {
            await client.query(
                'INSERT INTO job_items (job_id, category, description, qty, cost, price) VALUES ($1, $2, $3, $4, $5, $6)',
                [jobId, newCategoryName, item.description, item.qty, item.cost, item.price]
            );
            const itemCost = item.cost * item.qty;
            totalCost += itemCost;
            console.log(`  ✓ ${item.description.split('\n')[0].substring(0, 50)}... (Qty: ${item.qty}, Cost: $${item.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })} = $${itemCost.toLocaleString('en-US', { minimumFractionDigits: 2 })})`);
        }
        
        // Get all items in the category to show total
        const allItems = await client.query(
            'SELECT qty, cost FROM job_items WHERE job_id = $1 AND category = $2',
            [jobId, newCategoryName]
        );
        
        const categoryTotal = allItems.rows.reduce((sum, row) => sum + (parseFloat(row.qty) * parseFloat(row.cost)), 0);
        
        console.log('\n✅ Successfully updated Tank and Excavation package!');
        console.log(`New category name: ${newCategoryName}`);
        console.log(`Added ${newLineItems.length} new line items`);
        console.log(`New items cost: $${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        console.log(`Total items in category: ${allItems.rows.length}`);
        console.log(`Total package cost: $${categoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        
    } catch (error) {
        console.error('Error updating Tank and Excavation package:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

updateTankAndExcavation();
