// Main application object
const app = {
    data: {
        id: null, // Database job ID
        stationName: '',
        clientName: '',
        siteAddress: '',
        quoteDate: '',
        quoteNumber: '',
        companyName: 'Petroleum Network Solutions',
        companyLogoUrl: '',
        contactName: 'Thomas Lyons',
        phone: '817-888-6167',
        email: 'tlyons@petronetwrksolutions.com',
        items: [],
        files: [],
        projectNotes: '',
        taxRate: 8.25,
        discount: 0,
        paymentTerms: '',
        scopeOfWork: '',
        disclaimers: '',
        sectionScopes: {}, // { 'package': 'scope text' }
        sectionDisclaimers: {}, // { 'package': 'disclaimer text' }
        contractorSectionDisclaimers: {}, // { 'package': { 'contractorName': 'disclaimer text' } }
        sectionUpcharges: {}, // { 'package': 15 } - percentage upcharge for cost -> price calculation
        todos: [], // [{ id, text, priority, deadline, completed, completedAt }] - general todos
        sectionTodos: {}, // { 'package': [{ id, text, priority, deadline, completed, completedAt }] }
        contractorAssignments: {}, // { 'contractorName': ['Package A', 'Package B'] }
        contractorLogos: {}, // { 'contractorName': 'logoUrl or base64' }
        meetings: [], // [{ id, title, datetime, location, notes, createdAt }]
        sectionMeetings: {}, // { 'package': [meeting objects] }
        criticalJunctures: [], // [{ id, date, description, assignedPerson, createdAt }]
        testingCalibration: {}, // { 'Section Name': { lineItems: [{ id, description, qty, cost, price, status }] } }
        testingAssignments: {}, // { 'Section Name': 'Company Name' }
        testingSchedules: {}, // { 'Section Name': { scheduledDate, startDate, endDate } }
        mode: 'owner', // 'owner' or 'contractor'
        contractorName: null, // contractor viewing this
        contractorSection: null, // which package the contractor can edit (deprecated)
        contractorSections: [] // multiple packages for contractor
    },
    
    // Fixed testing sections
    TESTING_SECTIONS: ['Dispenser Calibrations', 'UDC and STP Sump Testing', 'Line Testing', 'Tank Testing'],
    
    // Priority definitions
    PRIORITIES: {
        'P1': { label: 'P1', name: 'Urgent', color: '#dc3545', description: 'Critical, needs immediate attention' },
        'P2': { label: 'P2', name: 'High', color: '#f59e0b', description: 'Important, address soon' },
        'P3': { label: 'P3', name: 'Normal', color: '#3b82f6', description: 'Standard priority' },
        'P4': { label: 'P4', name: 'Low', color: '#6b7280', description: 'When time permits' }
    },
    
    // Cache for templates
    packageTemplates: [],
    lineItemTemplates: [],
    
    saveTimeout: null, // For debouncing auto-saves
    calendarDate: new Date(), // Current calendar view date
    editingItemIndex: null, // Track which item is being edited

    // Format number as currency with commas (e.g., 1234.56 -> "1,234.56")
    formatCurrency(value) {
        const num = parseFloat(value) || 0;
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    // Parse currency string back to number (e.g., "1,234.56" -> 1234.56)
    parseCurrency(value) {
        if (typeof value === 'number') return value;
        return parseFloat(String(value).replace(/,/g, '')) || 0;
    },

    async init() {
        // Set today's date
        document.getElementById('quoteDate').value = new Date().toISOString().split('T')[0];
        
        // Check URL parameters
        const params = new URLSearchParams(window.location.search);
        const jobId = params.get('jobId');
        const dataParam = params.get('data');
        const isNew = params.get('new');
        
        // Load from database if jobId, otherwise from URL data parameter
        if (jobId) {
            await this.loadFromDatabase(jobId);
        } else if (dataParam) {
            this.loadFromURL();
        } else if (isNew === 'true') {
            // New job - reset to defaults but keep company info
            this.resetForNewJob();
        } else {
            // Try to load the most recent job from database
            const loaded = await this.loadMostRecentJob();
            if (!loaded) {
                // Fall back to localStorage if no recent job found
                this.loadFromStorage();
            }
        }
        
        // Check for contractor mode AFTER loading data
        if (params.get('mode') === 'contractor') {
            this.data.mode = 'contractor';
            const contractorName = params.get('contractor');
            
            if (contractorName) {
                this.data.contractorName = decodeURIComponent(contractorName);
                // Get sections assigned to this contractor
                this.data.contractorSections = this.data.contractorAssignments[this.data.contractorName] || [];
            } else {
                // Fallback to old method for backward compatibility
                this.data.contractorSection = params.get('section');
                const sectionsParam = params.get('sections');
                if (sectionsParam) {
                    this.data.contractorSections = sectionsParam.split(',').map(s => decodeURIComponent(s));
                } else if (this.data.contractorSection) {
                    this.data.contractorSections = [this.data.contractorSection];
                }
            }
            
            console.log('Contractor mode enabled');
            console.log('Contractor name:', this.data.contractorName);
            console.log('Contractor sections:', this.data.contractorSections);
            console.log('Total items:', this.data.items.length);
        }
        
        // Apply contractor mode restrictions
        this.applyModeRestrictions();
        
        // For contractor mode, switch to Line Items tab automatically
        if (this.data.mode === 'contractor') {
            this.switchTab('items');
        }
        
        // Render initial items and files
        this.renderItems();
        this.renderFiles();
        this.calculateTotals();

        // Load package templates for Add Package modal
        this.loadPackageTemplates();

        // Initialize TabSync if we have a job ID
        if (this.data.id && typeof TabSync !== 'undefined') {
            TabSync.init(this.data.id);
            this.setupTabSyncHandlers();
        }
    },

    // Setup handlers for receiving sync messages from other tabs
    setupTabSyncHandlers() {
        if (typeof TabSync === 'undefined') return;

        // Handle items updated from another tab
        TabSync.on('ITEMS_UPDATED', (payload) => {
            console.log('[App] Received ITEMS_UPDATED from another tab');
            this.data.items = payload.items || this.data.items;
            this.renderItems();
            this.calculateTotals();
            this.showNotification('Items updated from another tab', 2000);
        });

        // Handle files updated from another tab
        TabSync.on('FILES_UPDATED', (payload) => {
            console.log('[App] Received FILES_UPDATED from another tab');
            // Merge files - adds new ones, respects deletions
            this.data.files = TabSync.mergeFiles(
                this.data.files,
                payload.files,
                payload.deletedFileIds
            );
            this.renderFiles();
            this.showNotification('Files updated from another tab', 2000);
        });

        // Handle packages updated from another tab
        TabSync.on('PACKAGES_UPDATED', (payload) => {
            console.log('[App] Received PACKAGES_UPDATED from another tab');
            this.data.items = payload.items || this.data.items;
            this.data.sectionScopes = payload.sectionScopes || this.data.sectionScopes;
            this.data.sectionDisclaimers = payload.sectionDisclaimers || this.data.sectionDisclaimers;
            this.renderItems();
            this.calculateTotals();
            this.showNotification('Packages updated from another tab', 2000);
        });

        // Handle job saved from another tab
        TabSync.on('JOB_SAVED', (payload) => {
            console.log('[App] Received JOB_SAVED from another tab');
            // Sync files from the authoritative save
            if (payload.files) {
                this.data.files = payload.files;
                this.renderFiles();
            }
            if (payload.items) {
                this.data.items = payload.items;
                this.renderItems();
                this.calculateTotals();
            }
            this.showNotification('Changes synced from another tab', 2000);
        });

        console.log('[App] TabSync handlers registered');
    },
    
    resetForNewJob() {
        // Keep company info but clear client info
        const companyName = this.data.companyName;
        const contactName = this.data.contactName;
        const phone = this.data.phone;
        const email = this.data.email;
        
        // Reset to defaults
        this.data = {
            id: null,
            clientName: '',
            siteAddress: '',
            quoteDate: new Date().toISOString().split('T')[0],
            quoteNumber: '',
            companyName: companyName,
            contactName: contactName,
            phone: phone,
            email: email,
            items: [],
            files: [],
            projectNotes: '',
            taxRate: 8.25,
            discount: 0,
            paymentTerms: '',
            scopeOfWork: '',
            disclaimers: '',
            sectionScopes: {},
            sectionDisclaimers: {},
            contractorSectionDisclaimers: {},
            sectionUpcharges: {},
            todos: [],
            sectionTodos: {},
            contractorAssignments: {},
            meetings: [],
            sectionMeetings: {},
            criticalJunctures: [],
            testingCalibration: {},
            testingAssignments: {},
            testingSchedules: {},
            mode: 'owner',
            contractorName: null,
            contractorSection: null,
            contractorSections: []
        };
        
        this.populateForm();
        // Don't load default items for new jobs - user will add packages manually
        this.renderItems();
        this.renderFiles();
        this.calculateTotals();
        this.showNotification('✨ New job created! Add equipment packages to get started.');
    },
    
    applyModeRestrictions() {
        if (this.data.mode === 'contractor') {
            // Show contractor banner
            const banner = document.createElement('div');
            banner.className = 'info-banner';
            banner.style.cssText = 'background: #fff3cd; border-left-color: #ffc107; margin: 20px; font-size: 16px;';
            
            const contractorNameDisplay = this.data.contractorName ? `<strong>${this.data.contractorName}</strong>` : 'Contractor';
            const sectionsCount = this.data.contractorSections.length;
            
            banner.innerHTML = `
                <strong>👷 ${contractorNameDisplay}:</strong> You can fill in pricing for ${sectionsCount} section${sectionsCount !== 1 ? 's' : ''}. 
                When done, click "Send Back to Owner" button below.
            `;
            
            const tabsElement = document.querySelector('.tabs');
            const containerElement = document.querySelector('.container');
            if (tabsElement && containerElement) {
                containerElement.insertBefore(banner, tabsElement);
            }
            
            // Make project info fields read-only
            const readOnlyFields = ['clientName', 'siteAddress', 'quoteDate', 'quoteNumber', 
                                   'companyName', 'contactName', 'phone', 'email', 'projectNotes',
                                   'paymentTerms', 'scopeOfWork', 'disclaimers', 'taxRate', 'discount'];
            readOnlyFields.forEach(id => {
                const field = document.getElementById(id);
                if (field) {
                    field.readOnly = true;
                    field.style.background = '#e9ecef';
                    field.style.cursor = 'not-allowed';
                }
            });
            
            // Add "Send Back to Owner" button after the tabs (no actions div in HTML)
            const sendBackBtn = document.createElement('div');
            sendBackBtn.style.cssText = 'text-align: center; padding: 20px; background: #f8f9fa; border-bottom: 2px solid #dee2e6;';
            sendBackBtn.innerHTML = `
                <button onclick="app.sendBackToOwner()" class="btn btn-danger" style="font-size: 18px; padding: 18px 40px; background: #28a745; border: none; border-radius: 6px; cursor: pointer; color: white; font-weight: 600;">
                    ✅ SEND BACK TO OWNER
                </button>
                <div style="margin-top: 10px; color: #155724; font-weight: 600;">💾 Your changes are auto-saved as you type</div>
            `;
            
            if (tabsElement && containerElement) {
                tabsElement.parentNode.insertBefore(sendBackBtn, tabsElement.nextSibling);
            }
            
            // Show auto-save indicator

            

        }
    },

    // Load package templates from database
    async loadPackageTemplates() {
        try {
            const response = await fetch('/api/package-templates');
            if (response.ok) {
                this.packageTemplates = await response.json();
            }
        } catch (err) {
            console.error('Error loading package templates:', err);
        }
    },
    
    // Show Add Equipment Package modal
    async showAddPackageModal() {
        // Ensure templates are loaded
        if (this.packageTemplates.length === 0) {
            await this.loadPackageTemplates();
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'addPackageModal';
        
        let packageOptions = '<option value="">-- Select Equipment Package --</option>';
        this.packageTemplates.forEach(pkg => {
            packageOptions += `<option value="${pkg.id}">${pkg.name}</option>`;
        });
        packageOptions += '<option value="custom">+ Custom Package</option>';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px; max-height: 80vh; overflow-y: auto;">
                <h3 style="color: #3b82f6; margin-bottom: 20px;">➕ Add Equipment Package</h3>
                
                <div style="margin-bottom: 20px;">
                    <label style="font-weight: 600; display: block; margin-bottom: 8px;">Package Type:</label>
                    <select id="packageSelect" onchange="app.onPackageSelect(this.value)" style="width: 100%; padding: 12px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 15px;">
                        ${packageOptions}
                    </select>
                </div>
                
                <div id="customPackageName" style="display: none; margin-bottom: 20px;">
                    <label style="font-weight: 600; display: block; margin-bottom: 8px;">Custom Package Name:</label>
                    <input type="text" id="customPackageInput" placeholder="Enter package name..." style="width: 100%; padding: 12px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 15px;">
                </div>
                
                <div id="lineItemsSection" style="display: none;">
                    <label style="font-weight: 600; display: block; margin-bottom: 8px;">Select Line Items to Include:</label>
                    <div style="margin-bottom: 10px;">
                        <label style="cursor: pointer; color: #3b82f6;">
                            <input type="checkbox" id="selectAllLineItems" onchange="app.toggleAllLineItems(this.checked)"> Select All Default Items
                        </label>
                    </div>
                    <div id="lineItemsList" style="max-height: 300px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 6px; padding: 10px;">
                        <p style="color: #999; text-align: center;">Select a package to see available line items</p>
                    </div>
                </div>
                
                <div style="margin-top: 25px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="app.closeModal()" class="btn" style="background: #6c757d;">Cancel</button>
                    <button onclick="app.addSelectedPackage()" class="btn" style="background: linear-gradient(135deg, #3b82f6, #2563eb);">Add Package</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    },
    
    // Handle package selection in modal
    async onPackageSelect(packageId) {
        const customNameDiv = document.getElementById('customPackageName');
        const lineItemsSection = document.getElementById('lineItemsSection');
        const lineItemsList = document.getElementById('lineItemsList');
        
        if (packageId === 'custom') {
            customNameDiv.style.display = 'block';
            lineItemsSection.style.display = 'none';
            return;
        }
        
        if (!packageId) {
            customNameDiv.style.display = 'none';
            lineItemsSection.style.display = 'none';
            return;
        }
        
        customNameDiv.style.display = 'none';
        lineItemsSection.style.display = 'block';
        lineItemsList.innerHTML = '<p style="text-align: center; color: #999;">Loading line items...</p>';
        
        try {
            const response = await fetch(`/api/package-templates/${packageId}/line-items`);
            const items = await response.json();
            
            if (items.length === 0) {
                lineItemsList.innerHTML = '<p style="color: #999; text-align: center;">No default line items for this package</p>';
                return;
            }
            
            let html = '';
            items.forEach(item => {
                html += `
                    <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid #f0f0f0;">
                        <input type="checkbox" class="line-item-checkbox" data-id="${item.id}" data-desc="${item.description.replace(/"/g, '&quot;')}" data-qty="${item.default_qty}" data-price="${item.default_price}" ${item.is_default_for_package ? 'checked' : ''}>
                        <div style="flex: 1;">
                            <div style="font-weight: 500;">${item.description}</div>
                            <div style="font-size: 12px; color: #666;">Qty: ${item.default_qty} | Price: $${parseFloat(item.default_price || 0).toFixed(2)}</div>
                        </div>
                    </div>
                `;
            });
            lineItemsList.innerHTML = html;
            
            // Update select all checkbox state
            this.updateSelectAllState();
            
        } catch (err) {
            lineItemsList.innerHTML = '<p style="color: #dc3545; text-align: center;">Error loading line items</p>';
        }
    },
    
    toggleAllLineItems(checked) {
        document.querySelectorAll('.line-item-checkbox').forEach(cb => cb.checked = checked);
    },
    
    updateSelectAllState() {
        const checkboxes = document.querySelectorAll('.line-item-checkbox');
        const selectAll = document.getElementById('selectAllLineItems');
        if (selectAll && checkboxes.length > 0) {
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            selectAll.checked = allChecked;
        }
    },
    
    // Add the selected package with line items to the job
    addSelectedPackage() {
        const packageSelect = document.getElementById('packageSelect');
        const customInput = document.getElementById('customPackageInput');
        
        let packageName = '';
        
        if (packageSelect.value === 'custom') {
            packageName = customInput.value.trim();
            if (!packageName) {
                alert('Please enter a package name');
                return;
            }
        } else if (packageSelect.value) {
            packageName = packageSelect.options[packageSelect.selectedIndex].text;
        } else {
            alert('Please select a package type');
            return;
        }
        
        // Check if this package already exists in the job
        const existingPackages = [...new Set(this.data.items.map(i => i.category))];
        if (existingPackages.includes(packageName)) {
            if (!confirm(`"${packageName}" already exists in this job. Add another one?`)) {
                return;
            }
        }
        
        // Get selected line items
        const selectedItems = [];
        document.querySelectorAll('.line-item-checkbox:checked').forEach(cb => {
            selectedItems.push({
                category: packageName,
                description: cb.dataset.desc,
                qty: parseFloat(cb.dataset.qty) || 1,
                price: parseFloat(cb.dataset.price) || 0
            });
        });
        
        // If custom or no items selected, add one empty item
        if (selectedItems.length === 0) {
            selectedItems.push({
                category: packageName,
                description: '',
                qty: 1,
                price: 0
            });
        }
        
        // Add items to job
        this.data.items.push(...selectedItems);

        this.closeModal();
        this.renderItems();
        this.calculateTotals();
        this.save();
        this.showNotification(`✓ Added "${packageName}" with ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}`);

        // Broadcast package addition to other tabs
        if (typeof TabSync !== 'undefined') {
            TabSync.broadcast('PACKAGES_UPDATED', {
                items: this.data.items,
                sectionScopes: this.data.sectionScopes,
                sectionDisclaimers: this.data.sectionDisclaimers
            });
        }
    },

    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none';
        });
        document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
        
        // Show selected tab
        const selectedTab = document.getElementById(`tab-${tabName}`);
        if (selectedTab) {
            selectedTab.classList.add('active');
            selectedTab.style.display = 'block';
        }
        
        // Add active class to the matching tab button
        document.querySelectorAll('.tab').forEach(tab => {
            if (tab.getAttribute('onclick')?.includes(`'${tabName}'`)) {
                tab.classList.add('active');
            }
        });
        
        // Refresh section scopes/disclaimers/todos when switching to those tabs
        if (tabName === 'scope') {
            this.renderSectionScopes();
        } else if (tabName === 'disclaimers') {
            this.renderSectionDisclaimers();
        } else if (tabName === 'todos') {
            this.renderTodos();
        } else if (tabName === 'testing') {
            this.renderTestingSections();
        } else if (tabName === 'meetings') {
            this.renderMeetings();
        } else if (tabName === 'calendar') {
            this.renderCalendar();
        }
    },

    renderSectionScopes() {
        // Always render the general scope display first
        this.renderGeneralScopeDisplay();

        const container = document.getElementById('sectionScopesDisplay');
        if (!container) return;

        const allScopes = this.data.sectionScopes || {};
        let sections = Object.keys(allScopes);

        // In contractor mode, only show their assigned sections
        if (this.data.mode === 'contractor' && this.data.contractorSections && this.data.contractorSections.length) {
            sections = sections.filter(s => this.data.contractorSections.includes(s));
        }

        if (sections.length === 0) {
            container.innerHTML = '<p style="color:#666">No section scopes yet.</p>';
            return;
        }
        
        // Helper to find contractor(s) assigned to a category
        const getContractorsForCategory = (category) => {
            const result = [];
            const assignments = this.data.contractorAssignments || {};
            Object.keys(assignments).forEach(name => {
                if ((assignments[name] || []).includes(category)) {
                    result.push(name);
                }
            });
            return result;
        };
        
        // Build sections styled like Line Items headers
        container.innerHTML = '';
        sections.forEach(sectionName => {
            const scopeText = allScopes[sectionName];
            if (!scopeText || !scopeText.trim()) return;
            
            const contractors = getContractorsForCategory(sectionName);
            const contractorLabel = contractors.length
                ? ` — ${contractors.join(', ')}`
                : (this.data.mode === 'contractor' && this.data.contractorName ? ` — ${this.data.contractorName}` : '');
            
            const wrapper = document.createElement('div');
            wrapper.className = 'category-section';

            const header = document.createElement('div');
            header.className = 'category-header';
            const showDeleteBtn = this.data.mode !== 'contractor';
            header.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span>${sectionName}${contractorLabel}</span>
                </div>
                <div class="category-header-buttons">
                    <button class="btn-header" onclick="app.editSectionScope('${sectionName}')">✏️ Edit</button>
                    ${showDeleteBtn ? `<button class="btn-header btn-delete-section" onclick="app.deleteSectionScope('${sectionName}')">🗑️ Delete</button>` : ''}
                </div>
            `;

            const body = document.createElement('div');
            body.style.cssText = 'border:1px solid #dee2e6; border-top:none; border-radius:0 0 6px 6px; background:#fff; padding:15px;';
            body.innerHTML = `<div style="white-space:pre-wrap; color:#333; line-height:1.6;">${scopeText}</div>`;
            
            wrapper.appendChild(header);
            wrapper.appendChild(body);
            container.appendChild(wrapper);
        });
    },

    renderGeneralScopeDisplay() {
        const display = document.getElementById('generalScopeDisplay');
        const editDiv = document.getElementById('generalScopeEdit');
        const editBtn = document.getElementById('editGeneralScopeBtn');

        if (!display) return;

        const scopeText = this.data.scopeOfWork || '';

        if (scopeText.trim()) {
            display.textContent = scopeText;
            display.style.color = '#333';
        } else {
            display.textContent = 'No general scope of work defined. Click Edit to add one.';
            display.style.color = '#999';
            display.style.fontStyle = 'italic';
        }

        // Ensure we're in display mode
        display.style.display = 'block';
        if (editDiv) editDiv.style.display = 'none';
        if (editBtn) editBtn.style.display = 'inline-block';
    },

    editGeneralScope() {
        const display = document.getElementById('generalScopeDisplay');
        const editDiv = document.getElementById('generalScopeEdit');
        const editBtn = document.getElementById('editGeneralScopeBtn');
        const textarea = document.getElementById('scopeOfWork');

        if (!editDiv || !textarea) return;

        // Switch to edit mode
        display.style.display = 'none';
        editDiv.style.display = 'block';
        if (editBtn) editBtn.style.display = 'none';

        // Populate textarea with current value
        textarea.value = this.data.scopeOfWork || '';
        textarea.focus();
    },

    async saveGeneralScope() {
        const textarea = document.getElementById('scopeOfWork');
        if (!textarea) return;

        this.data.scopeOfWork = textarea.value;
        this.save();
        await this.saveToDatabase(true);

        // Switch back to display mode
        this.renderGeneralScopeDisplay();
        this.showNotification('✓ General scope of work saved!');
    },

    cancelGeneralScopeEdit() {
        // Just switch back to display mode without saving
        this.renderGeneralScopeDisplay();
    },

    // ============ SECTION DISCLAIMERS ============

    renderSectionDisclaimers() {
        // Always render the general disclaimers display first
        this.renderGeneralDisclaimersDisplay();

        const container = document.getElementById('sectionDisclaimersDisplay');
        if (!container) return;

        const ownerDisclaimers = this.data.sectionDisclaimers || {};
        const contractorDisclaimers = this.data.contractorSectionDisclaimers || {};

        // Get all sections that have either owner or contractor disclaimers
        let sections = [...new Set([
            ...Object.keys(ownerDisclaimers),
            ...Object.keys(contractorDisclaimers)
        ])];

        // In contractor mode, only show their assigned sections
        if (this.data.mode === 'contractor' && this.data.contractorSections && this.data.contractorSections.length) {
            sections = sections.filter(s => this.data.contractorSections.includes(s));
        }

        // Filter to only sections that have content
        sections = sections.filter(s => {
            const hasOwner = ownerDisclaimers[s] && ownerDisclaimers[s].trim();
            const hasContractor = contractorDisclaimers[s] && Object.keys(contractorDisclaimers[s]).some(
                name => contractorDisclaimers[s][name] && contractorDisclaimers[s][name].trim()
            );
            return hasOwner || hasContractor;
        });

        if (sections.length === 0) {
            container.innerHTML = '<p style="color:#666">No equipment package disclaimers yet. Add disclaimers from the Equipment Packages tab.</p>';
            return;
        }

        // Helper to find contractor(s) assigned to a category
        const getContractorsForCategory = (category) => {
            const result = [];
            const assignments = this.data.contractorAssignments || {};
            Object.keys(assignments).forEach(name => {
                if ((assignments[name] || []).includes(category)) {
                    result.push(name);
                }
            });
            return result;
        };

        // Build sections styled like Line Items headers
        container.innerHTML = '';
        sections.forEach(sectionName => {
            const ownerText = ownerDisclaimers[sectionName] || '';
            const contractorTexts = contractorDisclaimers[sectionName] || {};

            const contractors = getContractorsForCategory(sectionName);
            const contractorLabel = contractors.length
                ? ` — ${contractors.join(', ')}`
                : (this.data.mode === 'contractor' && this.data.contractorName ? ` — ${this.data.contractorName}` : '');

            const wrapper = document.createElement('div');
            wrapper.className = 'category-section';

            const header = document.createElement('div');
            header.className = 'category-header';
            const showDeleteBtn = this.data.mode !== 'contractor';
            header.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span>${sectionName}${contractorLabel}</span>
                </div>
                <div class="category-header-buttons">
                    ${this.data.mode !== 'contractor' ? `<button class="btn-header" onclick="app.editSectionDisclaimers('${sectionName}')">✏️ Edit</button>` : ''}
                    ${showDeleteBtn ? `<button class="btn-header btn-delete-section" onclick="app.deleteSectionDisclaimer('${sectionName}')">🗑️ Delete</button>` : ''}
                </div>
            `;

            const body = document.createElement('div');
            body.style.cssText = 'border:1px solid #dee2e6; border-top:none; border-radius:0 0 6px 6px; background:#fff; padding:15px;';

            // Build body content with owner disclaimers and contractor disclaimers
            let bodyHTML = '';

            // Owner disclaimers
            if (ownerText && ownerText.trim()) {
                bodyHTML += `<div style="white-space:pre-wrap; color:#333; line-height:1.6;">${ownerText}</div>`;
            }

            // Contractor disclaimers
            Object.keys(contractorTexts).forEach(contractorName => {
                const text = contractorTexts[contractorName];
                if (text && text.trim()) {
                    bodyHTML += `
                        <div style="margin-top: 20px; padding-top: 15px; border-top: 2px dashed #f59e0b;">
                            <div style="font-weight: 600; color: #f59e0b; margin-bottom: 8px; font-size: 14px;">
                                📝 Contractor Disclaimers (${contractorName})
                            </div>
                            <div style="white-space:pre-wrap; color:#333; line-height:1.6; background: #fffbeb; padding: 10px; border-radius: 4px;">${text}</div>
                        </div>
                    `;
                }
            });

            if (!bodyHTML) {
                bodyHTML = '<em style="color: #999;">No disclaimers added.</em>';
            }

            body.innerHTML = bodyHTML;

            wrapper.appendChild(header);
            wrapper.appendChild(body);
            container.appendChild(wrapper);
        });
    },

    renderGeneralDisclaimersDisplay() {
        const display = document.getElementById('generalDisclaimersDisplay');
        const editDiv = document.getElementById('generalDisclaimersEdit');
        const editBtn = document.getElementById('editGeneralDisclaimersBtn');

        if (!display) return;

        const disclaimerText = this.data.disclaimers || '';

        if (disclaimerText.trim()) {
            display.textContent = disclaimerText;
            display.style.color = '#333';
            display.style.fontStyle = 'normal';
        } else {
            display.textContent = 'No general disclaimers defined. Click Edit to add one.';
            display.style.color = '#999';
            display.style.fontStyle = 'italic';
        }

        // Ensure we're in display mode
        display.style.display = 'block';
        if (editDiv) editDiv.style.display = 'none';
        if (editBtn) editBtn.style.display = 'inline-block';
    },

    editGeneralDisclaimers() {
        const display = document.getElementById('generalDisclaimersDisplay');
        const editDiv = document.getElementById('generalDisclaimersEdit');
        const editBtn = document.getElementById('editGeneralDisclaimersBtn');
        const textarea = document.getElementById('disclaimers');

        if (!editDiv || !textarea) return;

        // Switch to edit mode
        display.style.display = 'none';
        editDiv.style.display = 'block';
        if (editBtn) editBtn.style.display = 'none';

        // Populate textarea with current value
        textarea.value = this.data.disclaimers || '';
        textarea.focus();
    },

    async saveGeneralDisclaimers() {
        const textarea = document.getElementById('disclaimers');
        if (!textarea) return;

        this.data.disclaimers = textarea.value;
        this.save();
        await this.saveToDatabase(true);

        // Switch back to display mode
        this.renderGeneralDisclaimersDisplay();
        this.showNotification('✓ General disclaimers saved!');
    },

    cancelGeneralDisclaimersEdit() {
        // Just switch back to display mode without saving
        this.renderGeneralDisclaimersDisplay();
    },

    async deleteSectionDisclaimer(category) {
        if (!confirm(`Delete disclaimers for "${category}"?`)) return;

        delete this.data.sectionDisclaimers[category];
        this.save();
        await this.saveToDatabase(true);
        this.renderSectionDisclaimers();
        this.showNotification(`✓ Disclaimers deleted for "${category}"`);
    },

    // ============ TODO LIST ============

    renderTodos() {
        this.renderGeneralTodos();
        this.renderSectionTodos();
    },

    renderGeneralTodos() {
        const container = document.getElementById('generalTodosDisplay');
        if (!container) return;

        const todos = this.data.todos || [];

        if (todos.length === 0) {
            container.innerHTML = '<p style="color: #999; font-style: italic;">No general todos yet. Add one above.</p>';
            return;
        }

        // Sort: Priority first (P1 > P2 > P3 > P4), then deadline (earliest first), then creation
        const sortedTodos = [...todos].map((t, i) => ({ ...t, originalIndex: i })).sort((a, b) => {
            // Priority sort (P1=1, P2=2, P3=3, P4=4)
            const priorityA = parseInt(a.priority?.substring(1)) || 3;
            const priorityB = parseInt(b.priority?.substring(1)) || 3;
            if (priorityA !== priorityB) return priorityA - priorityB;
            
            // Deadline sort (null deadlines go last)
            if (a.deadline && !b.deadline) return -1;
            if (!a.deadline && b.deadline) return 1;
            if (a.deadline && b.deadline) {
                return new Date(a.deadline) - new Date(b.deadline);
            }
            
            return 0;
        });

        let html = '<div style="background: white; border: 1px solid #dee2e6; border-radius: 6px; overflow: hidden;">';
        sortedTodos.forEach((todo) => {
            const isCompleted = todo.completed;
            const completedDate = todo.completedAt ? new Date(todo.completedAt).toLocaleString() : '';
            const priority = this.PRIORITIES[todo.priority || 'P3'];
            const isOverdue = !isCompleted && todo.deadline && new Date(todo.deadline) < new Date();
            
            html += `
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; border-bottom: 1px solid #f0f0f0; ${isCompleted ? 'background: #f0fdf4;' : ''}">
                    <input type="checkbox" ${isCompleted ? 'checked' : ''}
                        onclick="app.showCompleteTodoModal('general', ${todo.originalIndex})"
                        style="width: 20px; height: 20px; cursor: pointer;">
                    <div style="flex: 1; ${isCompleted ? 'text-decoration: line-through; color: #6b7280;' : ''}">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="background: ${priority.color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${priority.label}</span>
                            <span>${todo.text}</span>
                            ${todo.deadline ? `<span style="font-size: 12px; color: ${isOverdue ? '#dc3545' : '#6b7280'}; font-weight: ${isOverdue ? '600' : 'normal'};">📅 ${new Date(todo.deadline).toLocaleDateString()}${isOverdue ? ' (OVERDUE)' : ''}</span>` : ''}
                        </div>
                        ${isCompleted ? `<div style="font-size: 11px; color: #22c55e; margin-top: 2px;">Completed: ${completedDate}</div>` : ''}
                    </div>
                    <button onclick="app.editTodo('general', ${todo.originalIndex})" style="background: none; border: none; cursor: pointer; font-size: 16px;" title="Edit">✏️</button>
                    <button onclick="app.deleteTodo('general', ${todo.originalIndex})" style="background: none; border: none; cursor: pointer; font-size: 16px; color: #dc3545;" title="Delete">🗑️</button>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    },

    renderSectionTodos() {
        const container = document.getElementById('sectionTodosDisplay');
        if (!container) return;

        // Get all equipment packages
        const packages = [...new Set(this.data.items.map(item => item.category))];
        const sectionTodos = this.data.sectionTodos || {};

        if (packages.length === 0) {
            container.innerHTML = '<p style="color: #666; margin-top: 30px;">Add equipment packages to create package-specific todos.</p>';
            return;
        }

        let html = '<h3 style="color: #495057; margin: 30px 0 15px 0;">Equipment Package Todos</h3>';

        packages.forEach(pkg => {
            const todos = sectionTodos[pkg] || [];
            const completedCount = todos.filter(t => t.completed).length;

            // Sort todos by priority and deadline
            const sortedTodos = [...todos].map((t, i) => ({ ...t, originalIndex: i })).sort((a, b) => {
                const priorityA = parseInt(a.priority?.substring(1)) || 3;
                const priorityB = parseInt(b.priority?.substring(1)) || 3;
                if (priorityA !== priorityB) return priorityA - priorityB;
                
                if (a.deadline && !b.deadline) return -1;
                if (!a.deadline && b.deadline) return 1;
                if (a.deadline && b.deadline) {
                    return new Date(a.deadline) - new Date(b.deadline);
                }
                
                return 0;
            });

            html += `
                <div class="category-section" style="margin-bottom: 15px;">
                    <div class="category-header" style="cursor: default;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span>${pkg}</span>
                            <span style="font-size: 12px; color: #6b7280; font-weight: normal;">(${completedCount}/${todos.length} completed)</span>
                        </div>
                        <button class="btn-header" onclick="app.showAddTodoModal('${pkg}')">+ Add Todo</button>
                    </div>
                    <div style="border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 6px 6px; background: white;">
            `;

            if (todos.length === 0) {
                html += '<p style="color: #999; font-style: italic; padding: 15px; margin: 0;">No todos for this package.</p>';
            } else {
                sortedTodos.forEach((todo) => {
                    const isCompleted = todo.completed;
                    const completedDate = todo.completedAt ? new Date(todo.completedAt).toLocaleString() : '';
                    const priority = this.PRIORITIES[todo.priority || 'P3'];
                    const isOverdue = !isCompleted && todo.deadline && new Date(todo.deadline) < new Date();
                    
                    html += `
                        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; border-bottom: 1px solid #f0f0f0; ${isCompleted ? 'background: #f0fdf4;' : ''}">
                            <input type="checkbox" ${isCompleted ? 'checked' : ''}
                                onclick="app.showCompleteTodoModal('${pkg}', ${todo.originalIndex})"
                                style="width: 20px; height: 20px; cursor: pointer;">
                            <div style="flex: 1; ${isCompleted ? 'text-decoration: line-through; color: #6b7280;' : ''}">
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <span style="background: ${priority.color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${priority.label}</span>
                                    <span>${todo.text}</span>
                                    ${todo.deadline ? `<span style="font-size: 12px; color: ${isOverdue ? '#dc3545' : '#6b7280'}; font-weight: ${isOverdue ? '600' : 'normal'};">📅 ${new Date(todo.deadline).toLocaleDateString()}${isOverdue ? ' (OVERDUE)' : ''}</span>` : ''}
                                </div>
                                ${isCompleted ? `<div style="font-size: 11px; color: #22c55e; margin-top: 2px;">Completed: ${completedDate}</div>` : ''}
                            </div>
                            <button onclick="app.editTodo('${pkg}', ${todo.originalIndex})" style="background: none; border: none; cursor: pointer; font-size: 16px;" title="Edit">✏️</button>
                            <button onclick="app.deleteTodo('${pkg}', ${todo.originalIndex})" style="background: none; border: none; cursor: pointer; font-size: 16px; color: #dc3545;" title="Delete">🗑️</button>
                        </div>
                    `;
                });
            }

            html += '</div></div>';
        });

        container.innerHTML = html;
    },

    showAddTodoModal(category) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <h3>Add Todo${category !== 'general' ? ` - ${category}` : ''}</h3>
                <div class="form-group">
                    <label>Task Description:</label>
                    <input type="text" id="todoText" placeholder="Enter task description" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                </div>
                <div class="form-group">
                    <label>Priority:</label>
                    <select id="todoPriority" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                        <option value="P1">P1 - Urgent (Critical, needs immediate attention)</option>
                        <option value="P2">P2 - High (Important, address soon)</option>
                        <option value="P3" selected>P3 - Normal (Standard priority)</option>
                        <option value="P4">P4 - Low (When time permits)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Deadline (Optional):</label>
                    <input type="date" id="todoDeadline" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="app.closeModal()" class="btn" style="background: #6c757d;">Cancel</button>
                    <button onclick="app.confirmAddTodo('${category}')" class="btn" style="background: #3b82f6;">✓ Add Todo</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
        setTimeout(() => document.getElementById('todoText').focus(), 100);
    },

    async confirmAddTodo(category) {
        const text = document.getElementById('todoText').value.trim();
        const priority = document.getElementById('todoPriority').value;
        const deadline = document.getElementById('todoDeadline').value || null;

        if (!text) {
            alert('Please enter a task description');
            return;
        }

        const newTodo = {
            id: Date.now(),
            text: text,
            priority: priority,
            deadline: deadline,
            completed: false,
            completedAt: null
        };

        if (category === 'general') {
            if (!this.data.todos) this.data.todos = [];
            this.data.todos.push(newTodo);
        } else {
            if (!this.data.sectionTodos) this.data.sectionTodos = {};
            if (!this.data.sectionTodos[category]) this.data.sectionTodos[category] = [];
            this.data.sectionTodos[category].push(newTodo);
        }

        this.closeModal();
        this.save();
        await this.saveToDatabase(false);
        this.renderTodos();
        this.showNotification('✓ Todo added');
    },

    addSectionTodo(category) {
        this.showAddTodoModal(category);
    },

    showCompleteTodoModal(category, index) {
        const isGeneral = category === 'general';
        const todos = isGeneral ? this.data.todos : (this.data.sectionTodos[category] || []);
        const todo = todos[index];

        if (!todo) return;

        // If already completed, toggle it off
        if (todo.completed) {
            todo.completed = false;
            todo.completedAt = null;
            this.save();
            this.saveToDatabase(false);
            this.renderTodos();
            return;
        }

        // Show completion modal with datetime picker
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 16); // Format for datetime-local input

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h3>✅ Mark Todo Complete</h3>
                <p style="color: #666; margin-bottom: 15px;">"${todo.text}"</p>
                <div class="form-group">
                    <label>Completion Date/Time:</label>
                    <input type="datetime-local" id="completionDateTime" value="${dateStr}" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="app.closeModal()" class="btn" style="background: #6c757d;">Cancel</button>
                    <button onclick="app.confirmCompleteTodo('${category}', ${index})" class="btn" style="background: #22c55e;">✓ Confirm Complete</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    },

    async confirmCompleteTodo(category, index) {
        const dateInput = document.getElementById('completionDateTime');
        const completedAt = dateInput ? new Date(dateInput.value).toISOString() : new Date().toISOString();

        const isGeneral = category === 'general';
        const todos = isGeneral ? this.data.todos : (this.data.sectionTodos[category] || []);
        const todo = todos[index];

        if (todo) {
            todo.completed = true;
            todo.completedAt = completedAt;
        }

        this.closeModal();
        this.save();
        await this.saveToDatabase(false);
        this.renderTodos();
        this.showNotification('✓ Todo marked complete');
    },

    editTodo(category, index) {
        const isGeneral = category === 'general';
        const todos = isGeneral ? this.data.todos : (this.data.sectionTodos[category] || []);
        const todo = todos[index];

        if (!todo) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <h3>Edit Todo</h3>
                <div class="form-group">
                    <label>Task Description:</label>
                    <input type="text" id="editTodoText" value="${todo.text.replace(/"/g, '&quot;')}" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                </div>
                <div class="form-group">
                    <label>Priority:</label>
                    <select id="editTodoPriority" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                        <option value="P1" ${todo.priority === 'P1' ? 'selected' : ''}>P1 - Urgent</option>
                        <option value="P2" ${todo.priority === 'P2' ? 'selected' : ''}>P2 - High</option>
                        <option value="P3" ${(todo.priority === 'P3' || !todo.priority) ? 'selected' : ''}>P3 - Normal</option>
                        <option value="P4" ${todo.priority === 'P4' ? 'selected' : ''}>P4 - Low</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Deadline (Optional):</label>
                    <input type="date" id="editTodoDeadline" value="${todo.deadline || ''}" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="app.closeModal()" class="btn" style="background: #6c757d;">Cancel</button>
                    <button onclick="app.confirmEditTodo('${category}', ${index})" class="btn" style="background: #3b82f6;">✓ Save Changes</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
        setTimeout(() => document.getElementById('editTodoText').focus(), 100);
    },

    async confirmEditTodo(category, index) {
        const text = document.getElementById('editTodoText').value.trim();
        const priority = document.getElementById('editTodoPriority').value;
        const deadline = document.getElementById('editTodoDeadline').value || null;

        if (!text) {
            alert('Task description cannot be empty');
            return;
        }

        const isGeneral = category === 'general';
        const todos = isGeneral ? this.data.todos : (this.data.sectionTodos[category] || []);
        const todo = todos[index];

        if (todo) {
            todo.text = text;
            todo.priority = priority;
            todo.deadline = deadline;
        }

        this.closeModal();
        this.save();
        await this.saveToDatabase(false);
        this.renderTodos();
        this.showNotification('✓ Todo updated');
    },

    async deleteTodo(category, index) {
        if (!confirm('Delete this todo?')) return;

        const isGeneral = category === 'general';
        if (isGeneral) {
            this.data.todos.splice(index, 1);
        } else {
            this.data.sectionTodos[category].splice(index, 1);
        }

        this.save();
        await this.saveToDatabase(false);
        this.renderTodos();
        this.showNotification('✓ Todo deleted');
    },

    // ===== TESTING & CALIBRATION =====
    renderTestingSections() {
        const container = document.getElementById('testingSectionsDisplay');
        if (!container) return;

        let html = '';
        this.TESTING_SECTIONS.forEach(section => {
            const assignment = this.data.testingAssignments?.[section] || 'Not Assigned';
            const schedule = this.data.testingSchedules?.[section] || {};
            const lineItems = this.data.testingCalibration?.[section]?.lineItems || [];

            const totalCost = lineItems.reduce((sum, item) => sum + (parseFloat(item.cost) || 0) * (parseFloat(item.qty) || 0), 0);
            const totalPrice = lineItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0), 0);
            const profit = totalPrice - totalCost;

            html += `
                <div class="category-section" style="margin-bottom: 20px;">
                    <div class="category-header">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span>${section}</span>
                            <span style="background: #3b82f6; color: white; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;" onclick="app.editTestingCompany('${section}')">${assignment}</span>
                            <button onclick="app.editTestingSchedule('${section}')" class="btn-header" style="background: #22c55e; font-size: 12px;">📅 Schedule</button>
                        </div>
                        <button class="btn-header" onclick="app.addTestingLineItem('${section}')">+ Add Item</button>
                    </div>
                    <div style="border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 6px 6px; background: white;">
            `;

            if (schedule.scheduledDate || (schedule.startDate && schedule.endDate)) {
                html += `<div style="padding: 10px 15px; background: #f0fdf4; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #22c55e; font-weight: 600;">`;
                if (schedule.scheduledDate) {
                    html += `📅 Scheduled: ${new Date(schedule.scheduledDate).toLocaleDateString()}`;
                } else {
                    html += `📅 ${new Date(schedule.startDate).toLocaleDateString()} - ${new Date(schedule.endDate).toLocaleDateString()}`;
                }
                html += `</div>`;
            }

            if (lineItems.length === 0) {
                html += '<p style="color: #999; font-style: italic; padding: 15px; margin: 0;">No line items yet.</p>';
            } else {
                html += `
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                <th style="padding: 10px; text-align: left; width: 35%;">Description</th>
                                <th style="padding: 10px; text-align: center; width: 10%;">Qty</th>
                                <th style="padding: 10px; text-align: right; width: 15%;">Cost</th>
                                <th style="padding: 10px; text-align: right; width: 15%;">Price</th>
                                <th style="padding: 10px; text-align: center; width: 15%;">Status</th>
                                <th style="padding: 10px; text-align: center; width: 10%;"></th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                lineItems.forEach((item, index) => {
                    const statusColors = {
                        'pending': '#6b7280',
                        'scheduled': '#f59e0b',
                        'completed': '#22c55e'
                    };
                    const statusColor = statusColors[item.status] || '#6b7280';

                    html += `
                        <tr style="border-bottom: 1px solid #f0f0f0;">
                            <td style="padding: 10px;">${item.description}</td>
                            <td style="padding: 10px; text-align: center;">${item.qty}</td>
                            <td style="padding: 10px; text-align: right;">$${this.formatCurrency(item.cost * item.qty)}</td>
                            <td style="padding: 10px; text-align: right;">$${this.formatCurrency(item.price * item.qty)}</td>
                            <td style="padding: 10px; text-align: center;">
                                <select onchange="app.updateTestingItemStatus('${section}', ${index}, this.value)" style="padding: 5px; border: 1px solid ${statusColor}; border-radius: 4px; background: ${statusColor}; color: white; font-weight: 600; font-size: 11px; cursor: pointer;">
                                    <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
                                    <option value="scheduled" ${item.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                                    <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completed</option>
                                </select>
                            </td>
                            <td style="padding: 10px; text-align: center;">
                                <button onclick="app.deleteTestingLineItem('${section}', ${index})" style="background: none; border: none; cursor: pointer; font-size: 16px; color: #dc3545;" title="Delete">🗑️</button>
                            </td>
                        </tr>
                    `;
                });
                html += `
                        </tbody>
                    </table>
                    <div style="padding: 15px; background: #f8f9fa; border-top: 2px solid #dee2e6; display: flex; justify-content: space-between; font-weight: 600;">
                        <span>Section Totals:</span>
                        <div>
                            <span style="margin-right: 20px;">Cost: $${this.formatCurrency(totalCost)}</span>
                            <span style="margin-right: 20px; color: ${profit >= 0 ? '#22c55e' : '#dc3545'};">Profit: $${this.formatCurrency(profit)}</span>
                            <span>Total: $${this.formatCurrency(totalPrice)}</span>
                        </div>
                    </div>
                `;
            }

            html += '</div></div>';
        });

        container.innerHTML = html;
    },

    editTestingCompany(section) {
        const currentCompany = this.data.testingAssignments?.[section] || '';
        const companyName = prompt(`Assign company for "${section}":`, currentCompany);
        if (companyName === null) return;

        if (!this.data.testingAssignments) this.data.testingAssignments = {};
        this.data.testingAssignments[section] = companyName.trim();

        this.save();
        this.saveToDatabase(false);
        this.renderTestingSections();
        this.showNotification('✓ Company assigned');
    },

    editTestingSchedule(section) {
        const schedule = this.data.testingSchedules?.[section] || {};
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <h3>Schedule ${section}</h3>
                <div class="form-group">
                    <label>Schedule Type:</label>
                    <select id="scheduleType" onchange="document.getElementById('singleDateField').style.display = this.value === 'single' ? 'block' : 'none'; document.getElementById('rangeDateFields').style.display = this.value === 'range' ? 'block' : 'none';" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                        <option value="single" ${schedule.scheduledDate ? 'selected' : ''}>Single Date</option>
                        <option value="range" ${(schedule.startDate && schedule.endDate) ? 'selected' : ''}>Date Range</option>
                    </select>
                </div>
                <div id="singleDateField" class="form-group" style="display: ${schedule.scheduledDate ? 'block' : 'none'};">
                    <label>Scheduled Date:</label>
                    <input type="date" id="scheduledDate" value="${schedule.scheduledDate || ''}" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                </div>
                <div id="rangeDateFields" style="display: ${(schedule.startDate && schedule.endDate) ? 'block' : 'none'};">
                    <div class="form-group">
                        <label>Start Date:</label>
                        <input type="date" id="startDate" value="${schedule.startDate || ''}" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                    </div>
                    <div class="form-group">
                        <label>End Date:</label>
                        <input type="date" id="endDate" value="${schedule.endDate || ''}" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                    </div>
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="app.closeModal()" class="btn" style="background: #6c757d;">Cancel</button>
                    <button onclick="app.confirmTestingSchedule('${section}')" class="btn" style="background: #22c55e;">✓ Save Schedule</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    },

    async confirmTestingSchedule(section) {
        const type = document.getElementById('scheduleType').value;
        
        if (!this.data.testingSchedules) this.data.testingSchedules = {};

        if (type === 'single') {
            const date = document.getElementById('scheduledDate').value;
            if (!date) {
                alert('Please select a date');
                return;
            }
            this.data.testingSchedules[section] = { scheduledDate: date };
        } else {
            const start = document.getElementById('startDate').value;
            const end = document.getElementById('endDate').value;
            if (!start || !end) {
                alert('Please select both start and end dates');
                return;
            }
            this.data.testingSchedules[section] = { startDate: start, endDate: end };
        }

        this.closeModal();
        this.save();
        await this.saveToDatabase(false);
        this.renderTestingSections();
        this.showNotification('✓ Schedule saved');
    },

    addTestingLineItem(section) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <h3>Add Line Item - ${section}</h3>
                <div class="form-group">
                    <label>Description:</label>
                    <input type="text" id="testingDescription" placeholder="e.g., Dispenser calibration - Pump 1" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                    <div class="form-group">
                        <label>Quantity:</label>
                        <input type="number" id="testingQty" value="1" step="1" min="0" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                    </div>
                    <div class="form-group">
                        <label>Cost (per unit):</label>
                        <input type="number" id="testingCost" value="0" step="0.01" min="0" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                    </div>
                    <div class="form-group">
                        <label>Price (per unit):</label>
                        <input type="number" id="testingPrice" value="0" step="0.01" min="0" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                    </div>
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="app.closeModal()" class="btn" style="background: #6c757d;">Cancel</button>
                    <button onclick="app.confirmAddTestingLineItem('${section}')" class="btn" style="background: #3b82f6;">✓ Add Item</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
        setTimeout(() => document.getElementById('testingDescription').focus(), 100);
    },

    async confirmAddTestingLineItem(section) {
        const description = document.getElementById('testingDescription').value.trim();
        const qty = parseFloat(document.getElementById('testingQty').value) || 1;
        const cost = parseFloat(document.getElementById('testingCost').value) || 0;
        const price = parseFloat(document.getElementById('testingPrice').value) || 0;

        if (!description) {
            alert('Please enter a description');
            return;
        }

        if (!this.data.testingCalibration) this.data.testingCalibration = {};
        if (!this.data.testingCalibration[section]) this.data.testingCalibration[section] = { lineItems: [] };

        this.data.testingCalibration[section].lineItems.push({
            id: Date.now(),
            description,
            qty,
            cost,
            price,
            status: 'pending'
        });

        this.closeModal();
        this.save();
        await this.saveToDatabase(false);
        this.renderTestingSections();
        this.showNotification('✓ Line item added');
    },

    async updateTestingItemStatus(section, index, status) {
        if (!this.data.testingCalibration?.[section]?.lineItems?.[index]) return;
        
        this.data.testingCalibration[section].lineItems[index].status = status;
        this.save();
        await this.saveToDatabase(false);
        this.renderTestingSections();
        this.showNotification('✓ Status updated');
    },

    async deleteTestingLineItem(section, index) {
        if (!confirm('Delete this line item?')) return;
        
        if (!this.data.testingCalibration?.[section]?.lineItems) return;
        this.data.testingCalibration[section].lineItems.splice(index, 1);
        
        this.save();
        await this.saveToDatabase(false);
        this.renderTestingSections();
        this.showNotification('✓ Line item deleted');
    },

    // ===== MEETINGS =====
    renderMeetings() {
        this.renderGeneralMeetings();
        this.renderCriticalJunctures();
        this.renderPackageMeetings();
    },

    renderGeneralMeetings() {
        const container = document.getElementById('generalMeetingsDisplay');
        if (!container) return;

        const meetings = this.data.meetings || [];

        if (meetings.length === 0) {
            container.innerHTML = '<p style="color: #999; font-style: italic;">No meetings scheduled yet.</p>';
            return;
        }

        let html = '<div style="background: white; border: 1px solid #dee2e6; border-radius: 6px; overflow: hidden;">';
        meetings.forEach((meeting, index) => {
            const datetime = new Date(meeting.datetime);
            html += `
                <div style="padding: 15px; border-bottom: 1px solid #f0f0f0;">
                    <div style="display: flex; justify-content: between; align-items: start; gap: 15px;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 8px 0; color: #333;">${meeting.title}</h4>
                            <div style="font-size: 13px; color: #666; margin-bottom: 5px;">📅 ${datetime.toLocaleString()}</div>
                            ${meeting.location ? `<div style="font-size: 13px; color: #666; margin-bottom: 5px;">📍 ${meeting.location}</div>` : ''}
                            ${meeting.notes ? `<div style="font-size: 13px; color: #666; margin-top: 8px;">${meeting.notes}</div>` : ''}
                        </div>
                        <div style="display: flex; gap: 8px; flex-shrink: 0;">
                            <button onclick="app.addToGoogleCalendar(${index}, 'general')" class="btn-header" style="background: #4285f4; font-size: 12px; padding: 6px 12px;">Google Cal</button>
                            <button onclick="app.downloadICS(${index}, 'general')" class="btn-header" style="background: #22c55e; font-size: 12px; padding: 6px 12px;">Download .ics</button>
                            <button onclick="app.deleteMeeting(${index}, 'general')" style="background: none; border: none; cursor: pointer; font-size: 16px; color: #dc3545;" title="Delete">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    },

    renderCriticalJunctures() {
        const container = document.getElementById('criticalJuncturesDisplay');
        if (!container) return;

        const junctures = this.data.criticalJunctures || [];

        if (junctures.length === 0) {
            container.innerHTML = '<p style="color: #999; font-style: italic;">No critical junctures defined yet.</p>';
            return;
        }

        let html = '<div style="background: #fff5f5; border: 2px solid #dc3545; border-radius: 6px; overflow: hidden;">';
        junctures.forEach((juncture, index) => {
            const date = new Date(juncture.date);
            html += `
                <div style="padding: 15px; border-bottom: 1px solid #fecaca;">
                    <div style="display: flex; justify-content: space-between; align-items: start; gap: 15px;">
                        <div style="flex: 1;">
                            <div style="font-size: 14px; color: #dc3545; font-weight: 700; margin-bottom: 5px;">📅 ${date.toLocaleDateString()}</div>
                            <div style="font-size: 14px; color: #333; margin-bottom: 5px;">${juncture.description}</div>
                            ${juncture.assignedPerson ? `<div style="font-size: 12px; color: #666;">Assigned to: ${juncture.assignedPerson}</div>` : ''}
                        </div>
                        <button onclick="app.deleteCriticalJuncture(${index})" style="background: none; border: none; cursor: pointer; font-size: 16px; color: #dc3545;" title="Delete">🗑️</button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    },

    renderPackageMeetings() {
        const container = document.getElementById('packageMeetingsDisplay');
        if (!container) return;

        const packages = [...new Set(this.data.items.map(item => item.category))];
        const sectionMeetings = this.data.sectionMeetings || {};

        if (packages.length === 0) {
            container.innerHTML = '<p style="color: #666; margin-top: 30px;">Add equipment packages to create package-specific meetings.</p>';
            return;
        }

        let html = '<h3 style="color: #495057; margin: 30px 0 15px 0;">Equipment Package Meetings</h3>';

        packages.forEach(pkg => {
            const meetings = sectionMeetings[pkg] || [];

            html += `
                <div class="category-section" style="margin-bottom: 15px;">
                    <div class="category-header" style="cursor: default;">
                        <span>${pkg}</span>
                        <button class="btn-header" onclick="app.showAddMeetingModal('${pkg}')">+ Add Meeting</button>
                    </div>
                    <div style="border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 6px 6px; background: white;">
            `;

            if (meetings.length === 0) {
                html += '<p style="color: #999; font-style: italic; padding: 15px; margin: 0;">No meetings for this package.</p>';
            } else {
                meetings.forEach((meeting, index) => {
                    const datetime = new Date(meeting.datetime);
                    html += `
                        <div style="padding: 15px; border-bottom: 1px solid #f0f0f0;">
                            <div style="display: flex; justify-content: space-between; align-items: start; gap: 15px;">
                                <div style="flex: 1;">
                                    <h4 style="margin: 0 0 8px 0; color: #333; font-size: 14px;">${meeting.title}</h4>
                                    <div style="font-size: 12px; color: #666; margin-bottom: 3px;">📅 ${datetime.toLocaleString()}</div>
                                    ${meeting.location ? `<div style="font-size: 12px; color: #666; margin-bottom: 3px;">📍 ${meeting.location}</div>` : ''}
                                    ${meeting.notes ? `<div style="font-size: 12px; color: #666; margin-top: 5px;">${meeting.notes}</div>` : ''}
                                </div>
                                <div style="display: flex; gap: 8px; flex-shrink: 0;">
                                    <button onclick="app.addToGoogleCalendar(${index}, '${pkg}')" class="btn-header" style="background: #4285f4; font-size: 11px; padding: 5px 10px;">Google</button>
                                    <button onclick="app.downloadICS(${index}, '${pkg}')" class="btn-header" style="background: #22c55e; font-size: 11px; padding: 5px 10px;">.ics</button>
                                    <button onclick="app.deleteMeeting(${index}, '${pkg}')" style="background: none; border: none; cursor: pointer; font-size: 14px; color: #dc3545;" title="Delete">🗑️</button>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }

            html += '</div></div>';
        });

        container.innerHTML = html;
    },

    showAddMeetingModal(type) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <h3>Add Meeting${type !== 'general' ? ` - ${type}` : ''}</h3>
                <div class="form-group">
                    <label>Meeting Title:</label>
                    <input type="text" id="meetingTitle" placeholder="e.g., Site walkthrough" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                </div>
                <div class="form-group">
                    <label>Date & Time:</label>
                    <input type="datetime-local" id="meetingDatetime" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                </div>
                <div class="form-group">
                    <label>Location:</label>
                    <input type="text" id="meetingLocation" placeholder="e.g., Project site" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                </div>
                <div class="form-group">
                    <label>Notes (Optional):</label>
                    <textarea id="meetingNotes" rows="3" placeholder="Any additional details..." style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;"></textarea>
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="app.closeModal()" class="btn" style="background: #6c757d;">Cancel</button>
                    <button onclick="app.confirmAddMeeting('${type}')" class="btn" style="background: #3b82f6;">✓ Add Meeting</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
        setTimeout(() => document.getElementById('meetingTitle').focus(), 100);
    },

    async confirmAddMeeting(type) {
        const title = document.getElementById('meetingTitle').value.trim();
        const datetime = document.getElementById('meetingDatetime').value;
        const location = document.getElementById('meetingLocation').value.trim();
        const notes = document.getElementById('meetingNotes').value.trim();

        if (!title || !datetime) {
            alert('Please enter a title and date/time');
            return;
        }

        const newMeeting = {
            id: Date.now(),
            title,
            datetime,
            location,
            notes,
            createdAt: new Date().toISOString()
        };

        if (type === 'general') {
            if (!this.data.meetings) this.data.meetings = [];
            this.data.meetings.push(newMeeting);
        } else {
            if (!this.data.sectionMeetings) this.data.sectionMeetings = {};
            if (!this.data.sectionMeetings[type]) this.data.sectionMeetings[type] = [];
            this.data.sectionMeetings[type].push(newMeeting);
        }

        this.closeModal();
        this.save();
        await this.saveToDatabase(false);
        this.renderMeetings();
        this.showNotification('✓ Meeting added');
    },

    showAddCriticalJunctureModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <h3 style="color: #dc3545;">Add Critical Juncture</h3>
                <div class="form-group">
                    <label>Date:</label>
                    <input type="date" id="junctureDate" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                </div>
                <div class="form-group">
                    <label>Description:</label>
                    <input type="text" id="junctureDescription" placeholder="e.g., Tank testing - AB supervision required" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                </div>
                <div class="form-group">
                    <label>Assigned Person (Optional):</label>
                    <input type="text" id="junctureAssigned" placeholder="Person responsible" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="app.closeModal()" class="btn" style="background: #6c757d;">Cancel</button>
                    <button onclick="app.confirmAddCriticalJuncture()" class="btn" style="background: #dc3545;">✓ Add Juncture</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
        setTimeout(() => document.getElementById('junctureDate').focus(), 100);
    },

    async confirmAddCriticalJuncture() {
        const date = document.getElementById('junctureDate').value;
        const description = document.getElementById('junctureDescription').value.trim();
        const assignedPerson = document.getElementById('junctureAssigned').value.trim();

        if (!date || !description) {
            alert('Please enter a date and description');
            return;
        }

        if (!this.data.criticalJunctures) this.data.criticalJunctures = [];
        this.data.criticalJunctures.push({
            id: Date.now(),
            date,
            description,
            assignedPerson,
            createdAt: new Date().toISOString()
        });

        this.closeModal();
        this.save();
        await this.saveToDatabase(false);
        this.renderCriticalJunctures();
        this.showNotification('✓ Critical juncture added');
    },

    addToGoogleCalendar(index, type) {
        const meeting = type === 'general' ? this.data.meetings[index] : this.data.sectionMeetings[type][index];
        if (!meeting) return;

        const startDate = new Date(meeting.datetime);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour later

        const formatDateForGoogle = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: meeting.title,
            dates: `${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}`,
            details: meeting.notes || '',
            location: meeting.location || ''
        });

        window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank');
    },

    downloadICS(index, type) {
        const meeting = type === 'general' ? this.data.meetings[index] : this.data.sectionMeetings[type][index];
        if (!meeting) return;

        const startDate = new Date(meeting.datetime);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

        const formatDateForICS = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//FuelServicePro//Project Estimator//EN',
            'BEGIN:VEVENT',
            `UID:${meeting.id}@fuelservicepro.com`,
            `DTSTAMP:${formatDateForICS(new Date())}`,
            `DTSTART:${formatDateForICS(startDate)}`,
            `DTEND:${formatDateForICS(endDate)}`,
            `SUMMARY:${meeting.title}`,
            meeting.location ? `LOCATION:${meeting.location}` : '',
            meeting.notes ? `DESCRIPTION:${meeting.notes}` : '',
            'END:VEVENT',
            'END:VCALENDAR'
        ].filter(Boolean).join('\r\n');

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
        link.click();
    },

    async deleteMeeting(index, type) {
        if (!confirm('Delete this meeting?')) return;

        if (type === 'general') {
            this.data.meetings.splice(index, 1);
        } else {
            if (!this.data.sectionMeetings[type]) return;
            this.data.sectionMeetings[type].splice(index, 1);
        }

        this.save();
        await this.saveToDatabase(false);
        this.renderMeetings();
        this.showNotification('✓ Meeting deleted');
    },

    async deleteCriticalJuncture(index) {
        if (!confirm('Delete this critical juncture?')) return;

        this.data.criticalJunctures.splice(index, 1);
        this.save();
        await this.saveToDatabase(false);
        this.renderCriticalJunctures();
        this.showNotification('✓ Critical juncture deleted');
    },

    // ===== CALENDAR =====
    renderCalendar() {
        const container = document.getElementById('calendarGrid');
        if (!container) return;

        const year = this.calendarDate.getFullYear();
        const month = this.calendarDate.getMonth();

        document.getElementById('calendarMonthYear').textContent = this.calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let html = '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: #dee2e6; border: 1px solid #dee2e6; border-radius: 6px; overflow: hidden;">';

        // Day headers
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
            html += `<div style="background: #f8f9fa; padding: 10px; text-align: center; font-weight: 600; font-size: 12px; color: #495057;">${day}</div>`;
        });

        // Empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            html += '<div style="background: #f8f9fa; min-height: 100px;"></div>';
        }

        // Days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = date.toISOString().split('T')[0];
            const isToday = date.getTime() === today.getTime();
            const events = this.getEventsForDate(dateStr);

            html += `
                <div style="background: white; min-height: 100px; padding: 8px; position: relative; cursor: pointer; ${isToday ? 'border: 2px solid #3b82f6;' : ''}" onclick="app.showDayEvents('${dateStr}')">
                    <div style="font-weight: ${isToday ? '700' : '500'}; font-size: 14px; color: ${isToday ? '#3b82f6' : '#333'}; margin-bottom: 5px;">${day}</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 3px;">
                        ${events.meetings > 0 ? `<span style="width: 8px; height: 8px; background: #3b82f6; border-radius: 50%;" title="${events.meetings} meeting(s)"></span>` : ''}
                        ${events.testing > 0 ? `<span style="width: 8px; height: 8px; background: #22c55e; border-radius: 50%;" title="${events.testing} testing schedule(s)"></span>` : ''}
                        ${events.junctures > 0 ? `<span style="width: 8px; height: 8px; background: #dc3545; border-radius: 50%;" title="${events.junctures} critical juncture(s)"></span>` : ''}
                        ${events.todos > 0 ? `<span style="width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;" title="${events.todos} todo deadline(s)"></span>` : ''}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    },

    getEventsForDate(dateStr) {
        const events = {
            meetings: 0,
            testing: 0,
            junctures: 0,
            todos: 0,
            details: []
        };

        // Check general meetings
        (this.data.meetings || []).forEach(meeting => {
            if (meeting.datetime.startsWith(dateStr)) {
                events.meetings++;
                events.details.push({ type: 'meeting', title: meeting.title, data: meeting });
            }
        });

        // Check section meetings
        Object.values(this.data.sectionMeetings || {}).forEach(meetings => {
            meetings.forEach(meeting => {
                if (meeting.datetime.startsWith(dateStr)) {
                    events.meetings++;
                    events.details.push({ type: 'meeting', title: meeting.title, data: meeting });
                }
            });
        });

        // Check testing schedules
        Object.entries(this.data.testingSchedules || {}).forEach(([section, schedule]) => {
            if (schedule.scheduledDate === dateStr) {
                events.testing++;
                events.details.push({ type: 'testing', title: `${section} - Testing`, data: schedule });
            } else if (schedule.startDate && schedule.endDate) {
                const start = new Date(schedule.startDate);
                const end = new Date(schedule.endDate);
                const check = new Date(dateStr);
                if (check >= start && check <= end) {
                    events.testing++;
                    events.details.push({ type: 'testing', title: `${section} - Testing`, data: schedule });
                }
            }
        });

        // Check critical junctures
        (this.data.criticalJunctures || []).forEach(juncture => {
            if (juncture.date === dateStr) {
                events.junctures++;
                events.details.push({ type: 'juncture', title: juncture.description, data: juncture });
            }
        });

        // Check todo deadlines
        (this.data.todos || []).forEach(todo => {
            if (todo.deadline === dateStr && !todo.completed) {
                events.todos++;
                events.details.push({ type: 'todo', title: todo.text, data: todo });
            }
        });

        Object.values(this.data.sectionTodos || {}).forEach(todos => {
            todos.forEach(todo => {
                if (todo.deadline === dateStr && !todo.completed) {
                    events.todos++;
                    events.details.push({ type: 'todo', title: todo.text, data: todo });
                }
            });
        });

        return events;
    },

    showDayEvents(dateStr) {
        const events = this.getEventsForDate(dateStr);
        const date = new Date(dateStr);

        if (events.details.length === 0) {
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        let html = `
            <div class="modal-content" style="max-width: 600px;">
                <h3>Events for ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
                <div style="margin-top: 20px;">
        `;

        events.details.forEach(event => {
            const colors = {
                meeting: '#3b82f6',
                testing: '#22c55e',
                juncture: '#dc3545',
                todo: '#f59e0b'
            };

            html += `
                <div style="padding: 12px; margin-bottom: 10px; border-left: 4px solid ${colors[event.type]}; background: #f8f9fa; border-radius: 4px;">
                    <div style="font-weight: 600; color: ${colors[event.type]}; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">
                        ${event.type === 'meeting' ? '📅 Meeting' : event.type === 'testing' ? '🔬 Testing' : event.type === 'juncture' ? '🔴 Critical Juncture' : '📋 Todo Deadline'}
                    </div>
                    <div style="color: #333;">${event.title}</div>
                </div>
            `;
        });

        html += `
                </div>
                <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
                    <button onclick="app.closeModal()" class="btn" style="background: #6c757d;">Close</button>
                </div>
            </div>
        `;

        modal.innerHTML = html;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    },

    previousMonth() {
        this.calendarDate.setMonth(this.calendarDate.getMonth() - 1);
        this.renderCalendar();
    },

    nextMonth() {
        this.calendarDate.setMonth(this.calendarDate.getMonth() + 1);
        this.renderCalendar();
    },

    addItem() {
        // Get the last item's category, or default to first category
        const lastCategory = this.data.items.length > 0 ? 
            this.data.items[this.data.items.length - 1].category : 
            'A. Forecourt Island Equipment';
        
        this.data.items.push({ 
            category: lastCategory, 
            description: '', 
            qty: 1, 
            price: 0 
        });
        this.renderItems();
        this.save();
    },
    
    addFileLink() {
        const nameInput = document.getElementById('fileNameInput');
        const urlInput = document.getElementById('fileUrlInput');
        
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();
        
        if (!name) {
            alert('Please enter a file name');
            nameInput.focus();
            return;
        }
        
        if (!url) {
            alert('Please enter a file URL');
            urlInput.focus();
            return;
        }
        
        // Basic URL validation
        try {
            new URL(url);
        } catch (e) {
            alert('Please enter a valid URL (e.g., https://drive.google.com/...)');
            urlInput.focus();
            return;
        }
        
        this.data.files.push({
            name: name,
            url: url,
            addedAt: new Date().toISOString()
        });

        console.log('File link added:', name);
        console.log('Total file links now:', this.data.files.length);

        // Clear inputs
        nameInput.value = '';
        urlInput.value = '';

        this.renderFiles();
        this.save();

        // Broadcast file addition to other tabs
        if (typeof TabSync !== 'undefined') {
            TabSync.broadcast('FILES_UPDATED', { files: this.data.files });
        }
    },
    
    renderFiles() {
        const filesList = document.getElementById('filesList');
        if (!filesList) return;
        
        if (this.data.files.length === 0) {
            filesList.innerHTML = '<p style="color: #999; font-style: italic;">No file links added yet</p>';
            return;
        }
        
        filesList.innerHTML = '';
        this.data.files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.style.cssText = 'background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center;';
            
            // Determine icon based on file name extension or URL
            let icon = '📎';
            const nameLower = file.name.toLowerCase();
            if (nameLower.includes('.pdf') || file.url?.includes('pdf')) {
                icon = '📄';
            } else if (nameLower.match(/\.(jpg|jpeg|png|gif|bmp|svg)$/)) {
                icon = '🖼️';
            } else if (nameLower.match(/\.(doc|docx)$/)) {
                icon = '📝';
            } else if (nameLower.match(/\.(xls|xlsx)$/)) {
                icon = '📊';
            }
            
            const addedDate = file.addedAt ? new Date(file.addedAt).toLocaleDateString() : '';
            
            fileItem.innerHTML = `
                <div style="flex: 1; cursor: pointer;" onclick="window.open('${file.url}', '_blank')">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px;">${icon}</span>
                        <div>
                            <div style="font-weight: 600; color: #c41e3a; margin-bottom: 3px;">${file.name}</div>
                            <div style="color: #666; font-size: 12px;">
                                ${addedDate ? `Added: ${addedDate} • ` : ''}
                                <a href="${file.url}" target="_blank" onclick="event.stopPropagation()" style="color: #007bff; text-decoration: none;">Open link ↗</a>
                            </div>
                        </div>
                    </div>
                </div>
                <button onclick="app.removeFile(${index})" style="background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove</button>
            `;
            
            filesList.appendChild(fileItem);
        });
    },
    
    removeFile(index) {
        // Track deleted files so server knows to remove them
        const file = this.data.files[index];
        if (file) {
            const fileKey = `${file.name}::${file.url}`;
            if (!this.data._deletedFileIds) this.data._deletedFileIds = [];
            this.data._deletedFileIds.push(fileKey);
        }

        this.data.files.splice(index, 1);
        this.renderFiles();
        this.save();

        // Broadcast file removal to other tabs
        if (typeof TabSync !== 'undefined') {
            TabSync.broadcast('FILES_UPDATED', { files: this.data.files, deletedFileIds: this.data._deletedFileIds });
        }
    },

    async removeItem(index) {
        this.data.items.splice(index, 1);
        this.editingItemIndex = null; // Clear editing state
        this.renderItems();
        this.calculateTotals();
        this.save();
        await this.saveToDatabase(false);
    },

    editItemRow(index) {
        this.editingItemIndex = index;
        this.renderItems();
        // Focus on description input after render
        setTimeout(() => {
            const input = document.getElementById(`desc-input-${index}`);
            if (input) input.focus();
        }, 50);
    },

    saveItemEdit(index) {
        this.editingItemIndex = null;
        this.renderItems();
        this.calculateTotals();
        this.save();
        this.saveToDatabase(false);
    },

    async updateItem(index, field, value) {
        if (field === 'qty' || field === 'price') {
            value = parseFloat(value) || 0;
        }
        this.data.items[index][field] = value;
        this.calculateTotals();
        this.save();
        await this.saveToDatabase(false);

        // Broadcast item update to other tabs
        if (typeof TabSync !== 'undefined') {
            TabSync.broadcast('ITEMS_UPDATED', { items: this.data.items });
        }
    },

    // Update cost and auto-calculate price based on upcharge percentage
    async updateItemCost(index, category, cost) {
        cost = parseFloat(cost) || 0;
        const upchargePercent = this.data.sectionUpcharges?.[category] || 0;
        const price = cost * (1 + upchargePercent / 100);

        this.data.items[index].cost = cost;
        this.data.items[index].price = Math.round(price * 100) / 100; // Round to 2 decimals

        this.calculateTotals();
        this.save();
        await this.saveToDatabase(false);

        // Re-render to show updated price
        this.renderItems();

        // Broadcast item update to other tabs
        if (typeof TabSync !== 'undefined') {
            TabSync.broadcast('ITEMS_UPDATED', { items: this.data.items });
        }
    },

    // Update upcharge percentage for a category and recalculate all prices
    async updateSectionUpcharge(category, percent) {
        percent = parseFloat(percent) || 0;

        if (!this.data.sectionUpcharges) {
            this.data.sectionUpcharges = {};
        }
        this.data.sectionUpcharges[category] = percent;

        // Recalculate prices for all items in this category that have a cost
        this.data.items.forEach(item => {
            if (item.category === category && item.cost) {
                item.price = Math.round(item.cost * (1 + percent / 100) * 100) / 100;
            }
        });

        this.calculateTotals();
        this.save();
        await this.saveToDatabase(false);

        // Re-render to show updated prices
        this.renderItems();

        this.showNotification(`✓ Markup updated to ${percent}% for ${category}`);
    },

    renderItems() {
        const container = document.getElementById('categorySections');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Check if there are no items - show empty state
        if (this.data.items.length === 0 && this.data.mode !== 'contractor') {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; background: #f8f9fa; border-radius: 12px; border: 2px dashed #dee2e6;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📦</div>
                    <h3 style="color: #495057; margin-bottom: 10px;">No Equipment Packages Yet</h3>
                    <p style="color: #6c757d; margin-bottom: 25px;">Start building your quote by adding equipment packages to this job.</p>
                    <button onclick="app.showAddPackageModal()" class="btn" style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; padding: 15px 30px; font-size: 16px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        ➕ Add Equipment Package
                    </button>
                </div>
            `;
            return;
        }
        
        // Owner mode: Select All checkbox bar and Add Package button
        if (this.data.mode !== 'contractor') {
            const selectAllBar = document.createElement('div');
            selectAllBar.style.cssText = 'display:flex; align-items:center; gap:10px; padding:10px; background:#f8f9fa; border:1px solid #dee2e6; border-radius:6px; margin-bottom:10px;';
            selectAllBar.innerHTML = `
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" id="selectAllSections" style="width:18px; height:18px;"> 
                    <span style="font-weight:600; color:#495057;">Select All Packages</span>
                </label>
                <div style="flex:1"></div>
                <button class="btn-add-section" style="background:#28a745; margin-right:10px;" onclick="app.showAddPackageModal()">➕ Add Equipment Package</button>
                <button class="btn-add-section" style="background:#007bff;" onclick="app.sendSelectedSectionsToContractor()">📤 Send Selected to Contractor</button>`;
            container.appendChild(selectAllBar);
        }
        
        // Group items by category
        const categories = {};
        this.data.items.forEach((item, index) => {
            const cat = item.category || 'Uncategorized';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({ item, index });
        });
        
        // Render each category as a section
        Object.keys(categories).forEach(category => {
            // In contractor mode, only show their assigned sections
            if (this.data.mode === 'contractor' && 
                this.data.contractorSections.length > 0 && 
                !this.data.contractorSections.includes(category)) {
                console.log('Skipping category (not assigned to contractor):', category);
                return;
            }
            
            console.log('Rendering category:', category, 'Items:', categories[category].length);
            
            const section = document.createElement('div');
            section.className = 'category-section';
            
            const header = document.createElement('div');
            header.className = 'category-header';

            // Build disclaimer buttons based on mode
            let disclaimerButtons = '';
            if (this.data.mode === 'contractor' && this.data.contractorSections.includes(category)) {
                // Contractor sees: View owner disclaimers + Add their own
                disclaimerButtons = `
                    <button class="btn-header" onclick="app.viewSectionDisclaimers('${category}')">⚠️ View Disclaimers</button>
                    <button class="btn-header" style="background: #f59e0b;" onclick="app.editContractorDisclaimers('${category}')">📝 Add My Disclaimers</button>
                `;
            } else {
                // Owner sees: Edit disclaimers
                disclaimerButtons = `<button class="btn-header" onclick="app.editSectionDisclaimers('${category}')">⚠️ Disclaimers</button>`;
            }

            // Find contractor assigned to this category
            const assignedContractor = this.getContractorForCategory(category);
            
            // Create placeholder for default button
            const defaultButtonId = `default-btn-${category.replace(/[^a-zA-Z0-9]/g, '_')}`;

            header.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    ${this.data.mode !== 'contractor' ? `<input type="checkbox" class="section-checkbox" data-category="${category}" style="width: 18px; height: 18px; cursor: pointer;">` : ''}
                    <span>${category}</span>
                    ${this.data.mode !== 'contractor' ? `
                        <div id="contractor-display-${category.replace(/[^a-zA-Z0-9]/g, '_')}" style="display: flex; align-items: center; gap: 5px; margin-left: 10px; padding: 4px 10px; background: ${assignedContractor ? '#e0f2fe' : '#f3f4f6'}; border-radius: 4px; font-size: 13px;">
                            <span style="color: ${assignedContractor ? '#0369a1' : '#6b7280'};">${assignedContractor ? `👷 ${assignedContractor}` : 'No contractor assigned'}</span>
                            <button onclick="app.editContractorAssignment('${category}')" style="background: none; border: none; cursor: pointer; padding: 2px; font-size: 14px;" title="Edit contractor">✏️</button>
                        </div>
                        <div id="${defaultButtonId}" style="margin-left: 10px;">
                            <span style="color: #9ca3af; font-size: 13px;">Checking...</span>
                        </div>
                    ` : ''}
                </div>
                <div class="category-header-buttons">
                    <button class="btn-header" onclick="app.editSectionScope('${category}')">📋 Scope of Work</button>
                    ${disclaimerButtons}
                    ${this.data.mode !== 'contractor' ? `<button class="btn-header btn-delete-section" onclick="app.deleteSection('${category}')">🗑️ Delete Package</button>` : ''}
                </div>
            `;
            section.appendChild(header);
            
            // Check if package matches defaults (async, after render)
            if (this.data.mode !== 'contractor') {
                this.checkPackageMatchesDefaults(category).then(matches => {
                    const defaultBtnContainer = document.getElementById(defaultButtonId);
                    if (defaultBtnContainer) {
                        if (matches) {
                            defaultBtnContainer.innerHTML = `
                                <span style="padding: 4px 10px; background: #d1fae5; color: #065f46; border-radius: 4px; font-size: 13px; font-weight: 600;">
                                    ✓ Default
                                </span>
                            `;
                        } else {
                            defaultBtnContainer.innerHTML = `
                                <button class="btn-header" style="background: #3b82f6; font-size: 13px;" onclick="app.savePackageAsDefaults('${category}')">
                                    💾 Save as Default
                                </button>
                            `;
                        }
                    }
                });
            }
            
            // Upcharge dropdown (owner mode only)
            const upchargePercent = this.data.sectionUpcharges?.[category] || 0;
            if (this.data.mode !== 'contractor') {
                const upchargeBar = document.createElement('div');
                upchargeBar.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px 6px 0 0; font-size: 14px;';
                upchargeBar.innerHTML = `
                    <span style="font-weight: 600; color: #856404;">📊 Markup:</span>
                    <select onchange="app.updateSectionUpcharge('${category}', this.value)" style="padding: 5px 10px; border: 1px solid #ffc107; border-radius: 4px; background: white; font-size: 14px;">
                        <option value="0" ${upchargePercent === 0 ? 'selected' : ''}>0% (No markup)</option>
                        <option value="5" ${upchargePercent === 5 ? 'selected' : ''}>5%</option>
                        <option value="10" ${upchargePercent === 10 ? 'selected' : ''}>10%</option>
                        <option value="15" ${upchargePercent === 15 ? 'selected' : ''}>15%</option>
                        <option value="20" ${upchargePercent === 20 ? 'selected' : ''}>20%</option>
                        <option value="25" ${upchargePercent === 25 ? 'selected' : ''}>25%</option>
                        <option value="30" ${upchargePercent === 30 ? 'selected' : ''}>30%</option>
                        <option value="35" ${upchargePercent === 35 ? 'selected' : ''}>35%</option>
                        <option value="40" ${upchargePercent === 40 ? 'selected' : ''}>40%</option>
                        <option value="50" ${upchargePercent === 50 ? 'selected' : ''}>50%</option>
                    </select>
                    <span style="color: #856404; font-size: 13px;">Cost × ${(1 + upchargePercent/100).toFixed(2)} = Unit Price</span>
                `;
                section.appendChild(upchargeBar);
            }

            const tableContainer = document.createElement('div');
            tableContainer.className = 'category-table';

            const table = document.createElement('table');
            table.innerHTML = `
                <thead>
                    <tr>
                        <th style="width: 35%;">Description</th>
                        <th style="width: 80px;">QTY</th>
                        <th style="width: 100px;">Cost</th>
                        <th style="width: 100px;">Unit Price</th>
                        <th style="width: 100px;">Total</th>
                        <th style="width: 50px;"></th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;

            const tbody = table.querySelector('tbody');

            categories[category].forEach(({ item, index }) => {
                const row = document.createElement('tr');
                const cost = item.cost || 0;
                const price = item.price || 0;
                const total = (item.qty || 0) * price;
                const escapedDesc = (item.description || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

                // In contractor mode, allow full editing within assigned sections; lock others
                const isContractorSection = this.data.mode === 'contractor' && this.data.contractorSections.includes(category);
                const readOnlyStyle = 'readonly style="background: #e9ecef; cursor: not-allowed;"';
                const canEdit = (this.data.mode !== 'contractor' || isContractorSection);
                const removeBtn = canEdit ? `<button class="btn-remove" onclick="app.removeItem(${index})">×</button>` : '';

                // Check if this row is in edit mode
                const isEditing = this.editingItemIndex === index;

                // Format currency values
                const formattedCost = this.formatCurrency(cost);
                const formattedPrice = this.formatCurrency(price);
                const formattedTotal = this.formatCurrency(total);

                if (isEditing && canEdit) {
                    // EDIT MODE: Show input fields
                    const descInputId = `desc-input-${index}`;
                    row.innerHTML = `
                        <td style="position: relative;">
                            <input type="text" id="${descInputId}" value="${escapedDesc}"
                                onchange="app.updateItem(${index}, 'description', this.value)"
                                oninput="app.showAutocomplete(this, ${index})"
                                onfocus="app.showAutocomplete(this, ${index})"
                                onblur="setTimeout(() => app.hideAutocomplete(${index}), 200)"
                                autocomplete="off">
                            <div id="autocomplete-${index}" class="autocomplete-dropdown" style="display: none;"></div>
                        </td>
                        <td><input type="number" value="${item.qty || 0}" step="1" min="0" onchange="app.updateItem(${index}, 'qty', this.value)"></td>
                        <td><input type="text" value="${formattedCost}"
                            onfocus="this.value = app.parseCurrency(this.value) || ''"
                            onblur="this.value = app.formatCurrency(this.value); app.updateItemCost(${index}, '${category}', app.parseCurrency(this.value))"
                            style="background: #fffbeb; text-align: right;"></td>
                        <td><input type="text" value="${formattedPrice}"
                            onfocus="this.value = app.parseCurrency(this.value) || ''"
                            onblur="this.value = app.formatCurrency(this.value); app.updateItem(${index}, 'price', app.parseCurrency(this.value))"
                            style="text-align: right;"></td>
                        <td><input type="text" value="$${formattedTotal}" readonly style="text-align: right;"></td>
                        <td style="white-space: nowrap;">
                            <button onclick="app.saveItemEdit(${index})" style="background: #22c55e; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 14px; margin-right: 4px;" title="Save">✓</button>
                            ${removeBtn}
                        </td>
                    `;
                } else {
                    // VIEW MODE: Show text with wrapping, edit button
                    row.innerHTML = `
                        <td style="white-space: pre-wrap; word-wrap: break-word; padding: 10px;">${item.description || ''}</td>
                        <td style="text-align: center;">${item.qty || 0}</td>
                        <td style="text-align: right; color: #6b7280;">$${formattedCost}</td>
                        <td style="text-align: right;">$${formattedPrice}</td>
                        <td style="text-align: right; font-weight: 600;">$${formattedTotal}</td>
                        <td style="white-space: nowrap;">
                            ${canEdit ? `<button onclick="app.editItemRow(${index})" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 14px; margin-right: 4px;" title="Edit">✏️</button>` : ''}
                            ${removeBtn}
                        </td>
                    `;
                }
                tbody.appendChild(row);
            });
            
            tableContainer.appendChild(table);
            section.appendChild(tableContainer);
            
            // Calculate and display section totals
            const sectionCostTotal = categories[category].reduce((sum, { item }) => {
                return sum + ((item.qty || 0) * (item.cost || 0));
            }, 0);
            const sectionTotal = categories[category].reduce((sum, { item }) => {
                return sum + ((item.qty || 0) * (item.price || 0));
            }, 0);
            const sectionProfit = sectionTotal - sectionCostTotal;

            const sectionTotalDiv = document.createElement('div');
            sectionTotalDiv.style.cssText = 'background: #f8f9fa; padding: 12px 20px; border-radius: 0 0 6px 6px; font-weight: 600; font-size: 14px; color: #495057; border: 1px solid #dee2e6; border-top: none; display: flex; justify-content: space-between; align-items: center;';

            if (this.data.mode !== 'contractor' && sectionCostTotal > 0) {
                sectionTotalDiv.innerHTML = `
                    <div style="display: flex; gap: 20px;">
                        <span>Cost: <span style="color: #6b7280;">$${this.formatCurrency(sectionCostTotal)}</span></span>
                        <span>Profit: <span style="color: #22c55e;">$${this.formatCurrency(sectionProfit)}</span></span>
                    </div>
                    <div>Section Total: <span style="color: #f97316; font-size: 18px;">$${this.formatCurrency(sectionTotal)}</span></div>
                `;
            } else {
                sectionTotalDiv.innerHTML = `<div style="text-align: right; width: 100%;">Section Total: <span style="color: #f97316; font-size: 18px;">$${this.formatCurrency(sectionTotal)}</span></div>`;
            }
            section.appendChild(sectionTotalDiv);
            
            // Add button for this category (only in owner mode or contractor's own sections)
            if (this.data.mode !== 'contractor' || this.data.contractorSections.includes(category)) {
                const addBtn = document.createElement('button');
                addBtn.className = 'btn-add-section';
                addBtn.textContent = `+ Add Item to ${category}`;
                addBtn.onclick = () => this.addItemToCategory(category);
                section.appendChild(addBtn);
            }
            
            container.appendChild(section);
        });
        
        // Add "Send Selected to Contractor" and "New Section" buttons (owner mode only)
        if (this.data.mode !== 'contractor') {
            const buttonContainer = document.createElement('div');
            buttonContainer.style.marginTop = '20px';
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '10px';
            
            const addPackageBtn = document.createElement('button');
            addPackageBtn.className = 'btn-add-section';
            addPackageBtn.style.background = '#28a745';
            addPackageBtn.textContent = '➕ Add Equipment Package';
            addPackageBtn.onclick = () => this.showAddPackageModal();
            buttonContainer.appendChild(addPackageBtn);
            
            const sendSelectedBtn = document.createElement('button');
            sendSelectedBtn.className = 'btn-add-section';
            sendSelectedBtn.style.background = '#007bff';
            sendSelectedBtn.textContent = '📤 Send Selected to Contractor';
            sendSelectedBtn.onclick = () => this.sendSelectedSectionsToContractor();
            buttonContainer.appendChild(sendSelectedBtn);
            
            container.appendChild(buttonContainer);
            
            // Wire up Select All behavior
            const selectAll = document.getElementById('selectAllSections');
            if (selectAll) {
                const updateState = () => {
                    const cbs = document.querySelectorAll('.section-checkbox');
                    const total = cbs.length;
                    const checked = Array.from(cbs).filter(cb => cb.checked).length;
                    selectAll.checked = total > 0 && checked === total;
                    selectAll.indeterminate = checked > 0 && checked < total;
                };
                
                selectAll.addEventListener('change', () => {
                    const cbs = document.querySelectorAll('.section-checkbox');
                    cbs.forEach(cb => cb.checked = selectAll.checked);
                    updateState();
                });
                
                document.querySelectorAll('.section-checkbox').forEach(cb => {
                    cb.addEventListener('change', updateState);
                });
                
                updateState();
            }
        }
    },
    
    // Autocomplete functions
    autocompleteTimeout: null,
    
    async showAutocomplete(input, index) {
        const query = input.value.trim();
        const dropdown = document.getElementById(`autocomplete-${index}`);
        if (!dropdown) return;
        
        if (query.length < 2) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Debounce API calls
        clearTimeout(this.autocompleteTimeout);
        this.autocompleteTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/line-item-templates/search?q=${encodeURIComponent(query)}`);
                if (!response.ok) return;
                
                const items = await response.json();
                
                if (items.length === 0) {
                    dropdown.style.display = 'none';
                    return;
                }
                
                let html = '';
                items.forEach(item => {
                    const price = parseFloat(item.default_price || 0).toFixed(2);
                    html += `
                        <div class="autocomplete-item" onmousedown="app.selectAutocomplete(${index}, '${item.description.replace(/'/g, "\\'")}', ${item.default_qty}, ${item.default_price || 0})">
                            <div style="font-weight: 500;">${item.description}</div>
                            <div style="font-size: 12px; color: #666;">Qty: ${item.default_qty} | $${price}</div>
                        </div>
                    `;
                });
                
                dropdown.innerHTML = html;
                dropdown.style.display = 'block';
            } catch (err) {
                console.error('Autocomplete error:', err);
            }
        }, 200);
    },
    
    hideAutocomplete(index) {
        const dropdown = document.getElementById(`autocomplete-${index}`);
        if (dropdown) dropdown.style.display = 'none';
    },
    
    selectAutocomplete(index, description, qty, price) {
        this.data.items[index].description = description;
        this.data.items[index].qty = qty;
        this.data.items[index].price = price;
        
        this.hideAutocomplete(index);
        this.renderItems();
        this.calculateTotals();
        this.save();
    },
    
    async addItemToCategory(category) {
        this.data.items.push({
            category: category,
            description: '',
            qty: 1,
            price: 0
        });
        this.renderItems();
        this.save();
        await this.saveToDatabase(false);
    },

    calculateTotals() {
        // Group items by category (both price and cost)
        const categories = {};
        const categoryCosts = {};
        this.data.items.forEach(item => {
            const cat = item.category || 'Uncategorized';
            if (!categories[cat]) categories[cat] = 0;
            if (!categoryCosts[cat]) categoryCosts[cat] = 0;
            categories[cat] += (item.qty || 0) * (item.price || 0);
            categoryCosts[cat] += (item.qty || 0) * (item.cost || 0);
        });

        const subtotal = this.data.items.reduce((sum, item) => {
            return sum + ((item.qty || 0) * (item.price || 0));
        }, 0);

        const totalCost = this.data.items.reduce((sum, item) => {
            return sum + ((item.qty || 0) * (item.cost || 0));
        }, 0);

        const taxRate = parseFloat(document.getElementById('taxRate')?.value || 0) / 100;
        const discount = parseFloat(document.getElementById('discount')?.value || 0);

        const taxAmount = subtotal * taxRate;
        const grandTotal = subtotal + taxAmount - discount;

        document.getElementById('subtotal').textContent = '$' + this.formatCurrency(subtotal);
        document.getElementById('taxAmount').textContent = '$' + this.formatCurrency(taxAmount);
        document.getElementById('grandTotal').textContent = '$' + this.formatCurrency(grandTotal);

        this.data.taxRate = taxRate * 100;
        this.data.discount = discount;

        // Render section breakdown on summary page
        this.renderSectionBreakdown(categories, categoryCosts, subtotal, totalCost);
    },
    
    renderSectionBreakdown(categories, categoryCosts, subtotal, totalCost) {
        const container = document.getElementById('sectionBreakdown');
        if (!container) return;

        const sortedCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]);

        if (sortedCategories.length === 0) {
            container.innerHTML = '';
            return;
        }

        const totalProfit = subtotal - totalCost;
        const profitMargin = subtotal > 0 ? (totalProfit / subtotal * 100).toFixed(1) : 0;

        let html = '<h3 style="color: #495057; margin-bottom: 15px;">Price Breakdown by Section</h3>';
        html += '<div style="background: white; border-radius: 8px; overflow: hidden; border: 1px solid #dee2e6;">';

        sortedCategories.forEach(([category, total], index) => {
            const cost = categoryCosts[category] || 0;
            const profit = total - cost;
            const percentage = subtotal > 0 ? (total / subtotal * 100).toFixed(1) : 0;
            const isLast = index === sortedCategories.length - 1;

            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; ${!isLast ? 'border-bottom: 1px solid #f0f0f0;' : ''}">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; margin-bottom: 5px;">${category}</div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="flex: 1; max-width: 200px; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden;">
                                <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #3b82f6, #f97316); border-radius: 4px;"></div>
                            </div>
                            <span style="font-size: 13px; color: #6c757d; min-width: 50px;">${percentage}%</span>
                        </div>
                        ${this.data.mode !== 'contractor' && cost > 0 ? `
                            <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">
                                Cost: $${this.formatCurrency(cost)} | Profit: <span style="color: #22c55e;">$${this.formatCurrency(profit)}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div style="font-weight: 600; font-size: 18px; color: #f97316; min-width: 120px; text-align: right;">$${this.formatCurrency(total)}</div>
                </div>
            `;
        });

        html += '</div>';

        // Add totals summary if there's cost data (owner mode only)
        if (this.data.mode !== 'contractor' && totalCost > 0) {
            html += `
                <div style="margin-top: 20px; padding: 15px 20px; background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; color: #166534; margin-bottom: 5px;">Total Profit Summary</div>
                            <div style="font-size: 14px; color: #6b7280;">
                                Total Cost: $${this.formatCurrency(totalCost)} | Profit Margin: ${profitMargin}%
                            </div>
                        </div>
                        <div style="font-weight: 700; font-size: 24px; color: #22c55e;">$${this.formatCurrency(totalProfit)}</div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    async save() {
        // Collect all form data
        this.data.stationName = document.getElementById('stationName')?.value || '';
        this.data.clientName = document.getElementById('clientName')?.value || '';
        this.data.siteAddress = document.getElementById('siteAddress')?.value || '';
        this.data.quoteDate = document.getElementById('quoteDate')?.value || '';
        this.data.quoteNumber = document.getElementById('quoteNumber')?.value || '';
        this.data.companyName = document.getElementById('companyName')?.value || '';
        this.data.companyLogoUrl = document.getElementById('companyLogoUrl')?.value || '';
        this.data.contactName = document.getElementById('contactName')?.value || '';
        this.data.phone = document.getElementById('phone')?.value || '';
        this.data.email = document.getElementById('email')?.value || '';
        this.data.projectNotes = document.getElementById('projectNotes')?.value || '';
        this.data.paymentTerms = document.getElementById('paymentTerms')?.value || '';
        this.data.scopeOfWork = document.getElementById('scopeOfWork')?.value || '';
        this.data.disclaimers = document.getElementById('disclaimers')?.value || '';
        
        // Save to localStorage as backup (without files to avoid quota issues)
        try {
            const backupData = { ...this.data };
            delete backupData.files; // Don't save files to localStorage - too large
            localStorage.setItem('estimatorData', JSON.stringify(backupData));
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }
        
        // Save to database even in contractor mode (data links) so owner sees updates
        const params = new URLSearchParams(window.location.search);
        const allowDbSave = !params.get('data') || this.data.mode === 'contractor';
        if (allowDbSave) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => {
                this.saveToDatabase(false);
            }, 1000);
        }
    },

    async saveToDatabase(showNotification = false) {
        try {
            console.log('saveToDatabase called');
            console.log('Job ID:', this.data.id);
            console.log('Items being saved:', this.data.items.length);
            console.log('Section scopes being saved:', JSON.stringify(this.data.sectionScopes));
            console.log('Deleted file IDs:', this.data._deletedFileIds);

            const method = this.data.id ? 'PUT' : 'POST';
            const url = this.data.id ? `/api/jobs/${this.data.id}` : '/api/jobs';

            console.log('API method:', method);
            console.log('API URL:', url);

            // Include _deletedFileIds in the request body
            const payload = { ...this.data };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            console.log('API response status:', response.status);

            if (!response.ok) {
                if (response.status === 413) {
                    throw new Error('Payload too large - files exceed server limit. Please use smaller files (max 2MB each) or fewer files.');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('API response:', result);

            if (!this.data.id && result.id) {
                this.data.id = result.id;
                // Update URL to include jobId
                window.history.replaceState({}, '', `/?jobId=${result.id}`);

                // Initialize TabSync now that we have a job ID
                if (typeof TabSync !== 'undefined') {
                    TabSync.init(result.id);
                    this.setupTabSyncHandlers();
                }
            }

            // Sync files from server response (server has authoritative merged files)
            if (result.files) {
                this.data.files = result.files;
                this.renderFiles();
                console.log('Files synced from server:', result.files.length);
            }

            // Clear deletion tracking after successful save
            this.data._deletedFileIds = [];

            // Broadcast save to other tabs
            if (typeof TabSync !== 'undefined' && this.data.id) {
                TabSync.broadcast('JOB_SAVED', {
                    files: this.data.files,
                    items: this.data.items
                });
            }

            if (showNotification) {
                this.showNotification('✓ Saved to database!');
            }

            return true;
        } catch (error) {
            console.error('Error saving to database:', error);

            // Show user-friendly error message
            let errorMsg = '⚠️ Failed to save to database';
            if (error.message.includes('Payload too large')) {
                errorMsg = '⚠️ Files too large! Please remove some files or use smaller ones.';
                alert('Your files are too large to save.\n\nPlease:\n1. Remove large files and try again\n2. Use files under 2MB each\n3. Or use a file sharing service instead');
            }

            if (showNotification) {
                this.showNotification(errorMsg, 5000);
            }
            return false;
        }
    },

    async loadMostRecentJob() {
        try {
            const response = await fetch('/api/jobs');
            const jobs = await response.json();
            
            if (jobs.length > 0) {
                // Get the most recent job (they're already sorted by updated_at DESC)
                const mostRecentJobId = jobs[0].id;
                await this.loadFromDatabase(mostRecentJobId);
                // Update URL to reflect the loaded job
                window.history.replaceState({}, '', `/?jobId=${mostRecentJobId}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error loading most recent job:', error);
            return false;
        }
    },

    async loadFromDatabase(jobId) {
        try {
            const response = await fetch(`/api/jobs/${jobId}`);
            const job = await response.json();
            
            this.data.id = job.id;
            this.data.clientName = job.client_name || '';
            this.data.siteAddress = job.site_address || '';
            this.data.quoteDate = job.quote_date ? job.quote_date.split('T')[0] : '';
            this.data.quoteNumber = job.quote_number || '';
            this.data.companyName = job.company_name || '';
            this.data.contactName = job.contact_name || '';
            this.data.phone = job.phone || '';
            this.data.email = job.email || '';
            this.data.projectNotes = job.project_notes || '';
            this.data.taxRate = parseFloat(job.tax_rate) || 8.25;
            this.data.discount = parseFloat(job.discount) || 0;
            this.data.paymentTerms = job.payment_terms || '';
            this.data.scopeOfWork = job.scope_of_work || '';
            this.data.disclaimers = job.disclaimers || '';
            this.data.files = job.files || [];
            this.data.sectionScopes = job.section_scopes || {};
            this.data.sectionDisclaimers = job.section_disclaimers || {};
            this.data.contractorSectionDisclaimers = job.contractor_section_disclaimers || {};
            this.data.sectionUpcharges = job.section_upcharges || {};
            this.data.todos = job.todos || [];
            this.data.sectionTodos = job.section_todos || {};
            this.data.contractorAssignments = job.contractor_assignments || {};
            this.data.meetings = job.meetings || [];
            this.data.sectionMeetings = job.section_meetings || {};
            this.data.criticalJunctures = job.critical_junctures || [];
            this.data.testingCalibration = job.testing_calibration || {};
            this.data.testingAssignments = job.testing_assignments || {};
            this.data.testingSchedules = job.testing_schedules || {};
            this.data.items = job.items || [];
            
            console.log('Loaded files from database:', this.data.files);
            console.log('Files count:', this.data.files.length);
            
            this.populateForm();
            this.renderItems();
            this.renderFiles();
            this.calculateTotals();
            this.showNotification('✓ Job loaded from database');
            return true;
        } catch (error) {
            console.error('Error loading from database:', error);
            return false;
        }
    },

    loadFromStorage() {
        const saved = localStorage.getItem('estimatorData');
        if (saved) {
            try {
                const loadedData = JSON.parse(saved);
                // Merge loaded data but preserve existing files array (localStorage doesn't store files)
                // Use existing files from this.data if available, otherwise empty array
                this.data = { ...this.data, ...loadedData, files: this.data.files || [] };
                this.populateForm();
                return true;
            } catch (e) {
                console.error('Error loading data:', e);
            }
        }
        return false;
    },

    loadFromURL() {
        const params = new URLSearchParams(window.location.search);
        const dataParam = params.get('data');
        
        if (dataParam) {
            try {
                const decoded = atob(dataParam);
                this.data = JSON.parse(decoded);
                console.log('Loaded from URL - Job ID:', this.data.id);
                console.log('Loaded from URL - Items:', this.data.items.length);
                console.log('Loaded from URL - Contractor Assignments:', this.data.contractorAssignments);
                this.populateForm();
                this.showNotification('Data loaded from URL!');
                return true;
            } catch (e) {
                console.error('Error loading from URL:', e);
            }
        }
        return false;
    },

    populateForm() {
        document.getElementById('stationName').value = this.data.stationName || '';
        document.getElementById('clientName').value = this.data.clientName || '';
        document.getElementById('siteAddress').value = this.data.siteAddress || '';
        document.getElementById('quoteDate').value = this.data.quoteDate || '';
        document.getElementById('quoteNumber').value = this.data.quoteNumber || '';
        document.getElementById('companyName').value = this.data.companyName || '';
        document.getElementById('companyLogoUrl').value = this.data.companyLogoUrl || '';
        document.getElementById('contactName').value = this.data.contactName || '';
        document.getElementById('phone').value = this.data.phone || '';
        document.getElementById('email').value = this.data.email || '';
        document.getElementById('taxRate').value = this.data.taxRate || 8.25;
        document.getElementById('discount').value = this.data.discount || 0;
        document.getElementById('projectNotes').value = this.data.projectNotes || '';
        document.getElementById('paymentTerms').value = this.data.paymentTerms || '';
        document.getElementById('scopeOfWork').value = this.data.scopeOfWork || '';
        document.getElementById('disclaimers').value = this.data.disclaimers || '';
        
        // Render logo preview if exists
        if (this.data.companyLogoUrl) {
            this.renderLogoPreview('company', this.data.companyLogoUrl);
        }
    },

    exportJSON() {
        this.save();
        const json = JSON.stringify(this.data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `job-${this.data.clientName || 'quote'}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('✓ Job exported!');
    },

    importJSON() {
        document.getElementById('fileInput').click();
    },

    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                
                // Merge data (additive - don't overwrite existing pricing)
                if (imported.items) {
                    imported.items.forEach((importItem, index) => {
                        if (this.data.items[index]) {
                            // If price is filled in import but empty in current, use import
                            if (importItem.price && !this.data.items[index].price) {
                                this.data.items[index].price = importItem.price;
                            }
                        }
                    });
                }
                
                // Update other fields if empty
                Object.keys(imported).forEach(key => {
                    if (key !== 'items' && imported[key] && !this.data[key]) {
                        this.data[key] = imported[key];
                    }
                });
                
                this.populateForm();
                this.renderItems();
                this.calculateTotals();
                this.save();
                this.showNotification('✓ Data imported and merged!');
            } catch (error) {
                alert('Error importing file: ' + error.message);
            }
        };
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    },

    shareURL() {
        this.save();
        this.data.mode = 'owner'; // Always share as owner
        const encoded = btoa(JSON.stringify(this.data));
        const url = `${window.location.origin}${window.location.pathname}?data=${encoded}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
            this.showNotification('✓ Shareable link copied to clipboard!');
        }).catch(() => {
            // Fallback
            prompt('Copy this URL:', url);
        });
    },
    
    async sendToContractor() {
        this.save();
        await this.saveToDatabase(true);
        if (!this.data.id) {
            alert('Failed to create job ID. Please try saving the project first.');
            return;
        }
        const url = `${window.location.origin}${window.location.pathname}?jobId=${this.data.id}&mode=contractor`;
        navigator.clipboard.writeText(url).then(() => {
            this.showNotification('✓ Contractor link copied! Send this to your contractor.', 5000);
        }).catch(() => {
            prompt('Copy this contractor URL:', url);
        });
    },
    
    async sendBackToOwner() {
        // In contractor mode, persist changes to the database for the existing job
        console.log('sendBackToOwner called');
        console.log('Job ID:', this.data.id);
        console.log('Items count:', this.data.items.length);
        console.log('Section scopes:', this.data.sectionScopes);
        
        if (!this.data.id) {
            alert('Error: No job ID found. Changes cannot be saved to the project.');
            return;
        }
        
        const success = await this.saveToDatabase(true);
        if (success) {
            this.showNotification('✅ Your changes have been saved! The project owner will see your updates when they open the job.', 6000);
        } else {
            alert('Failed to save changes. Please try again.');
        }
    },
    
    addNewSection() {
        const sectionName = prompt('Enter new section name:');
        if (sectionName && sectionName.trim()) {
            this.data.items.push({
                category: sectionName.trim(),
                description: '',
                qty: 1,
                price: 0
            });
            this.renderItems();
            this.save();
        }
    },
    
    // Get contractor assigned to a specific category
    getContractorForCategory(category) {
        const assignments = this.data.contractorAssignments || {};
        for (const [contractorName, categories] of Object.entries(assignments)) {
            if (categories && categories.includes(category)) {
                return contractorName;
            }
        }
        return null;
    },

    // Edit contractor assignment for a category
    async editContractorAssignment(category) {
        const currentContractor = this.getContractorForCategory(category);
        
        const modal = document.getElementById('modal');
        const modalContent = document.getElementById('modalContent');
        
        modalContent.innerHTML = `
            <h3 style="margin-top: 0;">Assign Contractor: ${category}</h3>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label>Contractor Name</label>
                <input type="text" id="contractorNameInput" value="${currentContractor || ''}" placeholder="Enter contractor name" style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
            </div>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label>Contractor Logo (Optional)</label>
                <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                    <input type="text" id="contractorLogoInput" value="${this.data.contractorLogos && currentContractor ? (this.data.contractorLogos[currentContractor] || '') : ''}" placeholder="URL or base64" style="flex: 1; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                    <button onclick="document.getElementById('contractorLogoUpload').click()" class="btn" style="background: #3b82f6; padding: 10px 20px;">📁 Upload</button>
                    <input type="file" id="contractorLogoUpload" accept="image/*" style="display: none;">
                </div>
                <div id="contractorLogoPreviewModal" style="margin-top: 10px;"></div>
                <small style="color: #666;">Logo will appear in PDF on this contractor's packages.</small>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="app.closeModal()" class="btn" style="background: #6c757d;">Cancel</button>
                <button onclick="app.saveContractorAssignment('${category}')" class="btn" style="background: #28a745;">Save</button>
            </div>
        `;
        
        modal.classList.add('show');
        
        // Setup logo upload handler
        setTimeout(() => {
            const logoInput = document.getElementById('contractorLogoInput');
            const logoUpload = document.getElementById('contractorLogoUpload');
            const logoPreview = document.getElementById('contractorLogoPreviewModal');
            
            // Show existing logo if any
            if (logoInput.value) {
                logoPreview.innerHTML = `
                    <div style="border: 1px solid #dee2e6; border-radius: 6px; padding: 10px; display: inline-block; background: #f8f9fa;">
                        <img src="${logoInput.value}" style="max-width: 200px; max-height: 100px; display: block;" alt="Contractor logo">
                    </div>
                `;
            }
            
            logoUpload.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                if (!file.type.startsWith('image/')) {
                    this.showNotification('⚠️ Please select an image file', 3000);
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target.result;
                    logoInput.value = base64;
                    logoPreview.innerHTML = `
                        <div style="border: 1px solid #dee2e6; border-radius: 6px; padding: 10px; display: inline-block; background: #f8f9fa;">
                            <img src="${base64}" style="max-width: 200px; max-height: 100px; display: block;" alt="Contractor logo">
                        </div>
                    `;
                };
                reader.readAsDataURL(file);
            };
        }, 100);
    },

    async saveContractorAssignment(category) {
        const contractorNameInput = document.getElementById('contractorNameInput');
        const contractorLogoInput = document.getElementById('contractorLogoInput');
        
        if (!contractorNameInput || !contractorLogoInput) return;
        
        const newName = contractorNameInput.value.trim();
        const logoUrl = contractorLogoInput.value.trim();
        
        const currentContractor = this.getContractorForCategory(category);

        // Remove this category from any existing contractor assignment
        for (const [contractor, categories] of Object.entries(this.data.contractorAssignments || {})) {
            if (categories && categories.includes(category)) {
                this.data.contractorAssignments[contractor] = categories.filter(c => c !== category);
                // Clean up empty assignments
                if (this.data.contractorAssignments[contractor].length === 0) {
                    delete this.data.contractorAssignments[contractor];
                }
            }
        }

        // Assign to new contractor (if name provided)
        if (newName) {
            if (!this.data.contractorAssignments[newName]) {
                this.data.contractorAssignments[newName] = [];
            }
            this.data.contractorAssignments[newName].push(category);
            
            // Save logo if provided
            if (logoUrl) {
                if (!this.data.contractorLogos) {
                    this.data.contractorLogos = {};
                }
                this.data.contractorLogos[newName] = logoUrl;
            }
        }

        this.closeModal();
        this.save();
        await this.saveToDatabase(false);
        this.renderItems();
        this.showNotification(newName ? `✓ ${category} assigned to ${newName}` : `✓ Contractor removed from ${category}`);
    },

    async sendSectionToContractor(category) {
        const contractorName = prompt(`Enter contractor name for ${category}:`);
        if (!contractorName || !contractorName.trim()) return;
        const cleanName = contractorName.trim();

        // Assign this single section and persist to DB to ensure job ID exists in data
        this.data.contractorAssignments[cleanName] = Array.from(new Set([...(this.data.contractorAssignments[cleanName] || []), category]));
        this.save();
        await this.saveToDatabase(true);

        const encoded = btoa(JSON.stringify(this.data));
        const url = `${window.location.origin}${window.location.pathname}?data=${encoded}&mode=contractor&contractor=${encodeURIComponent(cleanName)}`;

        navigator.clipboard.writeText(url).then(() => {
            this.showNotification(`✓ Link for "${category}" copied for ${cleanName}!`, 5000);
        }).catch(() => {
            prompt('Copy this contractor URL:', url);
        });
    },
    
    async sendSelectedSectionsToContractor() {
        const checkboxes = document.querySelectorAll('.section-checkbox:checked');
        const selectedCategories = Array.from(checkboxes).map(cb => cb.dataset.category);
        
        if (selectedCategories.length === 0) {
            alert('Please select at least one section to send to contractor');
            return;
        }
        
        const contractorName = prompt(`Enter contractor name:\n(This will identify which sections they can edit)`);
        if (!contractorName || !contractorName.trim()) {
            alert('Contractor name is required');
            return;
        }
        const cleanName = contractorName.trim();
        
        // Save contractor assignment and persist to DB to ensure job ID exists
        this.data.contractorAssignments[cleanName] = selectedCategories;
        this.save();
        await this.saveToDatabase(true);
        
        if (!this.data.id) {
            alert('Failed to save job. Please try again.');
            return;
        }
        
        // Create short link via API
        try {
            const response = await fetch('/api/contractor-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId: this.data.id,
                    contractorName: cleanName
                })
            });
            
            if (!response.ok) throw new Error('Failed to create link');
            
            const { shortCode } = await response.json();
            const url = `${window.location.origin}/c/${shortCode}`;
            
            navigator.clipboard.writeText(url).then(() => {
                this.showNotification(`✓ Short link for ${cleanName} copied! (${selectedCategories.length} section${selectedCategories.length > 1 ? 's' : ''})`, 5000);
                checkboxes.forEach(cb => cb.checked = false);
            }).catch(() => {
                prompt('Copy this contractor URL:', url);
            });
        } catch (error) {
            console.error('Error creating short link:', error);
            alert('Failed to create short link. Please try again.');
        }
    },
    
    editSectionScope(category) {
        const currentScope = this.data.sectionScopes[category] || '';
        const readonly = this.data.mode === 'contractor' && !this.data.contractorSections.includes(category);
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Scope of Work - ${category}</h3>
                <textarea id="sectionScopeText" rows="10" style="width: 100%; padding: 10px; font-size: 14px;" ${readonly ? 'readonly' : ''}>${currentScope}</textarea>
                <div style="margin-top: 15px; text-align: right;">
                    ${!readonly ? '<button class="btn" onclick="app.saveSectionScope(\'' + category + '\')">Save</button>' : ''}
                    <button class="btn" onclick="app.closeModal()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    },
    
    editSectionDisclaimers(category) {
        const currentDisclaimers = this.data.sectionDisclaimers[category] || '';
        const readonly = this.data.mode === 'contractor' && !this.data.contractorSections.includes(category);
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Disclaimers - ${category}</h3>
                <textarea id="sectionDisclaimersText" rows="10" style="width: 100%; padding: 10px; font-size: 14px;" ${readonly ? 'readonly' : ''}>${currentDisclaimers}</textarea>
                <div style="margin-top: 15px; text-align: right;">
                    ${!readonly ? '<button class="btn" onclick="app.saveSectionDisclaimers(\'' + category + '\')">Save</button>' : ''}
                    <button class="btn" onclick="app.closeModal()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    },
    
    async saveSectionScope(category) {
        const text = document.getElementById('sectionScopeText').value;
        this.data.sectionScopes[category] = text;
        this.save();
        await this.saveToDatabase(true);
        this.closeModal();
        this.showNotification('✓ Scope of work saved to project!');
    },

    async deleteSectionScope(category) {
        if (!confirm(`Delete scope of work for "${category}"?`)) return;

        delete this.data.sectionScopes[category];
        this.save();
        await this.saveToDatabase(true);
        this.renderSectionScopes();
        this.showNotification(`✓ Scope of work deleted for "${category}"`);
    },

    async saveSectionDisclaimers(category) {
        const text = document.getElementById('sectionDisclaimersText').value;
        this.data.sectionDisclaimers[category] = text;
        this.save();
        await this.saveToDatabase(true);
        this.closeModal();
        this.showNotification('✓ Disclaimers saved to project!');
    },

    // View owner's disclaimers (read-only, for contractors)
    viewSectionDisclaimers(category) {
        const ownerDisclaimers = this.data.sectionDisclaimers[category] || '';

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>⚠️ Disclaimers - ${category}</h3>
                <p style="color: #666; margin-bottom: 10px; font-size: 14px;">Project Manager's Disclaimers (Read Only)</p>
                <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; min-height: 150px; white-space: pre-wrap; line-height: 1.6; color: #333;">
                    ${ownerDisclaimers || '<em style="color: #999;">No disclaimers added by project manager.</em>'}
                </div>
                <div style="margin-top: 15px; text-align: right;">
                    <button class="btn" onclick="app.closeModal()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    },

    // Contractor adds/edits their own disclaimers for a section
    editContractorDisclaimers(category) {
        if (!this.data.contractorSectionDisclaimers) {
            this.data.contractorSectionDisclaimers = {};
        }
        if (!this.data.contractorSectionDisclaimers[category]) {
            this.data.contractorSectionDisclaimers[category] = {};
        }

        const contractorName = this.data.contractorName || 'Contractor';
        const currentText = this.data.contractorSectionDisclaimers[category][contractorName] || '';

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>📝 My Disclaimers - ${category}</h3>
                <p style="color: #666; margin-bottom: 10px; font-size: 14px;">Add your disclaimers for this equipment package (${contractorName})</p>
                <textarea id="contractorDisclaimersText" rows="10" style="width: 100%; padding: 10px; font-size: 14px;" placeholder="Enter your disclaimers, exclusions, or notes...">${currentText}</textarea>
                <div style="margin-top: 15px; text-align: right;">
                    <button class="btn" style="background: #28a745; margin-right: 10px;" onclick="app.saveContractorDisclaimers('${category}')">Save</button>
                    <button class="btn" onclick="app.closeModal()">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    },

    async saveContractorDisclaimers(category) {
        const text = document.getElementById('contractorDisclaimersText').value;
        const contractorName = this.data.contractorName || 'Contractor';

        if (!this.data.contractorSectionDisclaimers) {
            this.data.contractorSectionDisclaimers = {};
        }
        if (!this.data.contractorSectionDisclaimers[category]) {
            this.data.contractorSectionDisclaimers[category] = {};
        }

        this.data.contractorSectionDisclaimers[category][contractorName] = text;
        this.save();
        await this.saveToDatabase(true);
        this.closeModal();
        this.showNotification('✓ Your disclaimers saved!');
    },

    closeModal() {
        const modal = document.getElementById('modal');
        if (modal) {
            modal.classList.remove('show');
        }
    },
    
    deleteSection(category) {
        if (confirm(`Are you sure you want to delete the entire "${category}" section? This will remove all items in this section.`)) {
            // Remove all items in this category
            this.data.items = this.data.items.filter(item => item.category !== category);

            // Remove section-specific scope and disclaimers
            delete this.data.sectionScopes[category];
            delete this.data.sectionDisclaimers[category];

            this.renderItems();
            this.calculateTotals();
            this.save();
            this.showNotification(`✓ "${category}" section deleted`);

            // Broadcast package deletion to other tabs
            if (typeof TabSync !== 'undefined') {
                TabSync.broadcast('PACKAGES_UPDATED', {
                    items: this.data.items,
                    sectionScopes: this.data.sectionScopes,
                    sectionDisclaimers: this.data.sectionDisclaimers
                });
            }
        }
    },

    generatePDF() {
        this.save();
        
        // Get unique categories from items
        const uniqueCategories = [...new Set(this.data.items.map(item => item.category))].filter(Boolean);
        
        // Show customization modal
        this.showPDFCustomizationModal(uniqueCategories);
    },

    showPDFCustomizationModal(categories) {
        const modal = document.getElementById('modal');
        const modalContent = document.getElementById('modalContent');
        
        // Build draggable category list
        let categoryListHTML = categories.map((cat, idx) => `
            <div class="pdf-category-item" draggable="true" data-category="${cat}" data-index="${idx}">
                <span class="drag-handle">⋮⋮</span>
                <span>${cat}</span>
            </div>
        `).join('');
        
        modalContent.innerHTML = `
            <h3 style="margin-top: 0;">Customize PDF</h3>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-weight: 600; margin-bottom: 8px;">
                    Equipment Package Order
                    <span style="font-weight: normal; color: #666; font-size: 13px;">(Drag to reorder)</span>
                </label>
                <div id="categoryOrderList" style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 10px;">
                    ${categoryListHTML}
                </div>
            </div>
            
            <div style="margin-bottom: 20px; padding: 12px; background: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 6px;">
                <strong>📋 Note:</strong> Package scopes and disclaimers will appear immediately after each package's line items.
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="app.closeModal()" class="btn" style="background: #6c757d;">Cancel</button>
                <button onclick="app.generatePDFWithOrder()" class="btn" style="background: #28a745;">Generate PDF</button>
            </div>
        `;
        
        modal.classList.add('show');
        
        // Setup drag and drop
        setTimeout(() => {
            const list = document.getElementById('categoryOrderList');
            const items = list.querySelectorAll('.pdf-category-item');
            
            let draggedItem = null;
            
            items.forEach(item => {
                item.addEventListener('dragstart', (e) => {
                    draggedItem = item;
                    item.style.opacity = '0.5';
                });
                
                item.addEventListener('dragend', (e) => {
                    item.style.opacity = '1';
                });
                
                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                });
                
                item.addEventListener('drop', (e) => {
                    e.preventDefault();
                    if (draggedItem !== item) {
                        const allItems = [...list.querySelectorAll('.pdf-category-item')];
                        const draggedIndex = allItems.indexOf(draggedItem);
                        const targetIndex = allItems.indexOf(item);
                        
                        if (draggedIndex < targetIndex) {
                            item.parentNode.insertBefore(draggedItem, item.nextSibling);
                        } else {
                            item.parentNode.insertBefore(draggedItem, item);
                        }
                    }
                });
            });
        }, 100);
    },

    generatePDFWithOrder() {
        // Get ordered categories from the modal
        const items = document.querySelectorAll('.pdf-category-item');
        const orderedCategories = Array.from(items).map(item => item.dataset.category);
        
        this.closeModal();
        
        // Generate PDF with custom order
        this.generatePDFActual(orderedCategories);
    },

    generatePDFActual(orderedCategories) {

        // Calculate category totals for breakdown
        const categoryTotals = {};
        this.data.items.forEach(item => {
            const cat = item.category || 'Uncategorized';
            if (!categoryTotals[cat]) categoryTotals[cat] = 0;
            categoryTotals[cat] += (item.qty || 0) * (item.price || 0);
        });

        const subtotal = this.data.items.reduce((sum, item) => sum + ((item.qty || 0) * (item.price || 0)), 0);
        const taxAmount = subtotal * (this.data.taxRate / 100);
        const grandTotal = subtotal + taxAmount - this.data.discount;

        // Build price breakdown by section (using ordered categories)
        const breakdownBody = [
            [{ text: 'Equipment Package', style: 'tableHeader' }, { text: 'Amount', style: 'tableHeader', alignment: 'right' }]
        ];
        orderedCategories.forEach(cat => {
            if (categoryTotals[cat]) {
                breakdownBody.push([cat, { text: '$' + this.formatCurrency(categoryTotals[cat]), alignment: 'right' }]);
            }
        });

        // Build content array
        const content = [
            { text: 'PROJECT ESTIMATE', style: 'title', alignment: 'center' },
            { text: this.data.stationName || this.data.siteAddress || this.data.clientName || '[Project Site]', style: 'siteName', alignment: 'center' }
        ];
        
        // Add company logo if available
        if (this.data.companyLogoUrl) {
            content.push({
                image: this.data.companyLogoUrl,
                width: 150,
                alignment: 'center',
                margin: [0, 10, 0, 10]
            });
        }
        
        content.push(
            { text: this.data.companyName || 'Your Company', style: 'company', alignment: 'center' },
            { text: `${this.data.phone} | ${this.data.email}`, style: 'contact', alignment: 'center' },
            { text: '\n' },

            { text: 'Prepared For:', style: 'sectionHeader' },
            { text: this.data.clientName || '[Client Name]', bold: true },
            { text: this.data.siteAddress || '[Site Address]' },
            { text: `Date: ${this.data.quoteDate || new Date().toISOString().split('T')[0]}` },
            { text: `Estimate #: ${this.data.quoteNumber || 'N/A'}` },
            { text: '\n' },

            { text: 'PRICE BREAKDOWN BY PACKAGE', style: 'sectionHeader' },
            {
                table: {
                    widths: ['*', 100],
                    body: breakdownBody
                },
                layout: 'lightHorizontalLines'
            },
            { text: '\n' },

            { text: 'DETAILED LINE ITEMS', style: 'sectionHeader' }
        );

        // For each category in order, add line items + scope + disclaimers
        orderedCategories.forEach((category, catIndex) => {
            const categoryItems = this.data.items.filter(item => item.category === category);
            
            if (categoryItems.length === 0) return;
            
            // Check if this package has an assigned contractor with logo
            const assignedContractor = this.getContractorForCategory(category);
            const contractorLogo = assignedContractor && this.data.contractorLogos ? this.data.contractorLogos[assignedContractor] : null;

            // Build table for this category
            const tableBody = [
                [
                    { text: 'Description', style: 'tableHeader' },
                    { text: 'QTY', style: 'tableHeader', alignment: 'center' },
                    { text: 'Unit Price', style: 'tableHeader', alignment: 'right' },
                    { text: 'Total', style: 'tableHeader', alignment: 'right' }
                ]
            ];

            // Add category header
            tableBody.push([
                { text: category, colSpan: 4, bold: true, color: '#c41e3a', fillColor: '#e8e8e8', margin: [0, 8, 0, 5] },
                {},
                {},
                {}
            ]);

            // Add items
            categoryItems.forEach(item => {
                const total = (item.qty || 0) * (item.price || 0);
                tableBody.push([
                    item.description || '',
                    { text: (item.qty || 0).toString(), alignment: 'center' },
                    { text: '$' + this.formatCurrency(item.price || 0), alignment: 'right' },
                    { text: '$' + this.formatCurrency(total), alignment: 'right' }
                ]);
            });

            // Add category total
            tableBody.push([
                { text: `${category} Total:`, colSpan: 3, bold: true, alignment: 'right', fillColor: '#f8f9fa' },
                {},
                {},
                { text: '$' + this.formatCurrency(categoryTotals[category]), bold: true, alignment: 'right', fillColor: '#f8f9fa' }
            ]);

            // Add the table to content
            content.push({
                table: {
                    widths: ['*', 50, 80, 80],
                    body: tableBody
                },
                layout: 'lightHorizontalLines',
                pageBreak: catIndex === 0 ? undefined : 'before' // Page break before each package except first
            });
            
            // Add contractor logo if assigned
            if (contractorLogo) {
                content.push({
                    columns: [
                        { text: `Contractor: ${assignedContractor}`, bold: true, fontSize: 10, color: '#666', margin: [0, 8, 0, 0] },
                        { image: contractorLogo, width: 80, alignment: 'right', margin: [0, 4, 0, 0] }
                    ],
                    columnGap: 10
                });
            } else if (assignedContractor) {
                content.push({ text: `Contractor: ${assignedContractor}`, bold: true, fontSize: 10, color: '#666', margin: [0, 8, 0, 4] });
            }

            // Add scope of work for this package if present
            if (this.data.sectionScopes && this.data.sectionScopes[category]) {
                content.push({ text: `\n${category} - Scope of Work`, bold: true, fontSize: 11, color: '#c41e3a', margin: [0, 8, 0, 4] });
                content.push({ text: this.data.sectionScopes[category], fontSize: 10, margin: [0, 0, 0, 8] });
            }

            // Add disclaimers for this package if present
            if (this.data.sectionDisclaimers && this.data.sectionDisclaimers[category]) {
                content.push({ text: `\n${category} - Disclaimers`, bold: true, fontSize: 11, color: '#c41e3a', margin: [0, 8, 0, 4] });
                content.push({ text: this.data.sectionDisclaimers[category], fontSize: 10, margin: [0, 0, 0, 12] });
            }
        });

        // Add totals
        content.push({ text: '\n' });
        content.push({
            table: {
                widths: ['*', 120],
                body: [
                    ['Subtotal:', { text: '$' + this.formatCurrency(subtotal), alignment: 'right' }],
                    [`Tax (${this.data.taxRate}%):`, { text: '$' + this.formatCurrency(taxAmount), alignment: 'right' }],
                    ['Discount:', { text: '-$' + this.formatCurrency(this.data.discount), alignment: 'right' }],
                    [
                        { text: 'TOTAL:', bold: true, fontSize: 12 },
                        { text: '$' + this.formatCurrency(grandTotal), bold: true, alignment: 'right', fontSize: 14 }
                    ]
                ]
            },
            layout: 'noBorders'
        });

        // Add general scope of work if present
        if (this.data.scopeOfWork) {
            content.push({ text: '\nGENERAL SCOPE OF WORK', style: 'sectionHeader' });
            content.push({ text: this.data.scopeOfWork, fontSize: 10 });
        }

        // Add general disclaimers if present
        if (this.data.disclaimers) {
            content.push({ text: '\nGENERAL DISCLAIMERS', style: 'sectionHeader' });
            content.push({ text: this.data.disclaimers, fontSize: 10 });
        }

        // Add payment terms if present
        if (this.data.paymentTerms) {
            content.push({ text: '\nPAYMENT TERMS', style: 'sectionHeader' });
            content.push({ text: this.data.paymentTerms, fontSize: 10 });
        }

        const docDefinition = {
            pageSize: 'LETTER',
            pageMargins: [40, 60, 40, 60],
            content: content,
            styles: {
                title: {
                    fontSize: 24,
                    bold: true,
                    color: '#c41e3a',
                    margin: [0, 0, 0, 5]
                },
                siteName: {
                    fontSize: 18,
                    bold: true,
                    color: '#333',
                    margin: [0, 0, 0, 10]
                },
                company: {
                    fontSize: 14,
                    bold: true,
                    margin: [0, 5, 0, 5]
                },
                contact: {
                    fontSize: 10,
                    color: '#666',
                    margin: [0, 0, 0, 20]
                },
                sectionHeader: {
                    fontSize: 12,
                    bold: true,
                    color: '#c41e3a',
                    margin: [0, 15, 0, 8]
                },
                tableHeader: {
                    bold: true,
                    fillColor: '#f0f0f0'
                }
            },

            defaultStyle: {
                fontSize: 10
            }
        };

        const siteName = this.data.siteAddress || this.data.clientName || 'estimate';
        const cleanSiteName = siteName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        pdfMake.createPdf(docDefinition).download(`estimate-${cleanSiteName}.pdf`);
        this.showNotification('✓ PDF generated!');
    },

    showNotification(message, duration = 3000) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
    },

    // Handle logo file upload
    handleLogoUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showNotification('⚠️ Please select an image file', 3000);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            
            if (type === 'company') {
                document.getElementById('companyLogoUrl').value = base64;
                this.data.companyLogoUrl = base64;
                this.renderLogoPreview('company', base64);
            } else if (type === 'contractor') {
                // This will be handled in contractor assignment modal
                const contractorName = event.target.dataset.contractor;
                if (contractorName) {
                    this.data.contractorLogos[contractorName] = base64;
                }
            }
            
            this.save();
            this.showNotification('✓ Logo uploaded!');
        };
        
        reader.readAsDataURL(file);
    },

    renderLogoPreview(type, logoUrl) {
        if (!logoUrl) return;
        
        const previewId = type === 'company' ? 'companyLogoPreview' : `${type}LogoPreview`;
        const preview = document.getElementById(previewId);
        if (!preview) return;
        
        preview.innerHTML = `
            <div style="border: 1px solid #dee2e6; border-radius: 6px; padding: 10px; display: inline-block; background: #f8f9fa;">
                <img src="${logoUrl}" style="max-width: 200px; max-height: 100px; display: block;" alt="Logo preview">
                <button onclick="app.removeLogo('${type}')" style="margin-top: 8px; background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    Remove Logo
                </button>
            </div>
        `;
    },

    removeLogo(type) {
        if (type === 'company') {
            this.data.companyLogoUrl = '';
            document.getElementById('companyLogoUrl').value = '';
            document.getElementById('companyLogoPreview').innerHTML = '';
        }
        this.save();
        this.showNotification('✓ Logo removed');
    },

    // Check if current package items match defaults
    async checkPackageMatchesDefaults(packageName) {
        try {
            const packageItems = this.data.items.filter(item => item.category === packageName);
            const lineItems = packageItems.map(item => ({
                description: item.description,
                qty: parseFloat(item.qty) || 0,
                cost: parseFloat(item.cost) || 0,
                price: parseFloat(item.price) || 0
            }));

            const response = await fetch('/api/package-templates/check-defaults', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packageName, lineItems })
            });

            const result = await response.json();
            return result.matches || false;
        } catch (error) {
            console.error('Error checking defaults:', error);
            return false;
        }
    },

    // Save current package items as defaults
    async savePackageAsDefaults(packageName) {
        const packageItems = this.data.items.filter(item => item.category === packageName);
        
        if (packageItems.length === 0) {
            this.showNotification('⚠️ No items to save as defaults');
            return;
        }

        const confirmed = confirm(`Save these ${packageItems.length} line items as the default template for "${packageName}"?\n\nThis will replace any existing defaults for this package.`);
        if (!confirmed) return;

        try {
            const lineItems = packageItems.map(item => ({
                description: item.description,
                qty: parseFloat(item.qty) || 0,
                cost: parseFloat(item.cost) || 0,
                price: parseFloat(item.price) || 0
            }));

            const response = await fetch('/api/package-templates/save-defaults', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packageName, lineItems })
            });

            const result = await response.json();
            
            if (response.ok) {
                this.showNotification(`✓ Saved ${lineItems.length} items as default for "${packageName}"`);
                // Re-render to show "Default" badge
                this.renderItems();
            } else {
                throw new Error(result.error || 'Failed to save defaults');
            }
        } catch (error) {
            console.error('Error saving defaults:', error);
            this.showNotification('⚠️ Failed to save defaults: ' + error.message, 5000);
        }
    }
};

// Initialize app when page loads
window.addEventListener('load', () => app.init());
