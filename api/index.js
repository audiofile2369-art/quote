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
                contractor_section_disclaimers JSONB DEFAULT '{}',
                section_upcharges JSONB DEFAULT '{}',
                contractor_assignments JSONB DEFAULT '{}',
                todos JSONB DEFAULT '[]',
                section_todos JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Add contractor_assignments column if it doesn't exist (for existing tables)
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='contractor_assignments') THEN
                    ALTER TABLE jobs ADD COLUMN contractor_assignments JSONB DEFAULT '{}';
                END IF;
            END $$;
        `);

        // Add contractor_section_disclaimers column if it doesn't exist (for existing tables)
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='contractor_section_disclaimers') THEN
                    ALTER TABLE jobs ADD COLUMN contractor_section_disclaimers JSONB DEFAULT '{}';
                END IF;
            END $$;
        `);

        // Add section_upcharges column if it doesn't exist (for existing tables)
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='section_upcharges') THEN
                    ALTER TABLE jobs ADD COLUMN section_upcharges JSONB DEFAULT '{}';
                END IF;
            END $$;
        `);

        // Add todos column if it doesn't exist (for existing tables)
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='todos') THEN
                    ALTER TABLE jobs ADD COLUMN todos JSONB DEFAULT '[]';
                END IF;
            END $$;
        `);

        // Add section_todos column if it doesn't exist (for existing tables)
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='section_todos') THEN
                    ALTER TABLE jobs ADD COLUMN section_todos JSONB DEFAULT '{}';
                END IF;
            END $$;
        `);

        // Create contractor_links table for short URLs
        await client.query(`
            CREATE TABLE IF NOT EXISTS contractor_links (
                id SERIAL PRIMARY KEY,
                short_code VARCHAR(10) UNIQUE NOT NULL,
                job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
                contractor_name VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS job_items (
                id SERIAL PRIMARY KEY,
                job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
                category VARCHAR(255),
                description TEXT,
                qty DECIMAL(10,2),
                cost DECIMAL(10,2) DEFAULT 0,
                price DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Add cost column to job_items if it doesn't exist (for existing tables)
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_items' AND column_name='cost') THEN
                    ALTER TABLE job_items ADD COLUMN cost DECIMAL(10,2) DEFAULT 0;
                END IF;
            END $$;
        `);
        
        // Equipment package templates (predefined package types)
        await client.query(`
            CREATE TABLE IF NOT EXISTS package_templates (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // Line item templates (master list of all line items with defaults)
        await client.query(`
            CREATE TABLE IF NOT EXISTS line_item_templates (
                id SERIAL PRIMARY KEY,
                package_template_id INTEGER REFERENCES package_templates(id) ON DELETE SET NULL,
                description TEXT NOT NULL,
                default_qty DECIMAL(10,2) DEFAULT 1,
                default_price DECIMAL(10,2) DEFAULT 0,
                is_default_for_package BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // Seed default package templates if empty
        const packageCount = await client.query('SELECT COUNT(*) FROM package_templates');
        if (parseInt(packageCount.rows[0].count) === 0) {
            const defaultPackages = [
                'Forecourt Island Equipment',
                'Forecourt Submerged Pump Package',
                'Tank',
                'Tank Equipment',
                'Tank Monitor Package',
                'Dispensers - Wayne Anthem',
                'Dispensers - Gilbarco',
                'Canopy Equipment'
            ];
            for (let i = 0; i < defaultPackages.length; i++) {
                await client.query(
                    'INSERT INTO package_templates (name, sort_order) VALUES ($1, $2)',
                    [defaultPackages[i], i + 1]
                );
            }
            console.log('✓ Default package templates seeded');
            
            // Seed default line items
            await seedDefaultLineItems(client);
        } else {
            // Ensure all default packages exist (migration for existing databases)
            const requiredPackages = [
                'Forecourt Island Equipment',
                'Forecourt Submerged Pump Package',
                'Tank',
                'Tank Equipment',
                'Tank Monitor Package',
                'Dispensers - Wayne Anthem',
                'Dispensers - Gilbarco',
                'Canopy Equipment'
            ];
            
            for (let i = 0; i < requiredPackages.length; i++) {
                const exists = await client.query('SELECT id FROM package_templates WHERE name = $1', [requiredPackages[i]]);
                if (exists.rows.length === 0) {
                    await client.query(
                        'INSERT INTO package_templates (name, sort_order) VALUES ($1, $2)',
                        [requiredPackages[i], i + 1]
                    );
                    console.log(`✓ Added missing package: ${requiredPackages[i]}`);
                }
            }
            
            // Delete "Tank and Equipment" if it exists (replaced by Tank + Tank Equipment)
            await client.query(`DELETE FROM package_templates WHERE name = 'Tank and Equipment'`);
            
            // Delete "Tank Specifications" if it exists
            await client.query(`DELETE FROM package_templates WHERE name = 'Tank Specifications'`);
            
            // Check if line_item_templates is empty and seed if needed
            const lineItemCount = await client.query('SELECT COUNT(*) FROM line_item_templates');
            if (parseInt(lineItemCount.rows[0].count) === 0) {
                console.log('Line item templates empty, seeding...');
                await seedDefaultLineItems(client);
            }
        }

        console.log('✓ Database tables initialized');
    } catch (err) {
        console.error('Database initialization error:', err);
    } finally {
        client.release();
    }
}

async function seedDefaultLineItems(client) {
    const defaultItems = [
        // Forecourt Island Equipment
        { package: 'Forecourt Island Equipment', description: '6" round X 7" long crash protector', qty: 12, price: 0, isDefault: true },
        { package: 'Forecourt Island Equipment', description: 'Fiberglass Dispenser Sumps', qty: 3, price: 0, isDefault: true },
        { package: 'Forecourt Island Equipment', description: 'Island Forms 3 X 8 X9 with 6"R', qty: 3, price: 0, isDefault: true },
        { package: 'Forecourt Island Equipment', description: 'Stabilizer bar', qty: 8, price: 0, isDefault: true },
        { package: 'Forecourt Island Equipment', description: 'flex connector 1 1/2" X 16"', qty: 8, price: 0, isDefault: true },
        { package: 'Forecourt Island Equipment', description: 'Impact valve double poppet', qty: 8, price: 0, isDefault: true },
        
        // Forecourt Submerged Pump Package
        { package: 'Forecourt Submerged Pump Package', description: 'OPW closed bottom fiberglass submerged pump sump', qty: 3, price: 0, isDefault: true },
        { package: 'Forecourt Submerged Pump Package', description: 'Sump mounting flange', qty: 3, price: 0, isDefault: true },
        { package: 'Forecourt Submerged Pump Package', description: '42" round manhole Matador', qty: 3, price: 0, isDefault: true },
        { package: 'Forecourt Submerged Pump Package', description: '1 1/2 HP sub pump (Regular/Premium/Diesel)', qty: 3, price: 0, isDefault: true },
        { package: 'Forecourt Submerged Pump Package', description: 'Gasoline DPLLD with SwiftCheck Valve', qty: 2, price: 0, isDefault: true },
        { package: 'Forecourt Submerged Pump Package', description: 'Diesel DPLLD with SwiftCheck Valve', qty: 1, price: 0, isDefault: true },
        { package: 'Forecourt Submerged Pump Package', description: 'Relay w/ hook box', qty: 3, price: 0, isDefault: true },
        { package: 'Forecourt Submerged Pump Package', description: '2" ball valve', qty: 3, price: 0, isDefault: true },
        { package: 'Forecourt Submerged Pump Package', description: '2" X 16" flex connector', qty: 3, price: 0, isDefault: true },
        
        // Tank (the actual tank)
        { package: 'Tank', description: '25,000 gallon ELUTRON double wall underground tank', qty: 1, price: 0, isDefault: true },
        { package: 'Tank', description: 'Add to above for tie-down straps', qty: 7, price: 0, isDefault: true },
        { package: 'Tank', description: 'Add to above for turnbuckles', qty: 14, price: 0, isDefault: true },
        
        // Tank Equipment
        { package: 'Tank Equipment', description: 'Spill containment manhole', qty: 3, price: 0, isDefault: true },
        { package: 'Tank Equipment', description: '10" overfill drop tube', qty: 3, price: 0, isDefault: true },
        { package: 'Tank Equipment', description: '4" fill adaptor w/swivel', qty: 2, price: 0, isDefault: true },
        { package: 'Tank Equipment', description: '4" adaptor standard', qty: 1, price: 0, isDefault: true },
        { package: 'Tank Equipment', description: '4" fill cap', qty: 3, price: 0, isDefault: true },
        { package: 'Tank Equipment', description: 'EVR vapor adaptor manhole', qty: 1, price: 0, isDefault: true },
        { package: 'Tank Equipment', description: 'EVR vapor swivel adaptor', qty: 1, price: 0, isDefault: true },
        { package: 'Tank Equipment', description: 'EVR adaptor cap', qty: 1, price: 0, isDefault: true },
        { package: 'Tank Equipment', description: 'Extractor valve', qty: 3, price: 0, isDefault: true },
        { package: 'Tank Equipment', description: 'Face seal adaptor', qty: 2, price: 0, isDefault: true },
        { package: 'Tank Equipment', description: '2" EVR vent cap', qty: 2, price: 0, isDefault: true },
        { package: 'Tank Equipment', description: 'Aluminum vent cap', qty: 1, price: 0, isDefault: true },
        { package: 'Tank Equipment', description: 'Probe manhole', qty: 3, price: 0, isDefault: true },
        { package: 'Tank Equipment', description: 'Interstitial Manhole', qty: 1, price: 0, isDefault: true },
        { package: 'Tank Equipment', description: 'Monitor Well Manhole', qty: 2, price: 0, isDefault: true },
        
        // Tank Monitor Package
        { package: 'Tank Monitor Package', description: 'TLS-450PLUS Console (Dual USB, RS-232/RS-485)', qty: 1, price: 0, isDefault: true },
        { package: 'Tank Monitor Package', description: 'TLS450PLUS Application Software', qty: 1, price: 0, isDefault: true },
        { package: 'Tank Monitor Package', description: 'Universal Sensor/Probe Interface Module', qty: 1, price: 0, isDefault: true },
        { package: 'Tank Monitor Package', description: 'Universal Input/Output Interface Module (UIOM)', qty: 1, price: 0, isDefault: true },
        { package: 'Tank Monitor Package', description: 'Base Compliance DPLLD Software', qty: 1, price: 0, isDefault: true },
        { package: 'Tank Monitor Package', description: 'SS Probe 0.2 MAG Plus Water Detection - 10 ft', qty: 3, price: 0, isDefault: true },
        { package: 'Tank Monitor Package', description: 'Install Kit - MAG Probe (Gas Phase Separator/Water Detector)', qty: 2, price: 0, isDefault: true },
        { package: 'Tank Monitor Package', description: 'Install Kit - MAG Plus Diesel', qty: 1, price: 0, isDefault: true },
        { package: 'Tank Monitor Package', description: 'Sump Sensor (Piping, 12ft Cable)', qty: 6, price: 0, isDefault: true },
        { package: 'Tank Monitor Package', description: 'Interstitial Sensor - Steel Tank (4-12ft)', qty: 1, price: 0, isDefault: true },
        { package: 'Tank Monitor Package', description: 'TLS450+ Continuous Statistical Leak Detection (CSLD)', qty: 1, price: 0, isDefault: true },
        
        // Dispensers - Wayne Anthem
        { package: 'Dispensers - Wayne Anthem', description: 'DUAL Passport POS terminal (2 servers, scanners, PIN pads)', qty: 1, price: 0, isDefault: true },
        { package: 'Dispensers - Wayne Anthem', description: 'Universal D-Box (for Wayne Anthems)', qty: 1, price: 0, isDefault: true },
        { package: 'Dispensers - Wayne Anthem', description: 'Wayne Anthem Model B23/4 (four grade blending, diesel)', qty: 1, price: 0, isDefault: true },
        { package: 'Dispensers - Wayne Anthem', description: 'Wayne Anthem Model B12/3 (four grade blending)', qty: 1, price: 0, isDefault: true },
        { package: 'Dispensers - Wayne Anthem', description: 'DX Promote annual contract', qty: 1, price: 0, isDefault: true },
        { package: 'Dispensers - Wayne Anthem', description: 'Additional warranty (years 4-5)', qty: 1, price: 0, isDefault: true },
        { package: 'Dispensers - Wayne Anthem', description: 'Unbranded valances', qty: 1, price: 0, isDefault: true },
        { package: 'Dispensers - Wayne Anthem', description: 'OPW Hanging Hardware (Unleaded/Premium)', qty: 1, price: 0, isDefault: true },
        { package: 'Dispensers - Wayne Anthem', description: 'OPW Hanging Hardware (Diesel)', qty: 1, price: 0, isDefault: true },
        { package: 'Dispensers - Wayne Anthem', description: 'POS Installation and commissioning', qty: 1, price: 0, isDefault: true },
        
        // Dispensers - Gilbarco
        { package: 'Dispensers - Gilbarco', description: 'DUAL Passport POS terminal', qty: 1, price: 0, isDefault: true },
        { package: 'Dispensers - Gilbarco', description: 'Gilbarco Encore Model E700 3+1 (four grade, diesel, Flexpay 6)', qty: 1, price: 0, isDefault: true },
        { package: 'Dispensers - Gilbarco', description: 'Gilbarco Encore Model E700 3+0 (three grade, Flexpay 6)', qty: 1, price: 0, isDefault: true },
        { package: 'Dispensers - Gilbarco', description: 'OPW Hanging Hardware (Unleaded/Premium)', qty: 1, price: 0, isDefault: true },
        { package: 'Dispensers - Gilbarco', description: 'OPW Hanging Hardware (Diesel)', qty: 1, price: 0, isDefault: true },
        
        // Canopy Equipment
        { package: 'Canopy Equipment', description: 'Canopy Structure (specify dimensions)', qty: 1, price: 0, isDefault: true },
        { package: 'Canopy Equipment', description: 'LED Lighting Package', qty: 1, price: 0, isDefault: true },
        { package: 'Canopy Equipment', description: 'Fascia/Signage', qty: 1, price: 0, isDefault: true },
        { package: 'Canopy Equipment', description: 'Canopy Installation', qty: 1, price: 0, isDefault: true }
    ];
    
    for (const item of defaultItems) {
        const pkgResult = await client.query('SELECT id FROM package_templates WHERE name = $1', [item.package]);
        if (pkgResult.rows.length > 0) {
            await client.query(`
                INSERT INTO line_item_templates (package_template_id, description, default_qty, default_price, is_default_for_package)
                VALUES ($1, $2, $3, $4, $5)
            `, [pkgResult.rows[0].id, item.description, item.qty, item.price, item.isDefault]);
        }
    }
    console.log('✓ Default line items seeded');
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
            cost: parseFloat(item.cost) || 0,
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
                scope_of_work, disclaimers, files, section_scopes, section_disclaimers, contractor_section_disclaimers, section_upcharges, contractor_assignments,
                todos, section_todos
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
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
            JSON.stringify(req.body.contractorSectionDisclaimers || {}),
            JSON.stringify(req.body.sectionUpcharges || {}),
            JSON.stringify(req.body.contractorAssignments || {}),
            JSON.stringify(req.body.todos || []),
            JSON.stringify(req.body.sectionTodos || {})
        ]);

        const jobId = jobResult.rows[0].id;

        // Insert items
        if (req.body.items && req.body.items.length > 0) {
            for (const item of req.body.items) {
                await client.query(`
                    INSERT INTO job_items (job_id, category, description, qty, cost, price)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [jobId, item.category, item.description, item.qty, item.cost || 0, item.price]);
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

// Helper function to merge files (protects against accidental deletions)
function mergeFiles(existingFiles, incomingFiles, deletedIds) {
    const fileMap = new Map();

    // Add existing files (unless explicitly deleted)
    (existingFiles || []).forEach(file => {
        const key = `${file.name}::${file.url}`;
        if (!deletedIds.includes(key)) {
            fileMap.set(key, file);
        }
    });

    // Add incoming files (won't duplicate due to Map key)
    (incomingFiles || []).forEach(file => {
        const key = `${file.name}::${file.url}`;
        if (!fileMap.has(key)) {
            fileMap.set(key, file);
        }
    });

    return Array.from(fileMap.values());
}

// Update job
app.put('/api/jobs/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        console.log('PUT /api/jobs/:id called');
        console.log('Job ID:', req.params.id);
        console.log('Items count:', req.body.items?.length);
        console.log('Section scopes:', JSON.stringify(req.body.sectionScopes));
        console.log('Deleted file IDs:', req.body._deletedFileIds);

        await client.query('BEGIN');

        // Fetch existing files to merge with incoming files
        const existingJob = await client.query('SELECT files FROM jobs WHERE id = $1', [req.params.id]);
        const existingFiles = existingJob.rows[0]?.files || [];

        // Merge files: keep existing + add new, only delete if explicitly in _deletedFileIds
        const deletedIds = req.body._deletedFileIds || [];
        const mergedFiles = mergeFiles(existingFiles, req.body.files || [], deletedIds);

        console.log('Existing files:', existingFiles.length);
        console.log('Incoming files:', (req.body.files || []).length);
        console.log('Merged files:', mergedFiles.length);

        await client.query(`
            UPDATE jobs SET
                client_name = $1, site_address = $2, quote_date = $3, quote_number = $4,
                company_name = $5, contact_name = $6, phone = $7, email = $8,
                project_notes = $9, tax_rate = $10, discount = $11, payment_terms = $12,
                scope_of_work = $13, disclaimers = $14, files = $15,
                section_scopes = $16, section_disclaimers = $17, contractor_section_disclaimers = $18, section_upcharges = $19, contractor_assignments = $20,
                todos = $21, section_todos = $22, updated_at = NOW()
            WHERE id = $23
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
            JSON.stringify(mergedFiles),
            JSON.stringify(req.body.sectionScopes || {}),
            JSON.stringify(req.body.sectionDisclaimers || {}),
            JSON.stringify(req.body.contractorSectionDisclaimers || {}),
            JSON.stringify(req.body.sectionUpcharges || {}),
            JSON.stringify(req.body.contractorAssignments || {}),
            JSON.stringify(req.body.todos || []),
            JSON.stringify(req.body.sectionTodos || {}),
            req.params.id
        ]);

        // Delete old items and insert new ones
        await client.query('DELETE FROM job_items WHERE job_id = $1', [req.params.id]);

        if (req.body.items && req.body.items.length > 0) {
            for (const item of req.body.items) {
                await client.query(`
                    INSERT INTO job_items (job_id, category, description, qty, cost, price)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [req.params.id, item.category, item.description, item.qty, item.cost || 0, item.price]);
            }
        }

        await client.query('COMMIT');
        console.log('Job updated successfully');

        // Return merged files so client can sync
        res.json({ success: true, files: mergedFiles });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating job:', err);
        res.status(500).json({ error: 'Failed to update job' });
    } finally {
        client.release();
    }
});

// Create short link for contractor
app.post('/api/contractor-links', async (req, res) => {
    const client = await pool.connect();
    try {
        const { jobId, contractorName } = req.body;
        
        // Generate a short random code
        const shortCode = Math.random().toString(36).substring(2, 8);
        
        await client.query(`
            INSERT INTO contractor_links (short_code, job_id, contractor_name, created_at)
            VALUES ($1, $2, $3, NOW())
        `, [shortCode, jobId, contractorName]);
        
        res.json({ shortCode });
    } catch (err) {
        console.error('Error creating contractor link:', err);
        res.status(500).json({ error: 'Failed to create link' });
    } finally {
        client.release();
    }
});

// Get contractor link details
app.get('/api/contractor-links/:shortCode', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT job_id, contractor_name FROM contractor_links WHERE short_code = $1',
            [req.params.shortCode]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Link not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching contractor link:', err);
        res.status(500).json({ error: 'Failed to fetch link' });
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

// ============ PACKAGE TEMPLATES API ============

// Get all package templates
app.get('/api/package-templates', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM package_templates ORDER BY sort_order, name');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching package templates:', err);
        res.status(500).json({ error: 'Failed to fetch package templates' });
    }
});

// Create package template
app.post('/api/package-templates', async (req, res) => {
    try {
        const { name, sort_order } = req.body;
        const result = await pool.query(
            'INSERT INTO package_templates (name, sort_order) VALUES ($1, $2) RETURNING *',
            [name, sort_order || 999]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error creating package template:', err);
        res.status(500).json({ error: 'Failed to create package template' });
    }
});

// Update package template
app.put('/api/package-templates/:id', async (req, res) => {
    try {
        const { name, sort_order } = req.body;
        const result = await pool.query(
            'UPDATE package_templates SET name = $1, sort_order = $2 WHERE id = $3 RETURNING *',
            [name, sort_order, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating package template:', err);
        res.status(500).json({ error: 'Failed to update package template' });
    }
});

// Delete package template
app.delete('/api/package-templates/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM package_templates WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting package template:', err);
        res.status(500).json({ error: 'Failed to delete package template' });
    }
});

// ============ LINE ITEM TEMPLATES API ============

// Get all line item templates (optionally filtered by package)
app.get('/api/line-item-templates', async (req, res) => {
    try {
        const { package_id } = req.query;
        let query = `
            SELECT lit.*, pt.name as package_name 
            FROM line_item_templates lit
            LEFT JOIN package_templates pt ON lit.package_template_id = pt.id
        `;
        const params = [];
        
        if (package_id) {
            query += ' WHERE lit.package_template_id = $1';
            params.push(package_id);
        }
        
        query += ' ORDER BY pt.sort_order, lit.description';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching line item templates:', err);
        res.status(500).json({ error: 'Failed to fetch line item templates' });
    }
});

// Search line item templates (for autocomplete)
app.get('/api/line-item-templates/search', async (req, res) => {
    try {
        const { q } = req.query;
        const result = await pool.query(`
            SELECT DISTINCT description, default_qty, default_price
            FROM line_item_templates
            WHERE description ILIKE $1
            ORDER BY description
            LIMIT 20
        `, [`%${q}%`]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error searching line items:', err);
        res.status(500).json({ error: 'Failed to search line items' });
    }
});

// Create line item template
app.post('/api/line-item-templates', async (req, res) => {
    try {
        const { package_template_id, description, default_qty, default_price, is_default_for_package } = req.body;
        const result = await pool.query(`
            INSERT INTO line_item_templates (package_template_id, description, default_qty, default_price, is_default_for_package)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `, [package_template_id, description, default_qty || 1, default_price || 0, is_default_for_package || false]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error creating line item template:', err);
        res.status(500).json({ error: 'Failed to create line item template' });
    }
});

// Update line item template
app.put('/api/line-item-templates/:id', async (req, res) => {
    try {
        const { package_template_id, description, default_qty, default_price, is_default_for_package } = req.body;
        const result = await pool.query(`
            UPDATE line_item_templates 
            SET package_template_id = $1, description = $2, default_qty = $3, default_price = $4, is_default_for_package = $5, updated_at = NOW()
            WHERE id = $6 RETURNING *
        `, [package_template_id, description, default_qty, default_price, is_default_for_package, req.params.id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating line item template:', err);
        res.status(500).json({ error: 'Failed to update line item template' });
    }
});

// Delete line item template
app.delete('/api/line-item-templates/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM line_item_templates WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting line item template:', err);
        res.status(500).json({ error: 'Failed to delete line item template' });
    }
});

// Get default line items for a specific package (for Add Package modal)
app.get('/api/package-templates/:id/line-items', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM line_item_templates 
            WHERE package_template_id = $1 
            ORDER BY is_default_for_package DESC, description
        `, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching package line items:', err);
        res.status(500).json({ error: 'Failed to fetch package line items' });
    }
});

export default app;
