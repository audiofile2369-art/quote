// Script to fix section todo names to match actual equipment package names
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixSectionTodoNames() {
    const client = await pool.connect();
    try {
        // Get the most recent job
        const result = await client.query('SELECT id, section_todos FROM jobs ORDER BY id DESC LIMIT 1');
        const job = result.rows[0];
        console.log(`Found job ID: ${job.id}`);
        
        const sectionTodos = job.section_todos || {};
        const newSectionTodos = {};
        
        // Mapping from script names to actual database category names
        const nameMap = {
            'Tank and Excavation': 'E. Tank Specifications', // Keep old name for now since that's what's in DB
            'Tank Equipment': 'C. Tank Equipment',
            'Forecourt Submerged Pump Package': 'B. Forecourt Submerged Pump Package',
            'Forecourt Island Equipment': 'A. Forecourt Island Equipment',
            'Tank Monitor Package': 'D. Tank Monitor Package',
            'Dispensers - Wayne Anthem': 'F. Dispensers - Wayne Anthem',
            'Dispensers - Gilbarco': 'G. Dispensers - Gilbarco',
            'Canopy Equipment': 'H. Canopy Equipment'
        };
        
        console.log('\nMapping section todos to actual package names:');
        Object.keys(sectionTodos).forEach(oldName => {
            const newName = nameMap[oldName] || oldName;
            newSectionTodos[newName] = sectionTodos[oldName];
            console.log(`  "${oldName}" -> "${newName}" (${sectionTodos[oldName].length} todos)`);
        });
        
        // Update the job
        await client.query(
            'UPDATE jobs SET section_todos = $1 WHERE id = $2',
            [JSON.stringify(newSectionTodos), job.id]
        );
        
        console.log('\n✅ Successfully remapped section todos to match equipment package names!');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

fixSectionTodoNames();
