// Script to add POS - Passport equipment package with line items
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const posPackageItems = [
    // PASSPORT-COMBO-AIOPL
    { description: 'Passport Combo Cashier/Manager Workstation\nPP-060CMB-01', qty: 1, cost: 0, price: 6100.00 },
    { description: 'Passport Combo Cashier/Manager Workstation Software\nZ-P60-CMBSW', qty: 1, cost: 0, price: 0.00 },
    { description: 'PLUS Payment Service Offering 1st Year Combo\nZ-P60-SVCB01', qty: 1, cost: 0, price: 0.00 },
    { description: 'Enhanced Dispenser Hub\nZ-P00-MEDH00', qty: 1, cost: 0, price: 0.00 },
    { description: 'Cash Drawer\nPAD1570080,PAD1570081,PAD1570082, PAD1570083', qty: 1, cost: 0, price: 0.00 },
    { description: 'Receipt Printer\nPAD4270013', qty: 1, cost: 0, price: 0.00 },
    { description: 'Mouse Bundled with Keyboard\nQ13181-09', qty: 1, cost: 0, price: 0.00 },
    { description: '2D Scanner Data Logic GD-4590-RS232-BK-B-KIT\nBK-B-KIT', qty: 1, cost: 0, price: 345.00 },
    { description: 'UPS Power Supply\nPAD3310004 (recommended)', qty: 1, cost: 0, price: 125.00 },
    { description: 'PIN PAD M400\nM189058001', qty: 1, cost: 0, price: 1075.00 },
    { description: 'PIN PAD stand, M400\n367-5249-DB', qty: 1, cost: 0, price: 125.00 },
    { description: 'Premium PSO Adder (PX60)', qty: 1, cost: 0, price: 892.00 },
    
    // PASSPORT-CLIENT-AIOPL
    { description: 'Passport PX68 Client Hardware\nPP-060CMB-01', qty: 1, cost: 0, price: 4900.00 },
    { description: 'Passport Client Install Kit\nZ-P60-CMBSW', qty: 1, cost: 0, price: 0.00 },
    { description: 'Epson TM-T88V Receipt Printer\nZ-P00-SVCB01', qty: 1, cost: 0, price: 0.00 },
    { description: 'Cash Drawer\nZ-P00-MEDH00', qty: 1, cost: 0, price: 0.00 },
    { description: 'QWERTY Keyboard\nPAD1570080,PAD1570081,PAD1570082, PAD1570083', qty: 1, cost: 0, price: 0.00 },
    { description: 'Mouse Bundled with Keyboard\nPAD4270013', qty: 1, cost: 0, price: 0.00 },
    { description: 'Passport Client Utilities Software\nQ13181-09', qty: 1, cost: 0, price: 0.00 },
    { description: '1st Year PSO Plus - Required Passport Add-On (Per Unit) Incl.', qty: 1, cost: 0, price: 0.00 },
    { description: '2D Scanner Data Logic GD-4590-RS232-BK-B-KIT\nBK-B-KIT', qty: 1, cost: 0, price: 345.00 },
    { description: 'UPS Power Supply\nPAD3310004 (recommended)', qty: 1, cost: 0, price: 125.00 },
    { description: 'PIN PAD M400', qty: 1, cost: 0, price: 1075.00 },
    { description: 'PIN PAD stand, M400\n367-5249-DB', qty: 1, cost: 0, price: 125.00 }
];

async function addPOSPackage() {
    const client = await pool.connect();
    try {
        // Get the most recent job
        const result = await client.query('SELECT id FROM jobs ORDER BY id DESC LIMIT 1');
        const jobId = result.rows[0].id;
        console.log(`Adding POS - Passport package to Job ID: ${jobId}`);
        
        const categoryName = 'I. POS - Passport';
        
        console.log(`\nAdding ${posPackageItems.length} line items...`);
        
        for (const item of posPackageItems) {
            await client.query(
                'INSERT INTO job_items (job_id, category, description, qty, cost, price) VALUES ($1, $2, $3, $4, $5, $6)',
                [jobId, categoryName, item.description, item.qty, item.cost, item.price]
            );
            console.log(`  ✓ Added: ${item.description.split('\n')[0].substring(0, 60)}...`);
        }
        
        // Calculate totals
        const totalCost = posPackageItems.reduce((sum, item) => sum + (item.cost * item.qty), 0);
        const totalPrice = posPackageItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        console.log('\n✅ Successfully added POS - Passport package!');
        console.log(`Total line items: ${posPackageItems.length}`);
        console.log(`Total Cost: $${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`Total Price: $${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`Package Profit: $${(totalPrice - totalCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        
    } catch (error) {
        console.error('Error adding POS package:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

addPOSPackage();
