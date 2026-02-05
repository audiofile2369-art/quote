// Script to add Tank Monitor - TLS-350 equipment package
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// TLS-350 line items from screenshot
const tls350Items = [
    { description: 'TLS 350 Console (847090-222)', qty: 1, cost: 2500.00, price: 0 },
    { description: 'TCP/IP Card w/ remote access setup ((INCLUDED))', qty: 1, cost: 0.00, price: 0 },
    { description: 'CSLD and PLLD Software Enhancement Module (330020)', qty: 1, cost: 400.00, price: 0 },
    { description: 'SS Probe, 0.1 Mag Plus, HGP, Water Detection, UL (846397-109)', qty: 3, cost: 2500.00, price: 0 },
    { description: 'Ethanol probe install kit (5\' cable) (886100-010)', qty: 2, cost: 781.00, price: 0 },
    { description: 'Probe Install Kits Diesel (5\' Cable) (846400-001)', qty: 1, cost: 464.00, price: 0 },
    { description: 'PLLD Interafce Module for TLS-350 (330843-001)', qty: 1, cost: 1100.00, price: 0 },
    { description: 'Veeder-root Gilbarco Tls-350 Plld Line Leak Transducer (848480-001)', qty: 3, cost: 800.00, price: 0 },
    { description: 'Piping Sump Sensor (794380-208)', qty: 6, cost: 215.00, price: 0 },
    { description: 'Interstitial Sensor (steel tanks) 16\' cablele (794390-420)', qty: 1, cost: 175.00, price: 0 },
    { description: '2" Interstitial Cap & Ring (312020-928)', qty: 1, cost: 314.00, price: 0 },
    { description: '4" NPT Riser Cap and Ring Kit for In-Tank Probes (312020-952)', qty: 3, cost: 314.00, price: 0 }
];

async function addTLS350Package() {
    const client = await pool.connect();
    try {
        // Get the most recent job
        const result = await client.query('SELECT id FROM jobs ORDER BY id DESC LIMIT 1');
        const jobId = result.rows[0].id;
        console.log(`Adding Tank Monitor - TLS-350 package to Job ID: ${jobId}`);
        
        const categoryName = 'J. Tank Monitor - TLS-350';
        
        console.log(`\nAdding ${tls350Items.length} line items...`);
        
        let totalCost = 0;
        for (const item of tls350Items) {
            await client.query(
                'INSERT INTO job_items (job_id, category, description, qty, cost, price) VALUES ($1, $2, $3, $4, $5, $6)',
                [jobId, categoryName, item.description, item.qty, item.cost, item.price]
            );
            const itemCost = item.cost * item.qty;
            totalCost += itemCost;
            console.log(`  ✓ ${item.description.substring(0, 60)}... (Qty: ${item.qty}, Cost: $${item.cost} = $${itemCost.toLocaleString('en-US', { minimumFractionDigits: 2 })})`);
        }
        
        console.log('\n✅ Successfully added Tank Monitor - TLS-350 package!');
        console.log(`Total line items: ${tls350Items.length}`);
        console.log(`Total Cost: $${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        console.log(`\nPrices are set to $0 - you can now set your selling prices with markup`);
        
    } catch (error) {
        console.error('Error adding TLS-350 package:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

addTLS350Package();
