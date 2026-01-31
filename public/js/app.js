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
        taxRate: 8.25,
        discount: 0,
        paymentTerms: '',
        scopeOfWork: ''
    },

    init() {
        // Set today's date
        document.getElementById('quoteDate').value = new Date().toISOString().split('T')[0];
        
        // Load from URL or localStorage
        this.loadFromURL() || this.loadFromStorage();
        
        // Render initial items
        this.renderItems();
        this.calculateTotals();
        
        // If no items, add a few defaults
        if (this.data.items.length === 0) {
            this.loadDefaultItems();
        }
    },

    loadDefaultItems() {
        const defaults = [
            { description: '6" round X 7" long crash protector', qty: 12, price: 0 },
            { description: 'Fiberglass Dispenser Sumps', qty: 3, price: 0 },
            { description: 'Impact valve double poppet', qty: 8, price: 0 },
            { description: 'OPW closed bottom fiberglass submerged pump sump', qty: 3, price: 0 },
            { description: '1-1/2 HP submerged pump', qty: 3, price: 0 },
            { description: 'TLS-450PLUS Console', qty: 1, price: 0 }
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
        this.data.items.push({ description: '', qty: 1, price: 0 });
        this.renderItems();
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
        const tbody = document.getElementById('itemsBody');
        tbody.innerHTML = '';
        
        this.data.items.forEach((item, index) => {
            const row = document.createElement('tr');
            const total = (item.qty || 0) * (item.price || 0);
            
            row.innerHTML = `
                <td><input type="text" value="${item.description || ''}" onchange="app.updateItem(${index}, 'description', this.value)"></td>
                <td><input type="number" value="${item.qty || 0}" step="1" min="0" onchange="app.updateItem(${index}, 'qty', this.value)"></td>
                <td><input type="number" value="${item.price || 0}" step="0.01" min="0" onchange="app.updateItem(${index}, 'price', this.value)"></td>
                <td><input type="text" value="$${total.toFixed(2)}" readonly></td>
                <td><button class="btn-remove" onclick="app.removeItem(${index})">×</button></td>
            `;
            
            tbody.appendChild(row);
        });
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
        this.data.paymentTerms = document.getElementById('paymentTerms')?.value || '';
        this.data.scopeOfWork = document.getElementById('scopeOfWork')?.value || '';
        
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
        document.getElementById('paymentTerms').value = this.data.paymentTerms || '';
        document.getElementById('scopeOfWork').value = this.data.scopeOfWork || '';
    },

    exportJSON() {
        this.save();
        const json = JSON.stringify(this.data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `estimate-${this.data.clientName || 'quote'}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('✓ JSON exported!');
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

    generatePDF() {
        this.save();
        
        const subtotal = this.data.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
        const taxAmount = subtotal * (this.data.taxRate / 100);
        const grandTotal = subtotal + taxAmount - this.data.discount;
        
        // Build line items table
        const tableBody = [
            [
                { text: 'Description', style: 'tableHeader' },
                { text: 'QTY', style: 'tableHeader', alignment: 'center' },
                { text: 'Unit Price', style: 'tableHeader', alignment: 'right' },
                { text: 'Total', style: 'tableHeader', alignment: 'right' }
            ]
        ];
        
        this.data.items.forEach(item => {
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
