// 在线模板只使用浏览器中的虚构数据，不连接本地 CRM 或真实客户数据库。
(function () {
  const DB_KEY = "ca_crm_demo_v1";
  const nativeFetch = window.fetch.bind(window);
  const now = () => new Date().toISOString();
  const json = (data, status = 200, headers = {}) => Promise.resolve(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  }));

  const names = ["Alex Morgan","Maria Silva","Ahmed Hassan","Ivan Petrov","Daniel Kim","Sofia Rossi","Omar Faruk","Lucas Martin","Elena Popova","James Wilson","Nina Costa","Samir Khan","Mila Novak","David Lee","Anna Becker","Carlos Ruiz","Yusuf Demir","Emma Brown","Leo Santos","Maya Chen","Noah Smith","Sara Ali","Victor Ivanov","Lina Park","Adam Kowalski","Eva Garcia","Rami Saad","Julia Meyer","Mark Taylor","Zara Malik"];
  const places = [
    ["阿联酋","迪拜","+971501000"], ["沙特阿拉伯","利雅得","+966501100"], ["哈萨克斯坦","阿拉木图","+7701100"],
    ["俄罗斯","莫斯科","+7916100"], ["乌兹别克斯坦","塔什干","+99890100"], ["格鲁吉亚","第比利斯","+99555100"]
  ];
  const statuses = ["待开发","已联系","已回复","意向客户","重点客户","老客户","暂时搁置","无效","同行"];
  const sources = ["TikTok","Instagram","Facebook","WhatsApp","展会","转介绍"];
  const vehicles = ["BYD Song Plus","Geely Monjaro","Changan CS75 Plus","Jetour T2","Toyota Camry","Haval H6"];
  const colors = ["黑色","白色","银色","蓝色","灰色","红色"];

  function seed() {
    const customers = names.map((name, i) => {
      const place = places[i % places.length];
      const created = new Date(Date.now() - i * 86400000).toISOString();
      const status = statuses[i % statuses.length];
      return {
        id: i + 1, customer_code: `CA-${String(i + 1).padStart(5, "0")}`, name,
        original_phone: `${place[2]}${String(1000 + i).slice(-4)}`, phone_e164: `${place[2]}${String(1000 + i).slice(-4)}`,
        country: place[0], country_code: "", city: place[1], source: sources[i % sources.length],
        source_id: `DEMO-${10001 + i}`, source_url: "", language: i % 3 ? "English" : "Русский",
        customer_type: "海外客户", status, followup_stage: i % 4,
        followup_notes: i % 4 ? `第 ${i % 4} 次模拟回访：客户正在比较车型与价格。` : "",
        priority_contact_count: status === "重点客户" ? 2 : 0,
        notes: `虚构模板客户 ${i + 1}，用于演示 CRM 功能。`, next_followup: null,
        last_contacted: i % 3 === 0 ? new Date().toISOString().slice(0, 10) : null,
        created_at: created, deleted_at: null
      };
    });
    const quotes = customers.slice(0, 12).map((c, i) => ({
      id: i + 1, customer_id: c.id, customer_name: c.name, customer_phone: c.phone_e164,
      quote_no: `Q-${new Date().getFullYear()}-${String(i + 1).padStart(4, "0")}`,
      vehicle: vehicles[i % vehicles.length], color: colors[i % colors.length], configuration: i % 2 ? "高配" : "标准版",
      quantity: (i % 4) + 1, unit_price_usd: 18500 + i * 750, total_usd: (18500 + i * 750) * ((i % 4) + 1),
      trade_term: ["FOB","CIF","EXW"][i % 3], status: ["草稿","已发送","已接受"][i % 3],
      notes: "模拟报价记录", created_at: new Date(Date.now() - i * 86400000).toISOString()
    }));
    const interactions = {};
    customers.filter(c => c.status === "重点客户").forEach(c => {
      interactions[c.id] = [
        { id: c.id * 100 + 1, customer_id: c.id, content: "询问现车颜色和交付时间。", created_at: now(), deleted_at: null },
        { id: c.id * 100 + 2, customer_id: c.id, content: "已发送车型配置与模拟报价。", created_at: now(), deleted_at: null }
      ];
    });
    return { customers, quotes, interactions, deletedCustomers: [], deletedInteractions: [] };
  }
  function load() { try { return JSON.parse(localStorage.getItem(DB_KEY)) || seed(); } catch (_) { return seed(); } }
  function save(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  function body(opts) { try { return JSON.parse(opts.body || "{}"); } catch (_) { return {}; } }
  function active(db) { return db.customers.filter(c => !c.deleted_at); }

  window.fetch = async function (input, opts = {}) {
    const raw = typeof input === "string" ? input : input.url;
    const url = new URL(raw, location.href);
    if (!url.pathname.startsWith("/api")) return nativeFetch(input, opts);
    const path = url.pathname.slice(4) || "/";
    const method = (opts.method || "GET").toUpperCase();
    const db = load();
    let match;

    if (path === "/login" && method === "POST") return json({ access_token: "demo-token", token_type: "bearer" });
    if (path === "/me") return json({ username: "demo", role: "模板演示" });
    if (path === "/health") return json({ ok: true, mode: "demo" });
    if (path === "/phone-detect") return json({ country: "待核实", country_code: "", phone_e164: url.searchParams.get("phone") || "" });
    if (path === "/dashboard") {
      const rows = active(db), count = key => Object.entries(rows.reduce((a, c) => (a[c[key] || "待核实"] = (a[c[key] || "待核实"] || 0) + 1, a), {})).map(([name, value]) => ({ name, value }));
      return json({ total_customers: rows.length, today_contacts: rows.filter(c => c.last_contacted === new Date().toISOString().slice(0, 10)).length, by_country: count("country"), by_status: count("status") });
    }
    if (path === "/customers" && method === "GET") {
      let rows = active(db); const status = url.searchParams.get("status"); if (status) rows = rows.filter(c => c.status === status); return json(rows);
    }
    if (path === "/customers" && method === "POST") {
      const data = body(opts), id = Math.max(0, ...db.customers.map(c => c.id)) + 1;
      const c = { id, customer_code: `CA-${String(id).padStart(5,"0")}`, name: "", phone_e164: data.original_phone || "", country: "待核实", city: "", source: "手动录入", source_id: "", language: "", customer_type: "待分类", status: "待开发", followup_stage: 0, followup_notes: "", priority_contact_count: 0, notes: "", created_at: now(), deleted_at: null, ...data };
      db.customers.push(c); save(db); return json(c, 201);
    }
    if ((match = path.match(/^\/customers\/(\d+)$/))) {
      const id = Number(match[1]), c = db.customers.find(x => x.id === id); if (!c) return json({ detail: "客户不存在" }, 404);
      if (method === "PATCH") { Object.assign(c, body(opts)); if (["已联系","已回复","意向客户","重点客户","老客户"].includes(c.status)) c.last_contacted = new Date().toISOString().slice(0,10); save(db); return json(c); }
      if (method === "DELETE") { if (c.deleted_at) db.customers = db.customers.filter(x => x.id !== id); else c.deleted_at = now(); save(db); return json({ ok: true }); }
    }
    if ((match = path.match(/^\/customers\/(\d+)\/restore$/))) { const c = db.customers.find(x => x.id === Number(match[1])); if (c) c.deleted_at = null; save(db); return json(c || {}); }
    if (path === "/customers-trash") return json(db.customers.filter(c => c.deleted_at));
    if ((match = path.match(/^\/customers\/(\d+)\/followup$/))) { const c = db.customers.find(x => x.id === Number(match[1])), data = body(opts); if (c) { c.followup_stage = data.visit_number; c.followup_notes = data.notes || ""; save(db); } return json(c || {}); }
    if ((match = path.match(/^\/customers\/(\d+)\/priority-contacts$/)) && method === "GET") return json((db.interactions[match[1]] || []).filter(x => !x.deleted_at).sort((a,b) => b.id-a.id));
    if ((match = path.match(/^\/customers\/(\d+)\/priority-contact$/)) && method === "POST") { const id = Number(match[1]), data = body(opts), list = db.interactions[id] ||= [], item = { id: Date.now(), customer_id: id, content: data.notes, created_at: now(), deleted_at: null }; list.push(item); const c = db.customers.find(x => x.id === id); if (c) c.priority_contact_count = list.filter(x => !x.deleted_at).length; save(db); return json(item, 201); }
    if ((match = path.match(/^\/customers\/(\d+)\/priority-contacts\/(\d+)$/)) && method === "DELETE") { const id = Number(match[1]), item = (db.interactions[id] || []).find(x => x.id === Number(match[2])); if (item) item.deleted_at = now(); const c = db.customers.find(x => x.id === id); if (c) c.priority_contact_count = (db.interactions[id] || []).filter(x => !x.deleted_at).length; save(db); return json({ priority_contact_count: c?.priority_contact_count || 0 }); }
    if (path === "/priority-contacts-trash") { const rows = []; Object.values(db.interactions).flat().filter(x => x.deleted_at).forEach(x => { const c = db.customers.find(y => y.id === x.customer_id) || {}; rows.push({ ...x, customer_name: c.name, customer_code: c.customer_code }); }); return json(rows); }
    if ((match = path.match(/^\/priority-contacts\/(\d+)\/restore$/))) { const item = Object.values(db.interactions).flat().find(x => x.id === Number(match[1])); if (item) { item.deleted_at = null; const c = db.customers.find(x => x.id === item.customer_id); if (c) c.priority_contact_count = (db.interactions[item.customer_id] || []).filter(x => !x.deleted_at).length; } save(db); return json(item || {}); }
    if (path === "/quotes" && method === "GET") return json(db.quotes);
    if ((match = path.match(/^\/customers\/(\d+)\/quotes$/)) && method === "POST") { const id = Number(match[1]), c = db.customers.find(x => x.id === id), data = body(opts), qid = Math.max(0,...db.quotes.map(q=>q.id))+1; const q = { id: qid, customer_id: id, customer_name: c?.name || "未命名", customer_phone: c?.phone_e164 || "", quote_no: `Q-DEMO-${String(qid).padStart(4,"0")}`, created_at: now(), total_usd: Number(data.quantity) * Number(data.unit_price_usd), ...data }; db.quotes.push(q); save(db); return json(q, 201); }
    if (path === "/import/excel") return json({ created: 0, duplicates: 0, invalid: 0 });
    if (path.startsWith("/export/")) { const csv = "Demo template export only\nNo real customer data is included."; return Promise.resolve(new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=crm-demo-backup.csv" } })); }
    return json({ detail: "演示模板暂不支持此操作" }, 404);
  };
})();
