// Transaction Manager
class TradeTracker {
    constructor() {
        this.transactions = this.loadTransactions();
        this.filteredTransactions = [];
        this.currentPage = 1;
        this.itemsPerPage = 15;
        this.searchQuery = '';
        this.filters = {
            types: { export: true, import: true },
            currency: '',
            amountMin: '',
            amountMax: '',
            dateFrom: '',
            dateTo: ''
        };
        this.sortBy = 'date-desc';
        this.exchangeRates = {};
        this.baseCurrency = 'USD';
        this.init();
        this.initSessionTimeout();
        this.fetchExchangeRates();
    }

    init() {
        this.applyFiltersAndRender();
        this.updateDashboard();
        this.setupEventListeners();
        this.setDefaultDate();
        this.initCharts();
        this.populateFilterCurrencies();

        // Load currencies when Drive backup is ready
        setTimeout(() => {
            if (window.driveBackup) {
                window.driveBackup.loadCurrencies();
            }
        }, 500);
    }

    setDefaultDate() {
        // Set current date and time as default
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        const defaultDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
        document.getElementById('transactionDate').value = defaultDateTime;
    }

    setupEventListeners() {
        const form = document.getElementById('transactionForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTransaction();
        });

        // Search
        const searchInput = document.getElementById('searchTransactions');
        searchInput?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.currentPage = 1;
            this.applyFiltersAndRender();
        });

        // Filter button toggle
        const filterBtn = document.getElementById('filterBtn');
        const filterPanel = document.getElementById('filterPanel');
        filterBtn?.addEventListener('click', () => {
            if (filterPanel.style.display === 'none' || !filterPanel.style.display) {
                filterPanel.style.display = 'block';
            } else {
                filterPanel.style.display = 'none';
            }
        });

        // Apply filters
        const applyFiltersBtn = document.getElementById('applyFilters');
        applyFiltersBtn?.addEventListener('click', () => {
            this.filters.types.export = document.getElementById('filterExport').checked;
            this.filters.types.import = document.getElementById('filterImport').checked;
            this.filters.currency = document.getElementById('filterCurrency').value;
            this.filters.amountMin = document.getElementById('filterAmountMin').value;
            this.filters.amountMax = document.getElementById('filterAmountMax').value;
            this.filters.dateFrom = document.getElementById('filterDateFrom').value;
            this.filters.dateTo = document.getElementById('filterDateTo').value;
            this.currentPage = 1;
            this.applyFiltersAndRender();
        });

        // Clear filters
        const clearFiltersBtn = document.getElementById('clearFilters');
        clearFiltersBtn?.addEventListener('click', () => {
            this.filters = {
                types: { export: true, import: true },
                currency: '',
                amountMin: '',
                amountMax: '',
                dateFrom: '',
                dateTo: ''
            };
            document.getElementById('filterExport').checked = true;
            document.getElementById('filterImport').checked = true;
            document.getElementById('filterCurrency').value = '';
            document.getElementById('filterAmountMin').value = '';
            document.getElementById('filterAmountMax').value = '';
            document.getElementById('filterDateFrom').value = '';
            document.getElementById('filterDateTo').value = '';
            this.searchQuery = '';
            document.getElementById('searchTransactions').value = '';
            this.currentPage = 1;
            this.applyFiltersAndRender();
            this.showNotification('تم مسح جميع الفلاتر');
        });

        // Sort
        const sortSelect = document.getElementById('sortTransactions');
        sortSelect?.addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.applyFiltersAndRender();
        });

        // Pagination
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        prevPageBtn?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderTransactions();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        nextPageBtn?.addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredTransactions.length / this.itemsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderTransactions();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        // Quick Add button
        const quickAddBtn = document.getElementById('quickAddBtn');
        quickAddBtn?.addEventListener('click', () => {
            const form = document.getElementById('transactionForm');
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Focus on amount field
            setTimeout(() => {
                document.getElementById('amount')?.focus();
            }, 500);
        });

        // Profit Details Modal
        const closeProfitDetailsBtn = document.getElementById('closeProfitDetailsModal');
        const profitDetailsModal = document.getElementById('profitDetailsModal');

        closeProfitDetailsBtn?.addEventListener('click', () => {
            profitDetailsModal.classList.remove('active');
        });

        profitDetailsModal?.addEventListener('click', (e) => {
            if (e.target === profitDetailsModal) {
                profitDetailsModal.classList.remove('active');
            }
        });

        // Reports Modal
        const openReportsBtn = document.getElementById('openReportsBtn');
        const closeReportsBtn = document.getElementById('closeReportsModal');
        const reportsModal = document.getElementById('reportsModal');

        openReportsBtn?.addEventListener('click', () => {
            reportsModal.classList.add('active');
            this.generateProfitByCurrencyReport();
            this.populateConverterCurrencies();
            this.populateBaseCurrencySelect();
        });

        closeReportsBtn?.addEventListener('click', () => {
            reportsModal.classList.remove('active');
        });

        reportsModal?.addEventListener('click', (e) => {
            if (e.target === reportsModal) {
                reportsModal.classList.remove('active');
            }
        });

        // Currency Converter
        const convertAmountInput = document.getElementById('convertAmount');
        const convertFromSelect = document.getElementById('convertFromCurrency');
        const convertToSelect = document.getElementById('convertToCurrency');
        const swapBtn = document.getElementById('swapCurrenciesBtn');

        [convertAmountInput, convertFromSelect, convertToSelect].forEach(el => {
            el?.addEventListener('input', () => this.performCurrencyConversion());
            el?.addEventListener('change', () => this.performCurrencyConversion());
        });

        swapBtn?.addEventListener('click', () => {
            const from = convertFromSelect.value;
            const to = convertToSelect.value;
            convertFromSelect.value = to;
            convertToSelect.value = from;
            this.performCurrencyConversion();
        });

        // Base Currency Select
        const baseCurrencySelect = document.getElementById('baseCurrencySelect');
        baseCurrencySelect?.addEventListener('change', (e) => {
            this.baseCurrency = e.target.value;
            if (this.baseCurrency) {
                this.generateMultiCurrencySummary();
            }
        });
    }

    addTransaction() {
        const type = document.querySelector('input[name="type"]:checked').value;
        const amount = parseFloat(document.getElementById('amount').value);
        let currency = document.getElementById('currency').value;
        const description = document.getElementById('description').value;
        const transactionDate = document.getElementById('transactionDate').value;

        if (!amount || amount <= 0) {
            alert('يرجى إدخال مبلغ صحيح');
            return;
        }

        // Use default currency if none selected
        if (!currency && window.driveBackup?.defaultCurrency) {
            currency = window.driveBackup.defaultCurrency;
        }

        if (!currency) {
            alert('يرجى اختيار العملة');
            return;
        }

        if (!description.trim()) {
            alert('يرجى إدخال وصف للمعاملة');
            return;
        }

        if (!transactionDate) {
            alert('يرجى اختيار تاريخ المعاملة');
            return;
        }

        const transaction = {
            id: Date.now(),
            type: type,
            amount: amount,
            currency: currency,
            description: description,
            date: new Date(transactionDate).toISOString()
        };

        // Add empty comments array
        transaction.comments = [];

        this.transactions.unshift(transaction);
        this.saveTransactions();
        this.applyFiltersAndRender();
        this.updateDashboard();
        this.updateCharts();
        this.populateFilterCurrencies();

        // Reset form
        document.getElementById('transactionForm').reset();

        // Reset date to current time
        this.setDefaultDate();

        // Show success message
        this.showNotification('تمت إضافة المعاملة بنجاح ✓');

        // Log activity
        if (window.driveBackup) {
            window.driveBackup.logActivity('added', 'transaction',
                `Added ${type} transaction: ${description} (${currency} ${amount.toFixed(2)})`);
            // Trigger auto-backup to Google Drive
            window.driveBackup.autoBackup();
        }
    }

    deleteTransaction(id) {
        if (confirm('هل أنت متأكد من حذف هذه المعاملة؟')) {
            const transaction = this.transactions.find(t => t.id === id);
            const desc = transaction ? `${transaction.description} (${transaction.currency} ${transaction.amount})` : 'transaction';

            this.transactions = this.transactions.filter(t => t.id !== id);
            this.saveTransactions();
            this.applyFiltersAndRender();
            this.updateDashboard();
            this.updateCharts();
            this.populateFilterCurrencies();
            this.showNotification('تم حذف المعاملة');

            // Log activity
            if (window.driveBackup) {
                window.driveBackup.logActivity('deleted', 'transaction', `Deleted transaction: ${desc}`);
                // Trigger auto-backup to Google Drive
                window.driveBackup.autoBackup();
            }
        }
    }

    clearAllTransactions() {
        this.transactions = [];
        this.saveTransactions();
        this.applyFiltersAndRender();
        this.updateDashboard();
        this.populateFilterCurrencies();
        this.showNotification('تم حذف جميع المعاملات');

        // Trigger auto-backup to Google Drive (once per day)
        if (window.driveBackup) {
            window.driveBackup.autoBackup();
        }
    }

    applyFiltersAndRender() {
        // Start with all transactions
        let filtered = [...this.transactions];

        // Apply search
        if (this.searchQuery) {
            filtered = filtered.filter(t => {
                return t.description.toLowerCase().includes(this.searchQuery) ||
                       t.amount.toString().includes(this.searchQuery) ||
                       (t.currency && t.currency.toLowerCase().includes(this.searchQuery));
            });
        }

        // Apply type filter
        filtered = filtered.filter(t => {
            if (t.type === 'export') return this.filters.types.export;
            if (t.type === 'import') return this.filters.types.import;
            return true;
        });

        // Apply currency filter
        if (this.filters.currency) {
            filtered = filtered.filter(t => t.currency === this.filters.currency);
        }

        // Apply amount filter
        if (this.filters.amountMin) {
            filtered = filtered.filter(t => t.amount >= parseFloat(this.filters.amountMin));
        }
        if (this.filters.amountMax) {
            filtered = filtered.filter(t => t.amount <= parseFloat(this.filters.amountMax));
        }

        // Apply date filter
        if (this.filters.dateFrom) {
            const fromDate = new Date(this.filters.dateFrom);
            filtered = filtered.filter(t => new Date(t.date) >= fromDate);
        }
        if (this.filters.dateTo) {
            const toDate = new Date(this.filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(t => new Date(t.date) <= toDate);
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (this.sortBy) {
                case 'date-desc':
                    return new Date(b.date) - new Date(a.date);
                case 'date-asc':
                    return new Date(a.date) - new Date(b.date);
                case 'amount-desc':
                    return b.amount - a.amount;
                case 'amount-asc':
                    return a.amount - b.amount;
                default:
                    return 0;
            }
        });

        this.filteredTransactions = filtered;
        this.renderTransactions();
        this.updatePagination();
    }

    renderTransactions() {
        const container = document.getElementById('transactionsList');
        const emptyState = document.getElementById('emptyState');

        // Use filtered transactions if available, otherwise use all
        const transactionsToShow = this.filteredTransactions.length > 0 || this.searchQuery ||
                                    this.filters.currency || this.filters.amountMin || this.filters.amountMax ||
                                    this.filters.dateFrom || this.filters.dateTo ||
                                    !this.filters.types.export || !this.filters.types.import
            ? this.filteredTransactions
            : this.transactions;

        if (transactionsToShow.length === 0 && this.transactions.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        if (transactionsToShow.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #808080; padding: 20px;">لا توجد معاملات تطابق الفلاتر المحددة</p>';
            container.style.display = 'block';
            emptyState.style.display = 'none';
            this.updatePagination();
            return;
        }

        container.style.display = 'block';
        emptyState.style.display = 'none';

        // Pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedTransactions = transactionsToShow.slice(startIndex, endIndex);

        // Check user role
        const role = localStorage.getItem('workspace_role');
        const canDelete = (role !== 'reader');

        container.innerHTML = paginatedTransactions.map(transaction => {
            const date = new Date(transaction.date);
            const formattedDate = date.toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const currency = transaction.currency || 'USD';
            const deleteButton = canDelete
                ? `<button class="btn-delete" onclick="tracker.deleteTransaction(${transaction.id})">🗑️</button>`
                : '';

            const commentsSection = this.renderComments(transaction);

            return `
                <div class="transaction-item ${transaction.type}">
                    <div class="transaction-info">
                        <div class="transaction-type">
                            ${transaction.type === 'export' ? '📤 واردات' : '📥 صادرات'}
                        </div>
                        <div class="transaction-description">${transaction.description}</div>
                        <div class="transaction-date">${formattedDate}</div>
                        ${commentsSection}
                    </div>
                    <div class="transaction-amount">${currency} ${transaction.amount.toFixed(2)}</div>
                    ${deleteButton}
                </div>
            `;
        }).join('');
    }

    updateDashboard() {
        const now = new Date();

        // Daily
        const dailyData = this.calculateProfit('day', now);
        this.updateProfitCard('daily', dailyData);

        // Weekly
        const weeklyData = this.calculateProfit('week', now);
        this.updateProfitCard('weekly', weeklyData);

        // Monthly
        const monthlyData = this.calculateProfit('month', now);
        this.updateProfitCard('monthly', monthlyData);
    }

    calculateProfit(period, now) {
        let startDate;

        if (period === 'day') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (period === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            startDate = new Date(now.setDate(diff));
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const filtered = this.transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate >= startDate;
        });

        // Group by currency
        const byCurrency = {};

        filtered.forEach(t => {
            const currency = t.currency || 'USD';
            if (!byCurrency[currency]) {
                byCurrency[currency] = { exports: 0, imports: 0, profit: 0 };
            }

            if (t.type === 'export') {
                byCurrency[currency].exports += t.amount;
            } else {
                byCurrency[currency].imports += t.amount;
            }
        });

        // Calculate profit for each currency
        Object.keys(byCurrency).forEach(currency => {
            byCurrency[currency].profit = byCurrency[currency].exports - byCurrency[currency].imports;
        });

        return byCurrency;
    }

    updateProfitCard(period, byCurrency) {
        const profitElement = document.getElementById(`${period}Profit`);
        const exportsElement = document.getElementById(`${period}Exports`);
        const importsElement = document.getElementById(`${period}Imports`);
        const detailsBtn = document.getElementById(`${period}DetailsBtn`);
        const profitLine = document.getElementById(`${period}ProfitLine`);

        const currencies = Object.keys(byCurrency);

        // Store data for modal
        if (!this.profitData) this.profitData = {};
        this.profitData[period] = byCurrency;

        if (currencies.length === 0) {
            // No transactions
            profitElement.innerHTML = '0.00';
            exportsElement.innerHTML = '0.00';
            importsElement.innerHTML = '0.00';
            profitElement.classList.remove('profit', 'loss');
            if (detailsBtn) detailsBtn.style.display = 'none';
            return;
        }

        // Build HTML for each currency
        const profitHTML = currencies.map(currency => {
            const data = byCurrency[currency];
            const profitClass = data.profit >= 0 ? 'profit' : 'loss';
            return `<span class="${profitClass}">${data.profit.toFixed(2)} ${currency}</span>`;
        }).join('<br>');

        const exportsHTML = currencies.map(currency => {
            return `${byCurrency[currency].exports.toFixed(2)} ${currency}`;
        }).join(' • ');

        const importsHTML = currencies.map(currency => {
            return `${byCurrency[currency].imports.toFixed(2)} ${currency}`;
        }).join(' • ');

        profitElement.innerHTML = profitHTML;
        exportsElement.innerHTML = exportsHTML;
        importsElement.innerHTML = importsHTML;

        // Update color based on overall profit/loss (check if any currency has profit)
        const hasProfit = currencies.some(c => byCurrency[c].profit > 0);
        const hasLoss = currencies.some(c => byCurrency[c].profit < 0);

        profitElement.classList.remove('profit', 'loss');
        if (hasProfit && !hasLoss) {
            profitElement.classList.add('profit');
        } else if (hasLoss && !hasProfit) {
            profitElement.classList.add('loss');
        }

        // Check for overflow and show/hide details button
        setTimeout(() => this.checkProfitOverflow(period), 100);
    }

    checkProfitOverflow(period) {
        const profitElement = document.getElementById(`${period}Profit`);
        const profitLine = document.getElementById(`${period}ProfitLine`);
        const detailsBtn = document.getElementById(`${period}DetailsBtn`);

        if (!profitElement || !profitLine || !detailsBtn) return;

        // Check if content is overflowing or wrapping to multiple lines
        const isOverflowing = profitElement.scrollHeight > profitElement.clientHeight + 5 ||
                             profitElement.scrollWidth > profitElement.clientWidth + 5;

        if (isOverflowing) {
            detailsBtn.style.display = 'flex';
        } else {
            detailsBtn.style.display = 'none';
        }
    }

    showProfitDetails(period) {
        const modal = document.getElementById('profitDetailsModal');
        const title = document.getElementById('profitDetailsTitle');
        const exportsEl = document.getElementById('detailExports');
        const importsEl = document.getElementById('detailImports');
        const profitEl = document.getElementById('detailProfit');

        if (!modal || !this.profitData || !this.profitData[period]) return;

        const periodNames = {
            'daily': 'اليومي',
            'weekly': 'الأسبوعي',
            'monthly': 'الشهري'
        };

        title.textContent = `تفاصيل الربح ${periodNames[period] || ''}`;

        const byCurrency = this.profitData[period];
        const currencies = Object.keys(byCurrency);

        // Build detailed strings
        const exportsHTML = currencies.map(currency => {
            return `${byCurrency[currency].exports.toFixed(2)} ${currency}`;
        }).join('<br>');

        const importsHTML = currencies.map(currency => {
            return `${byCurrency[currency].imports.toFixed(2)} ${currency}`;
        }).join('<br>');

        const profitHTML = currencies.map(currency => {
            const data = byCurrency[currency];
            const profitClass = data.profit >= 0 ? 'profit' : 'loss';
            return `<span class="${profitClass}">${data.profit.toFixed(2)} ${currency}</span>`;
        }).join('<br>');

        exportsEl.innerHTML = exportsHTML;
        importsEl.innerHTML = importsHTML;
        profitEl.innerHTML = profitHTML;

        modal.classList.add('active');
    }

    saveTransactions() {
        localStorage.setItem('transactions', JSON.stringify(this.transactions));
    }

    loadTransactions() {
        const stored = localStorage.getItem('transactions');
        return stored ? JSON.parse(stored) : [];
    }

    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4CAF50;
            color: white;
            padding: 15px 30px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideDown 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    initCharts() {
        // Wait for Chart.js to load
        if (typeof Chart === 'undefined') {
            setTimeout(() => this.initCharts(), 100);
            return;
        }

        this.createProfitChart();
        this.createComparisonChart();
    }

    createProfitChart() {
        const ctx = document.getElementById('profitChart');
        if (!ctx) return;

        // Get last 6 months data
        const monthsData = this.getMonthlyData(6);

        // Destroy existing chart if any
        if (this.profitChart) {
            this.profitChart.destroy();
        }

        this.profitChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthsData.labels,
                datasets: [{
                    label: 'الربح',
                    data: monthsData.profits,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e0e0e0',
                            font: { size: 12 }
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: { color: '#b0b0b0' },
                        grid: { color: '#2a2a3e' }
                    },
                    x: {
                        ticks: { color: '#b0b0b0' },
                        grid: { color: '#2a2a3e' }
                    }
                }
            }
        });
    }

    createComparisonChart() {
        const ctx = document.getElementById('comparisonChart');
        if (!ctx) return;

        // Get last 6 months data
        const monthsData = this.getMonthlyData(6);

        // Destroy existing chart if any
        if (this.comparisonChart) {
            this.comparisonChart.destroy();
        }

        this.comparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthsData.labels,
                datasets: [
                    {
                        label: 'واردات',
                        data: monthsData.exports,
                        backgroundColor: 'rgba(33, 150, 243, 0.7)',
                        borderColor: '#2196F3',
                        borderWidth: 1
                    },
                    {
                        label: 'صادرات',
                        data: monthsData.imports,
                        backgroundColor: 'rgba(255, 152, 0, 0.7)',
                        borderColor: '#FF9800',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e0e0e0',
                            font: { size: 12 }
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: { color: '#b0b0b0' },
                        grid: { color: '#2a2a3e' }
                    },
                    x: {
                        ticks: { color: '#b0b0b0' },
                        grid: { color: '#2a2a3e' }
                    }
                }
            }
        });
    }

    getMonthlyData(monthsCount) {
        const now = new Date();
        const labels = [];
        const profits = [];
        const exports = [];
        const imports = [];

        // Get data for last N months
        for (let i = monthsCount - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = date.toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' });
            labels.push(monthName);

            // Calculate data for this month
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

            const monthTransactions = this.transactions.filter(t => {
                const transactionDate = new Date(t.date);
                return transactionDate >= monthStart && transactionDate <= monthEnd;
            });

            const monthExports = monthTransactions
                .filter(t => t.type === 'export')
                .reduce((sum, t) => sum + t.amount, 0);

            const monthImports = monthTransactions
                .filter(t => t.type === 'import')
                .reduce((sum, t) => sum + t.amount, 0);

            const monthProfit = monthExports - monthImports;

            exports.push(monthExports);
            imports.push(monthImports);
            profits.push(monthProfit);
        }

        return { labels, profits, exports, imports };
    }

    updateCharts() {
        if (typeof Chart !== 'undefined') {
            this.createProfitChart();
            this.createComparisonChart();
        }
    }

    updatePagination() {
        const pagination = document.getElementById('pagination');
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (!pagination) return;

        const transactionsToShow = this.filteredTransactions.length > 0 || this.searchQuery ||
                                    this.filters.currency || this.filters.amountMin || this.filters.amountMax ||
                                    this.filters.dateFrom || this.filters.dateTo ||
                                    !this.filters.types.export || !this.filters.types.import
            ? this.filteredTransactions
            : this.transactions;

        const totalPages = Math.ceil(transactionsToShow.length / this.itemsPerPage);

        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }

        pagination.style.display = 'flex';
        pageInfo.textContent = `صفحة ${this.currentPage} من ${totalPages}`;

        // Disable/enable buttons
        prevBtn.disabled = this.currentPage === 1;
        nextBtn.disabled = this.currentPage === totalPages;
    }

    populateFilterCurrencies() {
        const filterCurrency = document.getElementById('filterCurrency');
        if (!filterCurrency) return;

        // Get unique currencies from transactions
        const currencies = [...new Set(this.transactions.map(t => t.currency).filter(c => c))];

        // Get workspace currencies if available
        const workspaceCurrencies = window.driveBackup?.workspaceCurrencies || [];
        const workspaceCurrencyCodes = workspaceCurrencies.map(c => c.code);

        // Combine and deduplicate
        const allCurrencies = [...new Set([...workspaceCurrencyCodes, ...currencies])];

        // Keep the default "الكل" option and add currencies
        const currentValue = filterCurrency.value;
        filterCurrency.innerHTML = '<option value="">الكل</option>' +
            allCurrencies.map(currency => `<option value="${currency}">${currency}</option>`).join('');
        filterCurrency.value = currentValue;
    }

    // Session Timeout Management
    initSessionTimeout() {
        // Only apply timeout if user is logged in
        if (!localStorage.getItem('google_access_token')) {
            return;
        }

        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.lastActivityTime = Date.now();

        // Track user activity
        const resetTimer = () => {
            this.lastActivityTime = Date.now();
        };

        ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, resetTimer, true);
        });

        // Check session every minute
        this.sessionCheckInterval = setInterval(() => {
            this.checkSessionTimeout();
        }, 60000); // Check every 60 seconds

        console.log('✓ Session timeout initialized (30 minutes)');
    }

    checkSessionTimeout() {
        if (!localStorage.getItem('google_access_token')) {
            if (this.sessionCheckInterval) {
                clearInterval(this.sessionCheckInterval);
            }
            return;
        }

        const now = Date.now();
        const timeElapsed = now - this.lastActivityTime;

        // Show warning at 25 minutes (5 minutes before timeout)
        if (timeElapsed > 25 * 60 * 1000 && timeElapsed < 26 * 60 * 1000) {
            this.showNotification('⚠️ ستنتهي الجلسة خلال 5 دقائق بسبب عدم النشاط');
        }

        // Logout at 30 minutes
        if (timeElapsed > this.sessionTimeout) {
            console.log('⏰ Session timeout - logging out');
            this.showNotification('⏰ انتهت الجلسة بسبب عدم النشاط');

            setTimeout(() => {
                if (window.driveBackup) {
                    window.driveBackup.signOut();
                }
            }, 2000);
        }
    }

    // Phase 2: Multi-Currency Features

    async fetchExchangeRates() {
        try {
            console.log('🔄 Fetching exchange rates...');

            // Using exchangerate-api.com free tier (1500 requests/month)
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');

            if (!response.ok) {
                throw new Error('Failed to fetch exchange rates');
            }

            const data = await response.json();
            this.exchangeRates = data.rates;

            console.log('✓ Exchange rates loaded:', Object.keys(this.exchangeRates).length, 'currencies');

            // Cache rates for 24 hours
            localStorage.setItem('exchange_rates', JSON.stringify(this.exchangeRates));
            localStorage.setItem('exchange_rates_timestamp', Date.now().toString());
        } catch (error) {
            console.error('❌ Failed to fetch exchange rates:', error);

            // Load from cache if available
            const cached = localStorage.getItem('exchange_rates');
            if (cached) {
                this.exchangeRates = JSON.parse(cached);
                console.log('ℹ️ Using cached exchange rates');
            } else {
                // Fallback to basic rates
                this.exchangeRates = { USD: 1, EUR: 0.85, GBP: 0.73, SAR: 3.75 };
                console.log('⚠️ Using fallback exchange rates');
            }
        }
    }

    convertCurrency(amount, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) {
            return amount;
        }

        // Convert from source to USD, then USD to target
        const amountInUSD = amount / (this.exchangeRates[fromCurrency] || 1);
        const converted = amountInUSD * (this.exchangeRates[toCurrency] || 1);

        return converted;
    }

    generateProfitByCurrencyReport() {
        const container = document.getElementById('profitByCurrencyReport');
        if (!container) return;

        // Group transactions by currency
        const currencyData = {};

        this.transactions.forEach(transaction => {
            const currency = transaction.currency || 'USD';

            if (!currencyData[currency]) {
                currencyData[currency] = {
                    exports: 0,
                    imports: 0,
                    profit: 0,
                    count: 0
                };
            }

            if (transaction.type === 'export') {
                currencyData[currency].exports += transaction.amount;
            } else {
                currencyData[currency].imports += transaction.amount;
            }

            currencyData[currency].count++;
        });

        // Calculate profit for each currency
        Object.keys(currencyData).forEach(currency => {
            const data = currencyData[currency];
            data.profit = data.exports - data.imports;
        });

        // Check if empty
        if (Object.keys(currencyData).length === 0) {
            container.innerHTML = `
                <div class="report-empty-state">
                    <div class="report-empty-state-icon">📊</div>
                    <p>لا توجد معاملات لعرض التقرير</p>
                </div>
            `;
            return;
        }

        // Generate HTML
        const html = Object.keys(currencyData)
            .sort((a, b) => Math.abs(currencyData[b].profit) - Math.abs(currencyData[a].profit))
            .map(currency => {
                const data = currencyData[currency];
                const profitClass = data.profit > 0 ? 'profit' : data.profit < 0 ? 'loss' : 'neutral';
                const profitSign = data.profit > 0 ? '+' : '';

                // Get currency name from workspace currencies
                const workspaceCurrencies = window.driveBackup?.workspaceCurrencies || [];
                const currencyInfo = workspaceCurrencies.find(c => c.code === currency);
                const currencyName = currencyInfo ? currencyInfo.name : currency;

                return `
                    <div class="currency-profit-card">
                        <div class="currency-icon">${currency}</div>
                        <div class="currency-profit-details">
                            <div class="currency-profit-name">${currencyName}</div>
                            <div class="currency-profit-breakdown">
                                <span>📤 ${data.exports.toFixed(2)}</span>
                                <span>📥 ${data.imports.toFixed(2)}</span>
                                <span>📊 ${data.count} معاملة</span>
                            </div>
                        </div>
                        <div class="currency-profit-amount ${profitClass}">
                            ${profitSign}${data.profit.toFixed(2)}
                        </div>
                    </div>
                `;
            }).join('');

        container.innerHTML = html;
    }

    populateConverterCurrencies() {
        const fromSelect = document.getElementById('convertFromCurrency');
        const toSelect = document.getElementById('convertToCurrency');

        if (!fromSelect || !toSelect) return;

        // Get unique currencies from transactions
        const currencies = [...new Set(this.transactions.map(t => t.currency).filter(c => c))];

        // Get workspace currencies
        const workspaceCurrencies = window.driveBackup?.workspaceCurrencies || [];
        const workspaceCurrencyCodes = workspaceCurrencies.map(c => c.code);

        // Combine and add common currencies from exchange rates
        const commonCurrencies = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP', 'JPY', 'CNY'];
        const allCurrencies = [...new Set([...workspaceCurrencyCodes, ...currencies, ...commonCurrencies])];

        const currentFrom = fromSelect.value;
        const currentTo = toSelect.value;

        const optionsHTML = '<option value="">اختر العملة</option>' +
            allCurrencies.map(currency => `<option value="${currency}">${currency}</option>`).join('');

        fromSelect.innerHTML = optionsHTML;
        toSelect.innerHTML = optionsHTML;

        // Restore selections
        if (currentFrom) fromSelect.value = currentFrom;
        if (currentTo) toSelect.value = currentTo;
    }

    performCurrencyConversion() {
        const amount = parseFloat(document.getElementById('convertAmount').value);
        const fromCurrency = document.getElementById('convertFromCurrency').value;
        const toCurrency = document.getElementById('convertToCurrency').value;
        const resultEl = document.getElementById('conversionResult');

        if (!amount || !fromCurrency || !toCurrency) {
            resultEl.textContent = 'أدخل المبلغ والعملات للتحويل';
            return;
        }

        if (fromCurrency === toCurrency) {
            resultEl.textContent = `${amount.toFixed(2)} ${toCurrency}`;
            return;
        }

        const converted = this.convertCurrency(amount, fromCurrency, toCurrency);
        resultEl.textContent = `${amount.toFixed(2)} ${fromCurrency} = ${converted.toFixed(2)} ${toCurrency}`;
    }

    populateBaseCurrencySelect() {
        const select = document.getElementById('baseCurrencySelect');
        if (!select) return;

        // Get unique currencies
        const currencies = [...new Set(this.transactions.map(t => t.currency).filter(c => c))];
        const workspaceCurrencies = window.driveBackup?.workspaceCurrencies || [];
        const workspaceCurrencyCodes = workspaceCurrencies.map(c => c.code);
        const allCurrencies = [...new Set([...workspaceCurrencyCodes, ...currencies, 'USD', 'EUR'])];

        const currentValue = select.value || this.baseCurrency;

        select.innerHTML = '<option value="">اختر العملة الأساسية</option>' +
            allCurrencies.map(currency => `<option value="${currency}">${currency}</option>`).join('');

        select.value = currentValue;

        // Auto-generate summary if currency is selected
        if (currentValue) {
            this.generateMultiCurrencySummary();
        }
    }

    generateMultiCurrencySummary() {
        const container = document.getElementById('multiCurrencySummary');
        if (!container || !this.baseCurrency) return;

        // Group by currency and convert to base currency
        const currencyData = {};
        let totalExports = 0;
        let totalImports = 0;

        this.transactions.forEach(transaction => {
            const currency = transaction.currency || 'USD';

            if (!currencyData[currency]) {
                currencyData[currency] = {
                    exports: 0,
                    imports: 0,
                    exportsInBase: 0,
                    importsInBase: 0
                };
            }

            const amount = transaction.amount;
            const amountInBase = this.convertCurrency(amount, currency, this.baseCurrency);

            if (transaction.type === 'export') {
                currencyData[currency].exports += amount;
                currencyData[currency].exportsInBase += amountInBase;
                totalExports += amountInBase;
            } else {
                currencyData[currency].imports += amount;
                currencyData[currency].importsInBase += amountInBase;
                totalImports += amountInBase;
            }
        });

        const totalProfit = totalExports - totalImports;
        const profitClass = totalProfit >= 0 ? 'profit' : 'loss';
        const profitSign = totalProfit > 0 ? '+' : '';

        if (Object.keys(currencyData).length === 0) {
            container.innerHTML = `
                <div class="report-empty-state">
                    <div class="report-empty-state-icon">💱</div>
                    <p>لا توجد معاملات لعرض الملخص</p>
                </div>
            `;
            return;
        }

        const currenciesHTML = Object.keys(currencyData).map(currency => {
            const data = currencyData[currency];
            const profit = data.exportsInBase - data.importsInBase;
            const profitClass = profit >= 0 ? 'profit' : 'loss';

            return `
                <div class="summary-card">
                    <div class="summary-card-label">${currency} → ${this.baseCurrency}</div>
                    <div class="summary-card-value ${profitClass}">
                        ${profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="summary-grid">
                ${currenciesHTML}
            </div>
            <div class="summary-total">
                <div class="summary-total-label">إجمالي الربح (${this.baseCurrency})</div>
                <div class="summary-total-value ${profitClass}">
                    ${profitSign}${totalProfit.toFixed(2)} ${this.baseCurrency}
                </div>
                <div class="summary-total-note">
                    واردات: ${totalExports.toFixed(2)} | صادرات: ${totalImports.toFixed(2)}
                </div>
            </div>
        `;
    }

    // Phase 3: Transaction Comments

    addComment(transactionId, commentText) {
        if (!commentText || !commentText.trim()) return;

        const transaction = this.transactions.find(t => t.id === transactionId);
        if (!transaction) return;

        // Initialize comments array if not exists
        if (!transaction.comments) {
            transaction.comments = [];
        }

        const userEmail = window.driveBackup?.currentUserEmail || localStorage.getItem('gdrive_email') || 'Anonymous';

        const comment = {
            id: Date.now(),
            author: userEmail,
            text: commentText.trim(),
            timestamp: new Date().toISOString()
        };

        transaction.comments.push(comment);
        this.saveTransactions();
        this.renderTransactions();

        // Log activity
        if (window.driveBackup) {
            window.driveBackup.logActivity('added', 'comment', `Commented on transaction: ${transaction.description}`);
            window.driveBackup.autoBackup();
        }

        this.showNotification('✓ تم إضافة التعليق');
    }

    toggleComments(transactionId) {
        const commentsDiv = document.getElementById(`comments-${transactionId}`);
        if (commentsDiv) {
            commentsDiv.style.display = commentsDiv.style.display === 'none' ? 'block' : 'none';
        }
    }

    renderComments(transaction) {
        if (!transaction.comments || transaction.comments.length === 0) {
            return '';
        }

        const commentsHTML = transaction.comments.map(comment => {
            const time = new Date(comment.timestamp);
            const relativeTime = window.driveBackup?.getRelativeTime(time) || time.toLocaleDateString('ar-EG');

            return `
                <div class="comment-item">
                    <div class="comment-author">${comment.author}</div>
                    <div class="comment-text">${comment.text}</div>
                    <div class="comment-time">${relativeTime}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="transaction-comments">
                <button class="comments-toggle" onclick="tracker.toggleComments(${transaction.id})">
                    💬 ${transaction.comments.length} تعليق
                </button>
                <div id="comments-${transaction.id}" class="comments-list" style="display: none;">
                    ${commentsHTML}
                    <div class="add-comment-form">
                        <input type="text" id="comment-input-${transaction.id}" placeholder="أضف تعليق..." class="comment-input">
                        <button onclick="tracker.addCommentFromInput(${transaction.id})" class="btn-add-comment">إضافة</button>
                    </div>
                </div>
            </div>
        `;
    }

    addCommentFromInput(transactionId) {
        const input = document.getElementById(`comment-input-${transactionId}`);
        if (input && input.value) {
            this.addComment(transactionId, input.value);
            input.value = '';
        }
    }

}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }

    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize app
const tracker = new TradeTracker();
