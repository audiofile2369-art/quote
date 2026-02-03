// Main application object
const app = {
    data: {
        id: null, // Database job ID
        clientName: '',
        siteAddress: '',
        quoteDate: '',
        quoteNumber: '',
        companyName: 'Petroleum Network Solutions',
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
        contractorAssignments: {}, // { 'contractorName': ['Package A', 'Package B'] }
        mode: 'owner', // 'owner' or 'contractor'
        contractorName: null, // contractor viewing this
        contractorSection: null, // which package the contractor can edit (deprecated)
        contractorSections: [] // multiple packages for contractor
    },
    
    // Cache for templates
    packageTemplates: [],
    lineItemTemplates: [],
    
    saveTimeout: null, // For debouncing auto-saves

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
            contractorAssignments: {},
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
        
        // Refresh section scopes/disclaimers when switching to those tabs
        if (tabName === 'scope') {
            this.renderSectionScopes();
        } else if (tabName === 'disclaimers') {
            this.renderSectionDisclaimers();
        }
    },

    renderSectionScopes() {
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
            header.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span>${sectionName}${contractorLabel}</span>
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
        this.data.files.splice(index, 1);
        this.renderFiles();
        this.save();
    },

    async removeItem(index) {
        this.data.items.splice(index, 1);
        this.renderItems();
        this.calculateTotals();
        this.save();
        await this.saveToDatabase(false);
    },

    async updateItem(index, field, value) {
        if (field === 'qty' || field === 'price') {
            value = parseFloat(value) || 0;
        }
        this.data.items[index][field] = value;
        this.calculateTotals();
        this.save();
        await this.saveToDatabase(false);
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
            header.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${this.data.mode !== 'contractor' ? `<input type="checkbox" class="section-checkbox" data-category="${category}" style="width: 18px; height: 18px; cursor: pointer;">` : ''}
                    <span>${category}</span>
                </div>
                <div class="category-header-buttons">
                    ${this.data.mode !== 'contractor' ? `<button class="btn-header" onclick="app.sendSectionToContractor('${category}')">📤 Send to Contractor</button>` : ''}
                    <button class="btn-header" onclick="app.editSectionScope('${category}')">📋 Scope of Work</button>
                    <button class="btn-header" onclick="app.editSectionDisclaimers('${category}')">⚠️ Disclaimers</button>
                    ${this.data.mode !== 'contractor' ? `<button class="btn-header btn-delete-section" onclick="app.deleteSection('${category}')">🗑️ Delete Package</button>` : ''}
                </div>
            `;
            section.appendChild(header);
            
            const tableContainer = document.createElement('div');
            tableContainer.className = 'category-table';
            
            const table = document.createElement('table');
            table.innerHTML = `
                <thead>
                    <tr>
                        <th style="width: 40%;">Description</th>
                        <th style="width: 100px;">QTY</th>
                        <th style="width: 120px;">Unit Price</th>
                        <th style="width: 120px;">Total</th>
                        <th style="width: 60px;"></th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            
            const tbody = table.querySelector('tbody');
            
            categories[category].forEach(({ item, index }) => {
                const row = document.createElement('tr');
                const total = (item.qty || 0) * (item.price || 0);
                const escapedDesc = (item.description || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                
                // In contractor mode, allow full editing within assigned sections; lock others
                const isContractorSection = this.data.mode === 'contractor' && this.data.contractorSections.includes(category);
                const readOnlyStyle = 'readonly style="background: #e9ecef; cursor: not-allowed;"';
                const descReadonly = (this.data.mode === 'contractor' && !isContractorSection) ? readOnlyStyle : '';
                const qtyReadonly = (this.data.mode === 'contractor' && !isContractorSection) ? readOnlyStyle : '';
                const removeBtn = (this.data.mode !== 'contractor' || isContractorSection) ? `<button class="btn-remove" onclick="app.removeItem(${index})">×</button>` : '';
                
                row.innerHTML = `
                    <td><input type="text" value="${escapedDesc}" onchange="app.updateItem(${index}, 'description', this.value)" ${descReadonly}></td>
                    <td><input type="number" value="${item.qty || 0}" step="1" min="0" onchange="app.updateItem(${index}, 'qty', this.value)" ${qtyReadonly}></td>
                    <td><input type="number" value="${item.price || 0}" step="0.01" min="0" onchange="app.updateItem(${index}, 'price', this.value)"></td>
                    <td><input type="text" value="$${total.toFixed(2)}" readonly></td>
                    <td>${removeBtn}</td>
                `;
                tbody.appendChild(row);
            });
            
            tableContainer.appendChild(table);
            section.appendChild(tableContainer);
            
            // Calculate and display section total
            const sectionTotal = categories[category].reduce((sum, { item }) => {
                return sum + ((item.qty || 0) * (item.price || 0));
            }, 0);
            
            const sectionTotalDiv = document.createElement('div');
            sectionTotalDiv.style.cssText = 'background: #f8f9fa; padding: 12px 20px; border-radius: 0 0 6px 6px; text-align: right; font-weight: 600; font-size: 16px; color: #495057; border: 1px solid #dee2e6; border-top: none;';
            sectionTotalDiv.innerHTML = `Section Total: <span style="color: #f97316; font-size: 18px;">$${sectionTotal.toFixed(2)}</span>`;
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
        // Group items by category
        const categories = {};
        this.data.items.forEach(item => {
            const cat = item.category || 'Uncategorized';
            if (!categories[cat]) categories[cat] = 0;
            categories[cat] += (item.qty || 0) * (item.price || 0);
        });
        
        const subtotal = this.data.items.reduce((sum, item) => {
            return sum + ((item.qty || 0) * (item.price || 0));
        }, 0);
        
        const taxRate = parseFloat(document.getElementById('taxRate')?.value || 0) / 100;
        const discount = parseFloat(document.getElementById('discount')?.value || 0);
        
        const taxAmount = subtotal * taxRate;
        const grandTotal = subtotal + taxAmount - discount;
        
        document.getElementById('subtotal').textContent = '$' + subtotal.toFixed(2);
        document.getElementById('taxAmount').textContent = '$' + taxAmount.toFixed(2);
        document.getElementById('grandTotal').textContent = '$' + grandTotal.toFixed(2);
        
        this.data.taxRate = taxRate * 100;
        this.data.discount = discount;
        
        // Render section breakdown on summary page
        this.renderSectionBreakdown(categories, subtotal);
    },
    
    renderSectionBreakdown(categories, subtotal) {
        const container = document.getElementById('sectionBreakdown');
        if (!container) return;
        
        const sortedCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]);
        
        if (sortedCategories.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        let html = '<h3 style="color: #495057; margin-bottom: 15px;">Cost Breakdown by Section</h3>';
        html += '<div style="background: white; border-radius: 8px; overflow: hidden; border: 1px solid #dee2e6;">';
        
        sortedCategories.forEach(([category, total], index) => {
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
                    </div>
                    <div style="font-weight: 600; font-size: 18px; color: #f97316; min-width: 120px; text-align: right;">$${total.toFixed(2)}</div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    },

    async save() {
        // Collect all form data
        this.data.clientName = document.getElementById('clientName')?.value || '';
        this.data.siteAddress = document.getElementById('siteAddress')?.value || '';
        this.data.quoteDate = document.getElementById('quoteDate')?.value || '';
        this.data.quoteNumber = document.getElementById('quoteNumber')?.value || '';
        this.data.companyName = document.getElementById('companyName')?.value || '';
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
            
            const method = this.data.id ? 'PUT' : 'POST';
            const url = this.data.id ? `/api/jobs/${this.data.id}` : '/api/jobs';
            
            console.log('API method:', method);
            console.log('API URL:', url);
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.data)
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
            this.data.contractorAssignments = job.contractor_assignments || {};
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
                // Merge loaded data but ensure files array exists (it's not in localStorage)
                this.data = { ...loadedData, files: [] };
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
        document.getElementById('clientName').value = this.data.clientName || '';
        document.getElementById('siteAddress').value = this.data.siteAddress || '';
        document.getElementById('quoteDate').value = this.data.quoteDate || '';
        document.getElementById('quoteNumber').value = this.data.quoteNumber || '';
        document.getElementById('companyName').value = this.data.companyName || '';
        document.getElementById('contactName').value = this.data.contactName || '';
        document.getElementById('phone').value = this.data.phone || '';
        document.getElementById('email').value = this.data.email || '';
        document.getElementById('taxRate').value = this.data.taxRate || 8.25;
        document.getElementById('discount').value = this.data.discount || 0;
        document.getElementById('projectNotes').value = this.data.projectNotes || '';
        document.getElementById('paymentTerms').value = this.data.paymentTerms || '';
        document.getElementById('scopeOfWork').value = this.data.scopeOfWork || '';
        document.getElementById('disclaimers').value = this.data.disclaimers || '';
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
    
    async saveSectionDisclaimers(category) {
        const text = document.getElementById('sectionDisclaimersText').value;
        this.data.sectionDisclaimers[category] = text;
        this.save();
        await this.saveToDatabase(true);
        this.closeModal();
        this.showNotification('✓ Disclaimers saved to project!');
    },
    
    closeModal() {
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
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
        }
    },

    generatePDF() {
        this.save();
        
        const subtotal = this.data.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
        const taxAmount = subtotal * (this.data.taxRate / 100);
        const grandTotal = subtotal + taxAmount - this.data.discount;
        
        // Build line items table with categories
        const tableBody = [
            [
                { text: 'Description', style: 'tableHeader' },
                { text: 'QTY', style: 'tableHeader', alignment: 'center' },
                { text: 'Unit Price', style: 'tableHeader', alignment: 'right' },
                { text: 'Total', style: 'tableHeader', alignment: 'right' }
            ]
        ];
        
        let currentCategory = '';
        this.data.items.forEach(item => {
            // Add category header
            if (item.category && item.category !== currentCategory) {
                currentCategory = item.category;
                tableBody.push([
                    { text: currentCategory, colSpan: 4, bold: true, color: '#c41e3a', fillColor: '#f8f9fa', margin: [0, 5, 0, 5] },
                    {},
                    {},
                    {}
                ]);
            }
            
            const total = item.qty * item.price;
            tableBody.push([
                item.description,
                { text: item.qty.toString(), alignment: 'center' },
                { text: '$' + item.price.toFixed(2), alignment: 'right' },
                { text: '$' + total.toFixed(2), alignment: 'right' }
            ]);
        });
        
        const docDefinition = {
            pageSize: 'LETTER',
            pageMargins: [40, 60, 40, 60],
            
            content: [
                { text: 'QUOTE', style: 'title', alignment: 'center' },
                { text: this.data.companyName || 'Your Company', style: 'company', alignment: 'center' },
                { text: `${this.data.phone} | ${this.data.email}`, style: 'contact', alignment: 'center' },
                { text: '\n' },
                
                { text: 'Prepared For:', style: 'sectionHeader' },
                { text: this.data.clientName || '[Client Name]', bold: true },
                { text: this.data.siteAddress || '[Site Address]' },
                { text: `Date: ${this.data.quoteDate || new Date().toISOString().split('T')[0]}` },
                { text: `Quote #: ${this.data.quoteNumber || 'N/A'}` },
                { text: '\n' },
                
                { text: 'LINE ITEMS', style: 'sectionHeader' },
                {
                    table: {
                        widths: ['*', 50, 80, 80],
                        body: tableBody
                    },
                    layout: 'lightHorizontalLines'
                },
                { text: '\n' },
                
                {
                    table: {
                        widths: ['*', 100],
                        body: [
                            ['Subtotal:', { text: '$' + subtotal.toFixed(2), alignment: 'right' }],
                            [`Tax (${this.data.taxRate}%):`, { text: '$' + taxAmount.toFixed(2), alignment: 'right' }],
                            ['Discount:', { text: '-$' + this.data.discount.toFixed(2), alignment: 'right' }],
                            [
                                { text: 'TOTAL:', bold: true },
                                { text: '$' + grandTotal.toFixed(2), bold: true, alignment: 'right', fontSize: 14 }
                            ]
                        ]
                    },
                    layout: 'noBorders'
                },
                
                this.data.paymentTerms ? [
                    { text: '\nPAYMENT TERMS', style: 'sectionHeader' },
                    { text: this.data.paymentTerms, fontSize: 10 }
                ] : [],
                
                this.data.scopeOfWork ? [
                    { text: '\nSCOPE OF WORK', style: 'sectionHeader' },
                    { text: this.data.scopeOfWork, fontSize: 10 }
                ] : []
            ],
            
            styles: {
                title: {
                    fontSize: 24,
                    bold: true,
                    color: '#c41e3a',
                    margin: [0, 0, 0, 10]
                },
                company: {
                    fontSize: 16,
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
        
        pdfMake.createPdf(docDefinition).download(`quote-${this.data.clientName || 'estimate'}.pdf`);
        this.showNotification('✓ PDF generated!');
    },

    showNotification(message, duration = 3000) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
    }
};

// Initialize app when page loads
window.addEventListener('load', () => app.init());
