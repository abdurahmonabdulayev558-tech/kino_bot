const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// 1. SOZLAMALAR
const token = '8625932620:AAFE1da95Vp8UZJtmuPYOxEPhzuviCCVsZQ'; // Tokenni shu yerga yozing
const bot = new TelegramBot(token, { polling: true });
const ADMIN_IDS = [7917949181,1039979240]; // Admin ID-ingiz

const DB_FILES = {
    users: 'users.json',
    kinolar: 'kinolar.json',
    kanallar: 'kanallar.json'
};

// 2. FUNKSIYALAR (Xatolik chiqmasligi uchun yuqorida bo'lishi shart)
function loadDB(file) {
    if (!fs.existsSync(file)) return file.includes('users') ? {} : [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveDB(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 4));
}

function isAdmin(id) {
    return ADMIN_IDS.includes(id);
}

// 3. ASOSIY LOGIKA
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Foydalanuvchini saqlash
    let users = loadDB(DB_FILES.users);
    if (!users[chatId]) {
        users[chatId] = { name: msg.from.first_name };
        saveDB(DB_FILES.users, users);
    }

    if (text === '/start') {
        return bot.sendMessage(chatId, "Xush kelibsiz! Kino kodini yuboring.", {
            reply_markup: {
                keyboard: [['🔍 Kino qidirish', '📊 Statistika']],
                resize_keyboard: true
            }
        });
    }

    if (text === '📊 Statistika') {
        const u = Object.keys(loadDB(DB_FILES.users)).length;
        const k = loadDB(DB_FILES.kinolar).length;
        return bot.sendMessage(chatId, `Azolar: ${u}\nKinolar: ${k}`);
    }

    // Kino qo'shish (Admin uchun)
    if (isAdmin(chatId) && msg.video) {
        const cap = msg.caption;
        if (!cap) return bot.sendMessage(chatId, "Kino kodi va nomini yozing!");
        const [code, ...nameParts] = cap.split(' ');
        let kinolar = loadDB(DB_FILES.kinolar);
        kinolar.push({ code, name: nameParts.join(' '), file_id: msg.video.file_id });
        saveDB(DB_FILES.kinolar, kinolar);
        return bot.sendMessage(chatId, "✅ Saqlandi!");
    }

    // Kino qidirish (Faqat raqam bo'lsa)
    if (text && !isNaN(text)) {
        const kinolar = loadDB(DB_FILES.kinolar);
        const k = kinolar.find(x => x.code === text);
        if (k) {
            return bot.sendVideo(chatId, k.file_id, { caption: k.name });
        } else {
            return bot.sendMessage(chatId, "❌ Topilmadi.");
        }
    }
});

console.log("🚀 Professional Gigant Bot ishga tushdi!");
