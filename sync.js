const crypto=require("crypto");
const GA_SA=JSON.parse(process.env.GA_SA_JSON), FB_SA=JSON.parse(process.env.FB_SA_JSON);
const CID=process.env.G_CLIENT_ID, CS=process.env.G_CLIENT_SECRET, RT=process.env.G_REFRESH_TOTAL;
const b64=x=>Buffer.from(x).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
async function saToken(sa,scope){const now=Math.floor(Date.now()/1e3);const h=b64(JSON.stringify({alg:"RS256",typ:"JWT"}));const c=b64(JSON.stringify({iss:sa.client_email,scope,aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600}));const sig=b64(crypto.sign("RSA-SHA256",Buffer.from(h+"."+c),sa.private_key));return (await(await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:h+"."+c+"."+sig})})).json()).access_token;}
async function oauthToken(){return (await(await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:CID,client_secret:CS,refresh_token:RT,grant_type:"refresh_token"})})).json()).access_token;}
function fv(v){if(v===null||v===undefined)return{nullValue:null};if(typeof v==="boolean")return{booleanValue:v};if(typeof v==="number")return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(typeof v==="string")return{stringValue:v};if(Array.isArray(v))return{arrayValue:{values:v.map(fv)}};if(typeof v==="object")return{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,fv(x)]))}};return{stringValue:String(v)};}
function toDoc(o){return{fields:Object.fromEntries(Object.entries(o).map(([k,v])=>[k,fv(v)]))};}
const dates=(()=>{const d=new Date(),e=d.toISOString().slice(0,10);const s=new Date(d.getTime()-27*864e5).toISOString().slice(0,10);return{s,e};})();
async function ga4(tok,prop){if(!prop)return{views:0,users:0,sessions:0};try{const d=await(await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${prop}:runReport`,{method:"POST",headers:{Authorization:"Bearer "+tok,"Content-Type":"application/json"},body:JSON.stringify({dateRanges:[{startDate:dates.s,endDate:dates.e}],metrics:[{name:"screenPageViews"},{name:"activeUsers"},{name:"sessions"}]})})).json();const r=(d.rows&&d.rows[0])||{metricValues:[{value:"0"},{value:"0"},{value:"0"}]};return{views:+r.metricValues[0].value||0,users:+r.metricValues[1].value||0,sessions:+r.metricValues[2].value||0};}catch{return{views:0,users:0,sessions:0};}}
async function sc(tok,site){try{const d=await(await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,{method:"POST",headers:{Authorization:"Bearer "+tok,"Content-Type":"application/json"},body:JSON.stringify({startDate:dates.s,endDate:dates.e,dimensions:[],rowLimit:1})})).json();const r=(d.rows&&d.rows[0])||{clicks:0,impressions:0,position:0};return{clicks:Math.round(r.clicks||0),impressions:Math.round(r.impressions||0),position:+(r.position||0).toFixed(1)};}catch{return{clicks:0,impressions:0,position:0};}}
async function posts(u){try{return +((await(await fetch(`${u.replace(/\/?$/,"/")}feeds/posts/default?alt=json&max-results=0`,{headers:{"User-Agent":"Mozilla/5.0"}})).json()).feed["openSearch$totalResults"].$t)||0;}catch{return 0;}}
const BLOGS=[
{name:"Dinheiro no Dia a Dia",domain:"www.dinheironodiaadia.com",url:"https://www.dinheironodiaadia.com/",sc:"https://www.dinheironodiaadia.com/",ga4:"544267278",mid:"G-N9HXSMWXXK",nicho:"Finanças"},
{name:"O Mundo da IA",domain:"omundodaia.blogspot.com",url:"https://omundodaia.blogspot.com/",sc:"https://omundodaia.blogspot.com/",ga4:"544354894",mid:"G-QF04SZVHS5",nicho:"Inteligência Artificial"},
{name:"O Mundo dos Animes",domain:"ouniversoanimes.blogspot.com",url:"https://ouniversoanimes.blogspot.com/",sc:"https://ouniversoanimes.blogspot.com/",ga4:"544476224",mid:"G-TGRD6F7XHK",nicho:"Animes (PT)"},
{name:"We Love Anime",domain:"weloveanimes1.blogspot.com",url:"https://weloveanimes1.blogspot.com/",sc:"https://weloveanimes1.blogspot.com/",ga4:"544471190",mid:"G-FNPQ67ZP00",nicho:"Anime (EN)"},
{name:"Arcane",domain:"arcane.agenciafadamadrinha.com",url:"https://arcane.agenciafadamadrinha.com/",sc:"https://arcane.agenciafadamadrinha.com/",ga4:"544632685",mid:"G-DVCPN4QKFE",nicho:"SaaS / Pesquisa de Produtos",fixedIdx:9,fixedSeo:92},
];
(async()=>{
const gaTok=await saToken(GA_SA,"https://www.googleapis.com/auth/analytics.readonly");
const scTok=await oauthToken();
const fsTok=await saToken(FB_SA,"https://www.googleapis.com/auth/datastore");
if(!fsTok){console.error("firestore token fail");process.exit(1);}
const nowISO=new Date().toISOString();let ok=0;
for(const b of BLOGS){
const g=await ga4(gaTok,b.ga4),s=await sc(scTok,b.sc),idx=b.fixedIdx??await posts(b.url);
const seo_score=b.fixedSeo??Math.min(98,45+Math.round(idx*0.45)+(s.position&&s.position<15?8:0));
const id=b.domain.replace(/[^a-z0-9]+/gi,"-").toLowerCase();
const doc=toDoc({name:b.name,domain:b.domain,url:b.url,nome_cliente:b.name,client_id:"",nicho:b.nicho,status:"active",seo_score,visits:g.views,whatsapp_clicks:0,ga4PropertyId:b.ga4,measurementId:b.mid,searchConsoleUrl:b.sc,indexedPages:idx,metrics:{ga4Users:g.users,ga4Views:g.views,ga4Sessions:g.sessions,scClicks:s.clicks,scImpressions:s.impressions,scPosition:s.position,indexedPages:idx,period:`${dates.s}..${dates.e}`,updatedAt:nowISO},source:"blogs-automaticos",updated_at:nowISO});
// PATCH sem sobrescrever created_at: usa updateMask nos campos enviados
const mask=Object.keys(doc.fields).map(k=>`updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
const r=await fetch(`https://firestore.googleapis.com/v1/projects/sistema-fada-madrinha/databases/(default)/documents/agencia_sites/${id}?${mask}`,{method:"PATCH",headers:{Authorization:"Bearer "+fsTok,"Content-Type":"application/json"},body:JSON.stringify(doc)});
if(r.ok){ok++;console.log(`OK ${b.name} | views=${g.views} clicks=${s.clicks} idx=${idx} seo=${seo_score}`);}else console.log(`FAIL ${r.status} ${b.name}`,JSON.stringify(await r.json()).slice(0,150));
}
console.log(`\n${ok}/${BLOGS.length} sincronizados no painel`);
})().catch(e=>{console.error("FATAL",e.message);process.exit(1);});
