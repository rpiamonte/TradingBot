'use strict';

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const crypto = require('node:crypto');

const DIR = __dirname;
const BASE = 'btcusdt-1m-validation-2026-07-19';
const FINAL = path.join(DIR, BASE + '.json');
const PART = path.join(DIR, BASE + '.jsonl.part');
const STATE = path.join(DIR, BASE + '.checkpoint.json');

const START = Date.parse('2026-04-20T00:00:00Z');
const END = Date.parse('2026-07-19T00:00:00Z');
const STEP = 60000;
const LIMIT = 100;
const EXPECTED = (END - START) / STEP;

const wait = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

function fetchPage(cursor) {
  return new Promise((resolve, reject) => {
    const q = new URLSearchParams({
      instId: 'BTC-USDT',
      bar: '1m',
      limit: String(LIMIT),
      after: String(cursor)
    });

    const url =
      'https://www.okx.com/api/v5/market/history-candles?' + q;

    const req = https.get(url, res => {
      let body = '';

      res.on('data', chunk => {
        body += chunk;
        if (body.length > 2000000)
          req.destroy(new Error('Response too large'));
      });

      res.on('end', () => {
        try {
          if (res.statusCode !== 200)
            throw Error('HTTP ' + res.statusCode);

          const j = JSON.parse(body);

          if (j.code !== '0' || !Array.isArray(j.data))
            throw Error('OKX ' + j.code + ': ' + j.msg);

          resolve(j.data);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.setTimeout(20000, () =>
      req.destroy(new Error('Timeout'))
    );

    req.on('error', reject);
  });
}

async function retry(cursor) {
  let last;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fetchPage(cursor);
    } catch (e) {
      last = e;
      console.error('Retry:', attempt + 1, e.message);
      await wait(Math.min(30000, 1500 * 2 ** attempt));
    }
  }

  throw last;
}

function normalize(r) {
  return {
    timestamp: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
    confirmed: r[8] === '1'
  };
}

function valid(c) {
  return Number.isSafeInteger(c.timestamp) &&
    c.timestamp % STEP === 0 &&
    [c.open, c.high, c.low, c.close, c.volume]
      .every(Number.isFinite) &&
    c.open > 0 &&
    c.low > 0 &&
    c.high >= Math.max(c.open, c.close, c.low) &&
    c.low <= Math.min(c.open, c.close, c.high) &&
    c.volume >= 0 &&
    c.confirmed;
}

function saveState(state) {
  const temp = STATE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(state, null, 2));
  fs.renameSync(temp, STATE);
}

async function main() {
  if (fs.existsSync(FINAL))
    throw Error('Final file exists; refusing overwrite');

  let state;

  if (fs.existsSync(STATE)) {
    state = JSON.parse(fs.readFileSync(STATE, 'utf8'));

    if (!fs.existsSync(PART))
      throw Error('Checkpoint exists without partial data');

    if (state.start !== START || state.end !== END)
      throw Error('Checkpoint date range mismatch');

    const lines = fs.readFileSync(PART, 'utf8')
      .trim().split('\n').filter(Boolean);

    if (lines.length !== state.count)
      throw Error('Checkpoint count mismatch');

    let previous = END;

    for (const line of lines) {
      const c = JSON.parse(line);

      if (!valid(c) || c.timestamp !== previous - STEP)
        throw Error('Invalid checkpoint data');

      previous = c.timestamp;
    }

    if (previous !== state.cursor)
      throw Error('Checkpoint cursor mismatch');

  } else {
    if (fs.existsSync(PART))
      throw Error('Partial data exists without checkpoint');

    state = {
      start: START,
      end: END,
      cursor: END,
      count: 0
    };

    fs.writeFileSync(PART, '', { flag: 'wx' });
    saveState(state);
  }

  console.log('=== BTCUSDT 90-DAY DOWNLOAD ===');
  console.log('Progress:', state.count, '/', EXPECTED);

  while (state.cursor > START) {
    const page = await retry(state.cursor);

    if (!page.length)
      throw Error('API returned empty page');

    const items = page.map(normalize)
      .filter(c =>
        c.timestamp >= START &&
        c.timestamp < state.cursor &&
        c.timestamp < END
      )
      .sort((a, b) => b.timestamp - a.timestamp);

    if (!items.length)
      throw Error('API returned no older candles');

    let previous = state.cursor;

    for (const c of items) {
      if (!valid(c))
        throw Error('Invalid candle: ' + c.timestamp);

      if (c.timestamp !== previous - STEP)
        throw Error(
          'Missing candle near ' +
          new Date(previous - STEP).toISOString()
        );

      previous = c.timestamp;
    }

    fs.appendFileSync(
      PART,
      items.map(c => JSON.stringify(c)).join('\n') + '\n'
    );

    state.cursor = previous;
    state.count += items.length;
    saveState(state);

    if (state.count % 1000 < items.length) {
      console.log(
        'Downloaded:', state.count, '/', EXPECTED
      );
    }

    await wait(450);
  }

  if (state.count !== EXPECTED)
    throw Error('Incomplete historical dataset');

  const candles = fs.readFileSync(PART, 'utf8')
    .trim().split('\n').map(JSON.parse).reverse();

  if (
    candles[0].timestamp !== START ||
    candles.at(-1).timestamp !== END - STEP
  ) {
    throw Error('Final timestamp range mismatch');
  }

  const temp = FINAL + '.tmp';

  fs.writeFileSync(temp, JSON.stringify(candles));
  fs.renameSync(temp, FINAL);

  const hash = crypto.createHash('sha256')
    .update(fs.readFileSync(FINAL))
    .digest('hex');

  console.log('PASS: Download complete');
  console.log('Candles:', candles.length);
  console.log('SHA256:', hash);
  console.log('Saved:', FINAL);
}

main().catch(error => {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
});
