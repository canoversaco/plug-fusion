const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios"); // Damit wir per HTTP an dein Backend senden können

const TELEGRAM_TOKEN = "7459654349:AAE3UmBpba5o8eXMOFtbLeZwlRUOiGsl5z8";
const API_URL = "http://185.198.234.220:3666/api/save-telegram-id"; // <-- Passe hier ggf. deine Backend-URL an

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });


bot.on("message", (msg) => {
  console.log("Empfange Nachricht:", msg);
    bot.sendMessage(msg.chat.id, "Testantwort von PlugBot! Deine ChatId: " + msg.chat.id)
    .then(() => console.log("Gesendet!"))
    .catch(e => console.error("SEND-FEHLER:", e));
});
// /start command mit optionalem payload
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const payload = match[1]; // alles nach /start (z.B. plug_abc123)

  // Erwartetes Format: plug_USERID
  if (payload && payload.startsWith("plug_")) {
    const userId = payload.replace("plug_", "").trim();
    console.log("[DEBUG] Sende Request an:", API_URL, userId, chatId);
    await axios.post(API_URL, {
      userId,
      chatId,
    });
    // Schicke die userId + chatId an dein Backend, damit du später Notifications schicken kannst!
    try {
      await axios.post(API_URL, {
        userId,
        chatId,
      });
      await bot.sendMessage(
        chatId,
        `✅ Telegram-Benachrichtigungen wurden erfolgreich aktiviert!\nDu bekommst jetzt wichtige Updates direkt hier.`
      );
    } catch (e) {
      await bot.sendMessage(
        chatId,
        `❌ Fehler beim Verknüpfen mit der App: ${e.response?.data?.message || e.message}`
      );
    }
  } else {
    // Fallback, falls jemand ohne App-Link den Bot startet
    await bot.sendMessage(
      chatId,
      `👋 Willkommen beim PlugBot! Bitte aktiviere Benachrichtigungen über den Link in deiner App, damit wir dich eindeutig zuordnen können.`
    );
  }
});

// (Optional) Reagiere auf /help oder andere Commands
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `Verwende den Aktivierungs-Link aus der App, um Telegram-Benachrichtigungen zu erhalten.`
  );
});

// (Optional) Zeige an, wenn Nachrichten empfangen werden
bot.on("message", (msg) => {
  if (msg.text && !msg.text.startsWith("/")) {
    bot.sendMessage(
      msg.chat.id,
      `ℹ️ Dies ist ein reiner Benachrichtigungs-Bot. Nutze den Aktivierungs-Link aus der App!`
    );
  }
});

console.log("PlugBot läuft und wartet auf /start-Nachrichten.");
