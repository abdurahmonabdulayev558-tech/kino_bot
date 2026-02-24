const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ==========================================
// 1. ASOSIY SOZLAMALAR
// ==========================================
const token = '8625932620:AAFE1da95Vp8UZJtmuPYOxEPhzuviCCVsZQ'; 
const bot = new TelegramBot(token, { polling: true });
const ADMIN_IDS = [7917949181,1039979240]; // O'z ID-ingizni kiriting

const DB_FILES = {
    users: 'users.json',
    kinolar: 'kinolar.json',
    kanallar: 'kanallar.json',
    blacklist: 'blacklist.json'
};

// Bazalarni tekshirish
Object.values(DB_FILES).forEach(file => {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(file === 'users.json' ? {} : []));
    }
});

// Funksiyalar (Xatoliklarni oldini olish uchun)
const loadDB = (file) => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { return file.includes('users') ? {} : []; }
};
const saveDB = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 4));
const isAdmin = (id) => ADMIN_IDS.includes(id);

// ==========================================
// 2. KLAVIATURALAR VA MENYULAR
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
            ['📢 Reklama yuborish', '➕ Kanal qo\'shish'],
            ['➖ Kanal o\'chirish', '🚫 Bloklash'],
            ['🏠 Asosiy menyu']
        ],
        resize_keyboard: true
    }
};

// ==========================================
// 3. MAJBURIY OBUNA MEXANIZMI
// ==========================================
async function checkSub(userId) {
    if (isAdmin(userId)) return true;
    const channels = loadDB(DB_FILES.kanallar);
    if (channels.length === 0) return true;
    for (const ch of channels) {
        try {
            const res = await bot.getChatMember(ch.id, userId);
            if (['left', 'kicked'].includes(res.status)) return false;
        } catch (e) { continue; }
    }
    return true;
}

// ==========================================
// 4. ASOSIY LOGIKA
// ==========================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    // Qora ro'yxat tekshiruvi
    const blacklist = loadDB(DB_FILES.blacklist);
    if (blacklist.includes(userId)) return;

    // Foydalanuvchini ro'yxatga olish
    let users = loadDB(DB_FILES.users);
    if (!users[userId]) {
        users[userId] = { name: msg.from.first_name, date: new Date().toISOString() };
        saveDB(DB_FILES.users, users);
    }

    // Obuna tekshiruvi
    const isSub = await checkSub(userId);
    if (!isSub && text !== '/start') {
        const chans = loadDB(DB_FILES.kanallar);
        const btn = chans.map(c => [{ text: c.name, url: c.link }]);
        btn.push([{ text: "✅ Tekshirish", callback_data: "verify" }]);
        return bot.sendMessage(chatId, "❌ Botdan foydalanish uchun kanallarimizga a'zo bo'ling!", {
            reply_markup: { inline_keyboard: btn }
        });
    }

    // --- TUGMALAR ---
    if (text === '/start' || text === '🏠 Asosiy menyu') {
        return bot.sendMessage(chatId, `Salom ${msg.from.first_name}! 🎬`, mainMenu);
    }

    if (text === '📊 Statistika') {
        const u = Object.keys(loadDB(DB_FILES.users)).length;
        const k = loadDB(DB_FILES.kinolar).length;
        return bot.sendMessage(chatId, `📊 **Statistika:**\n👥 Azolar: ${u}\n🎬 Kinolar: ${k}`);
    }

    if (text === '👤 Profil') {
        return bot.sendMessage(chatId, `👤 **Profilingiz:**\n🆔 ID: ${userId}\n👤 Ism: ${msg.from.first_name}`);
    }

    if (text === '🔍 Kino qidirish') {
        return bot.sendMessage(chatId, "🎬 Kino kodini yuboring (Masalan: 101):");
    }

    if (text === '👨+💻 Admin Panel' && isAdmin(userId)) {
        return bot.sendMessage(chatId, "🛠 Admin menyusi:", adminMenu);
    }

    // --- ADMIN: KINO QO'SHISH ---
    if (isAdmin(userId) && msg.video) {
        const cap = msg.caption;
        if (!cap) return bot.sendMessage(chatId, "⚠️ Videoga 'kod nomi' yozing!");
        const [code, ...nameParts] = cap.split(' ');
        let kinolar = loadDB(DB_FILES.kinolar);
        kinolar.push({ code, name: nameParts.join(' '), file_id: msg.video.file_id });
        saveDB(DB_FILES.kinolar, kinolar);
        return bot.sendMessage(chatId, `✅ Saqlandi! Kod: ${code}`);
    }

    // --- ADMIN: REKLAMA ---
    if (text === '📢 Reklama yuborish' && isAdmin(userId)) {
        return bot.sendMessage(chatId, "Menga reklama postini yuboring (rasm, video yoki matn).");
    }

    // --- KOD BILAN QIDIRISH ---
    if (text && !isNaN(text)) {
        const kinolar = loadDB(DB_FILES.kinolar);
        const k = kinolar.find(x => x.code === text);
        if (k) {
            return bot.sendVideo(chatId, k.file_id, { caption: `🎬 **Nomi:** ${k.name}\n🆔 **Kod:** ${k.code}` });
        } else {
            return bot.sendMessage(chatId, "❌ Kechirasiz, bunday kodli kino topilmadi.");
        }
    }
});

// Inline tugmalar uchun (verify)
bot.on('callback_query', async (q) => {
    if (q.data === 'verify') {
        const ok = await checkSub(q.from.id);
        if (ok) {
            bot.deleteMessage(q.message.chat.id, q.message.message_id);
            bot.sendMessage(q.message.chat.id, "✅ Tayyor! Kino kodini yuboring.", mainMenu);
        } else {
            bot.answerCallbackQuery(q.id, { text: "❌ Hali a'zo emassiz!", show_alert: true });
        }
    }
});

console.log("🚀 Professional Gigant Bot ishga tushdi!");
