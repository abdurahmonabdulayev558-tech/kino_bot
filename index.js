const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ==========================================
// 1. MA'LUMOTLAR BAZASI TIZIMI
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
// 2. SOZLAMALAR (YANGI TOKEN VA ADMINLAR)
// ==========================================
const token = '8625932620:AAGXXuSrczqvBhQ56EH0okDbdR9A2ObQQXM'; // Siz bergan yangi token
const bot = new TelegramBot(token, { polling: true });

const ADMIN_IDS = [7917949181, 1039979240]; // Siz yuborgan Admin ID-lar
const DB_FILES = {
    users: 'users.json',
    kinolar: 'kinolar.json',
    kanallar: 'kanallar.json',
    blacklist: 'blacklist.json'
};

// Boshlang'ich kanalni sozlash
let initChans = loadDB(DB_FILES.kanallar);
if (initChans.length === 0) {
    initChans.push({ name: "Iltifotligim", link: "https://t.me/iltifotligim", id: "@iltifotligim" });
    saveDB(DB_FILES.kanallar, initChans);
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
            console.log(`Xato: ${ch.id} kanalini tekshirib bo'lmadi`);
            continue;
        }
    }
    return true;
}

// ==========================================
// 4. PREMIMUM KLAVIATURALAR
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
// 5. ASOSIY LOGIKA (Kino_topuvchi_botku)
// ==========================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;

    // 1. Blacklist tekshiruvi
    const blacklist = loadDB(DB_FILES.blacklist);
    if (blacklist.includes(userId)) return bot.sendMessage(chatId, "🚫 Siz botdan bloklangansiz!");

    // 2. Foydalanuvchini ro'yxatga olish
    let users = loadDB(DB_FILES.users);
    if (!users[userId]) {
        users[userId] = { 
            name: msg.from.first_name, 
            joined: new Date().toLocaleString() 
        };
        saveDB(DB_FILES.users, users);
    }

    // 3. Majburiy obuna
    const isMember = await checkMembership(userId);
    if (!isMember && text !== '/start') {
        const chans = loadDB(DB_FILES.kanallar);
        const inlineBtn = chans.map(c => [{ text: c.name, url: c.link }]);
        inlineBtn.push([{ text: "✅ Tekshirish", callback_data: "check_sub" }]);
        
        return bot.sendMessage(chatId, "⚠️ **Diqqat!** Botdan foydalanish uchun quyidagi kanallarga a'zo bo'lishingiz shart:", {
            reply_markup: { inline_keyboard: inlineBtn }
        });
    }

    // --- ADMIN KOMANDALARI ---
    if (text === '👨‍💻 Admin Panel' && isAdmin(userId)) {
        userState[userId] = null;
        return bot.sendMessage(chatId, "🚀 **Kino_topuvchi_botku - Admin Panel**", adminMenu);
    }

    // Reklama tarqatish
    if (text === '📢 Reklama tarqatish' && isAdmin(userId)) {
        userState[userId] = 'SEND_AD';
        return bot.sendMessage(chatId, "📝 Reklama xabarini yuboring (Rasm, video yoki tekst):");
    }

    // Kanal qo'shish
    if (text === '➕ Kanal qo\'shish' && isAdmin(userId)) {
        userState[userId] = 'ADD_CHANNEL';
        return bot.sendMessage(chatId, "Kanal ma'lumotlarini yuboring:\n`ID Nomi Link` \n\nNamuna:\n`-100123456789 Kanalimiz https://t.me/link` ");
    }

    // --- ADMIN STATE HANDLING ---
    if (userState[userId] === 'SEND_AD' && isAdmin(userId) && text !== '🏠 Asosiy menyu') {
        const allUsers = Object.keys(loadDB(DB_FILES.users));
        bot.sendMessage(chatId, `🚀 Reklama ${allUsers.length} kishiga yuborilmoqda...`);
        let count = 0;
        for (const uId of allUsers) {
            try {
                await bot.copyMessage(uId, chatId, msg.message_id);
                count++;
            } catch (e) { continue; }
        }
        userState[userId] = null;
        return bot.sendMessage(chatId, `✅ Reklama yakunlandi! Muvaffaqiyatli: ${count}`);
    }

    if (userState[userId] === 'ADD_CHANNEL' && isAdmin(userId)) {
        const parts = text.split(' ');
        if (parts.length < 3) return bot.sendMessage(chatId, "❌ Xato format!");
        let chans = loadDB(DB_FILES.kanallar);
        chans.push({ id: parts[0], name: parts[1], link: parts[2] });
        saveDB(DB_FILES.kanallar, chans);
        userState[userId] = null;
        return bot.sendMessage(chatId, "✅ Kanal muvaffaqiyatli qo'shildi!");
    }

    // --- KINO QO'SHISH (VIDEO) ---
    if (msg.video && isAdmin(userId)) {
        const cap = msg.caption;
        if (!cap) return bot.sendMessage(chatId, "⚠️ Videoga 'kod nomi' deb caption yozing!");
        const [code, ...nameParts] = cap.split(' ');
        let kinolar = loadDB(DB_FILES.kinolar);
        kinolar.push({ code, name: nameParts.join(' '), file_id: msg.video.file_id });
        saveDB(DB_FILES.kinolar, kinolar);
        return bot.sendMessage(chatId, `✅ **Kino saqlandi!**\n🆔 Kod: ${code}\n🎬 Nomi: ${nameParts.join(' ')}`);
    }

    // --- FOYDALANUVCHI TUGMALARI ---
    if (text === '/start' || text === '🏠 Asosiy menyu') {
        userState[userId] = null;
        return bot.sendMessage(chatId, `👋 Assalomu alaykum, ${msg.from.first_name}!\n\n🎬 **Kino_topuvchi_botku** botiga xush kelibsiz!`, mainMenu);
    }

    if (text === '📊 Statistika') {
        const u = Object.keys(loadDB(DB_FILES.users)).length;
        const k = loadDB(DB_FILES.kinolar).length;
        return bot.sendMessage(chatId, `📈 **Bot Statistikasi:**\n\n👤 Foydalanuvchilar: ${u} ta\n🎬 Kinolar bazasi: ${k} ta\n📡 Server: Onlayn`);
    }

    if (text === '👤 Profil') {
        const u = loadDB(DB_FILES.users)[userId];
        return bot.sendMessage(chatId, `👤 **Profilingiz:**\n\n🆔 ID: \`${userId}\`\n🎭 Ism: ${msg.from.first_name}\n📅 A'zo bo'lingan: ${u.joined}`);
    }

    if (text === '📢 Kanalimiz') {
        const chans = loadDB(DB_FILES.kanallar);
        const inlineBtn = chans.map(c => [{ text: c.name, url: c.link }]);
        return bot.sendMessage(chatId, "📢 Bizning rasmiy kanallarimiz:", { reply_markup: { inline_keyboard: inlineBtn } });
    }

    if (text === '🎲 Tasodifiy kino') {
        const kinolar = loadDB(DB_FILES.kinolar);
        if (kinolar.length === 0) return bot.sendMessage(chatId, "😔 Hozircha bazada kinolar yo'q.");
        const r = kinolar[Math.floor(Math.random() * kinolar.length)];
        return bot.sendVideo(chatId, r.file_id, { caption: `🎬 **${r.name}**\n🆔 Kodi: ${r.code}\n✅ @Kinolar_borku_bot` });
    }

    // --- KOD BILAN QIDIRISH ---
    if (text && !isNaN(text)) {
        const kinolar = loadDB(DB_FILES.kinolar);
        const k = kinolar.find(x => x.code === text);
        if (k) return bot.sendVideo(chatId, k.file_id, { caption: `🎬 **${k.name}**\n🆔 Kodi: ${k.code}\n✅ @Kinolar_borku_bot` });
        return bot.sendMessage(chatId, "❌ **Topilmadi!**\nBunday kodli kino hali bazamizda yo'q.");
    }
});

// Inline verify
bot.on('callback_query', async (q) => {
    if (q.data === 'check_sub') {
        const ok = await checkMembership(q.from.id);
        if (ok) {
            bot.deleteMessage(q.message.chat.id, q.message.message_id);
            bot.sendMessage(q.message.chat.id, "✅ Tasdiqlandi! Endi kod yuborishingiz mumkin.", mainMenu);
        } else {
            bot.answerCallbackQuery(q.id, { text: "❌ Hozircha hamma kanallarga a'zo emassiz!", show_alert: true });
        }
    }
});

console.log("🚀 Kino_topuvchi_botku ishga tushdi!");
