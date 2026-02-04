// Script to fix POS - Passport pricing (move price to cost column)
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixPOSPricing() {
    const client = await pool.connect();
    try {
        // Get the most recent job
        const result = await client.query('SELECT id FROM jobs ORDER BY id DESC LIMIT 1');
        const jobId = result.rows[0].id;
        console.log(`Fixing POS - Passport pricing for Job ID: ${jobId}`);
        
        // Get all POS - Passport items
        const items = await client.query(
            'SELECT id, description, price FROM job_items WHERE job_id = $1 AND category = $2',
            [jobId, 'I. POS - Passport']
        );
        
        console.log(`\nFound ${items.rows.length} items to fix...`);
        
        for (const item of items.rows) {
            // Move price to cost, set price to 0
            await client.query(
                'UPDATE job_items SET cost = $1, price = 0 WHERE id = $2',
                [item.price, item.id]
            );
            console.log(`  ✓ Fixed: ${item.description.split('\n')[0].substring(0, 60)}... (Cost: $${item.price})`);
        }
        
        console.log('\n✅ Successfully fixed all POS - Passport pricing!');
        console.log('All values moved from PRICE column to COST column');
        console.log('You can now set your desired markup/price for each item');
        
    } catch (error) {
        console.error('Error fixing pricing:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

fixPOSPricing();
