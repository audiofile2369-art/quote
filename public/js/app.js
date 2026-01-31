// Main application object
const app = {
    data: {
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
        mode: 'owner' // 'owner' or 'contractor'
    },

    init() {
        // Set today's date
        document.getElementById('quoteDate').value = new Date().toISOString().split('T')[0];
        
        // Load from URL or localStorage
        this.loadFromURL() || this.loadFromStorage();
        
        // Check URL for mode parameter AFTER loading data (so it overrides stored mode)
        const params = new URLSearchParams(window.location.search);
        if (params.get('mode') === 'contractor') {
            this.data.mode = 'contractor';
        }
        
        // Apply contractor mode restrictions
        this.applyModeRestrictions();
        
        // Render initial items and files
        this.renderItems();
        this.renderFiles();
        this.calculateTotals();
        
        // If no items, add defaults
        if (this.data.items.length === 0) {
            this.loadDefaultItems();
        }
    },
    
    applyModeRestrictions() {
        if (this.data.mode === 'contractor') {
            // Show contractor banner
            const banner = document.createElement('div');
            banner.className = 'info-banner';
            banner.style.cssText = 'background: #fff3cd; border-left-color: #ffc107; margin: 20px; font-size: 16px;';
            banner.innerHTML = `
                <strong>👷 Contractor Mode:</strong> You can view project info, fill in your pricing, and upload additional documents. 
                When done, click "Send Back to Owner" button below.
            `;
            document.querySelector('.container').insertBefore(banner, document.querySelector('.actions'));
            
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
            
            // Hide owner-only buttons and show contractor buttons ONLY
            document.querySelector('.actions').innerHTML = `
                <button onclick="app.sendBackToOwner()" class="btn btn-danger" style="font-size: 18px; padding: 18px 40px;">
                    ✅ SEND BACK TO OWNER
                </button>
            `;
            
            // Show auto-save indicator
            const autoSaveMsg = document.createElement('div');
            autoSaveMsg.style.cssText = 'text-align: center; padding: 10px; background: #d4edda; color: #155724; font-weight: 600;';
            autoSaveMsg.innerHTML = '💾 Your changes are auto-saved as you type';
            document.querySelector('.actions').appendChild(autoSaveMsg);
            
            // Disable add/remove buttons on categories (contractor can only edit prices)
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-remove') || 
                    e.target.classList.contains('btn-add-section')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showNotification('You cannot add/remove items in contractor mode');
                }
            }, true);
        }
    },

    loadDefaultItems() {
        const defaults = [
            // A. FORECOURT ISLAND EQUIPMENT
            { category: 'A. Forecourt Island Equipment', description: '6" round X 7" long crash protector', qty: 12, price: 0 },
            { category: 'A. Forecourt Island Equipment', description: 'Fiberglass Dispenser Sumps', qty: 3, price: 0 },
            { category: 'A. Forecourt Island Equipment', description: 'Island Forms 3 X 8 X9 with 6"R', qty: 3, price: 0 },
            { category: 'A. Forecourt Island Equipment', description: 'Stabilizer bar', qty: 8, price: 0 },
            { category: 'A. Forecourt Island Equipment', description: 'flex connector 1 1/2" X 16"', qty: 8, price: 0 },
            { category: 'A. Forecourt Island Equipment', description: 'Impact valve double poppet', qty: 8, price: 0 },
            
            // B. FORECOURT SUBMERGED PUMP PACKAGE
            { category: 'B. Forecourt Submerged Pump Package', description: 'OPW closed bottom fiberglass submerged pump sump', qty: 3, price: 0 },
            { category: 'B. Forecourt Submerged Pump Package', description: 'Sump mounting flange', qty: 3, price: 0 },
            { category: 'B. Forecourt Submerged Pump Package', description: '42" round manhole Matador', qty: 3, price: 0 },
            { category: 'B. Forecourt Submerged Pump Package', description: '1 1/2 HP sub pump (Regular/Premium/Diesel)', qty: 3, price: 0 },
            { category: 'B. Forecourt Submerged Pump Package', description: 'Gasoline DPLLD with SwiftCheck Valve', qty: 2, price: 0 },
            { category: 'B. Forecourt Submerged Pump Package', description: 'Diesel DPLLD with SwiftCheck Valve', qty: 1, price: 0 },
            { category: 'B. Forecourt Submerged Pump Package', description: 'Relay w/ hook box', qty: 3, price: 0 },
            { category: 'B. Forecourt Submerged Pump Package', description: '2" ball valve', qty: 3, price: 0 },
            { category: 'B. Forecourt Submerged Pump Package', description: '2" X 16" flex connector', qty: 3, price: 0 },
            
            // C. TANK EQUIPMENT
            { category: 'C. Tank Equipment', description: 'Spill containment manhole', qty: 3, price: 0 },
            { category: 'C. Tank Equipment', description: '10" overfill drop tube', qty: 3, price: 0 },
            { category: 'C. Tank Equipment', description: '4" fill adaptor w/swivel', qty: 2, price: 0 },
            { category: 'C. Tank Equipment', description: '4" adaptor standard', qty: 1, price: 0 },
            { category: 'C. Tank Equipment', description: '4" fill cap', qty: 3, price: 0 },
            { category: 'C. Tank Equipment', description: 'EVR vapor adaptor manhole', qty: 1, price: 0 },
            { category: 'C. Tank Equipment', description: 'EVR vapor swivel adaptor', qty: 1, price: 0 },
            { category: 'C. Tank Equipment', description: 'EVR adaptor cap', qty: 1, price: 0 },
            { category: 'C. Tank Equipment', description: 'Extractor valve', qty: 3, price: 0 },
            { category: 'C. Tank Equipment', description: 'Face seal adaptor', qty: 2, price: 0 },
            { category: 'C. Tank Equipment', description: '2" EVR vent cap', qty: 2, price: 0 },
            { category: 'C. Tank Equipment', description: 'Aluminum vent cap', qty: 1, price: 0 },
            { category: 'C. Tank Equipment', description: 'Probe manhole', qty: 3, price: 0 },
            { category: 'C. Tank Equipment', description: 'Interstitial Manhole', qty: 1, price: 0 },
            { category: 'C. Tank Equipment', description: 'Monitor Well Manhole', qty: 2, price: 0 },
            
            // D. TANK MONITOR PACKAGE
            { category: 'D. Tank Monitor Package', description: 'TLS-450PLUS Console (Dual USB, RS-232/RS-485)', qty: 1, price: 0 },
            { category: 'D. Tank Monitor Package', description: 'TLS450PLUS Application Software', qty: 1, price: 0 },
            { category: 'D. Tank Monitor Package', description: 'Universal Sensor/Probe Interface Module', qty: 1, price: 0 },
            { category: 'D. Tank Monitor Package', description: 'Universal Input/Output Interface Module (UIOM)', qty: 1, price: 0 },
            { category: 'D. Tank Monitor Package', description: 'Base Compliance DPLLD Software', qty: 1, price: 0 },
            { category: 'D. Tank Monitor Package', description: 'SS Probe 0.2 MAG Plus Water Detection - 10 ft', qty: 3, price: 0 },
            { category: 'D. Tank Monitor Package', description: 'Install Kit - MAG Probe (Gas Phase Separator/Water Detector)', qty: 2, price: 0 },
            { category: 'D. Tank Monitor Package', description: 'Install Kit - MAG Plus Diesel', qty: 1, price: 0 },
            { category: 'D. Tank Monitor Package', description: 'Sump Sensor (Piping, 12ft Cable)', qty: 6, price: 0 },
            { category: 'D. Tank Monitor Package', description: 'Interstitial Sensor - Steel Tank (4-12ft)', qty: 1, price: 0 },
            { category: 'D. Tank Monitor Package', description: 'TLS450+ Continuous Statistical Leak Detection (CSLD)', qty: 1, price: 0 },
            
            // E. TANK SPECIFICATIONS
            { category: 'E. Tank Specifications', description: '25,000 gallon ELUTRON double wall underground tank. 10" dia. x 42.5" long. 3-compartment construction- SPLIT 5/15/5. Each compartment includes (5) 4" FNPT fittings. (1) 2" FNPT interstitial monitor port.', qty: 1, price: 0 },
            { category: 'E. Tank Specifications', description: 'Add to above for tie-down straps', qty: 7, price: 0 },
            { category: 'E. Tank Specifications', description: 'Add to above for turnbuckles', qty: 14, price: 0 },
            
            // F. DISPENSERS - WAYNE ANTHEM
            { category: 'F. Dispensers - Wayne Anthem', description: 'DUAL Passport POS terminal (2 servers, scanners, PIN pads)', qty: 1, price: 0 },
            { category: 'F. Dispensers - Wayne Anthem', description: 'Universal D-Box (for Wayne Anthems)', qty: 1, price: 0 },
            { category: 'F. Dispensers - Wayne Anthem', description: 'Wayne Anthem Model B23/4 (four grade blending, diesel)', qty: 1, price: 0 },
            { category: 'F. Dispensers - Wayne Anthem', description: 'Wayne Anthem Model B12/3 (four grade blending)', qty: 1, price: 0 },
            { category: 'F. Dispensers - Wayne Anthem', description: 'DX Promote annual contract', qty: 1, price: 0 },
            { category: 'F. Dispensers - Wayne Anthem', description: 'Additional warranty (years 4-5)', qty: 1, price: 0 },
            { category: 'F. Dispensers - Wayne Anthem', description: 'Unbranded valances', qty: 1, price: 0 },
            { category: 'F. Dispensers - Wayne Anthem', description: 'OPW Hanging Hardware (Unleaded/Premium)', qty: 1, price: 0 },
            { category: 'F. Dispensers - Wayne Anthem', description: 'OPW Hanging Hardware (Diesel)', qty: 1, price: 0 },
            { category: 'F. Dispensers - Wayne Anthem', description: 'POS Installation and commissioning', qty: 1, price: 0 },
            
            // G. DISPENSERS - GILBARCO
            { category: 'G. Dispensers - Gilbarco', description: 'DUAL Passport POS terminal', qty: 1, price: 0 },
            { category: 'G. Dispensers - Gilbarco', description: 'Gilbarco Encore Model E700 3+1 (four grade, diesel, Flexpay 6)', qty: 1, price: 0 },
            { category: 'G. Dispensers - Gilbarco', description: 'Gilbarco Encore Model E700 3+0 (three grade, Flexpay 6)', qty: 1, price: 0 },
            { category: 'G. Dispensers - Gilbarco', description: 'OPW Hanging Hardware (Unleaded/Premium)', qty: 1, price: 0 },
            { category: 'G. Dispensers - Gilbarco', description: 'OPW Hanging Hardware (Diesel)', qty: 1, price: 0 },
            
            // H. CANOPY EQUIPMENT
            { category: 'H. Canopy Equipment', description: 'Canopy Structure (specify dimensions)', qty: 1, price: 0 },
            { category: 'H. Canopy Equipment', description: 'LED Lighting Package', qty: 1, price: 0 },
            { category: 'H. Canopy Equipment', description: 'Fascia/Signage', qty: 1, price: 0 },
            { category: 'H. Canopy Equipment', description: 'Canopy Installation', qty: 1, price: 0 }
        ];
        
        this.data.items = defaults;
        this.renderItems();
        this.save();
    },

    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
        
        // Show selected tab
        document.getElementById(`tab-${tabName}`).classList.add('active');
        event.target.classList.add('active');
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
    
    handleFileUpload(event) {
        const files = event.target.files;
        
        Array.from(files).forEach(file => {
            // Check file size (5MB limit)
            if (file.size > 5 * 1024 * 1024) {
                alert(`File ${file.name} is too large. Max size is 5MB.`);
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                this.data.files.push({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: e.target.result
                });
                this.renderFiles();
                this.save();
            };
            reader.readAsDataURL(file);
        });
        
        // Clear the input
        event.target.value = '';
    },
    
    renderFiles() {
        const filesList = document.getElementById('filesList');
        if (!filesList) return;
        
        if (this.data.files.length === 0) {
            filesList.innerHTML = '<p style="color: #999; font-style: italic;">No files uploaded yet</p>';
            return;
        }
        
        filesList.innerHTML = '';
        this.data.files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const icon = file.type.includes('pdf') ? '📄' : 
                        file.type.includes('image') ? '🖼️' : '📎';
            
            const sizeKB = (file.size / 1024).toFixed(1);
            
            fileItem.innerHTML = `
                <div class="file-info">
                    <span class="file-icon">${icon}</span>
                    <div>
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${sizeKB} KB</div>
                    </div>
                </div>
                <button class="btn-remove-file" onclick="app.removeFile(${index})">Remove</button>
            `;
            
            filesList.appendChild(fileItem);
        });
    },
    
    removeFile(index) {
        this.data.files.splice(index, 1);
        this.renderFiles();
        this.save();
    },

    removeItem(index) {
        this.data.items.splice(index, 1);
        this.renderItems();
        this.calculateTotals();
        this.save();
    },

    updateItem(index, field, value) {
        if (field === 'qty' || field === 'price') {
            value = parseFloat(value) || 0;
        }
        this.data.items[index][field] = value;
        this.calculateTotals();
        this.save();
    },

    renderItems() {
        const container = document.getElementById('categorySections');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Group items by category
        const categories = {};
        this.data.items.forEach((item, index) => {
            const cat = item.category || 'Uncategorized';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({ item, index });
        });
        
        // Render each category as a section
        Object.keys(categories).forEach(category => {
            const section = document.createElement('div');
            section.className = 'category-section';
            
            const header = document.createElement('div');
            header.className = 'category-header';
            header.textContent = category;
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
                
                // In contractor mode, make description and qty read-only
                const descReadonly = this.data.mode === 'contractor' ? 'readonly style="background: #e9ecef; cursor: not-allowed;"' : '';
                const qtyReadonly = this.data.mode === 'contractor' ? 'readonly style="background: #e9ecef; cursor: not-allowed;"' : '';
                const removeBtn = this.data.mode === 'contractor' ? '' : `<button class="btn-remove" onclick="app.removeItem(${index})">×</button>`;
                
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
            
            // Add button for this category (only in owner mode)
            if (this.data.mode !== 'contractor') {
                const addBtn = document.createElement('button');
                addBtn.className = 'btn-add-section';
                addBtn.textContent = `+ Add Item to ${category}`;
                addBtn.onclick = () => this.addItemToCategory(category);
                section.appendChild(addBtn);
            }
            
            container.appendChild(section);
        });
    },
    
    addItemToCategory(category) {
        this.data.items.push({
            category: category,
            description: '',
            qty: 1,
            price: 0
        });
        this.renderItems();
        this.save();
    },

    calculateTotals() {
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
    },

    save() {
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
        
        // Save to localStorage
        localStorage.setItem('estimatorData', JSON.stringify(this.data));
    },

    loadFromStorage() {
        const saved = localStorage.getItem('estimatorData');
        if (saved) {
            try {
                this.data = JSON.parse(saved);
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
    
    sendToContractor() {
        this.save();
        const encoded = btoa(JSON.stringify(this.data));
        const url = `${window.location.origin}${window.location.pathname}?data=${encoded}&mode=contractor`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
            this.showNotification('✓ Contractor link copied! Send this to your contractor.', 5000);
        }).catch(() => {
            prompt('Copy this contractor URL:', url);
        });
    },
    
    sendBackToOwner() {
        this.save();
        this.data.mode = 'owner'; // Send back as owner mode
        const encoded = btoa(JSON.stringify(this.data));
        const url = `${window.location.origin}${window.location.pathname}?data=${encoded}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
            this.showNotification('✓ Link copied! Send this back to the project owner.', 5000);
        }).catch(() => {
            prompt('Copy this URL and send to project owner:', url);
        });
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
