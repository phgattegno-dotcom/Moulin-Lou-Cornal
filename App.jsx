import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ── Supabase ───────────────────────────────────────────────────────────────────
const SB_URL = "https://tngasfrizwssezpbhpdh.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZ2FzZnJpendzc2V6cGJocGRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MjIzMjIsImV4cCI6MjA5MjI5ODMyMn0.LMhj9PAy1Lc4gVjqHbBh5MH0lpKpMKLoQFTV5NOm-U8";
const SB_HEADERS = {
  "Content-Type": "application/json",
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Prefer": "return=representation",
};

const sbGet = (table, order = "") =>
  fetch(`${SB_URL}/rest/v1/${table}?select=*${order ? "&order=" + order : ""}`, { headers: SB_HEADERS })
    .then(r => r.json()).catch(() => null);

const sbPost = (table, body) =>
  fetch(`${SB_URL}/rest/v1/${table}`, { method: "POST", headers: SB_HEADERS, body: JSON.stringify(body) })
    .then(r => r.json()).then(d => ({ ok: true, data: Array.isArray(d) ? d : [d] })).catch(() => ({ ok: false }));

const sbUpsert = (table, body) =>
  fetch(`${SB_URL}/rest/v1/${table}`, { method: "POST", headers: { ...SB_HEADERS, "Prefer": "return=representation,resolution=merge-duplicates" }, body: JSON.stringify(body) })
    .then(r => r.json()).catch(() => null);

const sbPatch = (table, col, val, body) =>
  fetch(`${SB_URL}/rest/v1/${table}?${col}=eq.${val}`, { method: "PATCH", headers: SB_HEADERS, body: JSON.stringify(body) })
    .then(r => ({ ok: r.ok })).catch(() => ({ ok: false }));

const sbDelete = (table, col, val) =>
  fetch(`${SB_URL}/rest/v1/${table}?${col}=eq.${val}`, { method: "DELETE", headers: SB_HEADERS })
    .then(r => ({ ok: r.ok })).catch(() => ({ ok: false }));

// ── LocalStorage ───────────────────────────────────────────────────────────────
const LS = { prod: "mlc_prod", ventes: "mlc_ventes", cmd: "mlc_cmd", stocks: "mlc_stocks" };
const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ── Constantes ─────────────────────────────────────────────────────────────────
const FARINES  = ["T65 Blé", "T80 Blé", "T110 Blé", "T80 Épeautre", "T80 Sarrasin"];
const FORMATS  = ["1 kg", "5 kg", "25 kg"];
const CANAUX   = ["Marché", "Boutique", "BtoB", "Internet"];
const EQUIPE   = ["Nadège", "Viviane", "Laetitia", "Lou", "Amélie", "Audrey"];
const CLIENTS  = ["Marché Villeneuve", "Marché Pujols", "Marché Agen", "La Ferme"];
const STATUTS  = ["En attente", "Confirmée", "Préparée", "Livrée", "Annulée"];
const STATUT_STYLE = {
  "En attente": { bg: "#fff8e1", color: "#f57f17" },
  "Confirmée":  { bg: "#e3f2fd", color: "#1565c0" },
  "Préparée":   { bg: "#f3e5f5", color: "#6a1b9a" },
  "Livrée":     { bg: "#e8f5e9", color: "#2e7d32" },
  "Annulée":    { bg: "#fce4ec", color: "#c62828" },
};
const COULEURS = {
  "T65 Blé": "#c8a96e", "T80 Blé": "#a07840", "T110 Blé": "#7a5c2e",
  "T80 Épeautre": "#b5895a", "T80 Sarrasin": "#6b5040",
};
const SEUILS_DEFAUT = {
  grains:   { global: 100, "Blé": 100, "Épeautre": 60, "Sarrasin": 50 },
  farines:  { global: 50, "T65 Blé": 60, "T80 Blé": 50, "T110 Blé": 40, "T80 Épeautre": 30, "T80 Sarrasin": 30 },
  packaged: { global: 10 },
};
const STOCKS_INIT = {
  grains:   { "Blé": 850, "Épeautre": 200, "Sarrasin": 150 },
  farines:  { "T65 Blé": 240, "T80 Blé": 180, "T110 Blé": 120, "T80 Épeautre": 60, "T80 Sarrasin": 45 },
  packaged: {}
};

const fmt = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—";
const today = new Date().toISOString().split("T")[0];

function rowsToStocks(rows) {
  const s = { grains: {}, farines: {}, packaged: {} };
  rows.forEach(r => { if (s[r.categorie]) s[r.categorie][r.nom] = r.valeur; });
  return s;
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function MoulinApp() {
  const [tab, setTab] = useState("dashboard");
  const [saving, setSaving] = useState(false);
  const [sync, setSync] = useState("local");

  const [stocks,      setStocksRaw]  = useState(lsGet(LS.stocks, STOCKS_INIT));
  const [productions, setProdsRaw]   = useState(lsGet(LS.prod, []));
  const [ventes,      setVentesRaw]  = useState(lsGet(LS.ventes, []));
  const [commandes,   setCmdsRaw]    = useState(lsGet(LS.cmd, []));
  const [seuils,      setSeuils]     = useState(SEUILS_DEFAUT);

  const [showProd, setShowProd]   = useState(false);
  const [showVente, setShowVente] = useState(false);
  const [showCmd, setShowCmd]     = useState(false);
  const [showSeuils, setShowSeuils] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // Réinitialisation complète des données locales
  const resetData = () => {
    Object.values(LS).forEach(k => localStorage.removeItem(k));
    setStocksRaw({ grains: { "Blé": 0, "Épeautre": 0, "Sarrasin": 0 }, farines: { "T65 Blé": 0, "T80 Blé": 0, "T110 Blé": 0, "T80 Épeautre": 0, "T80 Sarrasin": 0 }, packaged: {} });
    setProdsRaw([]);
    setVentesRaw([]);
    setCmdsRaw([]);
    setShowReset(false);
  };

  const setStocks = (fn) => setStocksRaw(p => { const n = typeof fn === "function" ? fn(p) : fn; lsSet(LS.stocks, n); return n; });
  const setProds  = (fn) => setProdsRaw(p  => { const n = typeof fn === "function" ? fn(p) : fn; lsSet(LS.prod, n); return n; });
  const setVentes = (fn) => setVentesRaw(p => { const n = typeof fn === "function" ? fn(p) : fn; lsSet(LS.ventes, n); return n; });
  const setCmds   = (fn) => setCmdsRaw(p   => { const n = typeof fn === "function" ? fn(p) : fn; lsSet(LS.cmd, n); return n; });

  // Sync Supabase en arrière-plan au démarrage
  useEffect(() => {
    setSync("syncing");
    sbGet("stocks").then(data => {
      if (Array.isArray(data) && data.length > 0) {
        const s = rowsToStocks(data); setStocksRaw(s); lsSet(LS.stocks, s); setSync("synced");
      } else { setSync("local"); }
    }).catch(() => setSync("local"));
    sbGet("productions", "date.desc").then(data => { if (Array.isArray(data) && data.length > 0) { setProdsRaw(data); lsSet(LS.prod, data); } });
    sbGet("ventes", "date.desc").then(data => { if (Array.isArray(data) && data.length > 0) { setVentesRaw(data); lsSet(LS.ventes, data); } });
    sbGet("commandes", "date.desc").then(data => { if (Array.isArray(data) && data.length > 0) { const d = data.map(c => ({ ...c, lignes: c.lignes || [] })); setCmdsRaw(d); lsSet(LS.cmd, d); } });
  }, []);

  // Sauvegarde production
  const saveProd = async (p) => {
    setSaving(true);
    const parts = p.farine.split(" – ");
    const farineNom = parts[0]; // ex: "T65 Blé"
    const format = parts[1] || ""; // ex: "25 kg" ou "Vrac"
    const isVrac = format === "Vrac";
    const poidsFmt = isVrac ? 1 : parseInt(format);
    const unites = parseInt(p.qty);
    const kgTotal = isVrac ? unites : unites * poidsFmt;

    const newProd = { ...p, id: Date.now(), qty: kgTotal, rendement: parseInt(p.rendement) };
    setProds(prev => [newProd, ...prev]);

    if (isVrac) {
      // → Farines en vrac
      const cur = stocks.farines[farineNom] || 0;
      const newVal = cur + kgTotal;
      setStocks(prev => ({ ...prev, farines: { ...prev.farines, [farineNom]: newVal } }));
      sbUpsert("stocks", { categorie: "farines", nom: farineNom, valeur: newVal });
    } else {
      // → Produits conditionnés
      const sku = p.farine; // ex: "T65 Blé – 25 kg"
      const cur = stocks.packaged[sku] || 0;
      const newVal = cur + unites;
      setStocks(prev => ({ ...prev, packaged: { ...prev.packaged, [sku]: newVal } }));
      sbUpsert("stocks", { categorie: "packaged", nom: sku, valeur: newVal });
    }

    sbPost("productions", { date: p.date, farine: p.farine, qty: kgTotal, rendement: parseInt(p.rendement), lot: p.lot, operateur: p.operateur, note: p.note || "" })
      .then(res => { if (res.ok && res.data?.[0]) { setProds(prev => [res.data[0], ...prev.slice(1)]); } });
    setSaving(false);
    setShowProd(false);
  };

  // Sauvegarde vente
  const saveVente = async ({ header, lignes }) => {
    setSaving(true);
    const venteId = "V" + String(Date.now()).slice(-5);
    const newLines = lignes.map((l, i) => ({ id: Date.now() + i, vente_id: venteId, date: header.date, client: header.client, canal: header.canal, vendu_par: header.vendu_par, sku: l.sku, qty: parseFloat(l.qty), prix: parseFloat(l.prix) }));
    setVentes(prev => [...newLines, ...prev]);
    const rows = lignes.map(l => ({ vente_id: venteId, date: header.date, client: header.client, canal: header.canal, vendu_par: header.vendu_par, sku: l.sku, qty: parseFloat(l.qty), prix: parseFloat(l.prix) }));
    sbPost("ventes", rows);
    setSaving(false);
    setShowVente(false);
  };

  // Sauvegarde commande
  const saveCmd = async ({ header, lignes }) => {
    setSaving(true);
    const commandeId = "CMD-" + String(Date.now()).slice(-5);
    const newCmd = { id: Date.now(), commande_id: commandeId, date: header.date, client: header.client, livraison: header.livraison, saisie_par: header.saisie_par, note: header.note || "", statut: "En attente", lignes };
    setCmds(prev => [newCmd, ...prev]);
    sbPost("commandes", { commande_id: commandeId, date: header.date, client: header.client, livraison: header.livraison || null, saisie_par: header.saisie_par, note: header.note || "", statut: "En attente", lignes });
    setSaving(false);
    setShowCmd(false);
  };

  const updateStatut = async (id, statut) => {
    setCmds(prev => prev.map(c => c.id === id ? { ...c, statut } : c));
    sbPatch("commandes", "id", id, { statut });
  };

  const deleteCmd = async (id) => {
    setCmds(prev => prev.filter(c => c.id !== id));
    sbDelete("commandes", "id", id);
  };

  // Calculs
  const totalCA = ventes.reduce((s, v) => s + (v.qty * v.prix), 0);
  const totalKg = productions.reduce((s, p) => s + p.qty, 0);
  const ventesGroupees = [...new Map(ventes.map(v => [v.vente_id || v.venteId, v])).values()];
  const panierMoyen = ventesGroupees.length > 0 ? totalCA / ventesGroupees.length : 0;
  const alertes = Object.entries(stocks.grains).filter(([g, v]) => v < (seuils.grains[g] ?? seuils.grains.global)).length
                + Object.entries(stocks.farines).filter(([f, v]) => v < (seuils.farines[f] ?? seuils.farines.global)).length;
  const cmdEnAttente = commandes.filter(c => c.statut === "En attente").length;
  const prodParFarine = FARINES.filter(f => productions.some(p => p.farine === f)).map(f => ({ name: f.split(" ")[0] + (f.split(" ")[1] ? " " + f.split(" ")[1] : ""), kg: productions.filter(p => p.farine === f).reduce((s, p) => s + p.qty, 0) }));
  const ventesParFarine = FARINES.map(f => ({ name: f.split(" ")[0], ca: ventes.filter(v => (v.sku || "").startsWith(f)).reduce((s, v) => s + v.qty * v.prix, 0) }));

  return (
    <div style={{ fontFamily: "'Lora', Georgia, serif", background: "#f7f3ee", minHeight: "100vh", color: "#2d1f0e" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: #c8a96e; border-radius: 3px; }
        .card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(80,50,10,0.08); }
        .btn { cursor: pointer; border: none; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-weight: 500; transition: all .15s; }
        .btn-primary { background: #8b5e2a; color: #fff; padding: 10px 20px; font-size: 14px; }
        .btn-primary:hover { background: #6e4820; }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: #8b5e2a; border: 1.5px solid #c8a96e; padding: 8px 16px; font-size: 14px; }
        .btn-ghost:hover { background: #fdf5e8; }
        input, select, textarea { font-family: 'DM Sans', sans-serif; border: 1.5px solid #e0d0b8; border-radius: 8px; padding: 8px 12px; width: 100%; background: #fdfaf6; color: #2d1f0e; outline: none; font-size: 14px; }
        input:focus, select:focus, textarea:focus { border-color: #c8a96e; }
        label { font-size: 13px; font-weight: 500; color: #6b4c28; display: block; margin-bottom: 4px; font-family: 'DM Sans', sans-serif; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-family: 'DM Sans', sans-serif; font-weight: 500; }
        .badge-green { background: #e8f5e9; color: #2e7d32; }
        .badge-orange { background: #fff3e0; color: #e65100; }
        .badge-red { background: #fce4ec; color: #c62828; }
        .overlay { position: fixed; inset: 0; background: rgba(30,15,5,.45); z-index: 100; display: flex; align-items: center; justify-content: center; }
        .modal { background: #fff; border-radius: 16px; padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
        .tab-btn { padding: 10px 18px; border-radius: 8px; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: 500; font-size: 14px; transition: all .15s; background: transparent; color: #8b6d4a; }
        .tab-btn.active { background: #8b5e2a; color: #fff; }
        .tab-btn:hover:not(.active) { background: #f0e6d6; }
        .progress-bar { height: 8px; border-radius: 4px; background: #f0e6d6; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 4px; transition: width .4s; }
        table { width: 100%; border-collapse: collapse; font-family: 'DM Sans', sans-serif; font-size: 14px; }
        th { text-align: left; padding: 10px 14px; background: #f7f0e6; color: #6b4c28; font-weight: 600; font-size: 13px; }
        td { padding: 10px 14px; border-bottom: 1px solid #f0e6d6; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #fdfaf6; }
        .kpi-val { font-size: 28px; font-weight: 700; font-family: 'Lora', serif; }
        .kpi-label { font-size: 13px; color: #9a7a55; font-family: 'DM Sans', sans-serif; margin-top: 4px; }
        .sync-badge { display: flex; align-items: center; gap: 5px; font-size: 11px; font-family: 'DM Sans', sans-serif; padding: 3px 10px; border-radius: 20px; }
        .sync-synced { color: #4caf50; background: #e8f5e9; }
        .sync-syncing { color: #ff9800; background: #fff3e0; }
        .sync-local { color: #4caf50; background: #e8f5e9; }
      `}</style>

      {/* HEADER */}
      <header style={{ background: "#2d1f0e", color: "#f7f3ee", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🌾</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: ".5px" }}>Moulin Lou Cornal</div>
            <div style={{ fontSize: 11, color: "#c8a96e", fontFamily: "'DM Sans', sans-serif" }}>Gestion de production</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
          <div className={`sync-badge sync-${sync}`}>
            {sync === "synced" ? "● Supabase synchronisé" : sync === "syncing" ? "↻ Connexion…" : "● Données locales"}
          </div>
          {saving && <div style={{ fontSize: 12, color: "#ffcc80" }}>💾 Sauvegarde…</div>}
          {cmdEnAttente > 0 && <div style={{ color: "#80d8ff", fontSize: 12 }}>📋 {cmdEnAttente} en attente</div>}
          {alertes > 0 && <div style={{ color: "#ffcc80", fontSize: 12 }}>⚠️ {alertes} stock{alertes > 1 ? "s" : ""} bas</div>}
          <button onClick={() => setShowReset(true)} style={{ background: "none", border: "1px solid #6b4c28", borderRadius: 8, color: "#c8a96e", fontFamily: "'DM Sans',sans-serif", fontSize: 11, padding: "4px 10px", cursor: "pointer", opacity: 0.7 }} title="Réinitialiser les données locales">🗑 Réinit.</button>
          <div style={{ color: "#c8a96e" }}>{new Date().toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" })}</div>
        </div>
      </header>

      {/* NAV */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #e8dcc8", padding: "8px 24px", display: "flex", gap: 4 }}>
        {[
          { id: "dashboard", label: "📊 Tableau de bord" },
          { id: "production", label: "⚙️ Production" },
          { id: "stocks", label: "📦 Stocks" },
          { id: "ventes", label: "🛒 Ventes" },
          { id: "commandes", label: `📋 Commandes${cmdEnAttente > 0 ? ` (${cmdEnAttente})` : ""}` },
        ].map(t => <button key={t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </nav>

      <main style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
              {[
                { label: "CA total", val: `${totalCA.toFixed(0)} €`, icon: "💶", color: "#c8a96e" },
                { label: "Kg produits", val: `${totalKg} kg`, icon: "⚙️", color: "#8b5e2a" },
                { label: "Commandes en attente", val: cmdEnAttente, icon: "📋", color: cmdEnAttente > 0 ? "#1565c0" : "#4caf50" },
                { label: "Alertes stock", val: alertes, icon: "⚠️", color: alertes > 0 ? "#e53935" : "#4caf50" },
              ].map((k, i) => (
                <div key={i} className="card" style={{ borderTop: `3px solid ${k.color}` }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{k.icon}</div>
                  <div className="kpi-val" style={{ color: k.color }}>{k.val}</div>
                  <div className="kpi-label">{k.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>Production par farine (kg)</div>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={prodParFarine} barSize={26}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "DM Sans" }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => [`${v} kg`]} />
                    <Bar dataKey="kg" radius={[4,4,0,0]}>
                      {prodParFarine.map((_, i) => <Cell key={i} fill={Object.values(COULEURS)[i] || "#c8a96e"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>CA par farine (€)</div>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={ventesParFarine.filter(v => v.ca > 0)} barSize={26}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => [`${v.toFixed(0)} €`]} />
                    <Bar dataKey="ca" radius={[4,4,0,0]}>
                      {ventesParFarine.filter(v => v.ca > 0).map((_, i) => <Cell key={i} fill={Object.values(COULEURS)[i] || "#c8a96e"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>État des stocks de farine (vrac)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
                {FARINES.map(f => {
                  const val = stocks.farines[f] || 0;
                  const seuil = seuils.farines[f] ?? seuils.farines.global;
                  const pct = Math.min(100, (val / 300) * 100);
                  const color = val < seuil ? "#e53935" : val < seuil * 2 ? "#fb8c00" : "#c8a96e";
                  return (
                    <div key={f}>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: "#5c3a1a", marginBottom: 6 }}>{f}</div>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: color }} /></div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color, marginTop: 4 }}>{val} kg</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 15 }}>Dernières productions</div>
                <table><tbody>
                  {productions.slice(0, 5).map((p, i) => <tr key={i}><td style={{ color: "#9a7a55", fontSize: 12 }}>{fmt(p.date)}</td><td style={{ fontWeight: 500, fontSize: 13 }}>{p.farine}</td><td style={{ textAlign: "right", color: "#8b5e2a", fontWeight: 600 }}>{p.qty} kg</td></tr>)}
                  {productions.length === 0 && <tr><td colSpan={3} style={{ color: "#9a7a55", fontStyle: "italic", fontSize: 13 }}>Aucune production</td></tr>}
                </tbody></table>
              </div>
              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 15 }}>Dernières ventes</div>
                <table><tbody>
                  {ventesGroupees.slice(0, 5).map((v, i) => <tr key={i}><td style={{ color: "#9a7a55", fontSize: 12 }}>{fmt(v.date)}</td><td style={{ fontWeight: 500, fontSize: 13 }}>{v.client}</td><td style={{ textAlign: "right", color: "#2e7d32", fontWeight: 600 }}>{(v.qty * v.prix).toFixed(0)} €</td></tr>)}
                  {ventes.length === 0 && <tr><td colSpan={3} style={{ color: "#9a7a55", fontStyle: "italic", fontSize: 13 }}>Aucune vente</td></tr>}
                </tbody></table>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTION */}
        {tab === "production" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 22 }}>Suivi de production</h2>
              <button className="btn btn-primary" onClick={() => setShowProd(true)}>+ Nouvelle production</button>
            </div>
            <div className="card">
              <table>
                <thead><tr><th>Date</th><th>Lot</th><th>Farine</th><th>Quantité</th><th>Rendement</th><th>Opérateur</th><th>Note</th></tr></thead>
                <tbody>
                  {productions.map((p, i) => (
                    <tr key={i}>
                      <td>{fmt(p.date)}</td>
                      <td><span style={{ fontFamily: "monospace", fontSize: 11, color: "#8b5e2a", background: "#fdf5e8", padding: "2px 6px", borderRadius: 4 }}>{p.lot}</span></td>
                      <td style={{ fontWeight: 500 }}>{p.farine}</td>
                      <td><strong>{p.qty} kg</strong></td>
                      <td><span className={`badge ${p.rendement >= 77 ? "badge-green" : p.rendement >= 74 ? "badge-orange" : "badge-red"}`}>{p.rendement}%</span></td>
                      <td style={{ fontSize: 13 }}>{p.operateur}</td>
                      <td style={{ fontSize: 12, color: "#9a7a55", fontStyle: p.note ? "normal" : "italic" }}>{p.note || "—"}</td>
                    </tr>
                  ))}
                  {productions.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#9a7a55", fontStyle: "italic", padding: 30 }}>Aucune production enregistrée</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STOCKS */}
        {tab === "stocks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 22 }}>Gestion des stocks</h2>
              <button onClick={() => setShowSeuils(true)} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fdf5e8", border: "1.5px solid #c8a96e", borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: "#8b5e2a", fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: 13 }}>⚙️ Seuils d'alerte</button>
            </div>
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 16 }}>🌾 Grains bruts</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
                {Object.entries(stocks.grains).map(([grain, val]) => {
                  const seuil = seuils.grains[grain] ?? seuils.grains.global;
                  const pct = Math.min(100, (val / 1000) * 100);
                  const color = val < seuil ? "#e53935" : val < seuil * 2 ? "#fb8c00" : "#4caf50";
                  return (
                    <div key={grain}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontWeight: 600 }}>{grain}</span>
                        <span className={`badge ${val < seuil ? "badge-red" : val < seuil*2 ? "badge-orange" : "badge-green"}`}>{val < seuil ? "Bas" : "OK"}</span>
                      </div>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: color }} /></div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color, marginTop: 4 }}>{val} kg</div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#b0926a" }}>Seuil : {seuil} kg</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 16 }}>🏺 Farines en vrac</div>
              <table>
                <thead><tr><th>Farine</th><th>Stock (kg)</th><th>Seuil</th><th>Statut</th></tr></thead>
                <tbody>
                  {FARINES.map(f => {
                    const val = stocks.farines[f] || 0;
                    const seuil = seuils.farines[f] ?? seuils.farines.global;
                    return (
                      <tr key={f}>
                        <td style={{ fontWeight: 500 }}>{f}</td>
                        <td><strong>{val} kg</strong></td>
                        <td style={{ color: "#9a7a55" }}>{seuil} kg</td>
                        <td><span className={`badge ${val < seuil ? "badge-red" : val < seuil*2 ? "badge-orange" : "badge-green"}`}>{val < seuil ? "⚠️ Bas" : val < seuil*2 ? "Moyen" : "✓ OK"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 16 }}>📦 Produits conditionnés</div>
              {Object.keys(stocks.packaged).length === 0 ? (
                <div style={{ color: "#9a7a55", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontStyle: "italic" }}>Aucun stock conditionné enregistré</div>
              ) : (
                <table>
                  <thead><tr><th>Produit</th><th>Format</th><th>Unités</th><th>Statut</th></tr></thead>
                  <tbody>
                    {Object.entries(stocks.packaged).map(([sku, qty]) => {
                      const parts = sku.split(" – ");
                      const seuil = seuils.packaged.global;
                      return (
                        <tr key={sku}>
                          <td style={{ fontWeight: 500 }}>{parts[0]}</td>
                          <td>{parts[1]}</td>
                          <td><strong>{qty}</strong></td>
                          <td><span className={`badge ${qty < seuil ? "badge-red" : qty < seuil*2 ? "badge-orange" : "badge-green"}`}>{qty < seuil ? "⚠️ Bas" : "✓ OK"}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* VENTES */}
        {tab === "ventes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 22 }}>Suivi des ventes</h2>
              <button className="btn btn-primary" onClick={() => setShowVente(true)}>+ Enregistrer une vente</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              {[
                { label: "CA total", val: `${totalCA.toFixed(2)} €`, color: "#4caf50" },
                { label: "Transactions", val: ventesGroupees.length, color: "#c8a96e" },
                { label: "Panier moyen", val: `${panierMoyen.toFixed(2)} €`, color: "#8b5e2a" },
              ].map((k, i) => <div key={i} className="card" style={{ textAlign: "center" }}><div className="kpi-val" style={{ color: k.color }}>{k.val}</div><div className="kpi-label">{k.label}</div></div>)}
            </div>
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>Historique des ventes</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(ventes.reduce((acc, v) => { const vid = v.vente_id || v.venteId; if (!acc[vid]) acc[vid] = []; acc[vid].push(v); return acc; }, {})).map(([vid, lignes]) => {
                  const total = lignes.reduce((s, l) => s + l.qty * l.prix, 0);
                  const ref = lignes[0];
                  return (
                    <div key={vid} style={{ border: "1.5px solid #f0e6d6", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ background: "#fdf5e8", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#8b5e2a", background: "#ffe9c4", padding: "2px 7px", borderRadius: 4 }}>{vid}</span>
                          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#6b4c28" }}>📅 {fmt(ref.date)}</span>
                          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600 }}>👤 {ref.client}</span>
                          {ref.vendu_par && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#8b5e2a", background: "#fdf5e8", border: "1px solid #c8a96e", padding: "2px 8px", borderRadius: 20 }}>🌾 {ref.vendu_par}</span>}
                          <span className="badge badge-orange">{ref.canal}</span>
                        </div>
                        <strong style={{ color: "#2e7d32", fontSize: 16 }}>{total.toFixed(2)} €</strong>
                      </div>
                      <table style={{ margin: 0 }}>
                        <tbody>
                          {lignes.map((l, i) => <tr key={i}><td style={{ paddingLeft: 18, fontSize: 13, fontWeight: 500 }}>{l.sku}</td><td style={{ fontSize: 12, color: "#9a7a55" }}>× {l.qty}</td><td style={{ fontSize: 12, color: "#9a7a55" }}>{parseFloat(l.prix).toFixed(2)} €/u.</td><td style={{ fontWeight: 600, color: "#5c3a1a", textAlign: "right", paddingRight: 14 }}>{(l.qty * l.prix).toFixed(2)} €</td></tr>)}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
                {ventes.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#9a7a55", fontFamily: "'DM Sans',sans-serif", fontStyle: "italic" }}>Aucune vente enregistrée</div>}
              </div>
            </div>
          </div>
        )}

        {/* COMMANDES */}
        {tab === "commandes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 22 }}>Commandes en cours</h2>
              <button className="btn btn-primary" onClick={() => setShowCmd(true)}>+ Nouvelle commande</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
              {STATUTS.map(s => { const n = commandes.filter(c => c.statut === s).length; const st = STATUT_STYLE[s]; return <div key={s} className="card" style={{ textAlign: "center", borderTop: `3px solid ${st.color}` }}><div style={{ fontSize: 20, fontWeight: 700, color: st.color }}>{n}</div><div style={{ fontSize: 11, color: "#9a7a55", fontFamily: "'DM Sans',sans-serif", marginTop: 4 }}>{s}</div></div>; })}
            </div>
            <CommandesTable commandes={commandes} onStatusChange={updateStatut} onDelete={deleteCmd} />
          </div>
        )}
      </main>

      {showProd  && <ProdModal  onClose={() => setShowProd(false)}  onSave={saveProd}  saving={saving} />}
      {showVente && <VenteModal onClose={() => setShowVente(false)} onSave={saveVente} saving={saving} />}
      {showCmd   && <CmdModal   onClose={() => setShowCmd(false)}   onSave={saveCmd}   saving={saving} />}
      {showSeuils && <SeuilsModal seuils={seuils} stocks={stocks} onClose={() => setShowSeuils(false)} onSave={(s) => { setSeuils(s); setShowSeuils(false); }} />}

      {/* MODAL RÉINITIALISATION */}
      {showReset && (
        <div className="overlay" onClick={() => setShowReset(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 20, textAlign: "center", marginBottom: 10 }}>Réinitialiser les données locales ?</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "#6b4c28", textAlign: "center", marginBottom: 24, lineHeight: 1.6 }}>
              Cette action efface toutes les données stockées dans ce navigateur (productions, ventes, commandes, stocks).
              <br /><strong>Les données déjà enregistrées dans Supabase ne sont pas supprimées.</strong>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="btn btn-ghost" onClick={() => setShowReset(false)}>Annuler</button>
              <button onClick={resetData} style={{ background: "#e53935", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 14 }}>
                🗑 Oui, réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CommandesTable ─────────────────────────────────────────────────────────────
function CommandesTable({ commandes, onStatusChange, onDelete }) {
  const [filtre, setFiltre] = useState("Tous");
  const affichees = filtre === "Tous" ? commandes : commandes.filter(c => c.statut === filtre);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["Tous", ...STATUTS].map(s => { const st = STATUT_STYLE[s] || { bg: "#f0e6d6", color: "#8b5e2a" }; return <button key={s} onClick={() => setFiltre(s)} style={{ padding: "5px 13px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 500, background: filtre === s ? st.color : st.bg, color: filtre === s ? "#fff" : st.color }}>{s}</button>; })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {affichees.map(c => {
          const st = STATUT_STYLE[c.statut];
          const isUrgent = c.livraison && new Date(c.livraison) <= new Date(Date.now() + 86400000 * 2) && c.statut !== "Livrée" && c.statut !== "Annulée";
          const lignes = c.lignes || [];
          return (
            <div key={c.id} style={{ border: `1.5px solid ${isUrgent ? "#ffe082" : "#f0e6d6"}`, borderLeft: `4px solid ${st.color}`, borderRadius: 12, overflow: "hidden", background: isUrgent ? "#fffde7" : "#fff" }}>
              <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "center", background: isUrgent ? "#fff8e1" : "#fdfaf6", borderBottom: `1px solid ${isUrgent ? "#ffe082" : "#f0e6d6"}` }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.client}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#9a7a55" }}>{lignes.length} produit{lignes.length > 1 ? "s" : ""} · {c.commande_id || c.commandeId}</div>
                  {c.note && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#9a7a55", fontStyle: "italic" }}>💬 {c.note}</div>}
                </div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#9a7a55" }}>
                  <div>📅 {fmt(c.date)}</div>
                  <div style={{ color: isUrgent ? "#e65100" : "#9a7a55" }}>🚚 {fmt(c.livraison)}{isUrgent ? " ⚡" : ""}</div>
                  <div>👤 {c.saisie_par}</div>
                </div>
                <select value={c.statut} onChange={e => onStatusChange(c.id, e.target.value)} style={{ background: st.bg, color: st.color, border: `1.5px solid ${st.color}`, borderRadius: 20, padding: "5px 10px", fontWeight: 600, fontSize: 12, cursor: "pointer", width: "auto" }}>
                  {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => onDelete(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 16 }}>✕</button>
              </div>
              <div>
                {lignes.map((l, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 16px 7px 22px", borderBottom: i < lignes.length - 1 ? "1px solid #f7f0e6" : "none", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}><span style={{ fontWeight: 500 }}>{l.sku}</span><span style={{ color: "#8b5e2a", fontWeight: 600 }}>× {l.qty}</span></div>)}
              </div>
            </div>
          );
        })}
        {affichees.length === 0 && <div className="card" style={{ textAlign: "center", padding: 36, color: "#9a7a55", fontFamily: "'DM Sans',sans-serif", fontStyle: "italic" }}>Aucune commande dans cette catégorie</div>}
      </div>
    </div>
  );
}

// ── ProdModal ──────────────────────────────────────────────────────────────────
function ProdModal({ onClose, onSave, saving }) {
  // Produits conditionnés (sacs)
  const skusSacs = FARINES.flatMap(f => FORMATS.map(fmt => `${f} – ${fmt}`));
  // Vrac : seulement les farines de blé et épeautre
  const skusVrac = ["T65 Blé – Vrac", "T80 Blé – Vrac", "T110 Blé – Vrac", "T80 Épeautre – Vrac"];
  const allSkus = [...skusSacs, ...skusVrac];

  const [form, setForm] = useState({ date: today, farine: allSkus[0], qty: "", rendement: 76, operateur: "Lou", note: "", lot: `LOT-${today.replace(/-/g,"").slice(2)}` });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isVrac = form.farine.includes("– Vrac");
  const poidsFmt = isVrac ? null : parseInt(form.farine.split(" – ")[1]);
  const kgTotal = form.qty ? (isVrac ? parseInt(form.qty) : parseInt(form.qty) * (poidsFmt || 1)) : 0;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 18 }}>Nouvelle session de production</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label>Date</label><input type="date" value={form.date} onChange={e => set("date", e.target.value)} /></div>
            <div><label>N° de lot</label><input value={form.lot} onChange={e => set("lot", e.target.value)} /></div>
          </div>
          <div>
            <label>Type de farine</label>
            <select value={form.farine} onChange={e => set("farine", e.target.value)}>
              <optgroup label="── Produits conditionnés (sacs) ──">
                {skusSacs.map(s => <option key={s} value={s}>{s}</option>)}
              </optgroup>
              <optgroup label="── Vrac (kg) ──">
                {skusVrac.map(s => <option key={s} value={s}>{s}</option>)}
              </optgroup>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label>{isVrac ? "Quantité produite (kg)" : "Nombre d'unités produites"}</label>
              <input type="number" value={form.qty} onChange={e => set("qty", e.target.value)} placeholder={isVrac ? "ex. 150" : "ex. 2"} min="1" />
              {form.qty > 0 && !isVrac && (
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#8b5e2a", marginTop: 4 }}>
                  = <strong>{kgTotal} kg</strong> au total
                </div>
              )}
              {form.qty > 0 && isVrac && (
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#8b5e2a", marginTop: 4 }}>
                  → Stock <strong>Farines en vrac</strong>
                </div>
              )}
            </div>
            <div><label>Rendement (%)</label><input type="number" value={form.rendement} onChange={e => set("rendement", e.target.value)} /></div>
          </div>
          <div style={{ background: "#fdf5e8", borderRadius: 10, padding: "12px 14px" }}>
            <label>Opérateur</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {EQUIPE.map(o => <button key={o} onClick={() => set("operateur", o)} style={{ padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 500, background: form.operateur === o ? "#8b5e2a" : "#f0e6d6", color: form.operateur === o ? "#fff" : "#6b4c28" }}>{o}</button>)}
            </div>
          </div>
          <div><label>Observations</label><textarea value={form.note} onChange={e => set("note", e.target.value)} rows={2} placeholder="Humidité, texture…" /></div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" disabled={!form.qty || saving} onClick={() => form.qty && onSave(form)}>{saving ? "…" : "Enregistrer"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── VenteModal ─────────────────────────────────────────────────────────────────
function VenteModal({ onClose, onSave, saving }) {
  const skus = FARINES.flatMap(f => FORMATS.map(fmt => `${f} – ${fmt}`));
  const emptyL = () => ({ id: Math.random(), sku: skus[0], qty: "", prix: "" });
  const [header, setHeader] = useState({ date: today, client: CLIENTS[0], canal: CANAUX[0], vendu_par: "Viviane" });
  const [lignes, setLignes] = useState([emptyL()]);
  const setH = (k, v) => setHeader(h => ({ ...h, [k]: v }));
  const setL = (id, k, v) => setLignes(prev => prev.map(l => l.id === id ? { ...l, [k]: v } : l));
  const total = lignes.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.prix) || 0), 0);
  const valid = header.client && lignes.every(l => l.qty && l.prix);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Enregistrer une vente</div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#9a7a55", marginBottom: 16 }}>Plusieurs produits pour un même client en une transaction.</div>
        <div style={{ background: "#fdf5e8", borderRadius: 10, padding: "14px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label>Date</label><input type="date" value={header.date} onChange={e => setH("date", e.target.value)} /></div>
            <div><label>Canal</label><select value={header.canal} onChange={e => setH("canal", e.target.value)}>{CANAUX.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div>
            <label>Client *</label>
            <select value={CLIENTS.includes(header.client) ? header.client : "__autre__"} onChange={e => setH("client", e.target.value !== "__autre__" ? e.target.value : "")}>
              {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__autre__">Autre client…</option>
            </select>
            {!CLIENTS.includes(header.client) && <input value={header.client} onChange={e => setH("client", e.target.value)} placeholder="Nom du client" style={{ marginTop: 6 }} />}
          </div>
          <div>
            <label>Vendu par</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              {EQUIPE.map(o => <button key={o} onClick={() => setH("vendu_par", o)} style={{ padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 500, background: header.vendu_par === o ? "#8b5e2a" : "#f0e6d6", color: header.vendu_par === o ? "#fff" : "#6b4c28" }}>{o}</button>)}
            </div>
          </div>
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Produits vendus</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
          {lignes.map((l, idx) => (
            <div key={l.id} style={{ border: "1.5px solid #e8d8c0", borderRadius: 10, padding: "12px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, color: "#c8a96e" }}>Produit {idx + 1}</span>
                {lignes.length > 1 && <button onClick={() => setLignes(prev => prev.filter(x => x.id !== l.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14 }}>✕</button>}
              </div>
              <div><label>Produit</label><select value={l.sku} onChange={e => setL(l.id, "sku", e.target.value)}>{skus.map(s => <option key={s}>{s}</option>)}</select></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignItems: "end" }}>
                <div><label>Quantité</label><input type="number" min="1" value={l.qty} onChange={e => setL(l.id, "qty", e.target.value)} /></div>
                <div><label>Prix unitaire (€)</label><input type="number" step="0.01" value={l.prix} onChange={e => setL(l.id, "prix", e.target.value)} /></div>
                <div style={{ textAlign: "right", fontWeight: 700, fontSize: 14, color: l.qty && l.prix ? "#2e7d32" : "#ccc", paddingBottom: 6 }}>{l.qty && l.prix ? `${(parseFloat(l.qty)*parseFloat(l.prix)).toFixed(2)} €` : "—"}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setLignes(prev => [...prev, emptyL()])} style={{ width: "100%", padding: "9px", borderRadius: 8, border: "1.5px dashed #c8a96e", background: "transparent", cursor: "pointer", color: "#8b5e2a", fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: 13, marginBottom: 12 }}>+ Ajouter un produit</button>
        {total > 0 && <div style={{ background: "#e8f5e9", borderRadius: 10, padding: "10px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between" }}><span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#2e7d32" }}>💶 Total</span><strong style={{ color: "#2e7d32", fontSize: 18 }}>{total.toFixed(2)} €</strong></div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!valid || saving} onClick={() => valid && onSave({ header, lignes })}>{saving ? "…" : "✓ Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}

// ── CmdModal ───────────────────────────────────────────────────────────────────
function CmdModal({ onClose, onSave, saving }) {
  const skus = FARINES.flatMap(f => FORMATS.map(fmt => `${f} – ${fmt}`));
  const emptyL = () => ({ id: Math.random(), sku: skus[0], qty: "" });
  const [header, setHeader] = useState({ date: today, client: CLIENTS[0], livraison: "", saisie_par: "Nadège", note: "" });
  const [lignes, setLignes] = useState([emptyL()]);
  const setH = (k, v) => setHeader(h => ({ ...h, [k]: v }));
  const setL = (id, k, v) => setLignes(prev => prev.map(l => l.id === id ? { ...l, [k]: v } : l));
  const valid = header.client && header.livraison && lignes.every(l => l.qty);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Nouvelle commande</div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#9a7a55", marginBottom: 16 }}>Saisissez les produits commandés par un client.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "#fdf5e8", borderRadius: 10, padding: "12px 14px" }}>
            <label>Qui saisit cette commande ?</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {EQUIPE.map(e => <button key={e} onClick={() => setH("saisie_par", e)} style={{ padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 500, background: header.saisie_par === e ? "#8b5e2a" : "#f0e6d6", color: header.saisie_par === e ? "#fff" : "#6b4c28" }}>{e}</button>)}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label>Date de saisie</label><input type="date" value={header.date} onChange={e => setH("date", e.target.value)} /></div>
            <div><label>Date de livraison *</label><input type="date" value={header.livraison} onChange={e => setH("livraison", e.target.value)} /></div>
          </div>
          <div>
            <label>Client *</label>
            <select value={CLIENTS.includes(header.client) ? header.client : "__autre__"} onChange={e => setH("client", e.target.value !== "__autre__" ? e.target.value : "")}>
              {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__autre__">Autre client…</option>
            </select>
            {!CLIENTS.includes(header.client) && <input value={header.client} onChange={e => setH("client", e.target.value)} placeholder="Nom du client" style={{ marginTop: 6 }} />}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Produits commandés</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lignes.map((l, idx) => (
                <div key={l.id} style={{ border: "1.5px solid #e8d8c0", borderRadius: 10, padding: "12px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, color: "#c8a96e" }}>Produit {idx + 1}</span>
                    {lignes.length > 1 && <button onClick={() => setLignes(prev => prev.filter(x => x.id !== l.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14 }}>✕</button>}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" }}>
                    <div><label>Produit</label><select value={l.sku} onChange={e => setL(l.id, "sku", e.target.value)}>{skus.map(s => <option key={s}>{s}</option>)}</select></div>
                    <div style={{ width: 85 }}><label>Quantité</label><input type="number" min="1" value={l.qty} onChange={e => setL(l.id, "qty", e.target.value)} /></div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setLignes(prev => [...prev, emptyL()])} style={{ width: "100%", marginTop: 8, padding: "8px", borderRadius: 8, border: "1.5px dashed #c8a96e", background: "transparent", cursor: "pointer", color: "#8b5e2a", fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: 13 }}>+ Ajouter un produit</button>
          </div>
          <div><label>Notes</label><textarea value={header.note} onChange={e => setH("note", e.target.value)} rows={2} placeholder="Instructions de livraison…" /></div>
          {!valid && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#e65100" }}>* Client, date de livraison et quantités sont obligatoires.</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" disabled={!valid || saving} onClick={() => valid && onSave({ header, lignes })}>{saving ? "…" : "Enregistrer la commande"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SeuilsModal ────────────────────────────────────────────────────────────────
function SeuilsModal({ seuils, stocks, onClose, onSave }) {
  const [draft, setDraft] = useState(JSON.parse(JSON.stringify(seuils)));
  const setVal = (cat, key, val) => setDraft(prev => ({ ...prev, [cat]: { ...prev[cat], [key]: parseInt(val) || 0 } }));
  const grainKeys = Object.keys(stocks.grains).length > 0 ? Object.keys(stocks.grains) : ["Blé", "Épeautre", "Sarrasin"];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 20 }}>⚙️ Seuils d'alerte</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#ccc" }}>✕</button>
        </div>
        {[{ titre: "🌾 Grains bruts", cat: "grains", items: grainKeys, unite: "kg" }, { titre: "🏺 Farines en vrac", cat: "farines", items: FARINES, unite: "kg" }].map(({ titre, cat, items, unite }) => (
          <div key={cat} style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #f0e6d6" }}>{titre}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map(item => {
                const stockVal = cat === "grains" ? stocks.grains[item] : stocks.farines[item];
                const val = draft[cat][item] ?? draft[cat].global;
                const isBelow = stockVal !== undefined && stockVal < val;
                return (
                  <div key={item} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 10, background: isBelow ? "#fff5f5" : "#fdfaf6", borderRadius: 8, padding: "10px 12px", border: `1.5px solid ${isBelow ? "#ffcdd2" : "#f0e6d6"}` }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{item}</div>
                      {stockVal !== undefined && <div style={{ fontSize: 11, color: isBelow ? "#e53935" : "#9a7a55", fontFamily: "'DM Sans',sans-serif" }}>Stock : {stockVal} {unite}{isBelow ? " ⚠️" : ""}</div>}
                    </div>
                    <span style={{ fontSize: 11, color: "#9a7a55", fontFamily: "'DM Sans',sans-serif" }}>Seuil</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="number" value={val} min={0} onChange={e => setVal(cat, item, e.target.value)} style={{ width: 75, textAlign: "center", fontWeight: 600, color: "#8b5e2a" }} />
                      <span style={{ fontSize: 11, color: "#9a7a55", fontFamily: "'DM Sans',sans-serif" }}>{unite}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #f0e6d6" }}>📦 Produits conditionnés</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 10, background: "#fdfaf6", borderRadius: 8, padding: "10px 12px", border: "1.5px solid #f0e6d6" }}>
            <div style={{ fontWeight: 500, fontSize: 13 }}>Seuil global</div>
            <span style={{ fontSize: 11, color: "#9a7a55", fontFamily: "'DM Sans',sans-serif" }}>Seuil</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input type="number" min={0} value={draft.packaged.global} onChange={e => setVal("packaged", "global", e.target.value)} style={{ width: 75, textAlign: "center", fontWeight: 600, color: "#8b5e2a" }} />
              <span style={{ fontSize: 11, color: "#9a7a55", fontFamily: "'DM Sans',sans-serif" }}>unités</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => onSave(draft)}>✓ Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
