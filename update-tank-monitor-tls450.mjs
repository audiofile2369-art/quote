// Script to update Tank Monitor Package to TLS-450 with new line items
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// New TLS-450 line items with researched pricing
const tls450Items = [
    { 
        description: 'Piping Sump Sensor\n794380-208', 
        qty: 6, 
        cost: 389.00,  // Average from research: $364-456
        price: 0 
    },
    { 
        description: 'Interstitial Sensor (steel tanks) 16\' cable\n794390-420', 
        qty: 1, 
        cost: 733.00,  // Average from research: $731-808
        price: 0 
    },
    { 
        description: '2" Interstitial Cap & Ring\n312020-928', 
        qty: 1, 
        cost: 229.00,  // Average from research: $215-240
        price: 0 
    },
    { 
        description: '5\' Probe, 4" Mag Plus, ICPD, Water Detection, UL\n888391-420', 
        qty: 3, 
        cost: 2338.00,  // From research: $2338-2715
        price: 0 
    },
    { 
        description: '4" NPT Riser Cap and Ring Kit for In-Tank Probes\n312020-952', 
        qty: 2, 
        cost: 299.00,  // Average from research: $284-326
        price: 0 
    },
    { 
        description: 'Ethanol probe install kit (5\' cable)\nTLS4 SERIES 886100-000', 
        qty: 2, 
        cost: 705.00,  // Average from research: $674-778
        price: 0 
    },
    { 
        description: 'Probe Install Kits Diesel (5\' Cable)\nTLS4 SERIES 846400-001', 
        qty: 1, 
        cost: 442.00,  // Average from research: $414-514
        price: 0 
    }
];

async function updateTankMonitorPackage() {
    const client = await pool.connect();
    try {
        // Get the most recent job
        const result = await client.query('SELECT id FROM jobs ORDER BY id DESC LIMIT 1');
        const jobId = result.rows[0].id;
        console.log(`Updating Tank Monitor Package for Job ID: ${jobId}`);
        
        // Find the Tank Monitor category name
        const categoryCheck = await client.query(
            'SELECT DISTINCT category FROM job_items WHERE job_id = $1 AND category LIKE $2',
            [jobId, '%Tank Monitor%']
        );
        
        let categoryName = 'D. Tank Monitor Package';
        if (categoryCheck.rows.length > 0) {
            categoryName = categoryCheck.rows[0].category;
            console.log(`Found existing category: ${categoryName}`);
        }
        
        // Delete all existing items in Tank Monitor Package
        const deleteResult = await client.query(
            'DELETE FROM job_items WHERE job_id = $1 AND category = $2',
            [jobId, categoryName]
        );
        console.log(`\nDeleted ${deleteResult.rowCount} old items from ${categoryName}`);
        
        // Rename the category to include TLS-450
        const newCategoryName = categoryName.replace('Tank Monitor Package', 'Tank Monitor - TLS-450');
        
        // Add new TLS-450 items
        console.log(`\nAdding ${tls450Items.length} new TLS-450 line items...`);
        
        let totalCost = 0;
        for (const item of tls450Items) {
            await client.query(
                'INSERT INTO job_items (job_id, category, description, qty, cost, price) VALUES ($1, $2, $3, $4, $5, $6)',
                [jobId, newCategoryName, item.description, item.qty, item.cost, item.price]
            );
            const itemCost = item.cost * item.qty;
            totalCost += itemCost;
            console.log(`  ✓ ${item.description.split('\n')[0].substring(0, 50)}... (Qty: ${item.qty}, Cost: $${item.cost} = $${itemCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
        }
        
        console.log('\n✅ Successfully updated Tank Monitor Package to TLS-450!');
        console.log(`New category name: ${newCategoryName}`);
        console.log(`Total line items: ${tls450Items.length}`);
        console.log(`Total Cost: $${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`\nPrices are set to $0 - you can now set your selling prices with markup`);
        
    } catch (error) {
        console.error('Error updating Tank Monitor package:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

updateTankMonitorPackage();
