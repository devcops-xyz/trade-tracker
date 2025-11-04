// Google Drive Integration for Backup/Restore
class GoogleDriveBackup {
    constructor() {
        // Get Client ID from config
        this.CLIENT_ID = window.APP_CONFIG?.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
        this.workspaceId = null;
        this.BACKUP_FILENAME = 'trade-tracker-backup.json'; // Will be updated with workspace ID
        this.accessToken = null;
        this.fileId = null;
        this.workspaceCurrencies = [];
        this.defaultCurrency = 'USD';

        // Check if configured
        if (this.CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
            console.warn('Google Drive not configured. Please update config.js with your Client ID.');
            this.hideBackupControls();
            return;
        }

        this.init();
    }

    hideBackupControls() {
        const backupControls = document.querySelector('.backup-controls');
        if (backupControls) {
            backupControls.style.display = 'none';
        }
    }

    init() {
        // Setup event listeners immediately (page is already loaded when this runs)
        this.setupEventListeners();

        // Check sign-in status and show/hide gate
        this.checkSignInStatus();
    }

    checkSignInStatus() {
        const savedToken = localStorage.getItem('gdrive_token');
        const savedEmail = localStorage.getItem('gdrive_email');
        const savedWorkspace = localStorage.getItem('workspace_id');

        if (savedToken && savedEmail) {
            // User is signed in
            this.accessToken = savedToken;

            if (savedWorkspace) {
                // User has workspace, show app
                this.workspaceId = savedWorkspace;
                this.updateBackupFilename();
                this.showApp();
                this.displayWorkspaceCode();
                this.updateBackupControlsVisibility(); // Update visibility based on role
                this.updateUIBasedOnRole(); // Update UI based on role
            } else {
                // User signed in but no workspace, show workspace selection
                this.showWorkspaceGate();
            }
        } else {
            // User not signed in, show sign-in gate
            this.showSignInGate();
        }
    }

    showSignInGate() {
        document.getElementById('signInGate').classList.add('active');
        document.getElementById('workspaceGate').classList.remove('active');
        document.getElementById('appContent').style.display = 'none';
    }

    showWorkspaceGate() {
        document.getElementById('signInGate').classList.remove('active');
        document.getElementById('workspaceGate').classList.add('active');
        document.getElementById('appContent').style.display = 'none';
    }

    showApp() {
        document.getElementById('signInGate').classList.remove('active');
        document.getElementById('workspaceGate').classList.remove('active');
        document.getElementById('appContent').style.display = 'block';
    }

    generateWorkspaceId() {
        // Generate a 6-character alphanumeric code
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar looking characters
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    async createWorkspace() {
        const workspaceId = this.generateWorkspaceId();
        this.workspaceId = workspaceId;
        localStorage.setItem('workspace_id', workspaceId);
        localStorage.setItem('workspace_role', 'creator'); // Mark as creator
        this.updateBackupFilename();
        this.showApp();
        this.displayWorkspaceCode();
        this.updateBackupControlsVisibility();

        // Try to load existing data from Drive (in case workspace code was reused)
        await this.loadWorkspaceData();

        // Show notification
        if (window.tracker) {
            window.tracker.showNotification('✓ تم إنشاء مساحة العمل بنجاح!');
        }
    }

    async joinWorkspace(code, role = 'reader') {
        if (!code || code.length !== 6) {
            alert('رمز مساحة العمل غير صحيح');
            return;
        }

        const workspaceId = code.toUpperCase();
        this.workspaceId = workspaceId;
        localStorage.setItem('workspace_id', workspaceId);
        localStorage.setItem('workspace_role', role); // Always 'reader' by default
        this.updateBackupFilename();

        console.log('=== JOINING WORKSPACE ===');
        console.log('Workspace ID:', workspaceId);
        console.log('Role:', role);
        console.log('Backup filename:', this.BACKUP_FILENAME);

        // Show app first
        this.showApp();
        this.displayWorkspaceCode();
        this.updateBackupControlsVisibility();
        this.updateUIBasedOnRole();

        // Load shared data from Drive
        console.log('Starting to load workspace data...');
        await this.loadWorkspaceData();

        // Show notification
        if (window.tracker) {
            window.tracker.showNotification('✓ تم الانضمام لمساحة العمل - انتظر تحميل البيانات...');
        }
    }

    async loadWorkspaceData() {
        if (!this.accessToken) {
            console.error('❌ Load workspace data failed: No access token');
            if (window.tracker) {
                window.tracker.showNotification('❌ خطأ: لم يتم تسجيل الدخول');
            }
            return;
        }

        try {
            console.log('🔍 Looking for backup file:', this.BACKUP_FILENAME);
            console.log('🔑 Access token exists:', !!this.accessToken);

            // Find the backup file for this workspace
            await this.findBackupFile();

            if (this.fileId) {
                console.log('✓ Found backup file with ID:', this.fileId);

                // Download the file
                console.log('📥 Downloading file...');
                const response = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`,
                    {
                        headers: {
                            Authorization: `Bearer ${this.accessToken}`
                        }
                    }
                );

                console.log('📡 Download response status:', response.status);

                if (response.ok) {
                    const backupData = await response.json();
                    console.log('📦 Backup data retrieved:', backupData);

                    // Restore data
                    if (backupData.data && backupData.data.transactions) {
                        console.log('✓ Found', backupData.data.transactions.length, 'transactions');
                        localStorage.setItem('transactions', JSON.stringify(backupData.data.transactions));

                        // Also save currencies if they exist
                        if (backupData.data.currencies) {
                            localStorage.setItem('workspace_currencies', JSON.stringify(backupData.data.currencies));
                            this.workspaceCurrencies = backupData.data.currencies;
                        }

                        // Save default currency if it exists
                        if (backupData.data.defaultCurrency) {
                            localStorage.setItem('default_currency', backupData.data.defaultCurrency);
                            this.defaultCurrency = backupData.data.defaultCurrency;
                        }

                        // Reload the app
                        if (window.tracker) {
                            window.tracker.transactions = backupData.data.transactions;
                            window.tracker.renderTransactions();
                            window.tracker.updateDashboard();
                            window.tracker.updateCharts();
                        }

                        // Reload currencies dropdown
                        this.populateCurrencySelector();
                        this.setDefaultCurrencyInForm();
                        this.updateDefaultCurrencyDisplay();

                        // Update filter currencies dropdown
                        if (window.tracker) {
                            window.tracker.populateFilterCurrencies();
                        }

                        console.log('✓ Workspace data loaded from Drive successfully!');
                        if (window.tracker) {
                            window.tracker.showNotification(`✓ تم تحميل ${backupData.data.transactions.length} معاملة`);
                        }
                    } else {
                        console.warn('⚠️ Backup data format invalid or empty');
                        if (window.tracker) {
                            window.tracker.showNotification('⚠️ البيانات المحفوظة فارغة');
                        }
                    }
                } else if (response.status === 401) {
                    console.error('❌ Token expired - need to re-authenticate');
                    if (window.tracker) {
                        window.tracker.showNotification('⚠️ انتهت صلاحية الجلسة. سجل دخول مرة أخرى');
                    }
                    this.signOut();
                } else {
                    const errorText = await response.text();
                    console.error('❌ Failed to download backup:', response.status, response.statusText);
                    console.error('Error details:', errorText);
                    if (window.tracker) {
                        window.tracker.showNotification(`❌ خطأ في التحميل: ${response.status}`);
                    }
                }
            } else {
                console.log('ℹ️ No existing backup found for workspace:', this.workspaceId);
                console.log('💡 This might be a new workspace or the creator hasn\'t backed up yet');
                if (window.tracker) {
                    window.tracker.showNotification('ℹ️ مساحة العمل فارغة. انتظر حتى يضيف المنشئ معاملات');
                }
            }
        } catch (error) {
            console.error('❌ Error loading workspace data:', error);
            console.error('Error stack:', error.stack);
            if (window.tracker) {
                window.tracker.showNotification('❌ خطأ في تحميل البيانات');
            }
            throw error; // Re-throw to be caught by syncWorkspace
        }
    }

    updateBackupFilename() {
        if (this.workspaceId) {
            this.BACKUP_FILENAME = `trade-tracker-${this.workspaceId}.json`;
        }
    }

    displayWorkspaceCode() {
        const codeEl = document.getElementById('currentWorkspaceCode');
        if (codeEl && this.workspaceId) {
            codeEl.textContent = this.workspaceId;
        }
        this.displayWorkspaceRole();
        this.displayLastSync();
        this.updateLeaveButtonVisibility();
    }

    updateLeaveButtonVisibility() {
        const role = localStorage.getItem('workspace_role');
        const leaveBtn = document.getElementById('leaveWorkspaceBtn');

        if (leaveBtn) {
            if (role === 'creator') {
                // Hide leave button for creators - they own the workspace
                leaveBtn.style.display = 'none';
            } else {
                leaveBtn.style.display = 'inline-block';
            }
        }
    }

    displayWorkspaceRole() {
        const roleEl = document.getElementById('workspaceRole');
        const workspaceRole = localStorage.getItem('workspace_role');

        if (roleEl && workspaceRole) {
            const roleNames = {
                'creator': 'منشئ',
                'writer': 'كاتب',
                'reader': 'قارئ'
            };
            roleEl.textContent = roleNames[workspaceRole] || 'عضو';
            roleEl.className = `workspace-role-badge ${workspaceRole}`;
        }
    }

    updateUIBasedOnRole() {
        const role = localStorage.getItem('workspace_role');

        // Show workspace settings for creators only
        const workspaceSettingsControls = document.querySelector('.workspace-settings-controls');
        if (workspaceSettingsControls) {
            workspaceSettingsControls.style.display = (role === 'creator') ? 'flex' : 'none';
        }

        // Disable transaction form for readers
        const transactionForm = document.getElementById('transactionForm');
        if (transactionForm && role === 'reader') {
            const submitBtn = transactionForm.querySelector('.btn-submit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '🔒 وضع القراءة فقط';
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
            }

            // Disable all form inputs
            const inputs = transactionForm.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.disabled = true;
            });
        }
    }

    displayLastSync() {
        const lastSync = localStorage.getItem('last_sync_time');
        if (lastSync) {
            this.updateSyncStatus();
        }
    }

    updateSyncStatus() {
        const lastSync = localStorage.getItem('last_sync_time');
        const statusEl = document.getElementById('syncStatus');

        if (!statusEl || !lastSync) return;

        const syncTime = new Date(lastSync);
        const now = new Date();
        const diffMs = now - syncTime;
        const diffMins = Math.floor(diffMs / 60000);

        let statusText = '';
        if (diffMins < 1) {
            statusText = 'تم التحديث للتو';
        } else if (diffMins < 60) {
            statusText = `آخر تحديث: منذ ${diffMins} دقيقة`;
        } else {
            const diffHours = Math.floor(diffMins / 60);
            statusText = `آخر تحديث: منذ ${diffHours} ساعة`;
        }

        statusEl.textContent = statusText;
    }

    updateBackupControlsVisibility() {
        const workspaceRole = localStorage.getItem('workspace_role');
        const backupControls = document.querySelector('.backup-controls');

        if (backupControls) {
            if (workspaceRole === 'member') {
                // Hide backup settings for members
                backupControls.style.display = 'none';
                console.log('Backup controls hidden for workspace member');
            } else {
                // Show backup settings for creators
                backupControls.style.display = 'flex';
                console.log('Backup controls visible for workspace creator');
            }
        }
    }

    leaveWorkspace() {
        if (!confirm('هل أنت متأكد من مغادرة مساحة العمل؟\nسيتم حذف جميع البيانات المحلية.')) {
            return;
        }

        // Clear workspace data
        localStorage.removeItem('workspace_id');
        localStorage.removeItem('workspace_role');
        localStorage.removeItem('transactions');
        localStorage.removeItem('last_sync_time');

        // Reset workspace variables
        this.workspaceId = null;
        this.fileId = null;
        this.BACKUP_FILENAME = 'trade-tracker-backup.json';

        // Clear UI
        if (window.tracker) {
            window.tracker.transactions = [];
            window.tracker.renderTransactions();
            window.tracker.updateDashboard();
        }

        // Show workspace selection
        this.showWorkspaceGate();

        console.log('Left workspace successfully');
    }

    shareWorkspace() {
        if (!this.workspaceId) return;

        const shareText = `انضم لمساحة العمل على متتبع التجارة:\n\nالرمز: ${this.workspaceId}\n\nالرابط: https://devcops-xyz.github.io/trade-tracker/`;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText).then(() => {
                if (window.tracker) {
                    window.tracker.showNotification('✓ تم نسخ رمز مساحة العمل');
                }
            });
        } else {
            // Fallback
            alert(shareText);
        }
    }

    async syncWorkspace() {
        if (!this.workspaceId || !this.accessToken) {
            console.error('Sync failed: Missing workspace ID or access token');
            if (window.tracker) {
                window.tracker.showNotification('⚠️ يرجى تسجيل الدخول أولاً');
            }
            return;
        }

        // Add loading indicator
        const syncBtn = document.getElementById('syncWorkspaceBtn');
        if (syncBtn) {
            syncBtn.classList.add('loading');
        }

        try {
            console.log('Starting sync for workspace:', this.workspaceId);

            if (window.tracker) {
                window.tracker.showNotification('🔄 جاري التحديث من Drive...');
            }

            await this.loadWorkspaceData();

            // Save sync timestamp
            localStorage.setItem('last_sync_time', new Date().toISOString());
            this.updateSyncStatus();

            // Update sync status every minute
            if (this.syncStatusInterval) {
                clearInterval(this.syncStatusInterval);
            }
            this.syncStatusInterval = setInterval(() => this.updateSyncStatus(), 60000);

            if (window.tracker) {
                window.tracker.showNotification('✓ تم التحديث بنجاح');
            }

            console.log('Sync completed successfully');
        } catch (error) {
            console.error('Sync error:', error);
            if (window.tracker) {
                window.tracker.showNotification('❌ فشل التحديث. حاول مرة أخرى');
            }
        } finally {
            // Remove loading indicator
            if (syncBtn) {
                syncBtn.classList.remove('loading');
            }
        }
    }

    setupEventListeners() {
        console.log('Setting up Google Drive event listeners...');
        console.log('Client ID:', this.CLIENT_ID);

        // Sign-in gate button
        const signInGateBtn = document.getElementById('signInGateBtn');
        if (signInGateBtn) {
            signInGateBtn.addEventListener('click', () => {
                console.log('Sign in gate button clicked!');
                this.signIn();
            });
        }

        // Workspace buttons
        const createWorkspaceBtn = document.getElementById('createWorkspaceBtn');
        const joinWorkspaceBtn = document.getElementById('joinWorkspaceBtn');
        const confirmJoinBtn = document.getElementById('confirmJoinBtn');
        const cancelJoinBtn = document.getElementById('cancelJoinBtn');
        const shareWorkspaceBtn = document.getElementById('shareWorkspaceBtn');
        const joinWorkspaceForm = document.getElementById('joinWorkspaceForm');
        const workspaceActions = document.querySelector('.workspace-actions');

        createWorkspaceBtn?.addEventListener('click', () => {
            this.createWorkspace();
        });

        joinWorkspaceBtn?.addEventListener('click', () => {
            workspaceActions.style.display = 'none';
            joinWorkspaceForm.style.display = 'block';
        });

        confirmJoinBtn?.addEventListener('click', () => {
            const code = document.getElementById('workspaceCodeInput').value;
            // Always join as reader for security - admin can upgrade later
            this.joinWorkspace(code, 'reader');
        });

        cancelJoinBtn?.addEventListener('click', () => {
            workspaceActions.style.display = 'flex';
            joinWorkspaceForm.style.display = 'none';
            document.getElementById('workspaceCodeInput').value = '';
        });

        shareWorkspaceBtn?.addEventListener('click', () => {
            this.shareWorkspace();
        });

        const syncWorkspaceBtn = document.getElementById('syncWorkspaceBtn');
        syncWorkspaceBtn?.addEventListener('click', () => {
            this.syncWorkspace();
        });

        const leaveWorkspaceBtn = document.getElementById('leaveWorkspaceBtn');
        leaveWorkspaceBtn?.addEventListener('click', () => {
            this.leaveWorkspace();
        });

        // Workspace Settings Modal controls
        const openWorkspaceSettingsBtn = document.getElementById('openWorkspaceSettings');
        const closeWorkspaceSettingsBtn = document.getElementById('closeWorkspaceSettingsModal');
        const workspaceSettingsModal = document.getElementById('workspaceSettingsModal');

        openWorkspaceSettingsBtn?.addEventListener('click', () => {
            workspaceSettingsModal.classList.add('active');
            this.loadCurrencies();
        });

        closeWorkspaceSettingsBtn?.addEventListener('click', () => {
            workspaceSettingsModal.classList.remove('active');
        });

        workspaceSettingsModal?.addEventListener('click', (e) => {
            if (e.target === workspaceSettingsModal) {
                workspaceSettingsModal.classList.remove('active');
            }
        });

        // Currency management
        const addCurrencyBtn = document.getElementById('addCurrencyBtn');
        addCurrencyBtn?.addEventListener('click', () => {
            this.addCurrency();
        });

        // Currency selector button
        const changeCurrencyBtn = document.getElementById('changeCurrencyBtn');
        const currencyWrapper = document.querySelector('.currency-selector-wrapper');
        const currencySelect = document.getElementById('currency');
        const selectedCurrencyEl = document.getElementById('selectedCurrency');

        changeCurrencyBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            if (currencySelect.classList.contains('currency-select-hidden')) {
                currencySelect.classList.remove('currency-select-hidden');
                currencySelect.classList.add('currency-select');
                currencyWrapper.style.display = 'none';
            }
        });

        currencySelect?.addEventListener('change', () => {
            selectedCurrencyEl.textContent = currencySelect.value;
            currencySelect.classList.add('currency-select-hidden');
            currencySelect.classList.remove('currency-select');
            currencyWrapper.style.display = 'flex';
        });

        // Delete backup button
        const deleteBackupBtn = document.getElementById('deleteBackupBtn');
        deleteBackupBtn?.addEventListener('click', () => {
            this.deleteBackup();
        });

        // Charts Modal controls
        const openChartsBtn = document.getElementById('openChartsBtn');
        const closeChartsBtn = document.getElementById('closeChartsModal');
        const chartsModal = document.getElementById('chartsModal');

        openChartsBtn?.addEventListener('click', () => {
            chartsModal.classList.add('active');
            // Refresh charts when opening modal
            if (window.tracker) {
                setTimeout(() => {
                    window.tracker.updateCharts();
                }, 100);
            }
        });

        closeChartsBtn?.addEventListener('click', () => {
            chartsModal.classList.remove('active');
        });

        chartsModal?.addEventListener('click', (e) => {
            if (e.target === chartsModal) {
                chartsModal.classList.remove('active');
            }
        });

        // Modal controls
        const openModalBtn = document.getElementById('openBackupSettings');
        const closeModalBtn = document.getElementById('closeBackupModal');
        const modal = document.getElementById('backupModal');

        openModalBtn?.addEventListener('click', () => {
            modal.classList.add('active');
        });

        closeModalBtn?.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        // Close on outside click
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });

        // Google Drive controls
        const signInBtn = document.getElementById('signInBtn');
        const signOutBtn = document.getElementById('signOutBtn');
        const backupBtn = document.getElementById('backupBtn');
        const restoreBtn = document.getElementById('restoreBtn');

        console.log('Sign in button found:', signInBtn !== null);

        if (signInBtn) {
            signInBtn.addEventListener('click', () => {
                console.log('Sign in button clicked!');
                this.signIn();
            });
            console.log('✓ Event listener attached to sign in button');
        } else {
            console.error('✗ Sign in button not found!');
        }

        signOutBtn?.addEventListener('click', () => this.signOut());
        backupBtn?.addEventListener('click', () => this.backup());
        restoreBtn?.addEventListener('click', () => this.restore());

        // Check if already signed in
        const savedToken = localStorage.getItem('gdrive_token');
        const savedEmail = localStorage.getItem('gdrive_email');
        if (savedToken && savedEmail) {
            this.accessToken = savedToken;
            this.updateUISignedIn(savedEmail);
        }

        // Check Google API status
        console.log('Google API loaded:', typeof google !== 'undefined');
        if (typeof google !== 'undefined') {
            console.log('Google accounts available:', typeof google.accounts !== 'undefined');
        }
    }

    signIn() {
        // Check if Google API is loaded
        if (typeof google === 'undefined' || !google.accounts) {
            this.showStatus('جاري تحميل Google API...', 'info');
            console.error('Google API not loaded yet');

            // Retry after a delay
            setTimeout(() => this.signIn(), 1000);
            return;
        }

        try {
            // Using Google Identity Services
            const client = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: (response) => {
                    if (response.error) {
                        console.error('OAuth error:', response);
                        this.showStatus(`خطأ: ${response.error}`, 'error');
                        return;
                    }

                    if (response.access_token) {
                        this.accessToken = response.access_token;
                        localStorage.setItem('gdrive_token', this.accessToken);
                        this.getUserInfo();
                        this.showStatus('تم تسجيل الدخول بنجاح ✓', 'success');

                        // Check if user has workspace
                        const savedWorkspace = localStorage.getItem('workspace_id');
                        if (savedWorkspace) {
                            this.workspaceId = savedWorkspace;
                            this.updateBackupFilename();
                            this.showApp();
                            this.displayWorkspaceCode();
                        } else {
                            // Show workspace selection
                            this.showWorkspaceGate();
                        }
                    }
                },
            });
            client.requestAccessToken();
        } catch (error) {
            console.error('Sign-in error:', error);
            this.showStatus('خطأ في تسجيل الدخول', 'error');
        }
    }

    async getUserInfo() {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            const data = await response.json();
            localStorage.setItem('gdrive_email', data.email);
            this.updateUISignedIn(data.email);
        } catch (error) {
            console.error('Error getting user info:', error);
        }
    }

    signOut() {
        this.accessToken = null;
        localStorage.removeItem('gdrive_token');
        localStorage.removeItem('gdrive_email');
        this.updateUISignedOut();
        this.showStatus('تم تسجيل الخروج', 'info');

        // Show sign-in gate after sign-out
        this.showSignInGate();
    }

    updateUISignedIn(email) {
        const signInSection = document.getElementById('signInSection');
        const signedInSection = document.getElementById('signedInSection');
        const userEmail = document.getElementById('userEmail');

        if (signInSection) signInSection.style.display = 'none';
        if (signedInSection) signedInSection.style.display = 'block';
        if (userEmail) userEmail.textContent = email;
    }

    updateUISignedOut() {
        const signInSection = document.getElementById('signInSection');
        const signedInSection = document.getElementById('signedInSection');

        if (signInSection) signInSection.style.display = 'block';
        if (signedInSection) signedInSection.style.display = 'none';
    }

    async backup() {
        if (!this.accessToken) {
            this.showStatus('يرجى تسجيل الدخول أولاً', 'error');
            return;
        }

        const backupBtn = document.getElementById('backupBtn');
        if (backupBtn) {
            backupBtn.disabled = true;
            backupBtn.textContent = '⏳ جاري النسخ...';
        }

        try {
            this.showStatus('جاري النسخ الاحتياطي...', 'info');

            // Get current data from localStorage
            const transactions = localStorage.getItem('transactions') || '[]';
            const currencies = localStorage.getItem('workspace_currencies') || '[]';
            const defaultCurrency = localStorage.getItem('default_currency') || 'USD';

            const backupData = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                workspaceId: this.workspaceId || null,
                data: {
                    transactions: JSON.parse(transactions),
                    currencies: JSON.parse(currencies),
                    defaultCurrency: defaultCurrency
                }
            };

            // Check if backup file already exists
            await this.findBackupFile();

            const metadata = {
                name: this.BACKUP_FILENAME,
                mimeType: 'application/json'
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' }));

            const url = this.fileId
                ? `https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=multipart`
                : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

            const method = this.fileId ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                },
                body: form
            });

            if (response.ok) {
                const result = await response.json();
                this.fileId = result.id;

                // Save sync timestamp
                localStorage.setItem('last_sync_time', new Date().toISOString());
                this.updateSyncStatus();

                const date = new Date().toLocaleString('ar-EG');
                this.showStatus(`✓ تم النسخ الاحتياطي بنجاح (${date})`, 'success');
            } else if (response.status === 401) {
                this.showStatus('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً', 'error');
                this.signOut();
            } else {
                throw new Error('Backup failed');
            }
        } catch (error) {
            console.error('Backup error:', error);
            this.showStatus('فشل النسخ الاحتياطي ✗', 'error');
        } finally {
            if (backupBtn) {
                backupBtn.disabled = false;
                backupBtn.textContent = '☁️ نسخ احتياطي الآن';
            }
        }
    }

    async restore() {
        if (!this.accessToken) {
            this.showStatus('يرجى تسجيل الدخول أولاً', 'error');
            return;
        }

        try {
            this.showStatus('جاري البحث عن النسخ الاحتياطية...', 'info');

            // Find the backup file first
            await this.findBackupFile();

            if (!this.fileId) {
                this.showStatus('لم يتم العثور على نسخة احتياطية', 'error');
                return;
            }

            // Get all revisions of the backup file
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${this.fileId}/revisions?fields=revisions(id,modifiedTime,size)`,
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`
                    }
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    this.showStatus('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً', 'error');
                    this.signOut();
                    return;
                }
                throw new Error('Failed to fetch revisions');
            }

            const data = await response.json();

            if (!data.revisions || data.revisions.length === 0) {
                this.showStatus('لم يتم العثور على نسخ احتياطية', 'error');
                return;
            }

            // Show list of revisions
            await this.showRevisionsList(data.revisions.reverse()); // Most recent first

        } catch (error) {
            console.error('Restore error:', error);
            this.showStatus('فشل البحث عن النسخ الاحتياطية ✗', 'error');
        }
    }

    async showRevisionsList(revisions) {
        // Download each revision to get details
        const revisionPromises = revisions.map(async (revision) => {
            try {
                const response = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${this.fileId}/revisions/${revision.id}?alt=media`,
                    {
                        headers: {
                            Authorization: `Bearer ${this.accessToken}`
                        }
                    }
                );

                if (response.ok) {
                    const backupData = await response.json();
                    return {
                        revisionId: revision.id,
                        timestamp: backupData.timestamp,
                        transactionCount: backupData.data?.transactions?.length || 0,
                        modifiedTime: revision.modifiedTime,
                        isLatest: revision.id === revisions[0].id
                    };
                }
            } catch (error) {
                console.error('Error loading revision:', error);
            }
            return null;
        });

        const backups = (await Promise.all(revisionPromises)).filter(b => b !== null);

        if (backups.length === 0) {
            this.showStatus('لم يتم العثور على نسخ احتياطية صالحة', 'error');
            return;
        }

        // Create backup selection UI
        const backupListHTML = backups.map((backup) => {
            const date = new Date(backup.timestamp).toLocaleString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const latestBadge = backup.isLatest ? '<span class="latest-badge">الأحدث</span>' : '';
            return `
                <div class="backup-item" data-revision-id="${backup.revisionId}">
                    <div class="backup-item-info">
                        <div class="backup-item-date">📅 ${date} ${latestBadge}</div>
                        <div class="backup-item-count">📊 ${backup.transactionCount} معاملة</div>
                    </div>
                    <button class="btn-restore-backup" onclick="window.driveBackup.restoreFromRevision('${backup.revisionId}')">
                        استعادة
                    </button>
                </div>
            `;
        }).join('');

        // Show in modal
        const modal = document.getElementById('backupModal');
        const modalBody = modal.querySelector('.modal-body');

        // Save current content
        const originalContent = modalBody.innerHTML;

        // Show backup list
        modalBody.innerHTML = `
            <div class="backup-list-section">
                <h3>النسخ الاحتياطية المتاحة</h3>
                <p class="backup-description">اختر النسخة الاحتياطية التي تريد استعادتها</p>
                <div class="backup-list">
                    ${backupListHTML}
                </div>
                <button class="btn-modal-secondary" onclick="window.driveBackup.cancelRestore()">
                    إلغاء
                </button>
                <div id="backupStatus" class="backup-status"></div>
            </div>
        `;

        // Store original content for restore
        this.originalModalContent = originalContent;

        this.showStatus('', 'info'); // Clear status
    }

    cancelRestore() {
        const modal = document.getElementById('backupModal');
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = this.originalModalContent;
        this.showStatus('', 'info');
    }

    async restoreFromRevision(revisionId) {
        if (!confirm('هل تريد استعادة هذه النسخة الاحتياطية؟ سيتم استبدال البيانات الحالية.')) {
            return;
        }

        try {
            this.showStatus('جاري الاستعادة...', 'info');

            // Download the specific revision
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${this.fileId}/revisions/${revisionId}?alt=media`,
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`
                    }
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    this.showStatus('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً', 'error');
                    this.signOut();
                    return;
                }
                throw new Error('Failed to download backup');
            }

            const backupData = await response.json();

            // Restore data
            if (backupData.data && backupData.data.transactions) {
                localStorage.setItem('transactions', JSON.stringify(backupData.data.transactions));

                // Reload the app
                if (window.tracker) {
                    window.tracker.transactions = backupData.data.transactions;
                    window.tracker.renderTransactions();
                    window.tracker.updateDashboard();
                }

                // Close the modal
                const modal = document.getElementById('backupModal');
                modal.classList.remove('active');

                // Restore modal content
                this.cancelRestore();

                // Show success notification in main app
                if (window.tracker) {
                    const date = new Date(backupData.timestamp).toLocaleString('ar-EG');
                    window.tracker.showNotification(`✓ تم استعادة البيانات (${date})`);
                }
            } else {
                throw new Error('Invalid backup format');
            }
        } catch (error) {
            console.error('Restore error:', error);
            this.showStatus('فشلت الاستعادة ✗', 'error');
        }
    }

    async findBackupFile() {
        try {
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=name='${this.BACKUP_FILENAME}'&spaces=drive`,
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`
                    }
                }
            );

            const data = await response.json();
            if (data.files && data.files.length > 0) {
                this.fileId = data.files[0].id;
            }
        } catch (error) {
            console.error('Error finding backup file:', error);
        }
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('backupStatus');
        if (!statusEl) {
            console.warn('Status element not found');
            return;
        }

        statusEl.textContent = message;
        statusEl.className = `backup-status ${type}`;

        setTimeout(() => {
            if (statusEl) {
                statusEl.textContent = '';
                statusEl.className = 'backup-status';
            }
        }, 5000);
    }

    // Auto-backup: Immediate for workspaces, once per day for personal use
    shouldAutoBackup() {
        if (!this.accessToken) {
            return false; // Not signed in
        }

        // For workspaces, always backup immediately to enable collaboration
        if (this.workspaceId) {
            return true;
        }

        // For personal use, only backup once per day
        const lastBackup = localStorage.getItem('last_backup_date');
        const today = new Date().toDateString();

        if (lastBackup === today) {
            return false; // Already backed up today
        }

        return true;
    }

    async autoBackup() {
        if (!this.shouldAutoBackup()) {
            console.log('Auto-backup skipped: Already backed up today or not signed in');
            return;
        }

        try {
            console.log('Auto-backup triggered for workspace:', this.workspaceId || 'personal');

            // Get current data from localStorage
            const transactions = localStorage.getItem('transactions') || '[]';
            const currencies = localStorage.getItem('workspace_currencies') || '[]';
            const defaultCurrency = localStorage.getItem('default_currency') || 'USD';

            const backupData = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                workspaceId: this.workspaceId || null,
                data: {
                    transactions: JSON.parse(transactions),
                    currencies: JSON.parse(currencies),
                    defaultCurrency: defaultCurrency
                }
            };

            // Check if backup file already exists
            await this.findBackupFile();

            const metadata = {
                name: this.BACKUP_FILENAME,
                mimeType: 'application/json'
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' }));

            const url = this.fileId
                ? `https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=multipart`
                : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

            const method = this.fileId ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    Authorization: `Bearer ${this.accessToken}`
                },
                body: form
            });

            if (response.ok) {
                const result = await response.json();
                this.fileId = result.id;

                // Save sync timestamp
                localStorage.setItem('last_sync_time', new Date().toISOString());
                this.updateSyncStatus();

                // For personal use, save today's date as last backup
                if (!this.workspaceId) {
                    localStorage.setItem('last_backup_date', new Date().toDateString());
                }

                console.log('✓ Auto-backup completed successfully');
            } else if (response.status === 401) {
                // Token expired - clear it so user knows to sign in again
                console.log('Auto-backup failed: Token expired. Please sign in again.');
                this.signOut();
            } else {
                console.error('Auto-backup failed:', response.status);
            }
        } catch (error) {
            console.error('Auto-backup error:', error);
        }
    }

    // Currency Management
    loadCurrencies() {
        // Load from localStorage first
        const saved = localStorage.getItem('workspace_currencies');
        const savedDefault = localStorage.getItem('default_currency');

        if (saved) {
            this.workspaceCurrencies = JSON.parse(saved);
        } else {
            // Default currencies
            this.workspaceCurrencies = [
                { code: 'USD', name: 'دولار أمريكي', isDefault: true },
                { code: 'EUR', name: 'يورو', isDefault: false },
                { code: 'SAR', name: 'ريال سعودي', isDefault: false }
            ];
            localStorage.setItem('workspace_currencies', JSON.stringify(this.workspaceCurrencies));
        }

        if (savedDefault) {
            this.defaultCurrency = savedDefault;
        } else {
            // Find default from currencies
            const defaultCurr = this.workspaceCurrencies.find(c => c.isDefault);
            this.defaultCurrency = defaultCurr ? defaultCurr.code : 'USD';
            localStorage.setItem('default_currency', this.defaultCurrency);
        }

        this.displayCurrencies();
        this.populateCurrencySelector();
        this.setDefaultCurrencyInForm();
        this.updateDefaultCurrencyDisplay();

        // Update filter currencies dropdown
        if (window.tracker) {
            window.tracker.populateFilterCurrencies();
        }
    }

    setDefaultCurrencyInForm() {
        const selectedCurrencyEl = document.getElementById('selectedCurrency');
        if (selectedCurrencyEl) {
            selectedCurrencyEl.textContent = this.defaultCurrency;
        }

        const currencySelect = document.getElementById('currency');
        if (currencySelect) {
            currencySelect.value = this.defaultCurrency;
        }
    }

    updateDefaultCurrencyDisplay() {
        const currentDefaultEl = document.getElementById('currentDefaultCurrency');
        if (currentDefaultEl) {
            currentDefaultEl.textContent = this.defaultCurrency;
        }
    }

    displayCurrencies() {
        const container = document.getElementById('currenciesList');
        if (!container) return;

        if (this.workspaceCurrencies.length === 0) {
            container.innerHTML = '<p style="color: #808080; text-align: center;">لا توجد عملات بعد</p>';
            return;
        }

        container.innerHTML = this.workspaceCurrencies.map((currency, index) => {
            const isDefault = currency.code === this.defaultCurrency;
            const defaultClass = isDefault ? 'default' : '';
            const starClass = isDefault ? 'active' : '';

            return `
                <div class="currency-item ${defaultClass}">
                    <div class="currency-info">
                        <span class="currency-code">${currency.code}</span>
                        <span class="currency-name">${currency.name}</span>
                    </div>
                    <div class="currency-actions">
                        <button class="btn-set-default ${starClass}"
                                onclick="window.driveBackup.setDefaultCurrency('${currency.code}')"
                                title="تعيين كعملة افتراضية">
                            ${isDefault ? '⭐' : '☆'}
                        </button>
                        <button class="btn-remove-currency"
                                onclick="window.driveBackup.removeCurrency(${index})"
                                ${isDefault ? 'disabled' : ''}>
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    setDefaultCurrency(code) {
        this.defaultCurrency = code;
        localStorage.setItem('default_currency', code);

        // Update isDefault flags
        this.workspaceCurrencies = this.workspaceCurrencies.map(c => ({
            ...c,
            isDefault: c.code === code
        }));
        localStorage.setItem('workspace_currencies', JSON.stringify(this.workspaceCurrencies));

        this.displayCurrencies();
        this.setDefaultCurrencyInForm();
        this.updateDefaultCurrencyDisplay();

        // Update filter currencies dropdown
        if (window.tracker) {
            window.tracker.populateFilterCurrencies();
        }

        // Auto-backup
        this.autoBackup();

        if (window.tracker) {
            window.tracker.showNotification(`✓ تم تعيين ${code} كعملة افتراضية`);
        }
    }

    populateCurrencySelector() {
        const select = document.getElementById('currency');
        if (!select) return;

        // Keep the first placeholder option and add currencies
        select.innerHTML = '<option value="">اختر العملة</option>' +
            this.workspaceCurrencies.map(currency =>
                `<option value="${currency.code}">${currency.code} - ${currency.name}</option>`
            ).join('');
    }

    addCurrency() {
        const codeInput = document.getElementById('newCurrencyCode');
        const nameInput = document.getElementById('newCurrencyName');

        if (!codeInput || !nameInput) return;

        const code = codeInput.value.trim().toUpperCase();
        const name = nameInput.value.trim();

        if (!code || !name) {
            alert('يرجى إدخال رمز واسم العملة');
            return;
        }

        if (code.length !== 3) {
            alert('رمز العملة يجب أن يكون 3 أحرف');
            return;
        }

        // Check if currency already exists
        if (this.workspaceCurrencies.some(c => c.code === code)) {
            alert('هذه العملة موجودة بالفعل');
            return;
        }

        this.workspaceCurrencies.push({ code, name });
        localStorage.setItem('workspace_currencies', JSON.stringify(this.workspaceCurrencies));

        // Clear inputs
        codeInput.value = '';
        nameInput.value = '';

        // Update displays
        this.displayCurrencies();
        this.populateCurrencySelector();

        // Update filter currencies dropdown
        if (window.tracker) {
            window.tracker.populateFilterCurrencies();
        }

        // Auto-backup to sync currencies
        this.autoBackup();
    }

    removeCurrency(index) {
        const currency = this.workspaceCurrencies[index];

        // Prevent removing default currency
        if (currency.code === this.defaultCurrency) {
            alert('لا يمكن حذف العملة الافتراضية. قم بتعيين عملة أخرى كافتراضية أولاً');
            return;
        }

        if (!confirm('هل أنت متأكد من حذف هذه العملة؟')) {
            return;
        }

        this.workspaceCurrencies.splice(index, 1);
        localStorage.setItem('workspace_currencies', JSON.stringify(this.workspaceCurrencies));

        this.displayCurrencies();
        this.populateCurrencySelector();

        // Update filter currencies dropdown
        if (window.tracker) {
            window.tracker.populateFilterCurrencies();
        }

        // Auto-backup to sync currencies
        this.autoBackup();
    }

    async deleteBackup() {
        // Triple confirmation for dangerous action
        if (!confirm('⚠️ تحذير!\n\nهل أنت متأكد تماماً من حذف النسخة الاحتياطية؟\n\nسيتم حذف جميع البيانات المحفوظة على Google Drive.\nلن يتمكن أعضاء الفريق من استعادة البيانات.\n\nهذا الإجراء لا يمكن التراجع عنه!')) {
            return;
        }

        if (!confirm('⚠️ تأكيد نهائي\n\nاضغط "موافق" للحذف النهائي')) {
            return;
        }

        if (!this.accessToken) {
            alert('يرجى تسجيل الدخول أولاً');
            return;
        }

        try {
            // Find the backup file first
            await this.findBackupFile();

            if (!this.fileId) {
                alert('لا توجد نسخة احتياطية لحذفها');
                return;
            }

            console.log('🗑️ Deleting backup file:', this.fileId);

            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${this.fileId}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`
                    }
                }
            );

            if (response.ok || response.status === 204) {
                console.log('✓ Backup deleted successfully');
                this.fileId = null; // Clear the file ID

                if (window.tracker) {
                    window.tracker.showNotification('✓ تم حذف النسخة الاحتياطية من Drive');
                }

                alert('✓ تم حذف النسخة الاحتياطية من Google Drive بنجاح\n\nملاحظة: البيانات المحلية لا تزال موجودة على جهازك');
            } else if (response.status === 401) {
                alert('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً');
                this.signOut();
            } else {
                throw new Error(`Failed to delete: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Error deleting backup:', error);
            alert('فشل حذف النسخة الاحتياطية. يرجى المحاولة مرة أخرى');
        }
    }
}

// Initialize Google Drive backup
let driveBackup;
console.log('google-drive.js loaded');

window.addEventListener('load', () => {
    console.log('Page loaded, initializing GoogleDriveBackup...');
    driveBackup = new GoogleDriveBackup();
    console.log('GoogleDriveBackup initialized:', driveBackup);

    // Make it globally accessible for debugging
    window.driveBackup = driveBackup;
    console.log('You can test with: window.driveBackup.signIn()');
});

/*
=== SETUP INSTRUCTIONS ===

To use Google Drive backup, you need to create a Google Cloud Project:

1. Go to: https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized JavaScript origins:
     - http://localhost:8080 (for testing)
     - Your production domain
   - Add authorized redirect URIs (same as above)
   - Copy your Client ID

5. Get API Key (optional, for additional features):
   - In Credentials, click "Create Credentials" > "API key"
   - Copy your API key

6. Replace in this file:
   - this.CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com'
   - this.API_KEY = 'YOUR_API_KEY_HERE' (optional)

7. Deploy your app - Google Sign-In requires a proper domain (won't work on file://)

For development, you can use: python3 -m http.server 8080
Then access: http://localhost:8080
*/
