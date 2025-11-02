// Configuration file - Google Drive integration configured!
const CONFIG = {
    // Google OAuth Client ID
    GOOGLE_CLIENT_ID: '441953616159-sdognfjd3p2qih8ro0em7lm9vnjiuho3.apps.googleusercontent.com',

    // No other configuration needed!
    // The app will automatically work once deployed with the Client ID above
};

// Auto-detect if running locally or in production
CONFIG.IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Export config
window.APP_CONFIG = CONFIG;
