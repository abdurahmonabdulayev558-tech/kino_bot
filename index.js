const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ==========================================
// 1. KONFIGURATSIYA VA BAZA
// ==========================================
const token = '8625932620:AAHDPov-MZgUaqD2Fv5U5FUdZErDZ4J-vVQ'; // Tokenni albatta yangilang!
const bot = new TelegramBot(token, { polling: true });
const ADMIN_IDS = [7917949181, 1039979240]; // Adminlar ro'yxati

const DB_FILES = {
    users: 'users.json',
    kinolar: 'kinolar.json',
    kanallar: 'kanallar.json',
    blacklist: 'blacklist.json',
    settings: 'settings.json'
};

// Fayllarni tekshirish va yaratish
Object.values(DB_FILES).forEach(file => {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(file === 'users.json' || file === 'settings.json' ? {} : []));
    }
});

const loadDB = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const saveDB = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 4));
const isAdmin = (id) => ADMIN_IDS.includes(id);

let adminStates = {};

// ==========================================
// 2. MAJBURIY OBUNA FUNKSIYASI
// ==========================================
async function checkMembership(userId) {
    if (isAdmin(userId)) return true;
    const channels = loadDB(DB_FILES.kanallar);
    if (channels.length === 0) return true;

    for (const ch of channels) {
        try {
            const member = await bot.getChatMember(ch.id, userId);
            if (['left', 'kicked', 'restricted'].includes(member.status)) return false;
        } catch (e) {
            console.error(`Kanal ulanmagan: ${ch.id}`);
            continue;
        }
    }
    return true;
}

// ==========================================
// 3. KLAVIATURALAR
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
            ['➖ Kanalni o\'chirish', '🚫 Bloklash'],
            ['❌ Bazani tozalash', '🏠 Asosiy menyu']
        ],
        resize_keyboard: true
    }
};

// ==========================================
// 4. ASOSIY ISHLASH LOGIKASI
// ==========================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    // Qora ro'yxatni tekshirish
    const blacklist = loadDB(DB_FILES.blacklist);
    if (blacklist.includes(userId)) {
        return bot.sendMessage(chatId, "🚫 Kechirasiz, siz botdan bloklangansiz!");
    }

    // Foydalanuvchini ro'yxatga olish
    let users = loadDB(DB_FILES.users);
    if (!users[userId]) {
        users[userId] = { name: msg.from.first_name, username: msg.from.username, joined: new Date().toLocaleString() };
        saveDB(DB_FILES.users, users);
    }

    // Majburiy obuna tekshiruvi
    const isMember = await checkMembership(userId);
    if (!isMember && text !== '/start') {
        const chans = loadDB(DB_FILES.kanallar);
        const inlineBtn = chans.map(c => [{ text: c.name, url: c.link }]);
        inlineBtn.push([{ text: "✅ Tekshirish", callback_data: "verify_sub" }]);
        
        return bot.sendMessage(chatId, "⚠️ Botdan foydalanish uchun quyidagi kanallarga a'zo bo'ling:", {
            reply_markup: { inline_keyboard: inlineBtn }
        });
    }

    // --- ADMIN KOMANDALARI ---
    if (isAdmin(userId)) {
        if (text === '👨‍💻 Admin Panel') return bot.sendMessage(chatId, "🛠 Admin boshqaruv paneli:", adminMenu);

        if (text === '📢 Reklama yuborish') {
            adminStates[userId] = 'SEND_ADS';
            return bot.sendMessage(chatId, "📝 Reklama postini yuboring (Text, Photo, Video yoki Audio):");
        }

        if (text === '➕ Kanal qo\'shish') {
            adminStates[userId] = 'ADD_CH';
            return bot.sendMessage(chatId, "Kanal ID, Nomi va Linkini yuboring.\nNamuna: `-1001234567 MyKanal https://t.me/link` ");
        }

        if (text === '🚫 Bloklash') {
            adminStates[userId] = 'BAN_USER';
            return bot.sendMessage(chatId, "Bloklamoqchi bo'lgan foydalanuvchi ID-sini yuboring:");
        }

        // Reklama yuborish logikasi
        if (adminStates[userId] === 'SEND_ADS' && text !== '🏠 Asosiy menyu') {
            const allUsers = Object.keys(loadDB(DB_FILES.users));
            bot.sendMessage(chatId, `🚀 Reklama ${allUsers.length} kishiga yuborilmoqda...`);
            let count = 0;
            allUsers.forEach(u => {
                bot.copyMessage(u, chatId, msg.message_id).then(() => count++).catch(() => {});
            });
            adminStates[userId] = null;
            return bot.sendMessage(chatId, `✅ Reklama yakunlandi. Muvaffaqiyatli: ${count}`);
        }
    }

    // --- FOYDALANUVCHI BUYRUQLARI ---
    if (text === '/start' || text === '🏠 Asosiy menyu') {
        adminStates[userId] = null;
        return bot.sendMessage(chatId, `Xush kelibsiz, ${msg.from.first_name}! 🎬\nKino kodini kiriting:`, mainMenu);
    }

    if (text === '📊 Statistika') {
        const u = Object.keys(loadDB(DB_FILES.users)).length;
        const k = loadDB(DB_FILES.kinolar).length;
        return bot.sendMessage(chatId, `📊 **Bot statistikasi:**\n\n👥 Azolar: ${u} ta\n🎬 Kinolar: ${k} ta`);
    }

    if (text === '👤 Profil') {
        const u = loadDB(DB_FILES.users)[userId];
        return bot.sendMessage(chatId, `👤 **Ma'lumotlaringiz:**\n\n🆔 ID: ${userId}\n👤 Ism: ${u.name}\n📅 Qo'shilgan vaqtingiz: ${u.joined}`);
    }

    // --- KINO QO'SHISH (ADMINLAR UCHUN) ---
    if (isAdmin(userId) && msg.video) {
        const cap = msg.caption;
        if (!cap) return bot.sendMessage(chatId, "⚠️ Videoga 'kod nomi' deb caption yozing!");
        const [code, ...name] = cap.split(' ');
        let kinolar = loadDB(DB_FILES.kinolar);
        kinolar.push({ code, name: name.join(' '), file_id: msg.video.file_id });
        saveDB(DB_FILES.kinolar, kinolar);
        return bot.sendMessage(chatId, `✅ Kino qo'shildi!\n🆔 Kod: ${code}\n🎬 Nomi: ${name.join(' ')}`);
    }

    // --- KINO QIDIRISH ---
    if (text && !isNaN(text)) {
        const kinolar = loadDB(DB_FILES.kinolar);
        const k = kinolar.find(x => x.code === text);
        if (k) {
            return bot.sendVideo(chatId, k.file_id, { caption: `🎬 **${k.name}**\n\n🆔 Kodi: ${k.code}` });
        } else {
            return bot.sendMessage(chatId, "❌ Kechirasiz, bu kod bilan kino topilmadi.");
        }
    }
});

// Callback tugmalar (Inline)
bot.on('callback_query', async (q) => {
    if (q.data === 'verify_sub') {
        const ok = await checkMembership(q.from.id);
        if (ok) {
            bot.deleteMessage(q.message.chat.id, q.message.message_id);
            bot.sendMessage(q.message.chat.id, "✅ Rahmat! Endi botdan foydalanishingiz mumkin.", mainMenu);
        } else {
            bot.answerCallbackQuery(q.id, { text: "❌ Hali hamma kanallarga a'zo emassiz!", show_alert: true });
        }
    }
});

console.log("🚀 Professional Gigant Bot ishga tushdi!");
