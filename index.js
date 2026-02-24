const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const getSubButtons = () => {
    let buttons = kanallar.map(k => [Markup.button.url(`➕ ${k.name}`, k.link)]);
    buttons.push([Markup.button.callback('✅ Tasdiqlash', 'verify_sub')]);
    return Markup.inlineKeyboard(buttons);
};
// --- 1. SOZLAMALAR ---
const TOKEN = '8625932620:AAFE1da95Vp8UZJtmuPYOxEPhzuviCCVsZQ'; 
const MAIN_ADMINS = [1039979240, 7917949181]; 

const bot = new Telegraf(TOKEN);

// --- 2. MA'LUMOTLAR BAZASI ---
const DB_FILES = {
    kinolar: 'kinolar.json',
    kanallar: 'kanallar.json',
    adminlar: 'adminlar.json',
    users: 'users.json'
};

const loadData = (file) => {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file));
    return file === 'kinolar.json' || file === 'users.json' ? {} : [];
};

const saveData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

let kinolar = loadData(DB_FILES.kinolar);
let kanallar = loadData(DB_FILES.kanallar);
let adminlar = loadData(DB_FILES.adminlar);
let users = loadData(DB_FILES.users);

// Adminlikni tekshirish
const isAdmin = (id) => MAIN_ADMINS.includes(id) || adminlar.includes(id);

async function checkAllSubs(ctx) {
    // ADMINLARNI HAM TEKSHIRISH UCHUN PASTDAGI QATORNI O'CHIRIB KO'RING:
    // if (isAdmin(ctx.from.id)) return true; 

    if (kanallar.length === 0) return true;

    for (const kanal of kanallar) {
        try {
            const res = await ctx.telegram.getChatMember(kanal.id, ctx.from.id);
            // 'left' - chiqib ketgan, 'kicked' - haydalgan
            const statuslar = ['member', 'administrator', 'creator'];
            if (!statuslar.includes(res.status)) {
                console.log(`❌ Foydalanuvchi ${kanal.name} kanalidan chiqib ketgan!`);
                return false;
            }
        } catch (e) {
            console.log(`⚠️ Xatolik: Bot ${kanal.id} kanalida admin emas!`);
            continue; 
        }
    }
    return true;
}

// --- 4. KLAVIATURALAR ---
const mainKeyboard = Markup.keyboard([
    ['🔍 Kino qidirish', '🎲 Tasodifiy kino'],
    ['📊 Statistika', '👤 Profil'],
    ['📢 Kanalimiz', '👨‍💻 Admin Panel']
]).resize();

const adminInline = Markup.inlineKeyboard([
    [Markup.button.callback('➕ Kanal qo\'shish', 'add_channel'), Markup.button.callback('🗑 Kanallarni tozalash', 'del_channels')],
    [Markup.button.callback('➕ Admin qo\'shish', 'add_admin'), Markup.button.callback('✉️ Xabar yuborish', 'broadcast')],
    [Markup.button.callback('📂 Bazani yuklab olish', 'get_db')]
]);

// --- 5. ASOSIY LOGIKA ---

// Yangi foydalanuvchini ro'yxatga olish
bot.use(async (ctx, next) => {
    if (ctx.from && !users[ctx.from.id]) {
        users[ctx.from.id] = {
            name: ctx.from.first_name,
            username: ctx.from.username,
            date: new Date().toISOString()
        };
        saveData(DB_FILES.users, users);
    }
    return next();
});

bot.start(async (ctx) => {
    const isSub = await checkAllSubs(ctx);
    if (!isSub) {
        return ctx.replyWithHTML(
            `<b>Assalomu alaykum, ${ctx.from.first_name}!</b>\n\n` +
            `Botimizdan foydalanish uchun quyidagi kanallarga a'zo bo'ling. ` +
            `Bu botning bepul ishlashini ta'minlaydi. 👇`,
            getSubButtons()
        );
    }
    ctx.reply("🍿 **Xush kelibsiz!**\n\nKino kodini yuboring yoki quyidagi menyudan foydalaning.", mainKeyboard);
});

bot.action('verify_sub', async (ctx) => {
    if (await checkAllSubs(ctx)) {
        await ctx.deleteMessage();
        ctx.reply("✅ Rahmat! Obuna tasdiqlandi. Endi xohlagan kino kodingizni yuboring.", mainKeyboard);
    } else {
        ctx.answerCbQuery("❌ Siz hali barcha kanallarga a'zo bo'lmadingiz!", { show_alert: true });
    }
});

// --- 6. ADMIN KOMANDALARI ---
let step = {};

bot.hears('👨‍💻 Admin Panel', (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    ctx.reply("🛠 **Boshqaruv Paneli**\nTanlang:", adminInline);
});

bot.action('add_channel', (ctx) => {
    step[ctx.from.id] = 'await_chan';
    ctx.reply("Format: Link ID Nomi\n\nMasalan:\nhttps://t.me/kino -100123456789 BestKino");
});

bot.action('broadcast', (ctx) => {
    step[ctx.from.id] = 'await_broadcast';
    ctx.reply("Barcha foydalanuvchilarga yuboriladigan xabarni yozing (Matn, rasm yoki video bo'lishi mumkin):");
});

bot.action('del_channels', (ctx) => {
    kanallar = [];
    saveData(DB_FILES.kanallar, kanallar);
    ctx.reply("Kanallar tozalandi.");
});

bot.hears('📊 Statistika', async (ctx) => {
    const userCount = Object.keys(users).length;
    const kinoCount = Object.keys(kinolar).length;
    ctx.replyWithHTML(
        `<b>📊 Bot Statistikasi:</b>\n\n` +
        `👥 Foydalanuvchilar: <code>${userCount}</code>\n` +
        `🎬 Kinolar soni: <code>${kinoCount}</code>\n` +
        `📢 Kanallar: <code>${kanallar.length}</code>`
    );
});

// --- 7. XABARLARNI QAYTA ISHLASH (ENG KATTA QISM) ---
let tempVideo = {};

bot.on('video', (ctx) => {
    if (isAdmin(ctx.from.id)) {
        tempVideo[ctx.from.id] = ctx.message.video.file_id;
        ctx.reply("🎞 Video qabul qilindi. Ushbu video uchun kod kiriting:");
    }
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    // Obuna tekshiruvi (Oddiy foydalanuvchilar uchun)
    if (!isAdmin(userId) && !(await checkAllSubs(ctx))) {
        return ctx.reply("❌ Avval kanallarga a'zo bo'ling!", getSubButtons());
    }

    // Admin: Kanal qo'shish
    if (step[userId] === 'await_chan' && isAdmin(userId)) {
        const p = text.split(' ');
        if (p.length < 3) return ctx.reply("Format noto'g'ri!");
        kanallar.push({ link: p[0], id: p[1], name: p.slice(2).join(' ') });
        saveData(DB_FILES.kanallar, kanallar);
        delete step[userId];
        return ctx.reply("✅ Kanal qo'shildi!");
    }

    // Admin: Xabar yuborish (Rassilka)
    if (step[userId] === 'await_broadcast' && isAdmin(userId)) {
        const allUsers = Object.keys(users);
        ctx.reply(`Xabar yuborish boshlandi: ${allUsers.length} kishi...`);
        let count = 0;
        for (let user of allUsers) {
            try {
                await ctx.telegram.sendMessage(user, text);
                count++;
            } catch (e) { continue; }
        }
        delete step[userId];
        return ctx.reply(`Xabar ${count} kishiga yetib bordi! ✅`);
    }

    // Admin: Kino saqlash
    if (isAdmin(userId) && tempVideo[userId]) {
        kinolar[text] = tempVideo[userId];
        saveData(DB_FILES.kinolar, kinolar);
        delete tempVideo[userId];
        return ctx.reply(`🎬 Kino bazaga qo'shildi!\nKod: <b>${text}</b>`, { parse_mode: 'HTML' });
    }

    // --- FOYDALANUVCHI QIDIRUVI ---
    if (kinolar[text]) {
        ctx.replyWithVideo(kinolar[text], {
            caption: `🎬 <b>Kino kodi: ${text}</b>\n\n🍿 Yoqimli hordiq tilaymiz!\n🚀 Do'stlarga ham ulashing!`,
            parse_mode: 'HTML'
        });
    } else if (text === '🎲 Tasodifiy kino') {
        const keys = Object.keys(kinolar);
        if (keys.length === 0) return ctx.reply("Bazada kino yo'q.");
        const rand = keys[Math.floor(Math.random() * keys.length)];
        ctx.replyWithVideo(kinolar[rand], { caption: `🎲 Tasodifiy kino: <b>${rand}</b>`, parse_mode: 'HTML' });
    } else if (text === '👤 Profil') {
        ctx.replyWithHTML(`🆔 Sizning ID: <code>${userId}</code>\n👤 Ism: ${ctx.from.first_name}\n📅 Ro'yxatdan o'tgan sana: ${users[userId]?.date.split('T')[0]}`);
    } else if (text === '🔍 Kino qidirish') {
        ctx.reply("Kino kodini yuboring:");
    } else if (!isAdmin(userId) && !text.startsWith('/')) {
        ctx.reply("😔 Kechirasiz, bunday kodli kino topilmadi.\nKodni qayta tekshirib ko'ring.");
    }
});

// Xatoliklarni ushlash
bot.catch((err, ctx) => {
    console.log(`Ooops, xato yuz berdi: ${ctx.update_type}`, err);
});

bot.launch().then(() => {
    console.log("===============================");
    console.log("🚀 KINO BOT 2026 MUVAFFAQIYATLI YOQILDI");
    console.log("📡 Adminlar: " + MAIN_ADMINS.join(', '));
    console.log("===============================");
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));