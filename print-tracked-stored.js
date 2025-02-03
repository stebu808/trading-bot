import Redis from 'ioredis';
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
});

const mints = await redis.smembers("tracked_meme_coins");
console.log(mints);

process.exit();