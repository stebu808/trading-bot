import WebSocket from 'ws';
import { config } from 'dotenv';
import Redis from 'ioredis';
import { fetchFromProxy } from './fetch.js';
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
  process.exit();
});

const ws = new WebSocket('wss://pumpportal.fun/api/data');

ws.on('open', function open() {
  let payload = {
    method: "subscribeRaydiumLiquidity", 
  }
  ws.send(JSON.stringify(payload));
});

ws.on('message', function message(data) {
  const coinData = JSON.parse(data);
  const { mint: address } = coinData;

  address && redis.sadd("tracked_meme_coins", address);
});

const fetchPriceAsPair = async (tokenAddress) => {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
  const data = await fetchFromProxy(url);

  if (data.pairs && data.pairs.length > 0) {
    return data.pairs[0];
  }

  return null;
}

// Thresholds for selection criteria
const MIN_MARKET_CAP = 50000; // Minimum acceptable market cap in USD
const MIN_LIQUIDITY = 10000;  // Minimum liquidity in USD
const MIN_PRICE_CHANGE = 5;   // Minimum 1-hour price increase in percentage
const MIN_VOLUME = 5000;      // Minimum trading volume in last 1 hour
const filterMemeCoins = (coin) => {
  const marketCap = coin.marketCap || 0;
  const liquidity = coin.liquidity?.usd || 0;
  const priceChange = coin.priceChange?.h1 || 0;
  const volume = coin.volume?.h1 || 0;

  return (
    marketCap >= MIN_MARKET_CAP &&
    liquidity >= MIN_LIQUIDITY &&
    priceChange >= MIN_PRICE_CHANGE &&
    volume >= MIN_VOLUME
  );
}

const main = () => {
  setInterval(async () => {
    const trackedMints = await getTrackedMemeCoins();

    const trackedMemes = trackedMints.map(async (mint) => {
      if (!mint) return;
      const priceData = await fetchPriceAsPair(mint);
      return priceData;
    })

    const filteredMemes = trackedMemes.filter(filterMemeCoins);

    console.log(filteredMemes);
  }, UPDATE_INTERVAL)
}
main()