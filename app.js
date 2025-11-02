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
    }

    setupEventListeners() {
        const form = document.getElementById('transactionForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTransaction();
        });

        const clearBtn = document.getElementById('clearAllBtn');
        clearBtn.addEventListener('click', () => {
            if (confirm('هل أنت متأكد من حذف جميع المعاملات؟')) {
                this.clearAllTransactions();
            }
        });

        // Local export/import
        const exportBtn = document.getElementById('exportBtn');
        const importBtn = document.getElementById('importBtn');
        const importFile = document.getElementById('importFile');

        exportBtn?.addEventListener('click', () => this.exportData());
        importBtn?.addEventListener('click', () => importFile.click());
        importFile?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importData(e.target.files[0]);
                e.target.value = ''; // Reset input
            }
        });
    }

    addTransaction() {
        const type = document.querySelector('input[name="type"]:checked').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const description = document.getElementById('description').value;

        if (!amount || amount <= 0) {
            alert('يرجى إدخال مبلغ صحيح');
            return;
        }

        if (!description.trim()) {
            alert('يرجى إدخال وصف للمعاملة');
            return;
        }

        const transaction = {
            id: Date.now(),
            type: type,
            amount: amount,
            description: description,
            date: new Date().toISOString()
        };

        this.transactions.unshift(transaction);
        this.saveTransactions();
        this.renderTransactions();
        this.updateDashboard();

        // Reset form
        document.getElementById('transactionForm').reset();

        // Show success message
        this.showNotification('تمت إضافة المعاملة بنجاح ✓');
    }

    deleteTransaction(id) {
        if (confirm('هل أنت متأكد من حذف هذه المعاملة؟')) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            this.saveTransactions();
            this.renderTransactions();
            this.updateDashboard();
            this.showNotification('تم حذف المعاملة');
        }
    }

    clearAllTransactions() {
        this.transactions = [];
        this.saveTransactions();
        this.renderTransactions();
        this.updateDashboard();
        this.showNotification('تم حذف جميع المعاملات');
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

        container.innerHTML = this.transactions.map(transaction => {
            const date = new Date(transaction.date);
            const formattedDate = date.toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="transaction-item ${transaction.type}">
                    <div class="transaction-info">
                        <div class="transaction-type">
                            ${transaction.type === 'export' ? '📤 واردات' : '📥 صادرات'}
                        </div>
                        <div class="transaction-description">${transaction.description}</div>
                        <div class="transaction-date">${formattedDate}</div>
                    </div>
                    <div class="transaction-amount">${transaction.amount.toFixed(2)}</div>
                    <button class="btn-delete" onclick="tracker.deleteTransaction(${transaction.id})">🗑️</button>
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

    // Export data to JSON file
    exportData() {
        const exportData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            data: {
                transactions: this.transactions
            }
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trade-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('✓ تم تصدير البيانات');
    }

    // Import data from JSON file
    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);

                if (importedData.data && importedData.data.transactions) {
                    if (!confirm(`هل تريد استيراد ${importedData.data.transactions.length} معاملة؟ سيتم استبدال البيانات الحالية.`)) {
                        return;
                    }

                    this.transactions = importedData.data.transactions;
                    this.saveTransactions();
                    this.renderTransactions();
                    this.updateDashboard();

                    const date = new Date(importedData.timestamp).toLocaleDateString('ar-EG');
                    this.showNotification(`✓ تم استيراد البيانات (${date})`);
                } else {
                    throw new Error('Invalid format');
                }
            } catch (error) {
                alert('خطأ: الملف غير صحيح');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
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
