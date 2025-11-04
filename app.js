// Transaction Manager
class TradeTracker {
    constructor() {
        this.transactions = this.loadTransactions();
        this.init();
    }

    init() {
        this.renderTransactions();
        this.updateDashboard();
        this.setupEventListeners();
        this.setDefaultDate();
        this.initCharts();

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
        this.renderTransactions();
        this.updateDashboard();
        this.updateCharts();

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
            this.renderTransactions();
            this.updateDashboard();
            this.updateCharts();
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
        this.renderTransactions();
        this.updateDashboard();
        this.showNotification('تم حذف جميع المعاملات');

        // Trigger auto-backup to Google Drive (once per day)
        if (window.driveBackup) {
            window.driveBackup.autoBackup();
        }
    }

    renderTransactions() {
        const container = document.getElementById('transactionsList');
        const emptyState = document.getElementById('emptyState');

        if (this.transactions.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'block';
        emptyState.style.display = 'none';

        // Check user role
        const role = localStorage.getItem('workspace_role');
        const canDelete = (role !== 'reader');

        container.innerHTML = this.transactions.map(transaction => {
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
