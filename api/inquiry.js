export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    const {name,email,phone,message,listing_id,listing_title,inquiry_id}=req.body||{};
    if(!name||!email||!message) return res.status(400).json({error:"Name, email and message are required"});
    const key=process.env.RESEND_API_KEY;
    const to=process.env.ESTATELUX_CONTACT_EMAIL||"rossiewhittaker@gmail.com";
    if(!key) return res.status(503).json({error:"Email service not configured",saved:true});
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({
      from:process.env.ESTATELUX_FROM_EMAIL||"EstateLux <onboarding@resend.dev>",
      to:[to],
      reply_to:[email],
      subject:"[EstateLux #"+String(inquiry_id||listing_id||"inquiry")+"]"+(listing_title?" — "+listing_title:""),
      reply_to:[process.env.ESTATELUX_REPLY_TO_EMAIL||email],
      html:"<h2>New EstateLux inquiry</h2><p><b>Name:</b> "+String(name).replace(/</g,"&lt;")+"</p><p><b>Email:</b> "+String(email).replace(/</g,"&lt;")+"</p><p><b>Phone:</b> "+String(phone||"").replace(/</g,"&lt;")+"</p><p><b>Property:</b> "+String(listing_title||listing_id||"General inquiry").replace(/</g,"&lt;")+"</p><p><b>Message:</b></p><p>"+String(message).replace(/</g,"&lt;").replace(/\n/g,"<br>")+"</p>"
    })});
    const data=await response.json();
    if(!response.ok) return res.status(response.status).json({error:data});
    return res.status(200).json({ok:true});
  }catch(e){return res.status(500).json({error:"Unable to send inquiry"})}
}