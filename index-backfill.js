// Envia posts antigos ao Google Indexing API aos poucos (respeita cota 200/dia). Estado em indexed.json.
const fs=require("fs");
const CID=process.env.G_CLIENT_ID, CS=process.env.G_CLIENT_SECRET, RT=process.env.G_REFRESH_TOTAL;
const BATCH=parseInt(process.env.BATCH||"90",10);
const STATE="indexed.json";
const BLOGS=[
"https://ouniversoanimes.blogspot.com/",
"https://weloveanimes1.blogspot.com/",
"https://www.dinheironodiaadia.com/",
"https://omundodaia.blogspot.com/",
];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function allUrls(site){let urls=[],start=1;for(let p=0;p<8;p++){try{const d=await(await fetch(`${site}feeds/posts/default?alt=json&start-index=${start}&max-results=150`,{headers:{"User-Agent":"Mozilla/5.0"}})).json();const e=(d.feed&&d.feed.entry)||[];if(!e.length)break;e.forEach(x=>{const l=(x.link||[]).find(y=>y.rel==="alternate");if(l)urls.push(l.href);});if(e.length<150)break;start+=150;}catch{break;}}return urls;}
(async()=>{
let done=[];try{done=JSON.parse(fs.readFileSync(STATE,"utf8"));}catch{done=[];}
const set=new Set(done);
let pool=[];
for(const s of BLOGS){const u=await allUrls(s);pool=pool.concat(u);}
const pend=pool.filter(u=>!set.has(u));
console.log(`total posts: ${pool.length} | já indexados: ${set.size} | pendentes: ${pend.length} | lote hoje: ${BATCH}`);
const tok=(await(await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:CID,client_secret:CS,refresh_token:RT,grant_type:"refresh_token"})})).json()).access_token;
if(!tok){console.error("sem token");process.exit(1);}
let ok=0;
for(const u of pend.slice(0,BATCH)){
const r=await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish",{method:"POST",headers:{Authorization:"Bearer "+tok,"Content-Type":"application/json"},body:JSON.stringify({url:u,type:"URL_UPDATED"})});
if(r.status===200){ok++;set.add(u);}
else if(r.status===429){console.log("cota diária atingida, para por hoje");break;}
else if(r.status===403){console.log("403 (owner?):",u);}
await sleep(150);
}
fs.writeFileSync(STATE,JSON.stringify([...set],null,0));
const restante=pool.filter(u=>!set.has(u)).length;
console.log(`\n${ok} enviadas hoje | faltam ${restante} | ${restante===0?"✅ 100% INDEXADO":"continua amanhã"}`);
})().catch(e=>{console.error("FATAL",e.message);process.exit(1);});
