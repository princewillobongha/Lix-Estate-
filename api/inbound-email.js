import crypto from "crypto";

function verifySignature(payload, headers, secret){
  if(!secret) return true;
  const id=headers["svix-id"], ts=headers["svix-timestamp"], sig=headers["svix-signature"];
  if(!id||!ts||!sig) return false;
  if(Math.abs(Date.now()/1000-Number(ts))>300) return false;
  const raw=secret.replace(/^whsec_/,"");
  const secretBytes=Buffer.from(raw,"base64");
  const signed=id+"."+ts+"."+payload;
  const expected=crypto.createHmac("sha256",secretBytes).update(signed).digest("base64");
  return sig.split(" ").some(part=>part.startsWith("v1,")&&part.slice(3)===expected);
}
export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  const raw=typeof req.body==="string"?req.body:JSON.stringify(req.body||{});
  if(!verifySignature(raw,req.headers,process.env.RESEND_WEBHOOK_SECRET)) return res.status(401).json({error:"Invalid webhook"});
  try{
    const event=typeof req.body==="string"?JSON.parse(req.body):req.body;
    if(event.type!=="email.received") return res.status(200).json({ok:true});
    const subject=event.data?.subject||"";
    const match=subject.match(/\[EstateLux #([a-f0-9-]+)\]/i);
    if(!match) return res.status(200).json({ok:true,ignored:true});
    const inquiryId=match[1];
    const sb=process.env.SUPABASE_URL||"https://qomrwgvcgabwdomsamlc.supabase.co";
    const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resend=process.env.RESEND_API_KEY;
    if(!service||!resend) return res.status(503).json({error:"Reply service not configured"});
    const headers={apikey:service,Authorization:"Bearer "+service};
    const q=await fetch(sb+"/rest/v1/inquiries?id=eq."+encodeURIComponent(inquiryId)+"&select=id,user_id,email,name,listing_id,listing_data",{headers});
    const rows=await q.json();const inquiry=rows?.[0];
    if(!inquiry) return res.status(404).json({error:"Inquiry not found"});
    const message="EstateLux has a new reply to your inquiry. Sign in to your EstateLux account to view updates.";
    if(inquiry.user_id) await fetch(sb+"/rest/v1/notifications",{method:"POST",headers:{...headers,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({user_id:inquiry.user_id,type:"inquiry_reply",title:"EstateLux replied to your inquiry",message,link:"index.html"})});
    await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+resend},body:JSON.stringify({from:process.env.ESTATELUX_FROM_EMAIL||"EstateLux <onboarding@resend.dev>",to:[inquiry.email],subject:"EstateLux replied to your inquiry",html:"<p>"+message+"</p><p>Please open EstateLux and sign in to see your account updates.</p>"})});
    return res.status(200).json({ok:true});
  }catch(e){return res.status(500).json({error:"Unable to process reply"})}
}