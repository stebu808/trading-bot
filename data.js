import WebSocket from 'ws';
import { config } from 'dotenv';
import Redis from 'ioredis';
import { fetchFromProxy } from './fetch.js';
import { sendTelegramMessage } from './sendTelegramMessage.js';
config();

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
});

const UPDATE_INTERVAL = 60 * 1000; // 1 minute

// Function to get meme coins saved in Redis
async function getTrackedMemeCoins() {
  try {
    const mints = await redis.smembers("tracked_meme_coins"); // Assuming set storage
    return mints;
  } catch (error) {
    console.error("Error fetching tracked meme coins from Redis:", error);
    return [];
  }
}

// Handle app shutdown
process.on("SIGINT", async () => {
  console.log("Closing Redis connection...");
  await redis.quit();
  ws.close();
  process.exit();
});

const ws = new WebSocket('wss://pumpportal.fun/api/data');

ws.on('open', function open() {
  let payload = {
    method: "subscribeRaydiumLiquidity", 
  }
  console.log("Subscribing to Raydium liquidity updates...");
  ws.send(JSON.stringify(payload));
});

ws.on('message', function message(data) {
  const coinData = JSON.parse(data);

  if (coinData?.mint) {
    console.log("New meme coin found:", coinData.mint);
    redis.sadd("tracked_meme_coins", coinData.mint);
  }
});

ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('WebSocket closed');
});

const fetchPriceAsPair = async (tokenAddress) => {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
  const data = await fetchFromProxy(url);

  if (data?.pairs && data.pairs?.length > 0) {
    return data.pairs[0];
  }

  return null;
}

// Thresholds for selection criteria
const MIN_MARKET_CAP = 100000; // Minimum acceptable market cap in USD
const MIN_LIQUIDITY = 30000;  // Minimum liquidity in USD
const MIN_PRICE_CHANGE = 50;   // Minimum 1-hour price increase in percentage
const MIN_VOLUME = 100000;      // Minimum trading volume in last 1 hour
const filterMemeCoins = (coin) => {
  if (!coin || !coin.baseToken || !coin.baseToken.address) return false;

  const marketCap = coin.marketCap || 0;
  const liquidity = coin.liquidity?.usd || 0;
  const priceChange = coin.priceChange?.h1 || 0;
  const volume = coin.volume?.h1 || 0;

  return marketCap >= MIN_MARKET_CAP &&
    liquidity >= MIN_LIQUIDITY &&
    priceChange >= MIN_PRICE_CHANGE &&
    volume >= MIN_VOLUME
  ;
}

const sendMemeCoinAlert = (coin) => {
  function formatNumber(num) {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
    return num.toLocaleString();
  }

  const message = `
    🚀 *Meme Coin Alert!* 🚀

    🪙 *Token:* ${coin.baseToken.name}
    🪙 *Address:* ${coin.baseToken.address}
    💰 *Market Cap:* $${formatNumber(coin.marketCap)}
    📊 *Liquidity:* SOL ${formatNumber(coin.liquidity.quote)}
    📈 *Price Change (1h):* ${coin.priceChange.h1}%
    📈 *Price in USD*: $${coin.priceUsd}
    📊 *1h Volume:* $${formatNumber(coin.volume.h1)}
    🔗 [View on GMGN](https://gmgn.ai/sol/token/${coin.baseToken.address})
  `;

  sendTelegramMessage(message);
}

const main = () => {
  const alreadySent = new Set();

  setInterval(async () => {
    const trackedMints = await getTrackedMemeCoins();

    const trackedMemes = await Promise.all(trackedMints.map(async (mint) => {
      if (!mint) return null;
      const priceData = await fetchPriceAsPair(mint);
      return priceData;
    }))

    const filteredMemes = trackedMemes.filter(filterMemeCoins);

    filteredMemes.forEach((coin) => {
      if (alreadySent.has(coin.baseToken.address)) return;

      sendMemeCoinAlert(coin);
      alreadySent.add(coin.baseToken.address);
    })
  }, UPDATE_INTERVAL)
}
main()