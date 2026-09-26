import nodemailer from "nodemailer";

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});

  try{
    const body=req.body||{};
    const name=String(body.name||"").trim();
    const email=String(body.email||"").trim();
    const phone=String(body.phone||"").trim();
    const message=String(body.message||"").trim();
    const listingId=String(body.listing_id||"").trim();
    const listingTitle=String(body.listing_title||"").trim();

    if(!name||!email||!message){
      return res.status(400).json({error:"Name, email and message are required"});
    }

    const clean=v=>String(v||"").replace(/[&<>"']/g,m=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));

    const to=process.env.ESTATELUX_CONTACT_EMAIL||"rossiewhittaker@gmail.com";
    const subject="EstateLux property request"+(listingTitle?" — "+listingTitle:"");

    /*
      Gmail SMTP is the no-custom-domain option for EstateLux.
      The Gmail account sends the message to the EstateLux contact inbox.
      The customer's email is used only as Reply-To so EstateLux can reply
      directly to the person who submitted the request.
    */
    const gmailUser=process.env.GMAIL_USER;
    const gmailAppPassword=process.env.GMAIL_APP_PASSWORD;

    if(gmailUser&&gmailAppPassword){
      const transporter=nodemailer.createTransport({
        host:"smtp.gmail.com",
        port:465,
        secure:true,
        auth:{
          user:gmailUser,
          pass:gmailAppPassword
        }
      });

      await transporter.sendMail({
        from:`EstateLux <${gmailUser}>`,
        to,
        replyTo:email,
        subject,
        text:[
          "New EstateLux property request",
          "",
          `Name: ${name}`,
          `Email: ${email}`,
          `Phone: ${phone||"Not provided"}`,
          `Property: ${listingTitle||listingId||"General EstateLux inquiry"}`,
          "",
          "Message:",
          message
        ].join("\n"),
        html:`<h2>New EstateLux property request</h2>
          <p><b>Name:</b> ${clean(name)}</p>
          <p><b>Email:</b> ${clean(email)}</p>
          <p><b>Phone:</b> ${clean(phone)||"Not provided"}</p>
          <p><b>Property:</b> ${clean(listingTitle||listingId||"General EstateLux inquiry")}</p>
          <p><b>Message:</b></p>
          <p>${clean(message).replace(/\n/g,"<br>")}</p>`
      });

      return res.status(200).json({ok:true,method:"gmail"});
    }

    // Keep Resend available as a future/verified-domain fallback.
    const resendKey=process.env.RESEND_API_KEY;
    if(resendKey){
      const response=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer "+resendKey
        },
        body:JSON.stringify({
          from:process.env.ESTATELUX_FROM_EMAIL||"EstateLux <onboarding@resend.dev>",
          to:[to],
          reply_to:email,
          subject,
          html:`<h2>New EstateLux property request</h2>
            <p><b>Name:</b> ${clean(name)}</p>
            <p><b>Email:</b> ${clean(email)}</p>
            <p><b>Phone:</b> ${clean(phone)||"Not provided"}</p>
            <p><b>Property:</b> ${clean(listingTitle||listingId||"General EstateLux inquiry")}</p>
            <p><b>Message:</b></p>
            <p>${clean(message).replace(/\n/g,"<br>")}</p>`
        })
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        return res.status(response.status).json({
          error:data?.message||data||"Email delivery is not configured yet."
        });
      }
      return res.status(200).json({ok:true,method:"resend"});
    }

    return res.status(503).json({
      error:"EstateLux email delivery is not configured yet."
    });
  }catch(e){
    console.error("EstateLux inquiry email error:",e);
    return res.status(500).json({
      error:"We received the request but could not send the email notification yet."
    });
  }
}
