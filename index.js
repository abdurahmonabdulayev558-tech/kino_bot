const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// 1. ASOSIY BAZA VA FUNKSIYALAR
function loadDB(f) {
    if (!fs.existsSync(f)) return f.includes('users') ? {} : [];
    try { return JSON.parse(fs.readFileSync(f, 'utf8')); } 
    catch (e) { return f.includes('users') ? {} : []; }
}
function saveDB(f, d) { fs.writeFileSync(f, JSON.stringify(d, null, 4)); }

// 2. SOZLAMALAR (Tokenni yangilang!)
const token = '8625932620:AAHbVie8op50HohFVG38tnSfsVXPiRUlH9I'; 
const bot = new TelegramBot(token, { polling: true });
const ADMIN_IDS = [7917949181,1039979240]; 

const DB_FILES = { users: 'users.json', kinolar: 'kinolar.json', kanallar: 'kanallar.json' };

// 3. MAJBURIY OBUNA (AVTOMATIK)
async function checkMembership(userId) {
    if (ADMIN_IDS.includes(userId)) return true;
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

// 4. PREMIMUM KLAVIATURALAR
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

// 5. MONSTER LOGIKA
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Foydalanuvchini ro'yxatga olish
    let users = loadDB(DB_FILES.users);
    if (!users[chatId]) {
        users[chatId] = { name: msg.from.first_name, date: new Date().toLocaleString() };
        saveDB(DB_FILES.users, users);
    }

    // Obuna tekshiruvi (A'zo bo'lmasa bloklaydi)
    const isMember = await checkMembership(chatId);
    if (!isMember && text !== '/start') {
        return bot.sendMessage(chatId, "💎 **Botimiz premium!**\n\nDavom etish uchun rasmiy kanalga a'zo bo'ling:", {
            reply_markup: { inline_keyboard: [[{ text: "📢 Kanalga a'zo bo'lish", url: "https://t.me/KinoLar_Uz" }], [{ text: "✅ Tekshirish", callback_data: "verify" }]] }
        });
    }

    // --- ADMIN KOMANDALARI (MAXFIY) ---
    if (text === '👨‍💻 Admin Panel' && ADMIN_IDS.includes(chatId)) {
        return bot.sendMessage(chatId, "🚀 **Monster Admin Panel**\n\nBarcha boshqaruv qo'lingizda:", {
            reply_markup: { keyboard: [['📢 Reklama tarqatish', '➕ Kanal qo\'shish'], ['🏠 Asosiy menyu']], resize_keyboard: true }
        });
    }

    // Video yuborilsa (Faqat admin uchun kino qo'shish)
    if (msg.video && ADMIN_IDS.includes(chatId)) {
        const cap = msg.caption;
        if (!cap) return bot.sendMessage(chatId, "⚠️ Videoga 'kod nomi' deb izoh yozing!");
        const [code, ...name] = cap.split(' ');
        let kinolar = loadDB(DB_FILES.kinolar);
        kinolar.push({ code, name: name.join(' '), file_id: msg.video.file_id });
        saveDB(DB_FILES.kinolar, kinolar);
        return bot.sendMessage(chatId, `✅ Kino qo'shildi.**\n🆔 Kod: ${code}`);
    }

    // --- FOYDALANUVCHI TUGMALARI ---
    if (text === '/start' || text === '🏠 Asosiy menyu') {
        return bot.sendMessage(chatId, `Assalomu alaykum, ${msg.from.first_name}! 👋\n\nKino kodini yuboring va tomosha qiling!`, mainMenu);
    }

    if (text === '📊 Statistika') {
        const u = Object.keys(loadDB(DB_FILES.users)).length;
        const k = loadDB(DB_FILES.kinolar).length;
        return bot.sendMessage(chatId, `👑 **Bot Holati:**\n\n👥 Azolar: ${u} ta\n🎬 Kinolar: ${k} ta\n📡 Server: Online`);
    }

    if (text === '👤 Profil') {
        return bot.sendMessage(chatId, `👤 **Profilingiz:**\n\n🆔 ID: \`${chatId}\`\n🎭 Ism: ${msg.from.first_name}\n📅 Ro'yxatdan o'tgan vaqt: ${users[chatId].date}`);
    }

    // --- KOD BILAN QIDIRISH (TEZKOR) ---
    if (text && !isNaN(text)) {
        const kinolar = loadDB(DB_FILES.kinolar);
        const k = kinolar.find(x => x.code === text);
        if (k) {
            return bot.sendVideo(chatId, k.file_id, { 
                caption: `🎬 **${k.name}**\n\n🆔 Kod: ${k.code}\n✅ @Kinolar_borku_bot botidan topildi.` 
            });
        }
        return bot.sendMessage(chatId, "😔 **Topilmadi!**\nBunday kodli kino hali bazamizda yo'q.");
    }
});

// A'zolikni tasdiqlash
bot.on('callback_query', async (q) => {
    if (q.data === 'verify') {
        if (await checkMembership(q.from.id)) {
            bot.deleteMessage(q.message.chat.id, q.message.message_id);
            bot.sendMessage(q.message.chat.id, "✅ **Tasdiqlandi!** Marhamat, kino kodini yuboring.", mainMenu);
        } else {
            bot.answerCallbackQuery(q.id, { text: "❌ Kanalga a'zo emassiz!", show_alert: true });
        }
    }
});

console.log("🚀 Professional Monster Bot ishga tushdi!");
