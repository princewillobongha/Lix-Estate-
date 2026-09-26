import nodemailer from "nodemailer";

export default async function handler(req,res){
  const secret=process.env.CRON_SECRET;
  if(secret && req.headers.authorization!=="Bearer "+secret) return res.status(401).json({error:"Unauthorized"});

  const sb=process.env.SUPABASE_URL||"https://qomrwgvcgabwdomsamlc.supabase.co";
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const gmailUser=process.env.GMAIL_USER;
  const gmailAppPassword=process.env.GMAIL_APP_PASSWORD;

  if(!service||!gmailUser||!gmailAppPassword){
    return res.status(503).json({error:"Alert service is not configured"});
  }

  try{
    const transporter=nodemailer.createTransport({
      host:"smtp.gmail.com",
      port:465,
      secure:true,
      auth:{user:gmailUser,pass:gmailAppPassword}
    });

    const headers={apikey:service,Authorization:"Bearer "+service};
    const sr=await fetch(sb+"/rest/v1/saved_searches?select=*&email_alerts=eq.true",{headers});
    const searches=await sr.json();
    let sent=0;

    for(const s of searches||[]){
      const params=new URLSearchParams({status:"Active",limit:"10",daysOld:"1"});
      const loc=String(s.location||"").trim();
      if(/^\d{5}$/.test(loc)) params.set("zipCode",loc);
      else if(loc.includes(",")){
        const parts=loc.split(",").map(x=>x.trim());
        params.set("city",parts[0]);
        if(parts[1]) params.set("state",parts[1].split(/\s+/)[0].toUpperCase());
      }else if(loc) params.set("city",loc);

      if(s.property_type) params.set("propertyType",s.property_type);
      if(s.bedrooms) params.set("bedrooms",s.bedrooms);
      if(s.max_price) params.set("priceMax",s.max_price);

      const endpoint=s.mode==="rent"?"/listings/rental/long-term":"/listings/sale";
      const rr=await fetch("https://api.rentcast.io/v1"+endpoint+"?"+params,{
        headers:{"X-Api-Key":process.env.RENTCAST_API_KEY||""}
      });
      if(!rr.ok) continue;

      const data=await rr.json();
      const items=Array.isArray(data)?data:(data.listings||[]);
      if(!items.length||!s.email) continue;

      const safe=v=>String(v||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
      const html="<h2>New EstateLux matches</h2><p>New properties matching your saved search <b>"+safe(s.name||"EstateLux search")+"</b>:</p><ul>"+
        items.slice(0,5).map(p=>"<li><b>"+safe(p.title||p.formattedAddress||"Property")+"</b> — $"+Number(p.price||0).toLocaleString()+" — "+safe(p.formattedAddress||"")+"</li>").join("")+
        "</ul><p>Open EstateLux to continue exploring.</p>";

      const info=await transporter.sendMail({
        from:"EstateLux <"+gmailUser+">",
        to:s.email,
        subject:"New EstateLux property matches",
        text:"EstateLux found new properties matching your saved search.",
        html,
        replyTo:process.env.ESTATELUX_CONTACT_EMAIL||gmailUser
      });

      if(info){
        sent++;
        await fetch(sb+"/rest/v1/notifications",{
          method:"POST",
          headers:{...headers,"Content-Type":"application/json","Prefer":"return=minimal"},
          body:JSON.stringify({
            user_id:s.user_id,
            type:"property_alert",
            title:"New property matches your search",
            message:"EstateLux found new properties matching your saved search.",
            link:"properties.html?mode="+(s.mode||"sale")
          })
        });
        await fetch(sb+"/rest/v1/saved_searches?id=eq."+s.id,{
          method:"PATCH",
          headers:{...headers,"Content-Type":"application/json","Prefer":"return=minimal"},
          body:JSON.stringify({last_alert_at:new Date().toISOString()})
        });
      }
    }

    return res.status(200).json({ok:true,sent});
  }catch(e){
    console.error("EstateLux alert digest error:",e);
    return res.status(500).json({error:"Alert digest failed"});
  }
}
