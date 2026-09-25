const DEMO=[
{id:"demo-1",mode:"sale",title:"The Grand Modern",city:"Austin",state:"TX",price:895000,beds:4,baths:3,sqft:2840,type:"Single Family",tag:"FEATURED",image:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=90",description:"A refined modern residence with generous living areas and contemporary finishes."},
{id:"demo-2",mode:"sale",title:"Cedar Ridge Residence",city:"Atlanta",state:"GA",price:679000,beds:4,baths:3,sqft:2510,type:"Single Family",tag:"NEW",image:"https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=90",description:"A spacious family home in a sought-after Atlanta setting."},
{id:"demo-3",mode:"sale",title:"Oceanview House",city:"Miami",state:"FL",price:1250000,beds:5,baths:4,sqft:3380,type:"Single Family",tag:"LUXURY",image:"https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1400&q=90",description:"A luxury Miami home designed for indoor-outdoor living."},
{id:"demo-4",mode:"rent",title:"Park Avenue Residence",city:"New York",state:"NY",price:6200,beds:2,baths:2,sqft:1260,type:"Apartment",tag:"RENT",image:"https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1400&q=90",description:"Elegant city apartment living in the heart of New York."},
{id:"demo-5",mode:"rent",title:"Westside Townhome",city:"Los Angeles",state:"CA",price:4800,beds:3,baths:2.5,sqft:1780,type:"Townhouse",tag:"RENT",image:"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=90",description:"A comfortable Los Angeles townhome with modern space and privacy."},
{id:"demo-6",mode:"sale",title:"Hill Country Retreat",city:"Dallas",state:"TX",price:1125000,beds:5,baths:4,sqft:3650,type:"Single Family",tag:"LUXURY",image:"https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1400&q=90",description:"A spacious Texas retreat with room for entertaining and everyday life."}
];

const params=new URLSearchParams(location.search);
const id=params.get("id");
const mode=params.get("mode")==="rent"?"rent":"sale";
const CONTACT_EMAIL="rossiewhittaker@gmail.com";
const $=s=>document.querySelector(s);
let savedProperties=JSON.parse(localStorage.getItem("estatelux_saved_properties")||"[]");
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
let property=null;

function normalize(x){
  return {...x,id:x.id||crypto.randomUUID(),mode,title:x.title||x.formattedAddress?.split(",")[0]||"EstateLux Property",city:x.city||"",state:x.state||"",price:x.price,beds:x.bedrooms??"—",baths:x.bathrooms??"—",sqft:x.squareFootage||0,type:x.propertyType||"Property",tag:x.listingType?.toUpperCase()||(mode==="rent"?"RENT":"FOR SALE"),image:x.photo||x.photos?.[0]||DEMO.find(p=>p.mode===mode)?.image||DEMO[0].image,address:x.formattedAddress||x.address||"",description:x.description||"Property details supplied through the EstateLux listing feed.",photos:x.photos||[],lat:x.latitude,lng:x.longitude};
}

async function load(){
  property=DEMO.find(x=>x.id===id&&x.mode===mode)||DEMO.find(x=>x.id===id)||null;
  try{
    const r=await fetch("/api/listings?mode="+mode+"&limit=100",{cache:"no-store"});
    const d=await r.json().catch(()=>({}));
    const live=(d.listings||[]).map(normalize);
    property=live.find(x=>x.id===id)||property;
  }catch(e){}
  if(!property){
    $("#propertyPage").innerHTML="<div class='section'><h1>Property not found</h1><p>This property may no longer be in the live listing feed.</p><a class='gold-btn' href='properties.html?mode="+mode+"'>Browse properties</a></div>";
    return;
  }
  document.title=property.title+" — EstateLux";
  const meta=document.querySelector('meta[name="description"]');
  if(meta)meta.content=property.description||"Property details on EstateLux.";
  render();
}

function render(){
  const gallery=[property.image,...(property.photos||[]).filter(x=>x&&x!==property.image)].slice(0,6);
  const saved=JSON.parse(localStorage.getItem("estatelux_favorites")||"[]").includes(property.id);
  $("#propertyPage").innerHTML=`<section class="property-detail">
    <div class="property-gallery">${gallery.map((img,i)=>`<img src="${esc(img)}" alt="${esc(property.title)} photo ${i+1}" loading="${i?"lazy":"eager"}">`).join("")}</div>
    <div class="property-info">
      <span class="eyebrow dark">${esc(property.tag)}</span>
      <h1>${esc(property.title)}</h1>
      <div class="property-price">$ ${Number(property.price||0).toLocaleString()}${mode==="rent"?"/mo":""}</div>
      <div class="property-stats"><b>${esc(property.beds)}<small>Bedrooms</small></b><b>${esc(property.baths)}<small>Bathrooms</small></b><b>${Number(property.sqft||0).toLocaleString()}<small>Sq ft</small></b></div>
      <p class="property-address">${esc(property.address||property.city+", "+property.state)}</p>
      <p>${esc(property.description)}</p>
      <div class="property-actions"><button class="gold-btn" id="contactProperty">Request information</button><button class="outline-btn" id="saveProperty">${saved?"♥ Saved":"♡ Save property"}</button><button class="outline-btn" id="propertyMap">Open map</button></div>
      <div class="property-facts"><h3>Property overview</h3><p>Property type: <b>${esc(property.type)}</b></p><p>Location: <b>${esc(property.city)}, ${esc(property.state)}</b></p><p>Listing status: <b>Available through EstateLux search</b></p></div>
    </div>
  </section>`;

  $("#contactProperty").addEventListener("click",openContact);
  $("#saveProperty").addEventListener("click",()=>{
    let saved=JSON.parse(localStorage.getItem("estatelux_favorites")||"[]");
    const removing=saved.includes(property.id);
    saved=removing?saved.filter(x=>x!==property.id):[...saved,property.id];
    savedProperties=removing?savedProperties.filter(x=>x.id!==property.id):[...savedProperties.filter(x=>x.id!==property.id),property];
    localStorage.setItem("estatelux_favorites",JSON.stringify(saved));
    localStorage.setItem("estatelux_saved_properties",JSON.stringify(savedProperties));
    $("#saveProperty").textContent=saved.includes(property.id)?"♥ Saved":"♡ Save property";
  });
  $("#propertyMap").addEventListener("click",openMap);
}

function openContact(){
  $("#modalBackdrop").classList.remove("hidden");
  $("#modalContent").innerHTML=`<span class="eyebrow dark">ESTATELUX CONTACT</span><h2>Request information</h2><p>Send us your request and the EstateLux team will receive it securely.</p><form class="modal-form" id="propertyContact"><input required name="name" placeholder="Full name"><input required type="email" name="email" placeholder="Email address"><input name="phone" placeholder="Phone number (optional)"><textarea required name="message">I'm interested in ${esc(property.title)} in ${esc(property.city)}, ${esc(property.state)}.</textarea><button class="gold-btn" type="submit">Send request</button></form>`;
}

function openMap(){
  const destination=property.lat&&property.lng?property.lat+","+property.lng:(property.address||property.city+", "+property.state);
  const search="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(destination);
  if(!navigator.geolocation){location.href=search;return}
  navigator.geolocation.getCurrentPosition(pos=>{
    location.href="https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(pos.coords.latitude+","+pos.coords.longitude)+"&destination="+encodeURIComponent(destination);
  },()=>{
    alert("Please allow location access for EstateLux, then tap Open map again.");
  },{enableHighAccuracy:false,timeout:15000,maximumAge:300000});
}

document.addEventListener("click",e=>{
  if(e.target.id==="modalClose"||e.target.id==="modalBackdrop"&&e.target===e.currentTarget)$("#modalBackdrop").classList.add("hidden");
});

document.addEventListener("submit",async e=>{
  if(e.target.id!=="propertyContact")return;
  e.preventDefault();
  const form=e.target,f=new FormData(form),client=window.supabase?.createClient(window.ESTATELUX_SUPABASE_URL,window.ESTATELUX_SUPABASE_KEY);
  const payload={user_id:null,name:String(f.get("name")||"").trim(),email:String(f.get("email")||"").trim(),phone:String(f.get("phone")||"").trim(),message:String(f.get("message")||"").trim(),listing_id:property.id,listing_title:property.title,listing_data:property};
  const submit=form.querySelector("button[type=submit]");if(submit){submit.disabled=true;submit.textContent="Sending…"}
  try{
    if(client){
      const {data:userData}=await client.auth.getUser();
      payload.user_id=userData?.user?.id||null;
      const {error}=await client.from("inquiries").insert(payload);
      if(error)throw error;
    }
    const r=await fetch("/api/inquiry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error?.message||data.error||"Email delivery failed");
    form.innerHTML='<div class="success-box"><h3>Thank you.</h3><p>Your request has been sent to EstateLux. We will review it and respond using the contact information you provided.</p><button type="button" class="gold-btn" id="doneContact">Done</button></div>';
  }catch(err){
    if(submit){submit.disabled=false;submit.textContent="Send request"}
    form.insertAdjacentHTML("beforeend",'<p class="form-error">'+esc(err.message||"We could not send your request.")+'</p>');
  }
});

document.addEventListener("click",e=>{
  if(e.target.id==="doneContact")$("#modalBackdrop").classList.add("hidden");
});

load();
