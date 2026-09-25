export default async function handler(req,res){
  const secret=process.env.CRON_SECRET;
  if(secret && req.headers.authorization!=="Bearer "+secret) return res.status(401).json({error:"Unauthorized"});
  const sb=process.env.SUPABASE_URL||"https://qomrwgvcgabwdomsamlc.supabase.co";
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resend=process.env.RESEND_API_KEY;
  if(!service||!resend) return res.status(503).json({error:"Alert service is not configured"});
  try{
    const headers={apikey:service,Authorization:"Bearer "+service};
    const sr=await fetch(sb+"/rest/v1/saved_searches?select=*&email_alerts=eq.true",{headers});
    const searches=await sr.json();
    let sent=0;
    for(const s of searches||[]){
      const params=new URLSearchParams({status:"Active",limit:"10",daysOld:"1"});
      const loc=String(s.location||"").trim();
      if(/^\d{5}$/.test(loc)) params.set("zipCode",loc);
      else if(loc.includes(",")){const parts=loc.split(",").map(x=>x.trim());params.set("city",parts[0]);if(parts[1])params.set("state",parts[1].split(/\s+/)[0].toUpperCase())}
      else if(loc) params.set("city",loc);
      if(s.property_type) params.set("propertyType",s.property_type);
      if(s.bedrooms) params.set("bedrooms",s.bedrooms);
      if(s.max_price) params.set("priceMax",s.max_price);
      const endpoint=s.mode==="rent"?"/listings/rental/long-term":"/listings/sale";
      const rr=await fetch("https://api.rentcast.io/v1"+endpoint+"?"+params,{headers:{"X-Api-Key":process.env.RENTCAST_API_KEY||""}});
      if(!rr.ok) continue;
      const data=await rr.json();const items=Array.isArray(data)?data:(data.listings||[]);
      if(!items.length || !s.email) continue;
      const html="<h2>New EstateLux matches</h2><p>New properties matching your saved search <b>"+String(s.name||"EstateLux search").replace(/</g,"&lt;")+"</b>:</p><ul>"+items.slice(0,5).map(p=>"<li><b>"+String(p.title||p.formattedAddress||"Property").replace(/</g,"&lt;")+"</b> — $"+Number(p.price||0).toLocaleString()+" — "+String(p.formattedAddress||"").replace(/</g,"&lt;")+"</li>").join("")+"</ul><p>Open EstateLux to continue exploring.</p>";
      const er=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+resend},body:JSON.stringify({from:process.env.ESTATELUX_FROM_EMAIL||"EstateLux <onboarding@resend.dev>",to:[s.email],subject:"New EstateLux property matches",html})});
      if(er.ok){
        sent++;
        await fetch(sb+"/rest/v1/notifications",{method:"POST",headers:{...headers,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({user_id:s.user_id,type:"property_alert",title:"New property matches your search",message:"EstateLux found new properties matching your saved search.",link:"properties.html?mode="+(s.mode||"sale")})});
        await fetch(sb+"/rest/v1/saved_searches?id=eq."+s.id,{method:"PATCH",headers:{...headers,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({last_alert_at:new Date().toISOString()})});
      }
    }
    return res.status(200).json({ok:true,sent});
  }catch(e){return res.status(500).json({error:"Alert digest failed"})}
}