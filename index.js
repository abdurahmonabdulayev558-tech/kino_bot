const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ==========================================
// 1. SOZLAMALAR
// ==========================================
const token = '8625932620:AAHDPov-MZgUaqD2Fv5U5FUdZErDZ4J-vVQ'; 
const bot = new TelegramBot(token, { polling: true });
const ADMIN_IDS = [7917949181, 1039979240]; // Admin ID larini shu yerga yozing

const DB_FILES = {
    users: 'users.json',
    kinolar: 'kinolar.json',
    kanallar: 'kanallar.json'
};

// Bazalarni yaratish
Object.values(DB_FILES).forEach(file => {
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(file === 'users.json' ? {} : []));
});

const loadDB = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const saveDB = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 4));
const isAdmin = (id) => ADMIN_IDS.includes(id);

// ==========================================
// 2. KLAVIATURALAR
// ==========================================
const mainMenu = {
    reply_markup: {
        keyboard: [
            ['🔍 Kino qidirish', '🎲 Tasodifiy kino'],
            ['📊 Statistika', '👤 Profil'],
            ['📢 Kanalimiz', '👨‍💻 Admin Panel']
        ],
        resize_keyboard: true
    }
};

const adminMenu = {
    reply_markup: {
        keyboard: [
            ['📢 Reklama', '➕ Kanal qo\'shish'],
            ['➖ Kanal o\'chirish', '🏠 Asosiy menyu']
        ],
        resize_keyboard: true
    }
};

// ==========================================
// 3. ASOSIY LOGIKA
// ==========================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Foydalanuvchini ro'yxatga olish
    let users = loadDB(DB_FILES.users);
    if (!users[chatId]) {
        users[chatId] = { name: msg.from.first_name };
        saveDB(DB_FILES.users, users);
    }

    if (text === '/start' || text === '🏠 Asosiy menyu') {
        return bot.sendMessage(chatId, "Xush kelibsiz! Kino kodini yuboring.", mainMenu);
    }

    // Admin Panelga kirish
    if (text === '👨‍💻 Admin Panel' && isAdmin(chatId)) {
        return bot.sendMessage(chatId, "🛠 Admin panelga xush kelibsiz:", adminMenu);
    }

    // Statistika
    if (text === '📊 Statistika') {
        const u = Object.keys(loadDB(DB_FILES.users)).length;
        const k = loadDB(DB_FILES.kinolar).length;
        return bot.sendMessage(chatId, `👥 Azolar: ${u}\n🎬 Kinolar: ${k}`);
    }

    // Reklama tarqatish (Faqat adminlar uchun)
    if (text === '📢 Reklama' && isAdmin(chatId)) {
        return bot.sendMessage(chatId, "Menga reklama postini yuboring (text, rasm yoki video).");
    }

    // Kino qo'shish (Video yuborilganda)
    if (msg.video && isAdmin(chatId)) {
        const cap = msg.caption;
        if (!cap) return bot.sendMessage(chatId, "⚠️ Videoga 'kod nomi' deb izoh yozing!");
        const [code, ...name] = cap.split(' ');
        let kinolar = loadDB(DB_FILES.kinolar);
        kinolar.push({ code, name: name.join(' '), file_id: msg.video.file_id });
        saveDB(DB_FILES.kinolar, kinolar);
        return bot.sendMessage(chatId, `✅ Kino saqlandi! Kod: ${code}`);
    }

    // Kod bilan qidirish
    if (text && !isNaN(text)) {
        const kinolar = loadDB(DB_FILES.kinolar);
        const k = kinolar.find(x => x.code === text);
        if (k) return bot.sendVideo(chatId, k.file_id, { caption: k.name });
        return bot.sendMessage(chatId, "❌ Topilmadi.");
    }
});

console.log("🚀 Professional Gigant Bot ishga tushdi!");
