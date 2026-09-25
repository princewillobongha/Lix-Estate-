export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  try{
    const body=req.body||{};
    const name=String(body.name||"").trim();
    const email=String(body.email||"").trim();
    const phone=String(body.phone||"").trim();
    const message=String(body.message||"").trim();
    const listingId=String(body.listing_id||"").trim();
    const listingTitle=String(body.listing_title||"").trim();
    if(!name||!email||!message)return res.status(400).json({error:"Name, email and message are required"});

    const key=process.env.RESEND_API_KEY;
    const to=process.env.ESTATELUX_CONTACT_EMAIL||"rossiewhittaker@gmail.com";
    if(!key)return res.status(503).json({error:"Email service is not configured yet."});

    const clean=v=>v.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
    const response=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
      body:JSON.stringify({
        from:process.env.ESTATELUX_FROM_EMAIL||"EstateLux <onboarding@resend.dev>",
        to:[to],
        reply_to:email,
        subject:"EstateLux property request"+(listingTitle?" — "+listingTitle:""),
        html:`<h2>New EstateLux request</h2>
          <p><b>Name:</b> ${clean(name)}</p>
          <p><b>Email:</b> ${clean(email)}</p>
          <p><b>Phone:</b> ${clean(phone)}</p>
          <p><b>Property:</b> ${clean(listingTitle||listingId||"General EstateLux inquiry")}</p>
          <p><b>Message:</b></p><p>${clean(message).replace(/\n/g,"<br>")}</p>`
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return res.status(response.status).json({error:data?.message||data||"Resend could not deliver the message."});
    return res.status(200).json({ok:true});
  }catch(e){
    return res.status(500).json({error:"Unable to send the EstateLux request."});
  }
}