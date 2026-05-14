"use client";
import { useState, useEffect, useCallback } from "react";

const C = {
  bg: "#1a0f2e",
  bgCard: "#231540",
  bgCardHover: "#2a1a4e",
  border: "#3d2870",
  gold: "#c9a84c",
  goldLight: "#f0d080",
  plum: "#6b3fa0",
  plumLight: "#8b5cc0",
  text: "#e8dff5",
  textDim: "#b09fd0",
  textFaint: "#6a5f8a",
  green: "#6bdd99",
  red: "#e06b6b",
};

const TIER_THRESHOLDS = [
  { min: 5000, label: "Master of the Ledger", color: "#f0d080", emoji: "✦", multiplier: "2x" },
  { min: 3000, label: "Hearth Warden",        color: "#c084fc", emoji: "🔥", multiplier: "1.75x" },
  { min: 1500, label: "Flame Adept",          color: "#6bdd99", emoji: "⚗️", multiplier: "1.5x" },
  { min: 500,  label: "Ember Scribe",         color: "#f97316", emoji: "📜", multiplier: "1.25x" },
  { min: 0,    label: "Unranked",             color: "#b09fd0", emoji: "◈", multiplier: "1x" },
];

function getTier(pts) {
  return TIER_THRESHOLDS.find((t) => pts >= t.min) || TIER_THRESHOLDS[3];
}

function ProgressBar({ points }) {
  const nextTierIdx = TIER_THRESHOLDS.findIndex((t) => points >= t.min) - 1;
  if (nextTierIdx < 0) return <div style={{ height: 4, background: C.border, borderRadius: 2, marginTop: 4 }}><div style={{ width: "100%", height: "100%", background: C.gold, borderRadius: 2 }} /></div>;
  const next = TIER_THRESHOLDS[nextTierIdx];
  const curr = TIER_THRESHOLDS[nextTierIdx + 1];
  const pct = Math.min(100, ((points - curr.min) / (next.min - curr.min)) * 100);
  return (
    <div style={{ height: 4, background: C.border, borderRadius: 2, marginTop: 4, position: "relative" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${curr.color}, ${next.color})`, borderRadius: 2, transition: "width 0.8s ease" }} />
    </div>
  );
}

const StatCard = ({ label, value, sub, color }) => (
  <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 22px", flex: 1, minWidth: 140 }}>
    <div style={{ color: C.textFaint, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 28, fontWeight: 700, color: color || C.goldLight, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>{sub}</div>}
  </div>
);

export default function GuildLedger() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/loyalty");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filtered = (data?.leaderboard || []).filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const tier = getTier(m.points);
    const matchFilter = filter === "all" || tier.label.toLowerCase() === filter;
    return matchSearch && matchFilter;
  });

  const rankBadge = (i) => {
    if (i === 0) return { bg: "#c9a84c", text: "#1a0f2e", label: "1" };
    if (i === 1) return { bg: "#9ca3af", text: "#1a0f2e", label: "2" };
    if (i === 2) return { bg: "#cd7f32", text: "#1a0f2e", label: "3" };
    return { bg: C.bgCard, text: C.textDim, label: String(i + 1) };
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter', sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚗️</div>
          <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: 32, fontWeight: 900, color: C.goldLight, margin: 0, letterSpacing: "0.05em" }}>
            Guild Ledger
          </h1>
          <p style={{ color: C.textDim, fontSize: 14, marginTop: 6, letterSpacing: "0.1em" }}>
            COSMIC HEARTH GAMES · LOYALTY RANKINGS
          </p>
          {lastRefresh && (
            <p style={{ color: C.textFaint, fontSize: 11, marginTop: 4 }}>
              Last updated {lastRefresh.toLocaleTimeString()} · Auto-refreshes every 5 min
            </p>
          )}
        </div>

        {/* Stats Row */}
        {data && (
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <StatCard label="Guild Members" value={data.totalMembers} sub="enrolled in loyalty" />
            <StatCard label="Total Guild Marks" value={data.totalPoints.toLocaleString()} sub="across all members" color={C.plumLight} />
            <StatCard label="Ember Scribe" value="500 Marks" sub="first rank unlock" color={C.green} />
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
            style={{ flex: 1, minWidth: 180, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 14px", color: C.text, fontSize: 14, outline: "none" }}
          />
          {["all", "master of the ledger", "hearth warden", "flame adept", "ember scribe", "unranked"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? C.plum : C.bgCard,
                border: `1px solid ${filter === f ? C.plumLight : C.border}`,
                color: filter === f ? "#fff" : C.textDim,
                borderRadius: 20,
                padding: "6px 14px",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "'Cinzel', serif",
                letterSpacing: "0.05em",
                textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && !data && (
          <div style={{ textAlign: "center", padding: 60, color: C.textDim }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚗️</div>
            <div style={{ fontFamily: "'Cinzel', serif" }}>Consulting the Guild Ledger...</div>
          </div>
        )}

        {error && (
          <div style={{ background: "#3a1020", border: "1px solid #e06b6b", borderRadius: 10, padding: 20, color: C.red, textAlign: "center" }}>
            ⚠️ {error}
          </div>
        )}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((member, i) => {
              const tier = getTier(member.points);
              const badge = rankBadge(i);
              return (
                <div
                  key={member.id}
                  style={{
                    background: i < 3 ? `linear-gradient(135deg, ${C.bgCard}, ${C.bgCardHover})` : C.bgCard,
                    border: `1px solid ${i === 0 ? C.gold + "80" : C.border}`,
                    borderRadius: 12,
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    transition: "border-color 0.2s",
                  }}
                >
                  {/* Rank Badge */}
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: badge.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 13, color: badge.text }}>
                    {badge.label}
                  </div>

                  {/* Tier Emoji */}
                  <div style={{ fontSize: 18, flexShrink: 0 }}>{tier.emoji}</div>

                  {/* Member Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: i < 3 ? C.goldLight : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {member.name}
                    </div>
                    <div style={{ fontSize: 11, color: tier.color, marginBottom: 2 }}>{tier.label} · {tier.multiplier} points</div>
                    <ProgressBar points={member.points} />
                  </div>

                  {/* XP */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, fontWeight: 700, color: i === 0 ? C.goldLight : C.text }}>
                      {member.points}
                    </div>
                    <div style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.1em" }}>MARKS</div>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && data.leaderboard.length > 0 && (
              <div style={{ textAlign: "center", padding: 40, color: C.textFaint, fontStyle: "italic" }}>
                No members match your search.
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 40, paddingBottom: 20 }}>
          <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.gold}40, transparent)`, marginBottom: 16 }} />
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.3em", color: C.textFaint }}>
            ✦ AS THE FIRE GROWS, SO DOES YOUR LEGEND ✦
          </div>
          <button
            onClick={fetchData}
            style={{ marginTop: 12, background: "transparent", border: `1px solid ${C.border}`, color: C.textDim, borderRadius: 6, padding: "6px 16px", fontSize: 12, cursor: "pointer" }}
          >
            ↺ Refresh Now
          </button>
        </div>
      </div>
    </div>
  );
}
