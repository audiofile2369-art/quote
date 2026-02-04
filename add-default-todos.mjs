// One-time script to add default todos to the most recent job
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// General Project Todos
const generalTodos = [
    // Pre-Construction / Planning Phase
    { text: 'Complete market analysis and site selection', priority: 'P3', deadline: null },
    { text: 'Secure financing and funding approval', priority: 'P2', deadline: null },
    { text: 'Conduct environmental site assessment (Phase I/II)', priority: 'P2', deadline: null },
    { text: 'Obtain zoning approval from City of Dallas', priority: 'P1', deadline: null },
    { text: 'Submit building permit application to Dallas Building Department', priority: 'P1', deadline: null },
    { text: 'Obtain fire safety approval from Dallas Fire-Rescue', priority: 'P1', deadline: null },
    { text: 'Register business entity with Texas Secretary of State', priority: 'P2', deadline: null },
    { text: 'Obtain Texas Sales Tax Permit', priority: 'P2', deadline: null },
    { text: 'Apply for Federal EIN (Employer Identification Number)', priority: 'P2', deadline: null },
    { text: 'Secure business insurance (liability, environmental, property)', priority: 'P1', deadline: null },
    
    // Environmental & Regulatory
    { text: 'Obtain TCEQ permits for underground storage tanks', priority: 'P1', deadline: null },
    { text: 'Obtain TCEQ vapor recovery system approval', priority: 'P1', deadline: null },
    { text: 'Submit stormwater management plan to TCEQ', priority: 'P1', deadline: null },
    { text: 'Obtain Dallas County Health Department permit (if food service)', priority: 'P2', deadline: null },
    { text: 'Schedule pre-construction meeting with city inspectors', priority: 'P2', deadline: null },
    
    // Site Preparation
    { text: 'Clear and grade site', priority: 'P3', deadline: null },
    { text: 'Install utilities (water, electric, gas, sewer)', priority: 'P2', deadline: null },
    { text: 'Install site drainage system', priority: 'P2', deadline: null },
    { text: 'Pour concrete pads and foundations', priority: 'P2', deadline: null },
    { text: 'Complete excavation for underground tanks', priority: 'P2', deadline: null },
    
    // Staffing & Operations
    { text: 'Hire and train Class A, B, C UST operators', priority: 'P2', deadline: null },
    { text: 'Conduct safety and emergency response training', priority: 'P1', deadline: null },
    { text: 'Secure fuel supply agreements', priority: 'P2', deadline: null },
    { text: 'Set up point-of-sale system and payment processing', priority: 'P3', deadline: null },
    { text: 'Order initial convenience store inventory', priority: 'P3', deadline: null },
    
    // Final Approvals & Launch
    { text: 'Schedule final city building inspection', priority: 'P1', deadline: null },
    { text: 'Schedule fire department final inspection', priority: 'P1', deadline: null },
    { text: 'Schedule TCEQ final inspection', priority: 'P1', deadline: null },
    { text: 'Schedule Texas Dept of Agriculture weights & measures inspection', priority: 'P1', deadline: null },
    { text: 'Obtain Certificate of Occupancy', priority: 'P1', deadline: null },
    { text: 'Plan grand opening and marketing campaign', priority: 'P3', deadline: null },
    { text: 'Submit initial environmental compliance reports', priority: 'P1', deadline: null }
];

// Section-specific todos by package name
const sectionTodos = {
    'Tank and Excavation': [
        { text: 'Verify tank delivery schedule and specifications', priority: 'P2', deadline: null },
        { text: 'Excavate tank pit to proper depth (min 3 ft under traffic)', priority: 'P2', deadline: null },
        { text: 'Install tank anchoring system (if high water table)', priority: 'P2', deadline: null },
        { text: 'Place sand bedding (min 12" under tank)', priority: 'P3', deadline: null },
        { text: 'Position and level tanks (min 1 ft separation between tanks)', priority: 'P2', deadline: null },
        { text: 'Verify tank placement from property line (min 3 ft)', priority: 'P2', deadline: null },
        { text: 'Install cathodic protection system', priority: 'P2', deadline: null },
        { text: 'Backfill with clean sand/approved material', priority: 'P3', deadline: null },
        { text: 'Compact backfill in 6-12" lifts', priority: 'P3', deadline: null },
        { text: 'Perform tank tightness test before backfill', priority: 'P1', deadline: null },
        { text: 'Verify corrosion protection system', priority: 'P1', deadline: null },
        { text: 'Document tank installation with photos', priority: 'P3', deadline: null },
        { text: 'Submit tank installation notification to TCEQ', priority: 'P1', deadline: null },
        { text: 'Schedule tank integrity inspection', priority: 'P1', deadline: null },
        { text: 'Obtain tank installation sign-off from inspector', priority: 'P1', deadline: null }
    ],
    
    'Tank Equipment': [
        { text: 'Install fill pipes with spill containment buckets (5 gal max)', priority: 'P2', deadline: null },
        { text: 'Install tank vents (12 ft above grade, 18" above roof if within 15 ft)', priority: 'P2', deadline: null },
        { text: 'Install vapor recovery vents and Stage I equipment', priority: 'P2', deadline: null },
        { text: 'Install automatic tank gauge (ATG) system', priority: 'P2', deadline: null },
        { text: 'Install overfill prevention devices (alarm at 90%, shutoff at 95%)', priority: 'P1', deadline: null },
        { text: 'Install tank monitoring sensors', priority: 'P2', deadline: null },
        { text: 'Install secondary containment sumps', priority: 'P2', deadline: null },
        { text: 'Install leak detection system', priority: 'P1', deadline: null },
        { text: 'Test ATG system for accuracy and alarms', priority: 'P1', deadline: null },
        { text: 'Test overfill prevention devices', priority: 'P1', deadline: null },
        { text: 'Test leak detection sensors', priority: 'P1', deadline: null },
        { text: 'Verify all tank openings are liquid-tight', priority: 'P1', deadline: null },
        { text: 'Document equipment serial numbers and installation dates', priority: 'P3', deadline: null },
        { text: 'Create tank monitoring procedures manual', priority: 'P3', deadline: null },
        { text: 'Schedule 30-day walkthrough inspection', priority: 'P1', deadline: null }
    ],
    
    'Forecourt Submerged Pump Package': [
        { text: 'Install fiberglass submerged pump sumps', priority: 'P2', deadline: null },
        { text: 'Install sump mounting flanges', priority: 'P2', deadline: null },
        { text: 'Position and anchor 42" manhole covers', priority: 'P2', deadline: null },
        { text: 'Install 1.5 HP submersible pumps (verify correct models for fuel type)', priority: 'P2', deadline: null },
        { text: 'Install gasoline drop tube leak detection (DPLLD) with SwiftCheck valves', priority: 'P2', deadline: null },
        { text: 'Install diesel DPLLD with SwiftCheck valves', priority: 'P2', deadline: null },
        { text: 'Wire pump relay systems with hook boxes', priority: 'P2', deadline: null },
        { text: 'Install 2" ball valves', priority: 'P3', deadline: null },
        { text: 'Install 2" x 16" flex connectors', priority: 'P3', deadline: null },
        { text: 'Install product piping with proper slope', priority: 'P2', deadline: null },
        { text: 'Test pump pressure and flow rates', priority: 'P1', deadline: null },
        { text: 'Test leak detection devices', priority: 'P1', deadline: null },
        { text: 'Verify proper wiring and grounding', priority: 'P1', deadline: null },
        { text: 'Test emergency shutoff functionality', priority: 'P1', deadline: null },
        { text: 'Inspect sump for leaks and proper drainage', priority: 'P1', deadline: null },
        { text: 'Document pump serial numbers and GPM ratings', priority: 'P3', deadline: null }
    ],
    
    'Forecourt Island Equipment': [
        { text: 'Install 6" round x 7" long crash protectors (verify qty)', priority: 'P2', deadline: null },
        { text: 'Position fiberglass dispenser sumps', priority: 'P2', deadline: null },
        { text: 'Pour island forms with concrete (verify dimensions and radius)', priority: 'P2', deadline: null },
        { text: 'Install stabilizer bars', priority: 'P3', deadline: null },
        { text: 'Install 1.5" x 16" flex connectors', priority: 'P3', deadline: null },
        { text: 'Install double poppet impact valves', priority: 'P2', deadline: null },
        { text: 'Install product piping to dispensers', priority: 'P2', deadline: null },
        { text: 'Install vapor recovery piping (Stage II if required)', priority: 'P2', deadline: null },
        { text: 'Test impact valves for proper closure', priority: 'P1', deadline: null },
        { text: 'Inspect flex connectors for leaks', priority: 'P1', deadline: null },
        { text: 'Verify dispenser sump integrity (no cracks or leaks)', priority: 'P1', deadline: null },
        { text: 'Test piping system for tightness', priority: 'P1', deadline: null },
        { text: 'Verify crash protector anchoring', priority: 'P2', deadline: null },
        { text: 'Complete island finishing (paint, striping)', priority: 'P3', deadline: null }
    ],
    
    'Tank Monitor Package': [
        { text: 'Install Veeder-Root TLS-450/350 console', priority: 'P2', deadline: null },
        { text: 'Connect ATG probes to all tanks', priority: 'P2', deadline: null },
        { text: 'Install leak detection sensors', priority: 'P2', deadline: null },
        { text: 'Configure tank capacities and fuel types in system', priority: 'P2', deadline: null },
        { text: 'Set up alarm thresholds and notifications', priority: 'P1', deadline: null },
        { text: 'Install remote monitoring/telemetry (if required)', priority: 'P3', deadline: null },
        { text: 'Connect to internet/network for alerts', priority: 'P3', deadline: null },
        { text: 'Test ATG accuracy with known volumes', priority: 'P1', deadline: null },
        { text: 'Test all alarm conditions (leak, overfill, low fuel)', priority: 'P1', deadline: null },
        { text: 'Verify remote monitoring connectivity', priority: 'P2', deadline: null },
        { text: 'Train operators on system use', priority: 'P2', deadline: null },
        { text: 'Set up regular inventory reconciliation procedures', priority: 'P2', deadline: null },
        { text: 'Document system configuration and passwords', priority: 'P3', deadline: null }
    ],
    
    'Dispensers - Wayne Anthem': [
        { text: 'Position dispensers on island pads', priority: 'P2', deadline: null },
        { text: 'Anchor dispensers to concrete (verify torque specs)', priority: 'P2', deadline: null },
        { text: 'Connect product lines to dispenser inlet', priority: 'P2', deadline: null },
        { text: 'Connect vapor recovery lines (if Stage II)', priority: 'P2', deadline: null },
        { text: 'Install shear valves with leak detection', priority: 'P2', deadline: null },
        { text: 'Connect electrical power and data lines', priority: 'P2', deadline: null },
        { text: 'Install payment terminals (card readers, POS integration)', priority: 'P2', deadline: null },
        { text: 'Connect dispenser to network/controller', priority: 'P2', deadline: null },
        { text: 'Perform initial dispenser calibration (test measures)', priority: 'P1', deadline: null },
        { text: 'Test all payment terminals and card processing', priority: 'P1', deadline: null },
        { text: 'Test emergency shutoff (shear valve impact test)', priority: 'P1', deadline: null },
        { text: 'Test vapor recovery system (pressure decay test)', priority: 'P1', deadline: null },
        { text: 'Verify price display and totalizer accuracy', priority: 'P1', deadline: null },
        { text: 'Schedule Texas Dept of Agriculture weights & measures certification', priority: 'P1', deadline: null },
        { text: 'Label all dispensers with proper fuel grade markings', priority: 'P2', deadline: null },
        { text: 'Document dispenser serial numbers and meter readings', priority: 'P3', deadline: null }
    ],
    
    'Dispensers - Gilbarco': [
        { text: 'Position dispensers on island pads', priority: 'P2', deadline: null },
        { text: 'Anchor dispensers to concrete (verify torque specs)', priority: 'P2', deadline: null },
        { text: 'Connect product lines to dispenser inlet', priority: 'P2', deadline: null },
        { text: 'Connect vapor recovery lines (if Stage II)', priority: 'P2', deadline: null },
        { text: 'Install shear valves with leak detection', priority: 'P2', deadline: null },
        { text: 'Connect electrical power and data lines', priority: 'P2', deadline: null },
        { text: 'Install payment terminals (card readers, POS integration)', priority: 'P2', deadline: null },
        { text: 'Connect dispenser to network/controller', priority: 'P2', deadline: null },
        { text: 'Perform initial dispenser calibration (test measures)', priority: 'P1', deadline: null },
        { text: 'Test all payment terminals and card processing', priority: 'P1', deadline: null },
        { text: 'Test emergency shutoff (shear valve impact test)', priority: 'P1', deadline: null },
        { text: 'Test vapor recovery system (pressure decay test)', priority: 'P1', deadline: null },
        { text: 'Verify price display and totalizer accuracy', priority: 'P1', deadline: null },
        { text: 'Schedule Texas Dept of Agriculture weights & measures certification', priority: 'P1', deadline: null },
        { text: 'Label all dispensers with proper fuel grade markings', priority: 'P2', deadline: null },
        { text: 'Document dispenser serial numbers and meter readings', priority: 'P3', deadline: null }
    ],
    
    'Canopy Equipment': [
        { text: 'Erect canopy structure and supports', priority: 'P2', deadline: null },
        { text: 'Install canopy lighting fixtures (LED)', priority: 'P2', deadline: null },
        { text: 'Install canopy electrical panels and circuits', priority: 'P2', deadline: null },
        { text: 'Install price signs and display systems', priority: 'P2', deadline: null },
        { text: 'Install security cameras', priority: 'P2', deadline: null },
        { text: 'Install fire suppression system (if required)', priority: 'P1', deadline: null },
        { text: 'Install emergency lighting and exit signs', priority: 'P1', deadline: null },
        { text: 'Test all lighting circuits and emergency lighting', priority: 'P1', deadline: null },
        { text: 'Test price sign displays and programming', priority: 'P2', deadline: null },
        { text: 'Verify camera coverage and recording', priority: 'P2', deadline: null },
        { text: 'Test fire suppression system (if installed)', priority: 'P1', deadline: null },
        { text: 'Verify electrical grounding and bonding', priority: 'P1', deadline: null },
        { text: 'Schedule electrical inspection', priority: 'P1', deadline: null }
    ]
};

async function addDefaultTodos() {
    const client = await pool.connect();
    try {
        // Get the most recent job
        const result = await client.query('SELECT id, todos, section_todos FROM jobs ORDER BY id DESC LIMIT 1');
        
        if (result.rows.length === 0) {
            console.log('No jobs found in database');
            return;
        }
        
        const job = result.rows[0];
        console.log(`Found job ID: ${job.id}`);
        
        // Parse existing todos
        let currentTodos = job.todos || [];
        let currentSectionTodos = job.section_todos || {};
        
        // Add general todos
        console.log(`Adding ${generalTodos.length} general todos...`);
        generalTodos.forEach(todo => {
            currentTodos.push({
                id: Date.now() + Math.random(),
                ...todo,
                completed: false,
                completedAt: null
            });
        });
        
        // Add section-specific todos
        console.log('Adding section-specific todos...');
        Object.keys(sectionTodos).forEach(section => {
            if (!currentSectionTodos[section]) {
                currentSectionTodos[section] = [];
            }
            
            sectionTodos[section].forEach(todo => {
                currentSectionTodos[section].push({
                    id: Date.now() + Math.random(),
                    ...todo,
                    completed: false,
                    completedAt: null
                });
            });
            
            console.log(`  - Added ${sectionTodos[section].length} todos to "${section}"`);
        });
        
        // Update the job
        await client.query(
            'UPDATE jobs SET todos = $1, section_todos = $2 WHERE id = $3',
            [JSON.stringify(currentTodos), JSON.stringify(currentSectionTodos), job.id]
        );
        
        console.log('\n✅ Successfully added all default todos!');
        console.log(`Total general todos: ${currentTodos.length}`);
        console.log(`Total section types with todos: ${Object.keys(currentSectionTodos).length}`);
        
    } catch (error) {
        console.error('Error adding todos:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

addDefaultTodos();
