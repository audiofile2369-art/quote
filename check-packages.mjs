import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkPackages() {
    try {
        const result = await pool.query('SELECT id, name FROM package_templates ORDER BY name');
        console.log('Package Templates in Database:');
        result.rows.forEach(row => {
            console.log(`  ID: ${row.id}, Name: '${row.name}'`);
        });
        
        // Check what's in the job_items table
        const itemsResult = await pool.query('SELECT DISTINCT category FROM job_items ORDER BY category');
        console.log('\nCategories in job_items:');
        itemsResult.rows.forEach(row => {
            console.log(`  '${row.category}'`);
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkPackages();
