import { config } from 'dotenv';
import { agent } from './fetch.js';
import fetch from 'node-fetch';
config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  
export const sendTelegramMessage = async (text) => {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
  const params = {
    chat_id: TELEGRAM_CHAT_ID,
    text: text,
    parse_mode: "Markdown",
  };
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      agent,
    });
  
    const data = await response.json();
    if (data.ok) {
      console.log("✅ Message sent successfully:", text);
    } else {
      console.error("❌ Telegram API error:", data);
    }
  } catch (error) {
    console.error("❌ Failed to send message:", error);
  }
}