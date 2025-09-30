// Fetch all followers for a given X (Twitter) user, with pagination
// Usage (PowerShell):
//   $Env:X_BEARER_TOKEN = "YOUR_TOKEN"; pnpm followers "KrzysztofStaron"

const https = require("https");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchFollowersPage({ screenName, cursor = "-1", count = 200, bearerToken }) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      screen_name: screenName,
      cursor,
      count: String(count),
      skip_status: "true",
      include_user_entities: "false",
    });

    const url = `https://api.x.com/1.1/followers/list.json?${params.toString()}`;

    const req = https.request(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      },
      res => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", chunk => (body += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const json = JSON.parse(body);
              resolve({ json, rate: parseRateLimit(res.headers) });
            } catch (e) {
              reject(new Error(`Failed to parse JSON: ${e.message}`));
            }
          } else if (res.statusCode === 429) {
            resolve({ json: null, rate: parseRateLimit(res.headers), statusCode: 429 });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

function parseRateLimit(headers) {
  const limit = safeInt(headers["x-rate-limit-limit"]);
  const remaining = safeInt(headers["x-rate-limit-remaining"]);
  const reset = safeInt(headers["x-rate-limit-reset"]);
  return { limit, remaining, reset };
}

function safeInt(v) {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

async function fetchAllFollowers(screenName) {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error("Missing X_BEARER_TOKEN environment variable");
  }

  let cursor = "-1";
  const followers = [];

  while (cursor !== "0") {
    const { json, rate, statusCode } = await fetchFollowersPage({
      screenName,
      cursor,
      count: 200,
      bearerToken,
    });

    if (statusCode === 429) {
      const nowSec = Math.floor(Date.now() / 1000);
      const waitMs = rate && rate.reset ? Math.max(0, (rate.reset - nowSec + 1) * 1000) : 60_000;
      console.error(`Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s...`);
      await sleep(waitMs);
      continue;
    }

    if (!json || !Array.isArray(json.users)) {
      throw new Error("Unexpected API response (no users array)");
    }

    followers.push(...json.users);
    cursor = String(json.next_cursor_str || json.next_cursor || "0");

    // Be polite to the API
    await sleep(500);
  }

  return followers;
}

async function main() {
  const screenNameArg = process.argv[2] || "KrzysztofStaron";
  const followers = await fetchAllFollowers(screenNameArg);
  // Print as JSON lines: id, screen_name, name
  for (const u of followers) {
    console.log(JSON.stringify({ id: u.id_str || String(u.id), screen_name: u.screen_name, name: u.name }));
  }
  console.error(`Total followers: ${followers.length}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
