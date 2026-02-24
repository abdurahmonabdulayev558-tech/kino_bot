const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// ==========================================
// 1. ASOSIY SOZLAMALAR VA ADMINLAR
// ==========================================
const token = '8625932620:AAFE1da95Vp8UZJtmuPYOxEPhzuviCCVsZQ'; 
const bot = new TelegramBot(token, { polling: true });

// Adminlar ro'yxati (Istalgacha ID qo'shish mumkin)
const ADMIN_IDS = [7917949181, 1039979240]; 

const DB_FILES = {
    users: 'users.json',
    kinolar: 'kinolar.json',
    kanallar: 'kanallar.json',
    blacklist: 'blacklist.json'
};

// Fayllarni tekshirish va xatosiz yaratish
Object.values(DB_FILES).forEach(file => {
    if (!fs.existsSync(file)) {
        const initial = (file === 'users.json') ? {} : [];
        fs.writeFileSync(file, JSON.stringify(initial));
    }
});

// Ma'lumotlarni yuklash/saqlash funksiyalari
function load(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) { return file.includes('users') ? {} : []; }
}

function save(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 4));
}

function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

// ==========================================
// 2. MAJBURIY OBUNA VA KLAVIATURALAR
// ==========================================
async function checkSub(userId) {
    if (isAdmin(userId)) return true;
    const channels = load(DB_FILES.kanallar);
    if (channels.length === 0) return true;
    
    for (const ch of channels) {
        try {
            const res = await bot.getChatMember(ch.id, userId);
            if (['left', 'kicked', 'restricted'].includes(res.status)) return false;
        } catch (e) { continue; }
    }
    return true;
}

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
            ['➖ Kanalni o\'chirish', '🚫 Bloklash'],
            ['🏠 Asosiy menyu']
        ],
        resize_keyboard: true
    }
};

// ==========================================
// 3. ASOSIY LOGIKA (MESSAGE HANDLING)
// ==========================================

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    // Qora ro'yxatni tekshirish
    const blacklist = load(DB_FILES.blacklist);
    if (blacklist.includes(userId)) return;

    // Foydalanuvchini ro'yxatga olish
    let users = load(DB_FILES.users);
    if (!users[userId]) {
        users[userId] = { name: msg.from.first_name, date: new Date().toISOString() };
        save(DB_FILES.users, users);
    }

    // Majburiy obuna tekshiruvi
    const isSub = await checkSub(userId);
    if (!isSub && text !== '/start') {
        const chans = load(DB_FILES.kanallar);
        const btn = chans.map(c => [{ text: c.name, url: c.link }]);
        btn.push([{ text: "✅ Tekshirish", callback_data: "verify" }]);
        return bot.sendMessage(chatId, "⚠️ Botdan foydalanish uchun kanallarga a'zo bo'ling!", {
            reply_markup: { inline_keyboard: btn }
        });
    }

    // --- TUGMALAR LOGIKASI ---
    if (text === '/start' || text === '🏠 Asosiy menyu') {
        return bot.sendMessage(chatId, `Assalomu alaykum, ${msg.from.first_name}! 🎬`, mainMenu);
    }

    if (text === '📊 Statistika') {
        const u = Object.keys(load(DB_FILES.users)).length;
        const k = load(DB_FILES.kinolar).length;
        return bot.sendMessage(chatId, `📊 **Statistika:**\n\n👥 Azolar: ${u}\n🎬 Kinolar: ${k}`);
    }

    if (text === '👤 Profil') {
        return bot.sendMessage(chatId, `👤 **Sizning ma'lumotlaringiz:**\n\n🆔 ID: ${userId}\n👤 Ism: ${msg.from.first_name}`);
    }

    if (text === '🔍 Kino qidirish') {
        return bot.sendMessage(chatId, "🎬 Kino kodini yuboring (Masalan: 101)");
    }

    if (text === '🎲 Tasodifiy kino') {
        const kinolar = load(DB_FILES.kinolar);
        if (kinolar.length === 0) return bot.sendMessage(chatId, "Bazada kino yo'q.");
        const r = kinolar[Math.floor(Math.random() * kinolar.length)];
        return bot.sendVideo(chatId, r.file_id, { caption: `🎲 Tasodifiy: ${r.name}` });
    }

    if (text === '👨‍💻 Admin Panel' && isAdmin(userId)) {
        return bot.sendMessage(chatId, "🛠 Admin panel:", adminMenu);
    }

    // --- ADMIN FUNKSIYALARI ---
    if (isAdmin(userId) && msg.video) { // Kino qo'shish
        const cap = msg.caption;
        if (!cap) return bot.sendMessage(chatId, "⚠️ Kod va nomni yozing!");
        const [code, ...nameParts] = cap.split(' ');
        let kinolar = load(DB_FILES.kinolar);
        kinolar.push({ code, name: nameParts.join(' '), file_id: msg.video.file_id });
        save(DB_FILES.kinolar, kinolar);
        return bot.sendMessage(chatId, "✅ Kino saqlandi!");
    }

    if (text === '📢 Reklama' && isAdmin(userId)) {
        return bot.sendMessage(chatId, "Menga reklama xabarini yuboring (Text, Photo yoki Video).");
    }

    // --- KOD BILAN QIDIRISH ---
    if (text && !isNaN(text)) {
        const kinolar = load(DB_FILES.kinolar);
        const k = kinolar.find(x => x.code === text);
        if (k) {
            return bot.sendVideo(chatId, k.file_id, { caption: `🎬 **Nomi:** ${k.name}\n🆔 **Kodi:** ${k.code}` });
        } else {
            return bot.sendMessage(chatId, "❌ Topilmadi.");
        }
    }
});

// Callback (Verify tugmasi)
bot.on('callback_query', async (q) => {
    if (q.data === 'verify') {
        const ok = await checkSub(q.from.id);
        if (ok) {
            bot.deleteMessage(q.message.chat.id, q.message.message_id);
            bot.sendMessage(q.message.chat.id, "✅ Tayyor! Kino kodini yuboring.", mainMenu);
        } else {
            bot.answerCallbackQuery(q.id, { text: "❌ Obuna bo'lmagansiz!", show_alert: true });
        }
    }
});

console.log("🚀 Professional Gigant Bot ishga tushdi!");
