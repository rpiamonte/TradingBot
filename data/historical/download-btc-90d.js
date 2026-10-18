'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const DIR = __dirname;
const OUTPUT = path.join(
  DIR, 'btcusdt-1m-90d-2026-10-17.json'
);
const CHECKPOINT = path.join(
  DIR, 'btcusdt-1m-90d.checkpoint.json'
);

const START = Date.parse('2026-07-19T00:00:00Z');
const END = Date.parse('2026-10-17T00:00:00Z');
const INTERVAL = 60000;
const LIMIT = 100;

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

function request(before) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      instId: 'BTC-USDT',
      bar: '1m',
      limit: String(LIMIT),
      before: String(before)
    });

    const url =
      'https://www.okx.com/api/v5/market/history-candles?' +
      params.toString();

    https.get(url, { timeout: 15000 }, res => {
      let body = '';

      res.on('data', chunk => body += chunk);

      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            throw new Error('HTTP ' + res.statusCode);
          }

          const json = JSON.parse(body);

          if (json.code !== '0' ||
              !Array.isArray(json.data)) {
            throw new Error(
              'OKX API error: ' + json.code
            );
          }

          resolve(json.data);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

function normalize(row) {
  return {
    timestamp: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    confirmed: row[8] === '1'
  };
}

function validate(c) {
  return (
    Number.isSafeInteger(c.timestamp) &&
    c.timestamp % INTERVAL === 0 &&
    [c.open, c.high, c.low, c.close, c.volume]
      .every(Number.isFinite) &&
    c.open > 0 &&
    c.high >= Math.max(c.open, c.close, c.low) &&
    c.low <= Math.min(c.open, c.close, c.high) &&
    c.volume >= 0 &&
    c.confirmed
  );
}

async function main() {
  if (fs.existsSync(OUTPUT)) {
    throw new Error('Output exists; refusing overwrite');
  }

  if (fs.existsSync(CHECKPOINT)) {
    throw new Error(
      'Existing checkpoint detected. Review before resuming.'
    );
  }

  console.log('=== BTCUSDT 90-DAY DOWNLOADER ===');
  console.log('Start:', new Date(START).toISOString());
  console.log('End:', new Date(END).toISOString());
  console.log('Expected candles:', (END - START) / INTERVAL);
  console.log('Batch limit:', LIMIT);
  console.log('Downloader ready.');
  console.log('No API download started.');
}

if (require.main === module) {
  main().catch(error => {
    console.error('FAIL:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  request,
  normalize,
  validate
};
