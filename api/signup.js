import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});

  try{
    const {email,password,full_name,username}=req.body||{};
    const cleanEmail=String(email||"").trim().toLowerCase();
    const cleanName=String(full_name||"").trim();
    const cleanUsername=String(username||"").trim();

    if(!cleanEmail||!password) return res.status(400).json({error:"Email and password are required"});
    if(String(password).length<6) return res.status(400).json({error:"Password must be at least 6 characters"});

    const supabaseUrl=process.env.SUPABASE_URL||"https://qomrwgvcgabwdomsamlc.supabase.co";
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    const gmailUser=process.env.GMAIL_USER;
    const gmailAppPassword=process.env.GMAIL_APP_PASSWORD;

    if(!serviceKey||!gmailUser||!gmailAppPassword){
      return res.status(503).json({error:"EstateLux account email service is not configured yet."});
    }

    const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
    const redirectTo=(process.env.ESTATELUX_SITE_URL||"https://estate-lux-sand.vercel.app/").replace(/\/$/,"/");

    const {data,error}=await admin.auth.admin.generateLink({
      type:"signup",
      email:cleanEmail,
      password:String(password),
      options:{
        redirectTo,
        data:{full_name:cleanName,username:cleanUsername}
      }
    });
    if(error) return res.status(400).json({error:error.message});

    const actionLink=data?.properties?.action_link;
    if(!actionLink) return res.status(500).json({error:"Could not create the confirmation link."});

    const transporter=nodemailer.createTransport({
      host:"smtp.gmail.com",
      port:465,
      secure:true,
      auth:{user:gmailUser,pass:gmailAppPassword}
    });

    const safe=v=>String(v||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
    await transporter.sendMail({
      from:"EstateLux <"+gmailUser+">",
      to:cleanEmail,
      subject:"Confirm your EstateLux account",
      text:"Welcome to EstateLux. Confirm your email by opening this link: "+actionLink,
      html:"<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px'><h1 style='font-family:Georgia,serif'>EstateLux.</h1><h2>Confirm your account</h2><p>Hello "+safe(cleanName||"there")+",</p><p>Thank you for creating an EstateLux account. Tap the button below to confirm your email address and finish creating your account.</p><p><a href='"+actionLink+"' style='display:inline-block;background:#d4af37;color:#111;text-decoration:none;padding:14px 24px;border-radius:6px;font-weight:700'>Confirm my EstateLux account</a></p><p>After confirmation, you'll be returned to EstateLux automatically.</p><p style='color:#777;font-size:13px'>If you did not create this account, you can ignore this email.</p></div>"
    });

    return res.status(200).json({ok:true,message:"Confirmation email sent. Check your inbox and tap the EstateLux confirmation button."});
  }catch(e){
    console.error("EstateLux signup error:",e);
    return res.status(500).json({error:"We could not create the account right now. Please try again."});
  }
}
