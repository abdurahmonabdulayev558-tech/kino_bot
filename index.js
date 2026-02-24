const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ==========================================
// 1. SOZLAMALAR VA ADMINLAR
// ==========================================
const token = '8625932620:AAEv8kIkZ3wA7JmGx2FRqe0oI5pW49Z2zyI'; // Tokenni yangilang!
const bot = new TelegramBot(token, { polling: true });
const ADMIN_IDS = [7917949181,1039979240]; // O'z ID-ingizni kiriting

const DB_FILES = {
    users: 'users.json',
    kinolar: 'kinolar.json',
    kanallar: 'kanallar.json',
    blacklist: 'blacklist.json'
};

// Funksiyalar (Tepada bo'lishi xatolarning oldini oladi)
const loadDB = (f) => {
    if (!fs.existsSync(f)) return f.includes('users') ? {} : [];
    return JSON.parse(fs.readFileSync(f, 'utf8'));
};
const saveDB = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 4));
const isAdmin = (id) => ADMIN_IDS.includes(id);

// ==========================================
// 2. MAJBURIY OBUNA (PREMIUM)
// ==========================================
async function checkMembership(userId) {
    if (isAdmin(userId)) return true;
    const channels = loadDB(DB_FILES.kanallar);
    if (channels.length === 0) return true;

    for (const ch of channels) {
        try {
            const res = await bot.getChatMember(ch.id, userId);
            if (['left', 'kicked', 'restricted'].includes(res.status)) return false;
        } catch (e) { continue; }
    }
    return true;
}

// ==========================================
// 3. KLAVIATURALAR
// ==========================================
const mainMenu = {
    reply_markup: {
        keyboard: [
            ['🔍 Kino qidirish', '🎲 Tasodifiy'],
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
            ['🚫 Bloklash', '📑 Bazani yuklash'],
            ['🏠 Asosiy menyu']
        ],
        resize_keyboard: true
    }
};

// ==========================================
// 4. ASOSIY LOGIKA (MONSTER MODE)
// ==========================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Blacklist tekshiruvi
    const blacklist = loadDB(DB_FILES.blacklist);
    if (blacklist.includes(chatId)) return;

    // Foydalanuvchini ro'yxatga olish
    let users = loadDB(DB_FILES.users);
    if (!users[chatId]) {
        users[chatId] = { name: msg.from.first_name, date: new Date().toLocaleString() };
        saveDB(DB_FILES.users, users);
    }

    // --- ADMIN PANEL VA XAVFSIZLIK ---
    if (text === '👨‍💻 Admin Panel') {
        if (isAdmin(chatId)) {
            return bot.sendMessage(chatId, "🛠 **Admin Panelga xush kelibsiz!**\nQuyidagi tugmalardan foydalaning:", adminMenu);
        } else {
            return bot.sendMessage(chatId, "❌ **Kirish taqiqlangan!**\nSiz bot administratori emassiz.");
        }
    }

    // --- VIDEO YUBORISH (FAQAT ADMIN) ---
    if (msg.video) {
        if (isAdmin(chatId)) {
            const cap = msg.caption;
            if (!cap) return bot.sendMessage(chatId, "⚠️ Iltimos, videoga 'kod nomi' ko'rinishida izoh yozing!");
            
            const [code, ...nameParts] = cap.split(' ');
            let kinolar = loadDB(DB_FILES.kinolar);
            
            // Kod bandligini tekshirish
            if (kinolar.find(k => k.code === code)) return bot.sendMessage(chatId, "❌ Bu kod band! Boshqa kod tanlang.");

            kinolar.push({ code, name: nameParts.join(' '), file_id: msg.video.file_id });
            saveDB(DB_FILES.kinolar, kinolar);
            return bot.sendMessage(chatId, `✅ **Kino saqlandi!**\n🆔 Kod: ${code}\n🎬 Nomi: ${nameParts.join(' ')}`);
        } else {
            return bot.sendMessage(chatId, "⚠️ **Sizda ruxsat yo'q!**\nVideo yubormang, aks holda bloklanasiz.");
        }
    }

    // --- MAJBURIY OBUNA TEKSHIRUVI ---
    const isMember = await checkMembership(chatId);
    if (!isMember && text !== '/start') {
        const chans = loadDB(DB_FILES.kanallar);
        const inlineBtn = chans.map(c => [{ text: c.name, url: c.link }]);
        inlineBtn.push([{ text: "✅ Tekshirish", callback_data: "verify" }]);
        return bot.sendMessage(chatId, "⛔️ **To'xtang!** Botdan foydalanish uchun kanallarimizga a'zo bo'ling:", {
            reply_markup: { inline_keyboard: inlineBtn }
        });
    }

    // --- TUGMALAR ---
    if (text === '/start' || text === '🏠 Asosiy menyu') {
        return bot.sendMessage(chatId, `🌟 **Assalomu alaykum, ${msg.from.first_name}!**\n\nKino kodini yuboring yoki quyidagi menyudan foydalaning:`, mainMenu);
    }

    if (text === '📊 Statistika') {
        const u = Object.keys(loadDB(DB_FILES.users)).length;
        const k = loadDB(DB_FILES.kinolar).length;
        return bot.sendMessage(chatId, `📊 **Bot Statistikasi:**\n\n👥 Foydalanuvchilar: ${u}\n🎬 Kinolar bazasi: ${k}\n🛡 Holati: Faol`);
    }

    if (text === '👤 Profil') {
        return bot.sendMessage(chatId, `👤 **Profilingiz:**\n\n🆔 ID: \`${chatId}\`\n🎭 Ism: ${msg.from.first_name}\n📅 A'zo bo'ldingiz: ${users[chatId].date}`);
    }

    // --- KOD BILAN QIDIRISH (SMART) ---
    if (text && !isNaN(text)) {
        const kinolar = loadDB(DB_FILES.kinolar);
        const k = kinolar.find(x => x.code === text);
        if (k) {
            return bot.sendVideo(chatId, k.file_id, { 
                caption: `🎬 **${k.name}**\n\n🆔 Kodi: ${k.code}\n✅ https://t.me/iltifotligim` 
            });
        } else {
            return bot.sendMessage(chatId, "😔 **Afsus!** Bu kod bilan kino topilmadi.\nIltimos, kodni to'g'ri yozganingizni tekshiring.");
        }
    }
});

// Inline tugma uchun
bot.on('callback_query', async (q) => {
    if (q.data === 'verify') {
        const ok = await checkMembership(q.from.id);
        if (ok) {
            bot.deleteMessage(q.message.chat.id, q.message.message_id);
            bot.sendMessage(q.message.chat.id, "✅ **Rahmat!** A'zolik tasdiqlandi. Kino kodini yuboring.", mainMenu);
        } else {
            bot.answerCallbackQuery(q.id, { text: "❌ Hali a'zo emassiz!", show_alert: true });
        }
    }
});

console.log("🚀 Professional Monster Bot ishga tushdi!");

