const { Telegraf, Markup } = require('telegraf');

// Pega aquí el Token que te dio @BotFather
const bot = new Telegraf('7650482106:AAHV0-Y1yCE-jxyYlVVoIyo4iRUlZrB8zdg');

bot.command('start', (ctx) => {
    ctx.reply('¡Bienvenido al Kaergsty Hub!', 
        Markup.keyboard([
            // Aquí pones el link que conseguiste de GitHub Pages
            [Markup.button.webApp('🚀 Abrir Catálogo', 'https://kaergsty.github.io/ATC/')]
        ]).resize()
    );
});

bot.help((ctx) => ctx.reply('¿En qué puedo ayudarte?'));

bot.launch();
console.log("Bot en marcha y Mini App enlazada...");
