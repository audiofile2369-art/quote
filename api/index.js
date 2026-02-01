import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize database tables
async function initDB() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS jobs (
                id SERIAL PRIMARY KEY,
                client_name VARCHAR(255),
                site_address TEXT,
                quote_date DATE,
                quote_number VARCHAR(100),
                company_name VARCHAR(255),
                contact_name VARCHAR(255),
                phone VARCHAR(50),
                email VARCHAR(255),
                project_notes TEXT,
                tax_rate DECIMAL(5,2),
                discount DECIMAL(10,2),
                payment_terms TEXT,
                scope_of_work TEXT,
                disclaimers TEXT,
                files JSONB DEFAULT '[]',
                section_scopes JSONB DEFAULT '{}',
                section_disclaimers JSONB DEFAULT '{}',
                contractor_assignments JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS job_items (
                id SERIAL PRIMARY KEY,
                job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
                category VARCHAR(255),
                description TEXT,
                qty DECIMAL(10,2),
                price DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        console.log('✓ Database tables initialized');
    } catch (err) {
        console.error('Database initialization error:', err);
    } finally {
        client.release();
    }
}

initDB();

// API Routes

// Get all jobs
app.get('/api/jobs', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, client_name, site_address, quote_number, quote_date, created_at, updated_at
            FROM jobs 
            ORDER BY updated_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching jobs:', err);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// Get single job with all details
app.get('/api/jobs/:id', async (req, res) => {
    try {
        const jobResult = await pool.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
        
        if (jobResult.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const itemsResult = await pool.query(
            'SELECT * FROM job_items WHERE job_id = $1 ORDER BY id',
            [req.params.id]
        );

        const job = jobResult.rows[0];
        job.items = itemsResult.rows.map(item => ({
            category: item.category,
            description: item.description,
            qty: parseFloat(item.qty),
            price: parseFloat(item.price)
        }));

        res.json(job);
    } catch (err) {
        console.error('Error fetching job:', err);
        res.status(500).json({ error: 'Failed to fetch job' });
    }
});

// Create new job
app.post('/api/jobs', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const jobResult = await client.query(`
            INSERT INTO jobs (
                client_name, site_address, quote_date, quote_number,
                company_name, contact_name, phone, email,
                project_notes, tax_rate, discount, payment_terms,
                scope_of_work, disclaimers, files, section_scopes, section_disclaimers, contractor_assignments
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING id
        `, [
            req.body.clientName,
            req.body.siteAddress,
            req.body.quoteDate || null,
            req.body.quoteNumber,
            req.body.companyName,
            req.body.contactName,
            req.body.phone,
            req.body.email,
            req.body.projectNotes,
            req.body.taxRate,
            req.body.discount,
            req.body.paymentTerms,
            req.body.scopeOfWork,
            req.body.disclaimers,
            JSON.stringify(req.body.files || []),
            JSON.stringify(req.body.sectionScopes || {}),
            JSON.stringify(req.body.sectionDisclaimers || {}),
            JSON.stringify(req.body.contractorAssignments || {})
        ]);

        const jobId = jobResult.rows[0].id;

        // Insert items
        if (req.body.items && req.body.items.length > 0) {
            for (const item of req.body.items) {
                await client.query(`
                    INSERT INTO job_items (job_id, category, description, qty, price)
                    VALUES ($1, $2, $3, $4, $5)
                `, [jobId, item.category, item.description, item.qty, item.price]);
            }
        }

        await client.query('COMMIT');
        res.json({ id: jobId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating job:', err);
        res.status(500).json({ error: 'Failed to create job' });
    } finally {
        client.release();
    }
});

// Update job
app.put('/api/jobs/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        console.log('PUT /api/jobs/:id called');
        console.log('Job ID:', req.params.id);
        console.log('Items count:', req.body.items?.length);
        console.log('Section scopes:', JSON.stringify(req.body.sectionScopes));
        
        await client.query('BEGIN');

        await client.query(`
            UPDATE jobs SET
                client_name = $1, site_address = $2, quote_date = $3, quote_number = $4,
                company_name = $5, contact_name = $6, phone = $7, email = $8,
                project_notes = $9, tax_rate = $10, discount = $11, payment_terms = $12,
                scope_of_work = $13, disclaimers = $14, files = $15,
                section_scopes = $16, section_disclaimers = $17, contractor_assignments = $18, updated_at = NOW()
            WHERE id = $19
        `, [
            req.body.clientName,
            req.body.siteAddress,
            req.body.quoteDate || null,
            req.body.quoteNumber,
            req.body.companyName,
            req.body.contactName,
            req.body.phone,
            req.body.email,
            req.body.projectNotes,
            req.body.taxRate,
            req.body.discount,
            req.body.paymentTerms,
            req.body.scopeOfWork,
            req.body.disclaimers,
            JSON.stringify(req.body.files || []),
            JSON.stringify(req.body.sectionScopes || {}),
            JSON.stringify(req.body.sectionDisclaimers || {}),
            JSON.stringify(req.body.contractorAssignments || {}),
            req.params.id
        ]);

        // Delete old items and insert new ones
        await client.query('DELETE FROM job_items WHERE job_id = $1', [req.params.id]);

        if (req.body.items && req.body.items.length > 0) {
            for (const item of req.body.items) {
                await client.query(`
                    INSERT INTO job_items (job_id, category, description, qty, price)
                    VALUES ($1, $2, $3, $4, $5)
                `, [req.params.id, item.category, item.description, item.qty, item.price]);
            }
        }

        await client.query('COMMIT');
        console.log('Job updated successfully');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating job:', err);
        res.status(500).json({ error: 'Failed to update job' });
    } finally {
        client.release();
    }
});

// Delete job
app.delete('/api/jobs/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM jobs WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting job:', err);
        res.status(500).json({ error: 'Failed to delete job' });
    }
});

export default app;
