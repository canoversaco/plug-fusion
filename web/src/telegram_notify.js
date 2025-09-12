const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const cors = require("cors"); // <--- HINZUFÜGEN

const TELEGRAM_TOKEN = "7459654349:AAE3UmBpba5o8eXMOFtbLeZwlRUOiGsl5z8";
const app = express();
app.use(cors()); // <--- HINZUFÜGEN
app.use(bodyParser.json());

// SICHERHEITSTIPP: Authentifiziere am besten per Secret im Header!
app.post("/send-telegram", async (req, res) => {
  try {
    const { chatId, text } = req.body;
    if (!chatId || !text) return res.status(400).send("Missing params");

    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
      }
    );
    res.status(200).send("Sent!");
  } catch (e) {
    res.status(500).send(e.toString());
  }
});

// Port: z. B. 3667
app.listen(3667, () => {
  console.log("Telegram Notify API läuft auf 3667");
});

