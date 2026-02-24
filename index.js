const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ==========================================
// 1. MA'LUMOTLAR BAZASI (Xatolarni davolash tizimi bilan)
// ==========================================
function loadDB(file) {
    if (!fs.existsSync(file)) {
        const initialData = file.includes('users') ? {} : [];
        fs.writeFileSync(file, JSON.stringify(initialData));
        return initialData;
    }
    try {
        const data = fs.readFileSync(file, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return file.includes('users') ? {} : [];
    }
}

function saveDB(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 4));
}

// ==========================================
// 2. SIZ BERGAN KONFIGURATSIYALAR
// ==========================================
const token = '8625932620:AAFWvLVSOlmzw4GF9V9evEu5b8_-hu4EuMo'; // Siz yuborgan token
const bot = new TelegramBot(token, { polling: true });

const ADMIN_IDS = [7917949181, 1039979240]; // Siz yuborgan Admin ID-lar
const DEFAULT_CHANNEL = { name: "Iltifotligim", link: "https://t.me/iltifotligim", id: "@iltifotligim" };

const DB_FILES = {
    users: 'users.json',
    kinolar: 'kinolar.json',
    kanallar: 'kanallar.json',
    blacklist: 'blacklist.json'
};

// Kanallar bazasini boshlang'ich sozlash
let currentChans = loadDB(DB_FILES.kanallar);
if (currentChans.length === 0) {
    currentChans.push(DEFAULT_CHANNEL);
    saveDB(DB_FILES.kanallar, currentChans);
}

let userState = {}; 
const isAdmin = (id) => ADMIN_IDS.includes(id);

// ==========================================
// 3. MAJBURIY OBUNA TEKSHIRUVI
// ==========================================
async function checkMembership(userId) {
    if (isAdmin(userId)) return true;
    const channels = loadDB(DB_FILES.kanallar);
    if (channels.length === 0) return true;

    for (const ch of channels) {
        try {
            const res = await bot.getChatMember(ch.id, userId);
            if (['left', 'kicked', 'restricted'].includes(res.status)) return false;
        } catch (e) {
            console.log(`Ulanish xatosi: ${ch.id}`);
            continue;
        }
    }
    return true;
}

// ==========================================
// 4. KLAVIATURALAR (PREMIUM DIZAYN)
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
            ['📢 Reklama tarqatish', '➕ Kanal qo\'shish'],
            ['🚫 Foydalanuvchini bloklash', '❌ Kanallarni tozalash'],
            ['🏠 Asosiy menyu']
        ],
        resize_keyboard: true
    }
};

// ==========================================
// 5. ASOSIY LOGIKA
// ==========================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;

    // 1. Blacklist tekshiruvi
    const blacklist = loadDB(DB_FILES.blacklist);
    if (blacklist.includes(userId)) return bot.sendMessage(chatId, "🚫 Siz botdan bloklangansiz!");

    // 2. Foydalanuvchini saqlash
    let users = loadDB(DB_FILES.users);
    if (!users[userId]) {
        users[userId] = { name: msg.from.first_name, joined: new Date().toLocaleString() };
        saveDB(DB_FILES.users, users);
    }

    // 3. Obunani tekshirish
    const isMember = await checkMembership(userId);
    if (!isMember && text !== '/start') {
        const chans = loadDB(DB_FILES.kanallar);
        const inlineBtn = chans.map(c => [{ text: c.name, url: c.link }]);
        inlineBtn.push([{ text: "✅ Tekshirish", callback_data: "check_sub" }]);
        
        return bot.sendMessage(chatId, "⚠️ **Diqqat!** Botdan foydalanish uchun quyidagi kanallarga obuna bo'lishingiz shart:", {
            reply_markup: { inline_keyboard: inlineBtn }
        });
    }

    // --- ADMIN PANEL FUNKSIYALARI ---
    if (text === '👨‍💻 Admin Panel') {
        if (isAdmin(userId)) {
            userState[userId] = null;
            return bot.sendMessage(chatId, "🚀 **Monster Admin Panelga xush kelibsiz!**", adminMenu);
        }
        return bot.sendMessage(chatId, "⛔️ Siz admin emassiz!");
    }

    // Reklama tarqatish
    if (text === '📢 Reklama tarqatish' && isAdmin(userId)) {
        userState[userId] = 'SEND_AD';
        return bot.sendMessage(chatId, "📝 Reklama postini yuboring (Rasm, video yoki tekst):");
    }

    // Kanal qo'shish
    if (text === '➕ Kanal qo\'shish' && isAdmin(userId)) {
        userState[userId] = 'ADD_CHANNEL';
        return bot.sendMessage(chatId, "Format: `ID Nomi Link` \nMasalan: `@kanalID KanalNomi https://t.me/link` ");
    }

    // --- ADMIN STATE HANDLING ---
    if (userState[userId] === 'SEND_AD' && isAdmin(userId) && text !== '🏠 Asosiy menyu') {
        const allUsers = Object.keys(loadDB(DB_FILES.users));
        bot.sendMessage(chatId, `🚀 Reklama yuborish boshlandi (${allUsers.length} kishi)...`);
        let success = 0;
        for (const uId of allUsers) {
            try {
                await bot.copyMessage(uId, chatId, msg.message_id);
                success++;
            } catch (e) { continue; }
        }
        userState[userId] = null;
        return bot.sendMessage(chatId, `✅ Reklama yakunlandi! Muvaffaqiyatli: ${success}`);
    }

    if (userState[userId] === 'ADD_CHANNEL' && isAdmin(userId)) {
        const parts = text.split(' ');
        if (parts.length < 3) return bot.sendMessage(chatId, "❌ Xato format!");
        let chans = loadDB(DB_FILES.kanallar);
        chans.push({ id: parts[0], name: parts[1], link: parts[2] });
        saveDB(DB_FILES.kanallar, chans);
        userState[userId] = null;
        return bot.sendMessage(chatId, "✅ Yangi kanal muvaffaqiyatli qo'shildi!");
    }

    // --- KINO QO'SHISH (VIDEO YUBORILSA) ---
    if (msg.video && isAdmin(userId)) {
        const cap = msg.caption;
        if (!cap) return bot.sendMessage(chatId, "⚠️ Videoga 'kod nomi' deb caption yozing!");
        const [code, ...nameParts] = cap.split(' ');
        let kinolar = loadDB(DB_FILES.kinolar);
        kinolar.push({ code, name: nameParts.join(' '), file_id: msg.video.file_id });
        saveDB(DB_FILES.kinolar, kinolar);
        return bot.sendMessage(chatId, `✅ **Kino saqlandi!** Kod: ${code}`);
    }

    // --- TUGMALAR ---
    if (text === '/start' || text === '🏠 Asosiy menyu') {
        userState[userId] = null;
        return bot.sendMessage(chatId, `👋 Assalomu alaykum, ${msg.from.first_name}!\n\n🎬 @Kinolar_borku_bot botiga xush kelibsiz!`, mainMenu);
    }

    if (text === '📊 Statistika') {
        const u = Object.keys(loadDB(DB_FILES.users)).length;
        const k = loadDB(DB_FILES.kinolar).length;
        return bot.sendMessage(chatId, `📊 **Statistika:**\n\n👤 Azolar: ${u} ta\n🎬 Kinolar: ${k} ta\n📡 Holat: Onlayn`);
    }

    if (text === '📢 Kanalimiz') {
        const chans = loadDB(DB_FILES.kanallar);
        const inlineBtn = chans.map(c => [{ text: c.name, url: c.link }]);
        return bot.sendMessage(chatId, "📢 Bizning rasmiy kanallarimiz:", { reply_markup: { inline_keyboard: inlineBtn } });
    }

    if (text === '🎲 Tasodifiy kino') {
        const kinolar = loadDB(DB_FILES.kinolar);
        if (kinolar.length === 0) return bot.sendMessage(chatId, "😔 Bazada kinolar yo'q.");
        const r = kinolar[Math.floor(Math.random() * kinolar.length)];
        return bot.sendVideo(chatId, r.file_id, { caption: `🎬 **${r.name}**\n🆔 Kodi: ${r.code}` });
    }

    // --- KOD BILAN QIDIRISH ---
    if (text && !isNaN(text)) {
        const kinolar = loadDB(DB_FILES.kinolar);
        const k = kinolar.find(x => x.code === text);
        if (k) return bot.sendVideo(chatId, k.file_id, { caption: `🎬 **${k.name}**\n🆔 Kodi: ${k.code}\n✅ @Kinolar_borku_bot` });
        return bot.sendMessage(chatId, "❌ Topilmadi.");
    }
});

// Inline verify
bot.on('callback_query', async (q) => {
    if (q.data === 'check_sub') {
        const ok = await checkMembership(q.from.id);
        if (ok) {
            bot.deleteMessage(q.message.chat.id, q.message.message_id);
            bot.sendMessage(q.message.chat.id, "✅ Rahmat! Endi kod yuborishingiz mumkin.", mainMenu);
        } else {
            bot.answerCallbackQuery(q.id, { text: "❌ Hali a'zo emassiz!", show_alert: true });
        }
    }
});

console.log("🚀 Professional Monster Bot ishga tushdi!");
