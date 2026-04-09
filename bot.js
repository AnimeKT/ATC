const { Telegraf } = require('telegraf');

const bot = new Telegraf('7650482106:AAHV0-Y1yCE-jxyYlVVoIyo4iRUlZrB8zdg');

bot.start((ctx) => ctx.reply('¡Bot conectado y funcionando!'));
bot.help((ctx) => ctx.reply('¿En qué puedo ayudarte?'));

// Ejemplo de respuesta a un mensaje
bot.on('text', (ctx) => {
    ctx.reply(`Has dicho: ${ctx.message.text}`);
});

bot.launch();
console.log("Bot en marcha...");