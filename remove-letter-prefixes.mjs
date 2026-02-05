import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function removePrefixes() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        console.log('Removing letter prefixes from job_items categories...\n');
        
        // Get all distinct categories
        const categoriesResult = await client.query('SELECT DISTINCT category FROM job_items WHERE category ~ \'^[A-Z]\\. \'');
        const categories = categoriesResult.rows;
        
        console.log(`Found ${categories.length} categories with letter prefixes:\n`);
        
        for (const row of categories) {
            const oldName = row.category;
            const newName = oldName.replace(/^[A-Z]\.\s+/, '');
            
            console.log(`  "${oldName}" → "${newName}"`);
            
            // Update all job_items with this category
            const updateResult = await client.query(
                'UPDATE job_items SET category = $1 WHERE category = $2',
                [newName, oldName]
            );
            
            console.log(`    Updated ${updateResult.rowCount} items`);
        }
        
        // Also update section_todos, section_scopes, section_disclaimers, etc. in jobs table
        console.log('\nUpdating jobs table JSONB fields...\n');
        
        const jobsResult = await client.query('SELECT id, section_todos, section_scopes, section_disclaimers, contractor_section_disclaimers, section_upcharges, section_meetings, contractor_assignments FROM jobs');
        
        for (const job of jobsResult.rows) {
            let updated = false;
            
            // Helper function to clean keys in an object
            const cleanKeys = (obj) => {
                if (!obj || typeof obj !== 'object') return obj;
                const cleaned = {};
                for (const key in obj) {
                    const newKey = key.replace(/^[A-Z]\.\s+/, '');
                    cleaned[newKey] = obj[key];
                    if (newKey !== key) updated = true;
                }
                return cleaned;
            };
            
            const newSectionTodos = cleanKeys(job.section_todos);
            const newSectionScopes = cleanKeys(job.section_scopes);
            const newSectionDisclaimers = cleanKeys(job.section_disclaimers);
            const newContractorSectionDisclaimers = cleanKeys(job.contractor_section_disclaimers);
            const newSectionUpcharges = cleanKeys(job.section_upcharges);
            const newSectionMeetings = cleanKeys(job.section_meetings);
            
            // Clean contractor_assignments (values are arrays of categories)
            let newContractorAssignments = job.contractor_assignments || {};
            if (newContractorAssignments && typeof newContractorAssignments === 'object') {
                for (const contractor in newContractorAssignments) {
                    const sections = newContractorAssignments[contractor];
                    if (Array.isArray(sections)) {
                        newContractorAssignments[contractor] = sections.map(s => s.replace(/^[A-Z]\.\s+/, ''));
                        if (sections.some((s, i) => s !== newContractorAssignments[contractor][i])) {
                            updated = true;
                        }
                    }
                }
            }
            
            if (updated) {
                await client.query(`
                    UPDATE jobs 
                    SET section_todos = $1,
                        section_scopes = $2,
                        section_disclaimers = $3,
                        contractor_section_disclaimers = $4,
                        section_upcharges = $5,
                        section_meetings = $6,
                        contractor_assignments = $7
                    WHERE id = $8
                `, [
                    JSON.stringify(newSectionTodos),
                    JSON.stringify(newSectionScopes),
                    JSON.stringify(newSectionDisclaimers),
                    JSON.stringify(newContractorSectionDisclaimers),
                    JSON.stringify(newSectionUpcharges),
                    JSON.stringify(newSectionMeetings),
                    JSON.stringify(newContractorAssignments),
                    job.id
                ]);
                
                console.log(`  Updated job ID ${job.id}`);
            }
        }
        
        await client.query('COMMIT');
        console.log('\n✅ Successfully removed all letter prefixes!');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

removePrefixes();
