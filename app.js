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
        this.init();
        this.initSessionTimeout();
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
    }

    addTransaction() {
        const type = document.querySelector('input[name="type"]:checked').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const currency = document.getElementById('currency').value;
        const description = document.getElementById('description').value;
        const transactionDate = document.getElementById('transactionDate').value;

        if (!amount || amount <= 0) {
            alert('يرجى إدخال مبلغ صحيح');
            return;
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

        // Trigger auto-backup to Google Drive (once per day)
        if (window.driveBackup) {
            window.driveBackup.autoBackup();
        }
    }

    deleteTransaction(id) {
        if (confirm('هل أنت متأكد من حذف هذه المعاملة؟')) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            this.saveTransactions();
            this.applyFiltersAndRender();
            this.updateDashboard();
            this.updateCharts();
            this.populateFilterCurrencies();
            this.showNotification('تم حذف المعاملة');

            // Trigger auto-backup to Google Drive (once per day)
            if (window.driveBackup) {
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

            return `
                <div class="transaction-item ${transaction.type}">
                    <div class="transaction-info">
                        <div class="transaction-type">
                            ${transaction.type === 'export' ? '📤 واردات' : '📥 صادرات'}
                        </div>
                        <div class="transaction-description">${transaction.description}</div>
                        <div class="transaction-date">${formattedDate}</div>
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

        const exports = filtered
            .filter(t => t.type === 'export')
            .reduce((sum, t) => sum + t.amount, 0);

        const imports = filtered
            .filter(t => t.type === 'import')
            .reduce((sum, t) => sum + t.amount, 0);

        const profit = exports - imports;

        return { exports, imports, profit };
    }

    updateProfitCard(period, data) {
        const profitElement = document.getElementById(`${period}Profit`);
        const exportsElement = document.getElementById(`${period}Exports`);
        const importsElement = document.getElementById(`${period}Imports`);

        profitElement.textContent = data.profit.toFixed(2);
        exportsElement.textContent = data.exports.toFixed(2);
        importsElement.textContent = data.imports.toFixed(2);

        // Update color based on profit/loss
        profitElement.classList.remove('profit', 'loss');
        if (data.profit >= 0) {
            profitElement.classList.add('profit');
        } else {
            profitElement.classList.add('loss');
        }
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
