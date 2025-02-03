import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxy = 'http://127.0.0.1:4780'; // Set proxy URL
const agent = new HttpsProxyAgent(proxy);

export const fetchFromProxy = async (url) => {
  try {
    const response = await fetch(url, { agent });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Fetch error:", error.message);
  }
};