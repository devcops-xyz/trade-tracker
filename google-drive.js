// Google Drive Integration for Backup/Restore
class GoogleDriveBackup {
    constructor() {
        // Get Client ID from config
        this.CLIENT_ID = window.APP_CONFIG?.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
        this.workspaceId = null;
        this.BACKUP_FILENAME = 'trade-tracker-backup.json'; // Will be updated with workspace ID
        this.accessToken = null;
        this.fileId = null;
        this.workspaceCurrencies = [];
        this.defaultCurrency = 'USD';
        this.workspaceMembers = [];
        this.activityLog = [];
        this.currentUserEmail = null;
        this.worldCurrencies = this.getWorldCurrencies();

        // Check if configured
        if (this.CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
            console.warn('Google Drive not configured. Please update config.js with your Client ID.');
            this.hideBackupControls();
            return;
        }

        this.init();
    }

    hideBackupControls() {
        const settingsControls = document.querySelector('.settings-controls');
        if (settingsControls) {
            settingsControls.style.display = 'none';
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

        // Check for workspace invitation parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const invitationCode = urlParams.get('workspace');

        if (savedToken && savedEmail) {
            // User is signed in - validate token first before showing anything
            this.accessToken = savedToken;
            this.currentUserEmail = savedEmail;

            // Validate token by checking if it works (don't show UI until validated)
            this.validateSavedToken(savedWorkspace, invitationCode, savedEmail);
        } else {
            // User not signed in
            if (invitationCode) {
                // Save invitation code for after sign-in
                sessionStorage.setItem('pending_workspace_invitation', invitationCode);
            }
            this.showSignInGate();
        }
    }

    async validateSavedToken(savedWorkspace, invitationCode, savedEmail) {
        console.log('🔍 Validating saved token...');
        try {
            // Try to validate token with a simple API call
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });

            if (response.status === 401) {
                // Token is expired, clear it and show sign-in
                console.log('❌ Saved token expired, clearing and showing sign-in gate...');
                localStorage.removeItem('gdrive_token');
                localStorage.removeItem('gdrive_email');
                this.accessToken = null;
                this.currentUserEmail = null;
                this.showSignInGate();
                return;
            }

            if (response.ok) {
                // Token is valid, now update UI and continue with normal flow
                console.log('✅ Token is valid, continuing...');
                this.updateUISignedIn(savedEmail);

                if (savedWorkspace) {
                    // User has workspace, show app
                    this.workspaceId = savedWorkspace;
                    this.updateBackupFilename();
                    this.showApp();
                    this.displayWorkspaceCode();
                    this.updateBackupControlsVisibility();
                    this.updateUIBasedOnRole();
                } else if (invitationCode) {
                    // User signed in but has invitation link
                    this.showWorkspaceGateWithInvitation(invitationCode);
                } else {
                    // User signed in but no workspace
                    this.showWorkspaceGate();
                }
            }
        } catch (error) {
            console.error('Token validation error:', error);
            // On error, clear token and show sign-in
            localStorage.removeItem('gdrive_token');
            localStorage.removeItem('gdrive_email');
            this.accessToken = null;
            this.currentUserEmail = null;
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

        // Ensure the workspace actions are visible and form is hidden
        const workspaceActions = document.querySelector('.workspace-actions');
        const joinWorkspaceForm = document.getElementById('joinWorkspaceForm');
        const workspaceCodeInput = document.getElementById('workspaceCodeInput');

        if (workspaceActions) workspaceActions.style.display = 'flex';
        if (joinWorkspaceForm) joinWorkspaceForm.style.display = 'none';
        if (workspaceCodeInput) workspaceCodeInput.value = '';
    }

    showWorkspaceGateWithInvitation(invitationCode) {
        document.getElementById('signInGate').classList.remove('active');
        document.getElementById('workspaceGate').classList.add('active');
        document.getElementById('appContent').style.display = 'none';

        // Show the join form with code pre-filled
        const workspaceActions = document.querySelector('.workspace-actions');
        const joinWorkspaceForm = document.getElementById('joinWorkspaceForm');
        const workspaceCodeInput = document.getElementById('workspaceCodeInput');

        if (workspaceActions) workspaceActions.style.display = 'none';
        if (joinWorkspaceForm) joinWorkspaceForm.style.display = 'block';
        if (workspaceCodeInput) {
            workspaceCodeInput.value = invitationCode;
            workspaceCodeInput.focus();
        }

        // Show notification
        if (window.tracker) {
            window.tracker.showNotification('✓ تم تعبئة رمز مساحة العمل. اضغط "انضمام" للمتابعة');
        } else {
            // If tracker not available yet, show alert
            setTimeout(() => {
                if (window.tracker) {
                    window.tracker.showNotification('✓ تم تعبئة رمز مساحة العمل. اضغط "انضمام" للمتابعة');
                }
            }, 500);
        }

        // Clear URL parameter
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    showApp() {
        document.getElementById('signInGate').classList.remove('active');
        document.getElementById('workspaceGate').classList.remove('active');
        document.getElementById('appContent').style.display = 'block';

        // Initialize admin panel if user is super admin
        setTimeout(() => {
            this.showAdminPanel();

            // If super admin, hide all regular app sections
            if (this.isSuperAdmin()) {
                this.hideRegularAppForAdmin();
            }
        }, 500);
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

        // Ensure we have the current user email
        if (!this.currentUserEmail) {
            this.currentUserEmail = localStorage.getItem('gdrive_email');
        }

        // Initialize workspace with creator as first member
        this.workspaceMembers = [{
            email: this.currentUserEmail || 'creator@workspace',
            role: 'creator',
            joinedAt: new Date().toISOString()
        }];
        localStorage.setItem('workspace_members', JSON.stringify(this.workspaceMembers));

        // Log activity
        this.logActivity('created', 'workspace', `Created workspace ${workspaceId}`);

        this.showApp();
        this.displayWorkspaceCode();
        this.updateBackupControlsVisibility();
        this.displayMemberManagement();

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

                        // Save members if they exist
                        if (backupData.data.members) {
                            localStorage.setItem('workspace_members', JSON.stringify(backupData.data.members));
                            this.workspaceMembers = backupData.data.members;
                            this.addCurrentUserToMembers();
                        }

                        // Save activity log if it exists
                        if (backupData.data.activityLog) {
                            localStorage.setItem('activity_log', JSON.stringify(backupData.data.activityLog));
                            this.activityLog = backupData.data.activityLog;
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

                        // Display member management and activity log
                        this.displayMemberManagement();
                        this.displayActivityLog();

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
        // Workspace code is no longer displayed in header - it's inside settings
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
        console.log('🔐 Updating UI based on role:', role);

        // Show workspace settings for creators only
        const workspaceSettingsControls = document.querySelector('.workspace-settings-controls');
        if (workspaceSettingsControls) {
            workspaceSettingsControls.style.display = (role === 'creator') ? 'flex' : 'none';
        }

        // Hide quick add button for readers
        const quickAddBtn = document.getElementById('quickAddBtn');
        if (quickAddBtn) {
            quickAddBtn.style.display = (role === 'reader') ? 'none' : 'flex';
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

        // Hide add-transaction section completely for readers
        const addTransactionSection = document.querySelector('.add-transaction');
        if (addTransactionSection && role === 'reader') {
            addTransactionSection.style.display = 'none';
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
            // Only show backup controls for creators
            if (workspaceRole === 'creator') {
                backupControls.style.display = 'flex';
                console.log('Backup controls visible for workspace creator');
            } else {
                // Hide backup settings for readers and writers
                backupControls.style.display = 'none';
                console.log('Backup controls hidden for non-creator role:', workspaceRole);
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

        // Create direct invitation link with workspace code
        const invitationUrl = `${window.location.origin}${window.location.pathname}?workspace=${this.workspaceId}`;

        const shareText = `انضم لمساحة العمل على متتبع التجارة:\n\nالرابط المباشر:\n${invitationUrl}\n\nأو استخدم الرمز: ${this.workspaceId}`;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText).then(() => {
                if (window.tracker) {
                    window.tracker.showNotification('✓ تم نسخ رابط الدعوة');
                }
            }).catch((err) => {
                // Clipboard write blocked - fallback to alert
                console.log('Clipboard blocked, using fallback');
                alert(shareText);
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

        // Settings Modal controls
        const openSettingsBtn = document.getElementById('openSettings');
        const closeSettingsBtn = document.getElementById('closeSettingsModal');
        const settingsModal = document.getElementById('settingsModal');

        openSettingsBtn?.addEventListener('click', () => {
            settingsModal.classList.add('active');
            this.loadCurrencies();
            this.displayMemberManagement();

            // Update email display in case it wasn't set earlier
            const savedEmail = localStorage.getItem('gdrive_email');
            if (savedEmail) {
                this.updateUISignedIn(savedEmail);
            }
        });

        closeSettingsBtn?.addEventListener('click', () => {
            settingsModal.classList.remove('active');
        });

        settingsModal?.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.remove('active');
            }
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

        // Delete account button
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');
        deleteAccountBtn?.addEventListener('click', () => {
            this.deleteAccount();
        });

        // Invitation button
        const inviteBtn = document.getElementById('inviteToWorkspaceBtn');
        inviteBtn?.addEventListener('click', () => {
            this.shareWorkspace();
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
            this.currentUserEmail = savedEmail;
            this.updateUISignedIn(savedEmail);
        }

        // Check Google API status
        console.log('Google API loaded:', typeof google !== 'undefined');
        if (typeof google !== 'undefined') {
            console.log('Google accounts available:', typeof google.accounts !== 'undefined');
        }

        // Setup admin panel event listeners
        this.setupAdminEventListeners();
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
                        console.log('✅ Got fresh access token from OAuth');
                        this.accessToken = response.access_token;
                        localStorage.setItem('gdrive_token', this.accessToken);
                        console.log('📞 Calling getUserInfo with isFreshSignIn=true');
                        this.getUserInfo(true); // Pass true to indicate fresh sign-in
                        this.showStatus('تم تسجيل الدخول بنجاح ✓', 'success');

                        // Close settings modal if open
                        const settingsModal = document.getElementById('settingsModal');
                        if (settingsModal) {
                            settingsModal.classList.remove('active');
                        }

                        // Check if user has workspace
                        const savedWorkspace = localStorage.getItem('workspace_id');
                        const pendingInvitation = sessionStorage.getItem('pending_workspace_invitation');

                        if (savedWorkspace) {
                            this.workspaceId = savedWorkspace;
                            this.updateBackupFilename();
                            this.showApp();
                            this.displayWorkspaceCode();
                        } else if (pendingInvitation) {
                            // User signed in via invitation link - show join form
                            sessionStorage.removeItem('pending_workspace_invitation');
                            this.showWorkspaceGateWithInvitation(pendingInvitation);
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

    async getUserInfo(isFreshSignIn = false) {
        console.log(`📧 getUserInfo called with isFreshSignIn=${isFreshSignIn}`);
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });

            console.log(`📨 getUserInfo response status: ${response.status}`);

            if (response.status === 401) {
                // Only sign out if this is NOT a fresh sign-in
                // Fresh sign-ins should never have expired tokens
                if (!isFreshSignIn) {
                    console.log('❌ Token expired (saved token), signing out...');
                    this.signOut();
                    return;
                } else {
                    // Fresh sign-in with 401 is unexpected, log but don't sign out yet
                    console.warn('⚠️ Fresh sign-in returned 401 - token might not be ready yet, retrying...');
                    // Retry once after a short delay
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const retryResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                        headers: { Authorization: `Bearer ${this.accessToken}` }
                    });
                    if (!retryResponse.ok) {
                        throw new Error(`Retry failed with status: ${retryResponse.status}`);
                    }
                    const data = await retryResponse.json();
                    this.currentUserEmail = data.email;
                    localStorage.setItem('gdrive_email', data.email);
                    this.updateUISignedIn(data.email);
                    return;
                }
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.currentUserEmail = data.email;
            localStorage.setItem('gdrive_email', data.email);
            this.updateUISignedIn(data.email);
        } catch (error) {
            console.error('Error getting user info:', error);
            // Only sign out on error if not a fresh sign-in
            if (!isFreshSignIn) {
                console.log('Error during saved token validation, signing out...');
                this.signOut();
            }
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

    // Extract username from email (part before @)
    getUsernameFromEmail(email) {
        if (!email) return '';
        const atIndex = email.indexOf('@');
        return atIndex > 0 ? email.substring(0, atIndex) : email;
    }

    updateUISignedIn(email) {
        const signInSection = document.getElementById('signInSection');
        const signedInSection = document.getElementById('signedInSection');
        const userEmail = document.getElementById('userEmail');

        if (signInSection) signInSection.style.display = 'none';
        if (signedInSection) signedInSection.style.display = 'block';
        if (userEmail) {
            const fullEmail = email || this.currentUserEmail || localStorage.getItem('gdrive_email') || '';
            userEmail.textContent = this.getUsernameFromEmail(fullEmail);
        }
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
            const members = localStorage.getItem('workspace_members') || '[]';
            const activityLog = localStorage.getItem('activity_log') || '[]';

            const backupData = {
                timestamp: new Date().toISOString(),
                version: '1.1',
                workspaceId: this.workspaceId || null,
                data: {
                    transactions: JSON.parse(transactions),
                    currencies: JSON.parse(currencies),
                    defaultCurrency: defaultCurrency,
                    members: JSON.parse(members),
                    activityLog: JSON.parse(activityLog)
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

                // Share file with workspace members if this is a workspace
                if (this.workspaceId && this.workspaceMembers.length > 0) {
                    console.log('📤 Sharing workspace file with members...');
                    await this.shareFileWithMembers();
                }

                const date = new Date().toLocaleString('ar-EG');
                this.showStatus(`✓ تم النسخ الاحتياطي بنجاح (${date})`, 'success');

                // Close settings modal after successful backup
                setTimeout(() => {
                    const modal = document.getElementById('settingsModal');
                    if (modal) {
                        modal.classList.remove('active');
                    }
                }, 1500);
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
        const modal = document.getElementById('settingsModal');
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
        const modal = document.getElementById('settingsModal');
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
                const modal = document.getElementById('settingsModal');
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
            // Search in user's Drive and shared with user
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=name='${this.BACKUP_FILENAME}'&spaces=drive&fields=files(id,name,ownedByMe)`,
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`
                    }
                }
            );

            const data = await response.json();
            console.log('📂 Found files:', data.files);

            if (data.files && data.files.length > 0) {
                this.fileId = data.files[0].id;
                console.log('✓ Using file ID:', this.fileId, 'Owned by me:', data.files[0].ownedByMe);
            }
        } catch (error) {
            console.error('Error finding backup file:', error);
        }
    }

    async shareFileWithMembers() {
        if (!this.fileId || !this.workspaceMembers || this.workspaceMembers.length === 0) {
            console.log('📁 No file or members to share with');
            return;
        }

        const role = localStorage.getItem('workspace_role');
        if (role !== 'creator') {
            console.log('📁 Only creators can share files');
            return;
        }

        console.log('📤 Sharing file with', this.workspaceMembers.length, 'members...');

        for (const member of this.workspaceMembers) {
            // Skip if member is current user
            if (member.email === this.currentUserEmail) {
                console.log('⏭️ Skipping current user:', member.email);
                continue;
            }

            try {
                // Check if already shared
                const permissionsResponse = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${this.fileId}/permissions?fields=permissions(id,emailAddress)`,
                    {
                        headers: {
                            Authorization: `Bearer ${this.accessToken}`
                        }
                    }
                );

                if (permissionsResponse.ok) {
                    const permissionsData = await permissionsResponse.json();
                    const existingPermission = permissionsData.permissions?.find(p => p.emailAddress === member.email);

                    if (existingPermission) {
                        console.log('✓ Already shared with:', member.email);
                        continue;
                    }
                }

                // Share file with member (writer permission for drive file access)
                const shareResponse = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${this.fileId}/permissions`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${this.accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            type: 'user',
                            role: 'writer', // Drive permission (not app role)
                            emailAddress: member.email
                        })
                    }
                );

                if (shareResponse.ok) {
                    console.log('✓ Shared file with:', member.email);
                } else {
                    const errorText = await shareResponse.text();
                    console.error('❌ Failed to share with:', member.email, errorText);
                }
            } catch (error) {
                console.error('❌ Error sharing with:', member.email, error);
            }
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
            const members = localStorage.getItem('workspace_members') || '[]';
            const activityLog = localStorage.getItem('activity_log') || '[]';

            const backupData = {
                timestamp: new Date().toISOString(),
                version: '1.1',
                workspaceId: this.workspaceId || null,
                data: {
                    transactions: JSON.parse(transactions),
                    currencies: JSON.parse(currencies),
                    defaultCurrency: defaultCurrency,
                    members: JSON.parse(members),
                    activityLog: JSON.parse(activityLog)
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

                // Share file with workspace members if this is a workspace
                if (this.workspaceId && this.workspaceMembers.length > 0) {
                    console.log('📤 Sharing workspace file with members...');
                    await this.shareFileWithMembers();
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

        // Add currencies without placeholder - default will be selected
        select.innerHTML = this.workspaceCurrencies.map(currency =>
            `<option value="${currency.code}">${currency.code} - ${currency.name}</option>`
        ).join('');

        // Set default currency
        if (this.defaultCurrency) {
            select.value = this.defaultCurrency;
            this.setDefaultCurrencyInForm();
        }
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
        if (!this.accessToken) {
            this.showStatus('يرجى تسجيل الدخول أولاً', 'error');
            return;
        }

        try {
            this.showStatus('جاري البحث عن النسخ الاحتياطية...', 'info');

            // Find the backup file first
            await this.findBackupFile();

            if (!this.fileId) {
                this.showStatus('لم يتم العثور على نسخ احتياطية', 'error');
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

            // Show list of revisions for deletion
            await this.showDeletionList(data.revisions.reverse()); // Most recent first

        } catch (error) {
            console.error('Delete backup error:', error);
            this.showStatus('فشل البحث عن النسخ الاحتياطية ✗', 'error');
        }
    }

    async showDeletionList(revisions) {
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
                } else if (response.status === 404) {
                    // Revision was deleted - skip silently
                    return null;
                }
            } catch (error) {
                // Silently skip revisions that can't be loaded (likely just deleted)
                if (error.message && !error.message.includes('404')) {
                    console.error('Error loading revision:', error);
                }
            }
            return null;
        });

        const backups = (await Promise.all(revisionPromises)).filter(b => b !== null);

        if (backups.length === 0) {
            this.showStatus('لم يتم العثور على نسخ احتياطية صالحة', 'error');
            return;
        }

        // Create backup deletion selection UI
        const backupListHTML = backups.map((backup) => {
            const date = new Date(backup.timestamp).toLocaleString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const latestBadge = backup.isLatest ? '<span class="latest-badge">الأحدث</span>' : '';
            const latestWarning = backup.isLatest ? ' (⚠️ هذه النسخة الأحدث)' : '';

            return `
                <div class="backup-item deletion-item">
                    <div class="backup-item-info">
                        <div class="backup-item-date">📅 ${date} ${latestBadge}</div>
                        <div class="backup-item-count">📊 ${backup.transactionCount} معاملة</div>
                    </div>
                    <button class="btn-delete-backup" onclick="window.driveBackup.deleteRevision('${backup.revisionId}', '${date}${latestWarning}')">
                        🗑️ حذف
                    </button>
                </div>
            `;
        }).join('');

        // Show in modal
        const modal = document.getElementById('settingsModal');
        const modalBody = modal.querySelector('.modal-body');

        // Save current content
        const originalContent = modalBody.innerHTML;

        // Show backup deletion list
        modalBody.innerHTML = `
            <div class="backup-list-section">
                <h3>⚠️ حذف النسخ الاحتياطية</h3>
                <p class="backup-description">اختر النسخ الاحتياطية التي تريد حذفها. هذا الإجراء لا يمكن التراجع عنه!</p>
                <div class="backup-list deletion-list">
                    ${backupListHTML}
                </div>
                <button class="btn-modal-secondary" onclick="window.driveBackup.cancelDeletion()">
                    إلغاء
                </button>
                <div id="backupStatus" class="backup-status"></div>
            </div>
        `;

        // Store original content for restore
        this.originalModalContent = originalContent;

        this.showStatus('', 'info'); // Clear status
    }

    cancelDeletion() {
        const modal = document.getElementById('settingsModal');
        const modalBody = modal.querySelector('.modal-body');
        modalBody.innerHTML = this.originalModalContent;
        this.showStatus('', 'info');
    }

    async deleteRevision(revisionId, backupInfo) {
        if (!confirm(`⚠️ تأكيد الحذف\n\nهل تريد حذف هذه النسخة الاحتياطية؟\n\n${backupInfo}\n\nهذا الإجراء لا يمكن التراجع عنه!`)) {
            return;
        }

        // Disable all delete buttons to prevent multiple clicks
        const deleteButtons = document.querySelectorAll('.btn-delete-backup');
        deleteButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });

        try {
            this.showStatus('جاري الحذف...', 'info');

            // Delete the specific revision
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${this.fileId}/revisions/${revisionId}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`
                    }
                }
            );

            if (response.ok || response.status === 204) {
                console.log('✓ Revision deleted successfully');

                if (window.tracker) {
                    window.tracker.showNotification('✓ تم حذف النسخة الاحتياطية');
                }

                // Wait a moment for Google Drive to update, then refresh the deletion list
                this.showStatus('تم الحذف! جاري تحديث القائمة...', 'success');
                setTimeout(() => {
                    this.deleteBackup();
                }, 1500);

            } else if (response.status === 401) {
                this.showStatus('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً', 'error');
                this.signOut();
            } else if (response.status === 403) {
                this.showStatus('❌ لا يمكن حذف هذه النسخة (آخر نسخة محفوظة)', 'error');
                alert('⚠️ لا يمكن حذف آخر نسخة احتياطية متبقية\n\nيجب الاحتفاظ بنسخة واحدة على الأقل في Google Drive.\n\nإذا كنت تريد حذف جميع النسخ، احذف الملف بالكامل من Google Drive مباشرة.');

                // Re-enable delete buttons since operation failed
                const deleteButtons = document.querySelectorAll('.btn-delete-backup');
                deleteButtons.forEach(btn => {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                });
            } else {
                throw new Error(`Failed to delete: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Error deleting revision:', error);
            this.showStatus('فشل حذف النسخة الاحتياطية ✗', 'error');

            // Re-enable delete buttons on error
            const deleteButtons = document.querySelectorAll('.btn-delete-backup');
            deleteButtons.forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            });
        }
    }

    deleteAccount() {
        if (!confirm('⚠️ تحذير: حذف الحساب\n\nهل أنت متأكد من حذف حسابك وجميع البيانات المحلية؟\n\n• سيتم حذف جميع المعاملات المحلية\n• سيتم الخروج من Google Drive\n• لن يتم حذف النسخ الاحتياطية من Google Drive\n\nهذا الإجراء لا يمكن التراجع عنه!')) {
            return;
        }

        // Double confirmation
        if (!confirm('هل أنت متأكد 100%؟ سيتم حذف جميع البيانات المحلية نهائياً!')) {
            return;
        }

        try {
            // Clear all local storage
            localStorage.clear();

            // Clear session storage
            sessionStorage.clear();

            // Reset all variables
            this.accessToken = null;
            this.fileId = null;
            this.workspaceId = null;
            this.currentUserEmail = null;
            this.workspaceCurrencies = [];
            this.workspaceMembers = [];
            this.activityLog = [];

            // Clear UI
            if (window.tracker) {
                window.tracker.transactions = [];
                window.tracker.renderTransactions();
                window.tracker.updateDashboard();
            }

            // Close settings modal
            const modal = document.getElementById('settingsModal');
            if (modal) {
                modal.classList.remove('active');
            }

            // Show sign-in gate
            this.showSignInGate();

            console.log('✓ Account deleted successfully');
        } catch (error) {
            console.error('Error deleting account:', error);
            alert('حدث خطأ أثناء حذف الحساب. يرجى المحاولة مرة أخرى.');
        }
    }

    // Phase 3: Team Collaboration Features

    addCurrentUserToMembers() {
        console.log('👥 Adding current user to members...');
        console.log('Current email from this.currentUserEmail:', this.currentUserEmail);

        if (!this.currentUserEmail) {
            this.currentUserEmail = localStorage.getItem('gdrive_email');
            console.log('Current email from localStorage:', this.currentUserEmail);
        }

        if (!this.currentUserEmail) {
            console.warn('⚠️ Cannot add member: No email found');
            return;
        }

        // Check if current user is already in members list
        const existingMember = this.workspaceMembers.find(m => m.email === this.currentUserEmail);

        if (!existingMember) {
            // Add current user as reader
            const role = localStorage.getItem('workspace_role') || 'reader';
            console.log('➕ Adding new member:', this.currentUserEmail, 'with role:', role);

            this.workspaceMembers.push({
                email: this.currentUserEmail,
                role: role,
                joinedAt: new Date().toISOString()
            });

            localStorage.setItem('workspace_members', JSON.stringify(this.workspaceMembers));
            this.logActivity('joined', 'workspace', 'Joined the workspace');
            this.autoBackup();
        }
    }

    displayMemberManagement() {
        const section = document.getElementById('memberManagementSection');
        const container = document.getElementById('membersList');
        const role = localStorage.getItem('workspace_role');

        if (!section || !container) return;

        // Only show for creators
        if (role === 'creator') {
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
            return;
        }

        // Load members
        const savedMembers = localStorage.getItem('workspace_members');
        if (savedMembers) {
            this.workspaceMembers = JSON.parse(savedMembers);
        }

        if (this.workspaceMembers.length === 0) {
            container.innerHTML = '<p style="color: #808080; text-align: center;">لا يوجد أعضاء بعد</p>';
            return;
        }

        container.innerHTML = this.workspaceMembers.map((member, index) => {
            const joinedDate = new Date(member.joinedAt).toLocaleDateString('ar-EG');
            const roleNames = { creator: 'منشئ', writer: 'كاتب', reader: 'قارئ' };
            const isCreator = member.role === 'creator';

            // Safety checks for email
            const email = member.email || 'مستخدم غير معروف';
            const username = this.getUsernameFromEmail(email);
            const firstChar = email ? email.charAt(0).toUpperCase() : '?';

            return `
                <div class="member-card">
                    <div class="member-icon">${firstChar}</div>
                    <div class="member-info">
                        <div class="member-email">${username || email}</div>
                        <div class="member-joined">انضم في ${joinedDate}</div>
                    </div>
                    ${isCreator ?
                        `<span class="member-role-badge ${member.role}">${roleNames[member.role]}</span>` :
                        `<select class="member-role-select" onchange="window.driveBackup.changeMemberRole(${index}, this.value)">
                            <option value="reader" ${member.role === 'reader' ? 'selected' : ''}>قارئ</option>
                            <option value="writer" ${member.role === 'writer' ? 'selected' : ''}>كاتب</option>
                        </select>`
                    }
                </div>
            `;
        }).join('');
    }

    changeMemberRole(index, newRole) {
        const member = this.workspaceMembers[index];
        const oldRole = member.role;

        if (oldRole === newRole) return;

        member.role = newRole;
        localStorage.setItem('workspace_members', JSON.stringify(this.workspaceMembers));

        this.logActivity('modified', 'member', `Changed ${member.email} role from ${oldRole} to ${newRole}`);
        this.displayMemberManagement();
        this.autoBackup();

        if (window.tracker) {
            window.tracker.showNotification(`✓ تم تغيير صلاحيات ${member.email}`);
        }
    }

    logActivity(action, targetType, description) {
        if (!this.currentUserEmail) {
            this.currentUserEmail = localStorage.getItem('gdrive_email') || 'Unknown User';
        }

        const activity = {
            id: Date.now(),
            user: this.currentUserEmail,
            action: action,
            targetType: targetType,
            description: description,
            timestamp: new Date().toISOString()
        };

        // Load existing log
        const savedLog = localStorage.getItem('activity_log');
        this.activityLog = savedLog ? JSON.parse(savedLog) : [];

        // Add new activity at the beginning
        this.activityLog.unshift(activity);

        // Keep only last 100 activities
        if (this.activityLog.length > 100) {
            this.activityLog = this.activityLog.slice(0, 100);
        }

        localStorage.setItem('activity_log', JSON.stringify(this.activityLog));
        this.displayActivityLog();
    }

    displayActivityLog() {
        const section = document.getElementById('activityLogSection');
        const container = document.getElementById('activityList');

        if (!section || !container) return;

        // Show activity log section for workspace members
        const workspaceId = localStorage.getItem('workspace_id');
        if (workspaceId) {
            section.style.display = 'block';
        }

        // Load activity log
        const savedLog = localStorage.getItem('activity_log');
        this.activityLog = savedLog ? JSON.parse(savedLog) : [];

        if (this.activityLog.length === 0) {
            container.innerHTML = '<p style="color: #808080; text-align: center; padding: 20px;">لا يوجد نشاط بعد</p>';
            return;
        }

        // Show last 20 activities
        const recentActivities = this.activityLog.slice(0, 20);

        container.innerHTML = recentActivities.map(activity => {
            const time = new Date(activity.timestamp);
            const relativeTime = this.getRelativeTime(time);
            const actionClass = activity.action === 'deleted' ? 'deleted' :
                               activity.action === 'modified' ? 'modified' : 'added';

            return `
                <div class="activity-item ${actionClass}">
                    <div class="activity-details">
                        <span class="activity-user">${this.getUsernameFromEmail(activity.user)}</span>
                        <span class="activity-action">${activity.description}</span>
                    </div>
                    <div class="activity-time">${relativeTime}</div>
                </div>
            `;
        }).join('');

        // Setup toggle button
        const toggleBtn = document.getElementById('toggleActivityLog');
        const content = document.getElementById('activityLogContent');

        if (toggleBtn && content) {
            toggleBtn.onclick = () => {
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    toggleBtn.textContent = 'إخفاء';
                } else {
                    content.style.display = 'none';
                    toggleBtn.textContent = 'عرض';
                }
            };
        }
    }

    getRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'الآن';
        if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
        if (diffHours < 24) return `منذ ${diffHours} ساعة`;
        if (diffDays < 7) return `منذ ${diffDays} يوم`;

        return date.toLocaleDateString('ar-EG');
    }

    // World Currencies Management

    getWorldCurrencies() {
        return [
            { code: 'AED', name: 'درهم إماراتي' },
            { code: 'AFN', name: 'أفغاني' },
            { code: 'ALL', name: 'ليك ألباني' },
            { code: 'AMD', name: 'درام أرميني' },
            { code: 'ANG', name: 'غيلدر أنتيلي هولندي' },
            { code: 'AOA', name: 'كوانزا أنغولي' },
            { code: 'ARS', name: 'بيزو أرجنتيني' },
            { code: 'AUD', name: 'دولار أسترالي' },
            { code: 'AWG', name: 'فلورن أروبي' },
            { code: 'AZN', name: 'مانات أذربيجاني' },
            { code: 'BAM', name: 'مارك بوسني' },
            { code: 'BBD', name: 'دولار بربادوسي' },
            { code: 'BDT', name: 'تاكا بنغلاديشي' },
            { code: 'BGN', name: 'ليف بلغاري' },
            { code: 'BHD', name: 'دينار بحريني' },
            { code: 'BIF', name: 'فرنك بوروندي' },
            { code: 'BMD', name: 'دولار برمودي' },
            { code: 'BND', name: 'دولار بروناي' },
            { code: 'BOB', name: 'بوليفيانو بوليفي' },
            { code: 'BRL', name: 'ريال برازيلي' },
            { code: 'BSD', name: 'دولار باهامي' },
            { code: 'BTN', name: 'نغولتروم بوتاني' },
            { code: 'BWP', name: 'بولا بوتسواني' },
            { code: 'BYN', name: 'روبل بيلاروسي' },
            { code: 'BZD', name: 'دولار بليزي' },
            { code: 'CAD', name: 'دولار كندي' },
            { code: 'CDF', name: 'فرنك كونغولي' },
            { code: 'CHF', name: 'فرنك سويسري' },
            { code: 'CLP', name: 'بيزو تشيلي' },
            { code: 'CNY', name: 'يوان صيني' },
            { code: 'COP', name: 'بيزو كولومبي' },
            { code: 'CRC', name: 'كولون كوستاريكي' },
            { code: 'CUP', name: 'بيزو كوبي' },
            { code: 'CVE', name: 'إسكودو الرأس الأخضر' },
            { code: 'CZK', name: 'كرونة تشيكية' },
            { code: 'DJF', name: 'فرنك جيبوتي' },
            { code: 'DKK', name: 'كرونة دنماركية' },
            { code: 'DOP', name: 'بيزو دومينيكاني' },
            { code: 'DZD', name: 'دينار جزائري' },
            { code: 'EGP', name: 'جنيه مصري' },
            { code: 'ERN', name: 'ناكفا إريتري' },
            { code: 'ETB', name: 'بير إثيوبي' },
            { code: 'EUR', name: 'يورو' },
            { code: 'FJD', name: 'دولار فيجي' },
            { code: 'FKP', name: 'جنيه جزر فوكلاند' },
            { code: 'FOK', name: 'كرونة جزر فارو' },
            { code: 'GBP', name: 'جنيه إسترليني' },
            { code: 'GEL', name: 'لاري جورجي' },
            { code: 'GGP', name: 'جنيه غيرنزي' },
            { code: 'GHS', name: 'سيدي غاني' },
            { code: 'GIP', name: 'جنيه جبل طارق' },
            { code: 'GMD', name: 'دالاسي غامبي' },
            { code: 'GNF', name: 'فرنك غيني' },
            { code: 'GTQ', name: 'كتزال غواتيمالي' },
            { code: 'GYD', name: 'دولار غياني' },
            { code: 'HKD', name: 'دولار هونغ كونغ' },
            { code: 'HNL', name: 'ليمبيرا هندوراسي' },
            { code: 'HRK', name: 'كونا كرواتية' },
            { code: 'HTG', name: 'غورد هايتي' },
            { code: 'HUF', name: 'فورنت مجري' },
            { code: 'IDR', name: 'روبية إندونيسية' },
            { code: 'ILS', name: 'شيكل إسرائيلي' },
            { code: 'IMP', name: 'جنيه مانكس' },
            { code: 'INR', name: 'روبية هندية' },
            { code: 'IQD', name: 'دينار عراقي' },
            { code: 'IRR', name: 'ريال إيراني' },
            { code: 'ISK', name: 'كرونة آيسلندية' },
            { code: 'JEP', name: 'جنيه جيرزي' },
            { code: 'JMD', name: 'دولار جامايكي' },
            { code: 'JOD', name: 'دينار أردني' },
            { code: 'JPY', name: 'ين ياباني' },
            { code: 'KES', name: 'شلن كيني' },
            { code: 'KGS', name: 'سوم قرغيزستاني' },
            { code: 'KHR', name: 'ريال كمبودي' },
            { code: 'KID', name: 'دولار كيريباتي' },
            { code: 'KMF', name: 'فرنك قمري' },
            { code: 'KRW', name: 'وون كوري جنوبي' },
            { code: 'KWD', name: 'دينار كويتي' },
            { code: 'KYD', name: 'دولار جزر كايمان' },
            { code: 'KZT', name: 'تنغي كازاخستاني' },
            { code: 'LAK', name: 'كيب لاوسي' },
            { code: 'LBP', name: 'ليرة لبنانية' },
            { code: 'LKR', name: 'روبية سريلانكية' },
            { code: 'LRD', name: 'دولار ليبيري' },
            { code: 'LSL', name: 'لوتي ليسوتو' },
            { code: 'LYD', name: 'دينار ليبي' },
            { code: 'MAD', name: 'درهم مغربي' },
            { code: 'MDL', name: 'ليو مولدوفي' },
            { code: 'MGA', name: 'أرياري مدغشقري' },
            { code: 'MKD', name: 'دينار مقدوني' },
            { code: 'MMK', name: 'كيات ميانماري' },
            { code: 'MNT', name: 'توغروغ منغولي' },
            { code: 'MOP', name: 'باتاكا ماكاوي' },
            { code: 'MRU', name: 'أوقية موريتانية' },
            { code: 'MUR', name: 'روبية موريشيوسية' },
            { code: 'MVR', name: 'روفيه مالديفي' },
            { code: 'MWK', name: 'كواشا ملاوي' },
            { code: 'MXN', name: 'بيزو مكسيكي' },
            { code: 'MYR', name: 'رينغيت ماليزي' },
            { code: 'MZN', name: 'ميتيكال موزمبيقي' },
            { code: 'NAD', name: 'دولار ناميبي' },
            { code: 'NGN', name: 'نايرا نيجيري' },
            { code: 'NIO', name: 'كوردوبا نيكاراغوي' },
            { code: 'NOK', name: 'كرونة نرويجية' },
            { code: 'NPR', name: 'روبية نيبالية' },
            { code: 'NZD', name: 'دولار نيوزيلندي' },
            { code: 'OMR', name: 'ريال عماني' },
            { code: 'PAB', name: 'بالبوا بنمي' },
            { code: 'PEN', name: 'سول بيروفي' },
            { code: 'PGK', name: 'كينا بابوا غينيا الجديدة' },
            { code: 'PHP', name: 'بيزو فلبيني' },
            { code: 'PKR', name: 'روبية باكستانية' },
            { code: 'PLN', name: 'زلوتي بولندي' },
            { code: 'PYG', name: 'غواراني باراغواي' },
            { code: 'QAR', name: 'ريال قطري' },
            { code: 'RON', name: 'ليو روماني' },
            { code: 'RSD', name: 'دينار صربي' },
            { code: 'RUB', name: 'روبل روسي' },
            { code: 'RWF', name: 'فرنك رواندي' },
            { code: 'SAR', name: 'ريال سعودي' },
            { code: 'SBD', name: 'دولار جزر سليمان' },
            { code: 'SCR', name: 'روبية سيشيلية' },
            { code: 'SDG', name: 'جنيه سوداني' },
            { code: 'SEK', name: 'كرونة سويدية' },
            { code: 'SGD', name: 'دولار سنغافوري' },
            { code: 'SHP', name: 'جنيه سانت هيلينا' },
            { code: 'SLE', name: 'ليون سيراليوني' },
            { code: 'SLL', name: 'ليون سيراليوني قديم' },
            { code: 'SOS', name: 'شلن صومالي' },
            { code: 'SRD', name: 'دولار سورينامي' },
            { code: 'SSP', name: 'جنيه جنوب سوداني' },
            { code: 'STN', name: 'دوبرا ساو تومي' },
            { code: 'SYP', name: 'ليرة سورية' },
            { code: 'SZL', name: 'ليلانغيني سوازيلاندي' },
            { code: 'THB', name: 'بات تايلاندي' },
            { code: 'TJS', name: 'سوموني طاجيكي' },
            { code: 'TMT', name: 'مانات تركماني' },
            { code: 'TND', name: 'دينار تونسي' },
            { code: 'TOP', name: 'بانغا تونغي' },
            { code: 'TRY', name: 'ليرة تركية' },
            { code: 'TTD', name: 'دولار ترينيداد وتوباغو' },
            { code: 'TVD', name: 'دولار توفالو' },
            { code: 'TWD', name: 'دولار تايواني' },
            { code: 'TZS', name: 'شلن تنزاني' },
            { code: 'UAH', name: 'هريفنا أوكراني' },
            { code: 'UGX', name: 'شلن أوغندي' },
            { code: 'USD', name: 'دولار أمريكي' },
            { code: 'UYU', name: 'بيزو أوروغواي' },
            { code: 'UZS', name: 'سوم أوزبكي' },
            { code: 'VES', name: 'بوليفار فنزويلي' },
            { code: 'VND', name: 'دونغ فيتنامي' },
            { code: 'VUV', name: 'فاتو فانواتي' },
            { code: 'WST', name: 'تالا ساموي' },
            { code: 'XAF', name: 'فرنك وسط أفريقي' },
            { code: 'XCD', name: 'دولار شرق كاريبي' },
            { code: 'XDR', name: 'حقوق سحب خاصة' },
            { code: 'XOF', name: 'فرنك غرب أفريقي' },
            { code: 'XPF', name: 'فرنك باسيفيكي' },
            { code: 'YER', name: 'ريال يمني' },
            { code: 'ZAR', name: 'راند جنوب أفريقي' },
            { code: 'ZMW', name: 'كواشا زامبي' },
            { code: 'ZWL', name: 'دولار زيمبابوي' }
        ];
    }

    displayWorldCurrencies(filter = '') {
        const container = document.getElementById('worldCurrenciesList');
        if (!container) return;

        const filtered = filter ?
            this.worldCurrencies.filter(c =>
                c.code.toLowerCase().includes(filter.toLowerCase()) ||
                c.name.toLowerCase().includes(filter.toLowerCase())
            ) :
            this.worldCurrencies;

        if (filtered.length === 0) {
            container.innerHTML = '<p style="padding: 20px; text-align: center; color: #808080;">لا توجد نتائج</p>';
            return;
        }

        container.innerHTML = filtered.map(currency => {
            const isAdded = this.workspaceCurrencies.some(c => c.code === currency.code);
            const addedClass = isAdded ? 'added' : '';
            const buttonText = isAdded ? '✓' : '+';

            return `
                <div class="world-currency-item ${addedClass}" onclick="window.driveBackup.addWorldCurrency('${currency.code}', '${currency.name}')">
                    <div class="world-currency-info">
                        <div class="world-currency-code">${currency.code}</div>
                        <div class="world-currency-name">${currency.name}</div>
                    </div>
                    <button class="btn-add-world-currency" ${isAdded ? 'disabled' : ''}>
                        ${buttonText}
                    </button>
                </div>
            `;
        }).join('');
    }

    filterWorldCurrencies(searchTerm) {
        this.displayWorldCurrencies(searchTerm);
    }

    addWorldCurrency(code, name) {
        // Check if already added
        if (this.workspaceCurrencies.some(c => c.code === code)) {
            return;
        }

        this.workspaceCurrencies.push({ code, name });
        localStorage.setItem('workspace_currencies', JSON.stringify(this.workspaceCurrencies));

        // Update displays
        this.displayCurrencies();
        this.populateCurrencySelector();
        this.displayWorldCurrencies();

        // Update filter currencies dropdown
        if (window.tracker) {
            window.tracker.populateFilterCurrencies();
        }

        // Auto-backup to sync currencies
        this.autoBackup();

        if (window.tracker) {
            window.tracker.showNotification(`✓ تمت إضافة ${code}`);
        }
    }

    // Phase 4: Developer/Super Admin Panel Features

    // Super admin email
    isSuperAdmin() {
        const currentEmail = this.currentUserEmail || localStorage.getItem('gdrive_email');
        const SUPER_ADMIN_EMAIL = 'khaled.alhasan4@gmail.com';

        return currentEmail === SUPER_ADMIN_EMAIL;
    }

    showAdminPanel() {
        const adminPanel = document.getElementById('adminPanelSection');

        if (!adminPanel) return;

        // Only show admin panel for super admin (developer)
        if (this.isSuperAdmin()) {
            adminPanel.style.display = 'block';
            this.updateAdminStatistics();
            this.displayAdminUsers();
            this.displayAdminActivityLogs();
        } else {
            adminPanel.style.display = 'none';
        }
    }

    hideRegularAppForAdmin() {
        // Hide all regular app sections for super admin
        const sectionsToHide = [
            'dashboard',
            'add-transaction',
            'transactions-list',
            'activityLogSection'
        ];

        sectionsToHide.forEach(className => {
            const sections = document.querySelectorAll(`.${className}`);
            sections.forEach(section => {
                section.style.display = 'none';
            });
        });

        // Also hide the quick add button
        const quickAddBtn = document.getElementById('quickAddBtn');
        if (quickAddBtn) quickAddBtn.style.display = 'none';
    }

    updateAdminStatistics() {
        // Total members
        const totalMembers = this.workspaceMembers.length;
        document.getElementById('totalMembers').textContent = totalMembers;

        // Total transactions
        const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        document.getElementById('totalTransactions').textContent = transactions.length;

        // Total currencies
        document.getElementById('totalCurrencies').textContent = this.workspaceCurrencies.length;

        // Total activities
        const activityLog = JSON.parse(localStorage.getItem('activity_log') || '[]');
        document.getElementById('totalActivities').textContent = activityLog.length;
    }

    displayAdminUsers() {
        const container = document.getElementById('adminUsersList');
        if (!container) return;

        const savedMembers = localStorage.getItem('workspace_members');
        if (savedMembers) {
            this.workspaceMembers = JSON.parse(savedMembers);
        }

        if (this.workspaceMembers.length === 0) {
            container.innerHTML = '<p style="color: #808080; text-align: center; padding: 20px;">لا يوجد أعضاء</p>';
            return;
        }

        container.innerHTML = this.workspaceMembers.map((member, index) => {
            const joinedDate = new Date(member.joinedAt).toLocaleString('ar-EG', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            const roleNames = { creator: 'منشئ', writer: 'كاتب', reader: 'قارئ' };
            const isCreator = member.role === 'creator';
            const isBlocked = member.blocked || false;

            return `
                <div class="admin-user-card ${isBlocked ? 'blocked' : ''}">
                    <div class="admin-user-avatar">${member.email.charAt(0).toUpperCase()}</div>
                    <div class="admin-user-info">
                        <div class="admin-user-email">${this.getUsernameFromEmail(member.email)}</div>
                        <div class="admin-user-meta">
                            <span class="user-role-badge ${member.role}">${roleNames[member.role]}</span>
                            <span class="user-joined-date">انضم ${joinedDate}</span>
                            ${isBlocked ? '<span class="user-blocked-badge">🚫 محظور</span>' : ''}
                        </div>
                    </div>
                    <div class="admin-user-actions">
                        ${!isCreator ? `
                            <button class="btn-admin-action ${isBlocked ? 'btn-unblock' : 'btn-block'}"
                                    onclick="window.driveBackup.toggleBlockUser(${index})"
                                    title="${isBlocked ? 'إلغاء الحظر' : 'حظر المستخدم'}">
                                ${isBlocked ? '✅ إلغاء الحظر' : '🚫 حظر'}
                            </button>
                            <button class="btn-admin-action btn-remove"
                                    onclick="window.driveBackup.removeUser(${index})"
                                    title="إزالة من مساحة العمل">
                                🗑️ إزالة
                            </button>
                        ` : '<span class="creator-label">👑 مالك مساحة العمل</span>'}
                    </div>
                </div>
            `;
        }).join('');
    }

    toggleBlockUser(index) {
        const member = this.workspaceMembers[index];
        const isCurrentlyBlocked = member.blocked || false;

        if (!confirm(`هل تريد ${isCurrentlyBlocked ? 'إلغاء حظر' : 'حظر'} ${member.email}؟`)) {
            return;
        }

        member.blocked = !isCurrentlyBlocked;
        localStorage.setItem('workspace_members', JSON.stringify(this.workspaceMembers));

        this.logActivity(
            isCurrentlyBlocked ? 'unblocked' : 'blocked',
            'member',
            `${isCurrentlyBlocked ? 'Unblocked' : 'Blocked'} user ${member.email}`
        );

        this.displayAdminUsers();
        this.autoBackup();

        if (window.tracker) {
            window.tracker.showNotification(`✓ تم ${isCurrentlyBlocked ? 'إلغاء حظر' : 'حظر'} ${member.email}`);
        }
    }

    removeUser(index) {
        const member = this.workspaceMembers[index];

        if (!confirm(`⚠️ تحذير\n\nهل أنت متأكد من إزالة ${member.email} من مساحة العمل؟\n\nهذا الإجراء لا يمكن التراجع عنه!`)) {
            return;
        }

        this.workspaceMembers.splice(index, 1);
        localStorage.setItem('workspace_members', JSON.stringify(this.workspaceMembers));

        this.logActivity('removed', 'member', `Removed user ${member.email} from workspace`);

        this.displayAdminUsers();
        this.displayMemberManagement();
        this.updateAdminStatistics();
        this.autoBackup();

        if (window.tracker) {
            window.tracker.showNotification(`✓ تم إزالة ${member.email} من مساحة العمل`);
        }
    }

    displayAdminActivityLogs() {
        const container = document.getElementById('adminActivityList');
        if (!container) return;

        // Load activity log
        const savedLog = localStorage.getItem('activity_log');
        this.activityLog = savedLog ? JSON.parse(savedLog) : [];

        // Populate user filter
        this.populateAdminLogFilters();

        // Display logs (initially unfiltered)
        this.currentLogPage = 1;
        this.logsPerPage = 50;
        this.filteredActivityLog = [...this.activityLog];
        this.renderAdminActivityLogs();
    }

    populateAdminLogFilters() {
        const userFilter = document.getElementById('logUserFilter');
        if (!userFilter) return;

        // Get unique users from activity log
        const uniqueUsers = [...new Set(this.activityLog.map(a => a.user))];

        const currentValue = userFilter.value;
        userFilter.innerHTML = '<option value="">جميع المستخدمين</option>' +
            uniqueUsers.map(user => `<option value="${user}">${user}</option>`).join('');
        userFilter.value = currentValue;
    }

    renderAdminActivityLogs() {
        const container = document.getElementById('adminActivityList');
        if (!container) return;

        if (this.filteredActivityLog.length === 0) {
            container.innerHTML = '<p style="color: #808080; text-align: center; padding: 30px;">لا توجد سجلات</p>';
            this.updateAdminLogPagination();
            return;
        }

        const startIndex = (this.currentLogPage - 1) * this.logsPerPage;
        const endIndex = startIndex + this.logsPerPage;
        const pageItems = this.filteredActivityLog.slice(startIndex, endIndex);

        container.innerHTML = pageItems.map(activity => {
            const time = new Date(activity.timestamp);
            const formattedTime = time.toLocaleString('ar-EG', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const relativeTime = this.getRelativeTime(time);

            const actionIcons = {
                'added': '➕',
                'modified': '✏️',
                'deleted': '🗑️',
                'joined': '🚪',
                'created': '🆕',
                'blocked': '🚫',
                'unblocked': '✅',
                'removed': '❌'
            };
            const icon = actionIcons[activity.action] || '📝';

            return `
                <div class="admin-log-item action-${activity.action}">
                    <div class="log-icon">${icon}</div>
                    <div class="log-details">
                        <div class="log-user">${this.getUsernameFromEmail(activity.user)}</div>
                        <div class="log-description">${activity.description}</div>
                        <div class="log-meta">
                            <span class="log-type">${activity.targetType}</span>
                            <span class="log-time" title="${formattedTime}">${relativeTime}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.updateAdminLogPagination();
    }

    updateAdminLogPagination() {
        const totalPages = Math.ceil(this.filteredActivityLog.length / this.logsPerPage);
        const pageInfo = document.getElementById('logPageInfo');
        const prevBtn = document.getElementById('prevLogPage');
        const nextBtn = document.getElementById('nextLogPage');

        if (pageInfo) {
            pageInfo.textContent = `صفحة ${this.currentLogPage} من ${totalPages || 1}`;
        }

        if (prevBtn) {
            prevBtn.disabled = this.currentLogPage === 1;
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentLogPage === totalPages || totalPages === 0;
        }
    }

    applyAdminLogFilters() {
        const userFilter = document.getElementById('logUserFilter').value;
        const actionFilter = document.getElementById('logActionFilter').value;
        const targetFilter = document.getElementById('logTargetFilter').value;
        const dateFromFilter = document.getElementById('logDateFromFilter').value;
        const dateToFilter = document.getElementById('logDateToFilter').value;

        this.filteredActivityLog = this.activityLog.filter(activity => {
            if (userFilter && activity.user !== userFilter) return false;
            if (actionFilter && activity.action !== actionFilter) return false;
            if (targetFilter && activity.targetType !== targetFilter) return false;

            const activityDate = new Date(activity.timestamp);
            if (dateFromFilter) {
                const fromDate = new Date(dateFromFilter);
                if (activityDate < fromDate) return false;
            }
            if (dateToFilter) {
                const toDate = new Date(dateToFilter);
                toDate.setHours(23, 59, 59);
                if (activityDate > toDate) return false;
            }

            return true;
        });

        this.currentLogPage = 1;
        this.renderAdminActivityLogs();

        if (window.tracker) {
            window.tracker.showNotification(`✓ تم تطبيق الفلاتر: ${this.filteredActivityLog.length} سجل`);
        }
    }

    resetAdminLogFilters() {
        document.getElementById('logUserFilter').value = '';
        document.getElementById('logActionFilter').value = '';
        document.getElementById('logTargetFilter').value = '';
        document.getElementById('logDateFromFilter').value = '';
        document.getElementById('logDateToFilter').value = '';

        this.filteredActivityLog = [...this.activityLog];
        this.currentLogPage = 1;
        this.renderAdminActivityLogs();

        if (window.tracker) {
            window.tracker.showNotification('✓ تم إعادة تعيين الفلاتر');
        }
    }

    exportAdminLogs() {
        if (this.activityLog.length === 0) {
            alert('لا توجد سجلات لتصديرها');
            return;
        }

        // Convert to CSV
        const headers = ['الوقت', 'المستخدم', 'الحدث', 'النوع', 'الوصف'];
        const rows = this.activityLog.map(activity => [
            new Date(activity.timestamp).toLocaleString('ar-EG'),
            activity.user,
            activity.action,
            activity.targetType,
            activity.description
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Download
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        if (window.tracker) {
            window.tracker.showNotification('✓ تم تصدير السجلات');
        }
    }

    clearAdminLogs() {
        if (!confirm('⚠️ تحذير\n\nهل أنت متأكد من حذف جميع السجلات؟\n\nهذا الإجراء لا يمكن التراجع عنه!')) {
            return;
        }

        if (!confirm('هل أنت متأكد 100%؟ سيتم حذف جميع سجلات النشاط نهائياً!')) {
            return;
        }

        this.activityLog = [];
        localStorage.setItem('activity_log', JSON.stringify(this.activityLog));

        this.filteredActivityLog = [];
        this.renderAdminActivityLogs();
        this.updateAdminStatistics();
        this.autoBackup();

        if (window.tracker) {
            window.tracker.showNotification('✓ تم حذف جميع السجلات');
        }
    }

    nextLogPage() {
        const totalPages = Math.ceil(this.filteredActivityLog.length / this.logsPerPage);
        if (this.currentLogPage < totalPages) {
            this.currentLogPage++;
            this.renderAdminActivityLogs();
        }
    }

    prevLogPage() {
        if (this.currentLogPage > 1) {
            this.currentLogPage--;
            this.renderAdminActivityLogs();
        }
    }

    // Initialize admin panel event listeners
    setupAdminEventListeners() {
        // Apply log filters button
        const applyLogFiltersBtn = document.getElementById('applyLogFilters');
        applyLogFiltersBtn?.addEventListener('click', () => this.applyAdminLogFilters());

        // Reset log filters button
        const resetLogFiltersBtn = document.getElementById('resetLogFilters');
        resetLogFiltersBtn?.addEventListener('click', () => this.resetAdminLogFilters());

        // Export logs button
        const exportLogsBtn = document.getElementById('exportLogsBtn');
        exportLogsBtn?.addEventListener('click', () => this.exportAdminLogs());

        // Clear logs button
        const clearLogsBtn = document.getElementById('clearLogsBtn');
        clearLogsBtn?.addEventListener('click', () => this.clearAdminLogs());

        // Pagination buttons
        const prevLogPageBtn = document.getElementById('prevLogPage');
        prevLogPageBtn?.addEventListener('click', () => this.prevLogPage());

        const nextLogPageBtn = document.getElementById('nextLogPage');
        nextLogPageBtn?.addEventListener('click', () => this.nextLogPage());
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
