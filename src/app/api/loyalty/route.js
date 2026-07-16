const SQUARE_BASE = "https://connect.squareup.com/v2";

// Both Cosmic Hearth locations
const LOCATION_IDS = [
  "LNTH08FTG95BB",   // Concord
  "LNDCH2DW9Y3XM",   // Pineville
];

// Staff blocklist — set BLOCKED_CUSTOMER_IDS in Vercel env vars
// as a comma-separated list of Square customer IDs
function getBlockedIds() {
  const raw = process.env.BLOCKED_CUSTOMER_IDS || "";
  return new Set(raw.split(",").map((id) => id.trim()).filter(Boolean));
}

async function squareGet(path, token) {
  const res = await fetch(`${SQUARE_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Square-Version": "2024-04-17",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Square API error ${res.status} on ${path}`);
  return res.json();
}

async function getAllLoyaltyAccounts(token) {
  // Search across all locations by not filtering by location_id —
  // Square loyalty accounts are program-wide, but we explicitly pass
  // both location IDs to ensure full coverage.
  let accounts = [];
  let cursor = null;
  do {
    const res = await fetch(`${SQUARE_BASE}/loyalty/accounts/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-04-17",
      },
      body: JSON.stringify({
        cursor,
        limit: 100,
        query: {},  // no filter = all accounts across all locations
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Square loyalty search error: ${res.status}`);
    const data = await res.json();
    accounts = accounts.concat(data.loyalty_accounts || []);
    cursor = data.cursor || null;
  } while (cursor);
  return accounts;
}

async function getCustomerName(customerId, token) {
  try {
    const data = await squareGet(`/customers/${customerId}`, token);
    const c = data.customer;
    if (!c) return "Unknown";
    return [c.given_name, c.family_name].filter(Boolean).join(" ") || c.email_address || "Unknown";
  } catch {
    return "Unknown";
  }
}

export async function GET(request) {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing SQUARE_ACCESS_TOKEN" }, { status: 500 });
  }

  try {
    const programData = await squareGet("/loyalty/programs/main", token);
    const program = programData.program;

    const allAccounts = await getAllLoyaltyAccounts(token);

    // Deduplicate by customer_id (a customer could theoretically appear twice)
    const seen = new Set();
    const deduped = allAccounts.filter((a) => {
      const key = a.customer_id || a.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filter out staff/blocked accounts
    const blockedIds = getBlockedIds();
    const accounts = deduped.filter(
      (a) => !a.customer_id || !blockedIds.has(a.customer_id)
    );

    // Sort by lifetime_points (all-time Guild Marks earned), take top 50
    const topAccounts = [...accounts]
      .sort((a, b) => (b.lifetime_points || 0) - (a.lifetime_points || 0))
      .slice(0, 50);

    const enriched = await Promise.all(
      topAccounts.map(async (acc) => {
        const name = acc.customer_id
          ? await getCustomerName(acc.customer_id, token)
          : "Guest";
        return {
          id: acc.id,
          name,
          points: acc.lifetime_points || 0,
          balance: acc.balance || 0,
          customerId: acc.customer_id,
        };
      })
    );

    return Response.json({
      program: {
        id: program?.id,
        status: program?.status,
        pointsPerDollar: program?.accrual_rules?.[0]?.points || 1,
        rewardThreshold: program?.reward_tiers?.[0]?.points_cost || 50,
      },
      totalMembers: accounts.length,
      totalPoints: accounts.reduce((s, a) => s + (a.lifetime_points || 0), 0),
      leaderboard: enriched,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
