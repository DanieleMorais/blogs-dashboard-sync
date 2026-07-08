// Submete (ou re-submete) um sitemap ao Google Search Console.
// Usa o mesmo OAuth amplo dos outros scripts (G_CLIENT_ID/G_CLIENT_SECRET/G_REFRESH_TOTAL, escopo webmasters).
// Uso: node submit-sitemap.js [siteUrl] [sitemapUrl]
const CID = process.env.G_CLIENT_ID, CS = process.env.G_CLIENT_SECRET, RT = process.env.G_REFRESH_TOTAL;

const SITE = process.argv[2] || 'https://visionscoreai.agenciafadamadrinha.com/';
const SITEMAP = process.argv[3] || (SITE.replace(/\/?$/, '/') + 'sitemap.xml');

async function main() {
  if (!CID || !CS || !RT) { console.error('Faltam G_CLIENT_ID/G_CLIENT_SECRET/G_REFRESH_TOTAL'); process.exit(1); }
  const tok = (await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CID, client_secret: CS, refresh_token: RT, grant_type: 'refresh_token' }),
  })).json()).access_token;
  if (!tok) { console.error('Sem access_token (client/refresh nao batem).'); process.exit(1); }

  const base = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}`;
  const put = await fetch(`${base}/sitemaps/${encodeURIComponent(SITEMAP)}`, { method: 'PUT', headers: { Authorization: `Bearer ${tok}` } });
  console.log(`PUT sitemap [${SITEMAP}] -> HTTP ${put.status}` + (put.ok ? ' OK' : ' ' + (await put.text()).slice(0, 200)));

  const list = await (await fetch(`${base}/sitemaps`, { headers: { Authorization: `Bearer ${tok}` } })).json();
  console.log('Sitemaps na propriedade ' + SITE + ':');
  (list.sitemap || []).forEach(s => console.log('  - ' + s.path + ' | submetido: ' + (s.lastSubmitted || '?') + ' | erros: ' + (s.errors || 0) + ' | avisos: ' + (s.warnings || 0)));
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
