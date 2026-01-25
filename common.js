// ==================== ОБЩИЕ ПЕРЕМЕННЫЕ ====================
const BOT_TOKEN = '8212269748:AAFog811LFiMRQZuAeMFZxGHOHm3rhxduQY';
const ADMIN_CHAT_ID = '8155919358';
const YOUR_WALLET_ADDRESS = 'UQBKY-FkAwXlWkaZ9bNunXkGO5iChsGLyeTHhjIVthgFXwUh';
const WITHDRAW_FEE_PERCENT = 5;

// Общее состояние
let appState = {
    balance: parseInt(localStorage.getItem('balance')) || 1500,
    username: localStorage.getItem('username') || 'Гость',
    betsHistory: JSON.parse(localStorage.getItem('betsHistory')) || [],
    minesGameHistory: JSON.parse(localStorage.getItem('minesGameHistory')) || [],
    crashGameHistory: JSON.parse(localStorage.getItem('crashGameHistory')) || [],
    withdrawHistory: JSON.parse(localStorage.getItem('withdrawHistory')) || [],
    referralData: JSON.parse(localStorage.getItem('referralData')) || {
        isPartner: false,
        referralCode: 'REF' + Math.random().toString(36).substr(2, 8).toUpperCase(),
        referralLink: '',
        totalEarnings: 0,
        availableToWithdraw: 0,
        referrals: [],
        referralStats: {
            totalReferrals: 0,
            totalGames: 0,
            totalDeposits: 0,
            totalWithdrawals: 0,
            totalLoss: 0
        }
    }
};

// ==================== ОБЩИЕ ФУНКЦИИ ====================
function updateBalance(amount) {
    appState.balance += amount;
    localStorage.setItem('balance', appState.balance);
    if (typeof updateBalanceDisplay === 'function') {
        updateBalanceDisplay();
    }
    return appState.balance;
}

function getBalance() {
    return appState.balance;
}

function addToHistory(game, bet, win, multiplier = 0, amount = 0) {
    const record = {
        game: game,
        bet: bet,
        win: win,
        multiplier: multiplier,
        amount: win ? amount : 0,
        timestamp: Date.now()
    };
    
    appState.betsHistory.push(record);
    localStorage.setItem('betsHistory', JSON.stringify(appState.betsHistory));
    
    // Также сохраняем в историю конкретной игры
    if (game === 'mines') {
        appState.minesGameHistory.push(record);
        localStorage.setItem('minesGameHistory', JSON.stringify(appState.minesGameHistory));
    } else if (game === 'crash') {
        appState.crashGameHistory.push(record);
        localStorage.setItem('crashGameHistory', JSON.stringify(appState.crashGameHistory));
    }
    
    return record;
}

function getStats() {
    const allGames = [...appState.betsHistory];
    const totalGames = allGames.length;
    const totalWins = allGames.filter(game => game.win).length;
    const totalLosses = totalGames - totalWins;
    
    let totalProfit = 0;
    let totalLoss = 0;
    
    allGames.forEach(game => {
        if (game.win) {
            totalProfit += game.amount || (game.bet * (game.multiplier || 2));
        } else {
            totalLoss += game.bet;
        }
    });
    
    const netProfit = totalProfit - totalLoss;
    const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
    
    return {
        totalGames,
        totalWins,
        totalLosses,
        totalProfit,
        totalLoss,
        netProfit,
        winRate
    };
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(-50%) translateY(-100px)';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

function shortenAddress(address) {
    return address ? address.substring(0, 6) + '...' + address.substring(address.length - 4) : '';
}

// ==================== ИНИЦИАЛИЗАЦИЯ TON CONNECT ====================
let tonConnectUI = null;
let isWalletConnected = false;
let connectedWalletAddress = null;

function initTonConnect() {
    const manifestUrl = window.location.origin + '/tonconnect-manifest.json';
    
    tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: manifestUrl,
        buttonRootId: 'tonconnect-button',
        actionsConfiguration: {
            twaReturnUrl: 'https://t.me/DiceCasinoBot'
        }
    });
    
    tonConnectUI.onStatusChange(wallet => {
        if (wallet) {
            isWalletConnected = true;
            connectedWalletAddress = wallet.account.address;
            if (typeof onWalletConnected === 'function') {
                onWalletConnected(wallet.account.address);
            }
        } else {
            isWalletConnected = false;
            connectedWalletAddress = null;
        }
    });
    
    return tonConnectUI;
}

function getTonConnectUI() {
    return tonConnectUI;
}

function getWalletAddress() {
    return connectedWalletAddress;
}

function isWalletConnected() {
    return isWalletConnected;
}

// ==================== РЕФЕРАЛЬНАЯ СИСТЕМА ====================
function updateReferralData(newData) {
    appState.referralData = { ...appState.referralData, ...newData };
    localStorage.setItem('referralData', JSON.stringify(appState.referralData));
}

function getReferralData() {
    return appState.referralData;
}

// ==================== ВЫВОД СРЕДСТВ ====================
async function sendWithdrawRequest(amount, address) {
    const fee = Math.ceil(amount * (WITHDRAW_FEE_PERCENT / 100));
    const netAmount = amount - fee;
    
    const withdrawId = Date.now();
    const withdrawRequest = {
        id: withdrawId,
        amount: amount,
        netAmount: netAmount,
        fee: fee,
        address: address,
        timestamp: Date.now(),
        status: 'pending'
    };
    
    appState.withdrawHistory.push(withdrawRequest);
    localStorage.setItem('withdrawHistory', JSON.stringify(appState.withdrawHistory));
    
    // Отправка в Telegram
    try {
        const message = `
🎰 *НОВАЯ ЗАЯВКА НА ВЫВОД #${withdrawId}*

👤 *Пользователь:* ${appState.username}
💰 *Сумма:* ${amount} TON
💸 *К выплате:* ${netAmount} TON
📝 *Комиссия:* ${fee} TON (${WITHDRAW_FEE_PERCENT}%)
📍 *Адрес:* \`${address}\`
📊 *Баланс до:* ${appState.balance + amount} TON
📊 *Баланс после:* ${appState.balance} TON
⏰ *Время:* ${new Date().toLocaleString('ru-RU')}

🆔 *ID заявки:* ${withdrawId}
        `.trim();
        
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: ADMIN_CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '✅ Выплачено',
                                callback_data: `withdraw_approve_${withdrawId}`
                            },
                            {
                                text: '❌ Отклонить',
                                callback_data: `withdraw_reject_${withdrawId}`
                            }
                        ]
                    ]
                }
            })
        });
        
        return { success: true, id: withdrawId };
    } catch (error) {
        console.error('Ошибка отправки:', error);
        return { success: false, error: error.message };
    }
}

function getWithdrawHistory() {
    return appState.withdrawHistory;
}

// Экспортируем функции в глобальную область видимости
window.appState = appState;
window.updateBalance = updateBalance;
window.getBalance = getBalance;
window.addToHistory = addToHistory;
window.getStats = getStats;
window.showNotification = showNotification;
window.shortenAddress = shortenAddress;
window.initTonConnect = initTonConnect;
window.getTonConnectUI = getTonConnectUI;
window.getWalletAddress = getWalletAddress;
window.isWalletConnected = isWalletConnected;
window.updateReferralData = updateReferralData;
window.getReferralData = getReferralData;
window.sendWithdrawRequest = sendWithdrawRequest;
window.getWithdrawHistory = getWithdrawHistory;
