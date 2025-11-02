// Configuration file - Just update CLIENT_ID once and you're done!
const CONFIG = {
    // TODO: Replace with your Google OAuth Client ID
    // Get it from: https://console.cloud.google.com/apis/credentials
    GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com',

    // No other configuration needed!
    // The app will automatically work once deployed with the Client ID above
};

// Auto-detect if running locally or in production
CONFIG.IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Export config
window.APP_CONFIG = CONFIG;
