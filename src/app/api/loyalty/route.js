const SQUARE_BASE = "https://connect.squareup.com/v2";

async function squareGet(path, token) {
  const res = await fetch(`${SQUARE_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Square-Version": "2024-04-17",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Square API error: ${res.status}`);
  return res.json();
}

async function getAllLoyaltyAccounts(token) {
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
      body: JSON.stringify({ cursor, limit: 100, query: {} }),
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

export async function GET() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "Missing SQUARE_ACCESS_TOKEN" }, { status: 500 });
  }

  try {
    const programData = await squareGet("/loyalty/programs/main", token);
    const program = programData.program;

    const accounts = await getAllLoyaltyAccounts(token);

    // Sort by lifetime_points — the all-time Guild Marks earned (not spendable balance)
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
