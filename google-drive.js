// Google Drive Integration for Backup/Restore
class GoogleDriveBackup {
    constructor() {
        // Get Client ID from config
        this.CLIENT_ID = window.APP_CONFIG?.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
        this.BACKUP_FILENAME = 'trade-tracker-backup.json';
        this.accessToken = null;
        this.fileId = null;

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
        // Wait for Google API to load
        window.addEventListener('load', () => {
            this.setupEventListeners();
        });
    }

    setupEventListeners() {
        console.log('Setting up Google Drive event listeners...');
        console.log('Client ID:', this.CLIENT_ID);

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
    }

    updateUISignedIn(email) {
        document.getElementById('signInBtn').style.display = 'none';
        document.getElementById('signedInControls').style.display = 'flex';
        document.getElementById('userEmail').textContent = email;
    }

    updateUISignedOut() {
        document.getElementById('signInBtn').style.display = 'inline-block';
        document.getElementById('signedInControls').style.display = 'none';
    }

    async backup() {
        if (!this.accessToken) {
            this.showStatus('يرجى تسجيل الدخول أولاً', 'error');
            return;
        }

        try {
            this.showStatus('جاري النسخ الاحتياطي...', 'info');

            // Get current data from localStorage
            const transactions = localStorage.getItem('transactions') || '[]';
            const backupData = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                data: {
                    transactions: JSON.parse(transactions)
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
                const date = new Date().toLocaleString('ar-EG');
                this.showStatus(`✓ تم النسخ الاحتياطي بنجاح (${date})`, 'success');
            } else {
                throw new Error('Backup failed');
            }
        } catch (error) {
            console.error('Backup error:', error);
            this.showStatus('فشل النسخ الاحتياطي ✗', 'error');
        }
    }

    async restore() {
        if (!this.accessToken) {
            this.showStatus('يرجى تسجيل الدخول أولاً', 'error');
            return;
        }

        if (!confirm('هل تريد استعادة النسخة الاحتياطية؟ سيتم استبدال البيانات الحالية.')) {
            return;
        }

        try {
            this.showStatus('جاري الاستعادة...', 'info');

            // Find the backup file
            await this.findBackupFile();

            if (!this.fileId) {
                this.showStatus('لم يتم العثور على نسخة احتياطية', 'error');
                return;
            }

            // Download the file
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`,
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`
                    }
                }
            );

            if (!response.ok) {
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

                const date = new Date(backupData.timestamp).toLocaleString('ar-EG');
                this.showStatus(`✓ تم استعادة البيانات (${date})`, 'success');
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
        statusEl.textContent = message;
        statusEl.className = `backup-status ${type}`;

        setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'backup-status';
        }, 5000);
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
