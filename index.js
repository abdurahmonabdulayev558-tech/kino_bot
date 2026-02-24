const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ==========================================
// 1. ASOSIY SOZLAMALAR
// ==========================================
const token = '8625932620:AAFE1da95Vp8UZJtmuPYOxEPhzuviCCVsZQ'; 
const bot = new TelegramBot(token, { polling: true });

// ADMINLAR: O'zingiz va sherigingizning ID raqami
const ADMIN_IDS = [7917949181, 1039979240]; 

const DB_FILES = {
    users: 'users.json',
    kinolar: 'kinolar.json',
    kanallar: 'kanallar.json'
};

// Fayllar mavjudligini tekshirish va yaratish
Object.values(DB_FILES).forEach(file => {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(file === 'users.json' ? {} : []));
    }
});

function loadData(file) {
    try {
        const data = fs.readFileSync(file, 'utf8');
        return JSON.parse(data);
    } catch (e) { return file === 'users.json' ? {} : []; }
}

function saveData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 4));
}

// Adminni aniqlash funksiyasi
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

// ==========================================
// 2. MAJBURIY OBUNA TIZIMI
// ==========================================
async function checkMembership(userId) {
    if (isAdmin(userId)) return true;
    const channels = loadData(DB_FILES.kanallar);
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
// 3. ASOSIY LOGIKA
// ==========================================

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    // Foydalanuvchini ro'yxatga olish
    let users = loadData(DB_FILES.users);
    if (!users[userId]) {
        users[userId] = { name: msg.from.first_name, date: new Date().toISOString() };
        saveData(DB_FILES.users, users);
    }

    // Obuna tekshiruvi
    const isMember = await checkMembership(userId);
    if (!isMember && text !== '/start') {
        const chans = loadData(DB_FILES.kanallar);
        const buttons = chans.map(c => [{ text: c.name, url: c.link }]);
        buttons.push([{ text: "✅ Tekshirish", callback_data: "verify" }]);
        return bot.sendMessage(chatId, "❌ Botdan foydalanish uchun kanallarimizga a'zo bo'ling!", {
            reply_markup: { inline_keyboard: buttons }
        });
    }

    // --- ADMIN PANEL ---
    if (text === '/admin' && isAdmin(userId)) {
        return bot.sendMessage(chatId, "🛠 **Admin Panel**\n\n/stat - Statistika\n/kanal [ID] [Link] [Nomi] - Kanal qo'shish\n\nKino qo'shish uchun videoni yuboring va tagiga 'kod nomi' deb yozing.");
    }

    if (text === '/stat' && isAdmin(userId)) {
        const uCount = Object.keys(loadData(DB_FILES.users)).length;
        const kCount = loadData(DB_FILES.kinolar).length;
        return bot.sendMessage(chatId, `📊 **Statistika**\n\n👥 Foydalanuvchilar: ${uCount}\n🎬 Kinolar: ${kCount}`);
    }

    // --- KINO QO'SHISH (ADMINLAR UCHUN) ---
    if (isAdmin(userId) && msg.video) {
        const caption = msg.caption;
        if (!caption) return bot.sendMessage(chatId, "⚠️ Video tagiga kod va nomni yozing!\nNamuna: `101 Avatar 2` ");
        
        const [code, ...nameParts] = caption.split(' ');
        const name = nameParts.join(' ');
        
        let kinolar = loadData(DB_FILES.kinolar);
        if (kinolar.some(k => k.code === code)) return bot.sendMessage(chatId, "❌ Bu kodli kino bazada bor!");
        
        kinolar.push({ code, name, file_id: msg.video.file_id });
        saveData(DB_FILES.kinolar, kinolar);
        return bot.sendMessage(chatId, `✅ Saqlandi!\n🆔 Kod: ${code}\n🎬 Nomi: ${name}`);
    }

    // --- KINO QIDIRISH ---
    if (text && !isNaN(text)) {
        const kinolar = loadData(DB_FILES.kinolar);
        const kino = kinolar.find(k => k.code === text);
        if (kino) {
            return bot.sendVideo(chatId, kino.file_id, {
                caption: `🎬 **Nomi:** ${kino.name}\n🆔 **Kodi:** ${kino.code}`
            });
        } else {
            return bot.sendMessage(chatId, "❌ Kechirasiz, bunday kodli kino topilmadi.");
        }
    }

    // START BUYRUG'I
    if (text === '/start') {
        bot.sendMessage(chatId, `Assalomu alaykum, ${msg.from.first_name}! 🎬\nKino kodini yuboring.`);
    }
});

// Callback tugmalari uchun
bot.on('callback_query', async (query) => {
    if (query.data === 'verify') {
        const isSub = await checkMembership(query.from.id);
        if (isSub) {
            bot.deleteMessage(query.message.chat.id, query.message.message_id);
            bot.sendMessage(query.message.chat.id, "✅ Tabriklaymiz! Endi botdan foydalanishingiz mumkin.");
        } else {
            bot.answerCallbackQuery(query.id, { text: "❌ Hali a'zo emassiz!", show_alert: true });
        }
    }
});

console.log("🚀 Xatosiz professional bot ishga tushdi!");
