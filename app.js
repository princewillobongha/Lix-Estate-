const CONTACT_EMAIL = "rossiewhittaker@gmail.com";
const SUPABASE_URL = window.ESTATELUX_SUPABASE_URL;
const SUPABASE_KEY = window.ESTATELUX_SUPABASE_KEY;
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);

const DEMO_LISTINGS = [
  {id:"demo-1",mode:"sale",title:"The Grand Modern",city:"Austin",state:"TX",price:895000,beds:4,baths:3,sqft:2840,type:"Single Family",tag:"FEATURED",image:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85",lat:30.2672,lng:-97.7431,description:"A refined modern residence with generous living areas and contemporary finishes."},
  {id:"demo-2",mode:"sale",title:"Cedar Ridge Residence",city:"Atlanta",state:"GA",price:679000,beds:4,baths:3,sqft:2510,type:"Single Family",tag:"NEW",image:"https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85",lat:33.749,lng:-84.388,description:"A spacious family home in a sought-after Atlanta setting."},
  {id:"demo-3",mode:"sale",title:"Oceanview House",city:"Miami",state:"FL",price:1250000,beds:5,baths:4,sqft:3380,type:"Single Family",tag:"LUXURY",image:"https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=85",lat:25.7617,lng:-80.1918,description:"A luxury Miami home designed for indoor-outdoor living."},
  {id:"demo-4",mode:"rent",title:"Park Avenue Residence",city:"New York",state:"NY",price:6200,beds:2,baths:2,sqft:1260,type:"Apartment",tag:"RENT",image:"https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1200&q=85",lat:40.7128,lng:-74.006,description:"Elegant city apartment living in the heart of New York."},
  {id:"demo-5",mode:"rent",title:"Westside Townhome",city:"Los Angeles",state:"CA",price:4800,beds:3,baths:2.5,sqft:1780,type:"Townhouse",tag:"RENT",image:"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85",lat:34.0522,lng:-118.2437,description:"A comfortable Los Angeles townhome with modern space and privacy."},
  {id:"demo-6",mode:"sale",title:"Hill Country Retreat",city:"Dallas",state:"TX",price:1125000,beds:5,baths:4,sqft:3650,type:"Single Family",tag:"LUXURY",image:"https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=85",lat:32.7767,lng:-96.797,description:"A spacious Texas retreat with room for entertaining and everyday life."}
];

let mode = "sale";
let listings = [...DEMO_LISTINGS];
let filtered = [...listings];
let favorites = JSON.parse(localStorage.getItem("estatelux_favorites") || "[]");
let currentUser = null;
let currentProfile = null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function money(n,rent=false){
  if(n==null || n==="") return "Price on request";
  return rent ? "$"+Number(n).toLocaleString()+"/mo" : "$"+Number(n).toLocaleString();
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function safeCall(fn){try{fn()}catch(e){console.error(e)}}

function renderListings(items=filtered){
  const grid=$("#listingGrid"), empty=$("#emptyState");
  if(!grid) return;
  if(!items.length){grid.innerHTML="";empty?.classList.remove("hidden");return}
  empty?.classList.add("hidden");
  grid.innerHTML=items.map(p=>`
    <article class="listing-card">
      <div class="listing-image" style="background-image:url('${esc(p.image)}')">
        <span class="badge">${esc(p.tag||(p.mode==="rent"?"RENT":"FOR SALE"))}</span>
        <button class="heart ${favorites.includes(p.id)?"saved":""}" data-fav="${esc(p.id)}" aria-label="Save property">${favorites.includes(p.id)?"♥":"♡"}</button>
      </div>
      <div class="listing-info">
        <div class="price">${money(p.price,p.mode==="rent")}</div>
        <div class="listing-title">${esc(p.title)}</div>
        <div class="address">${esc(p.city)}, ${esc(p.state)}</div>
        <div class="stats"><span>${esc(p.beds)} bd</span><span>${esc(p.baths)} ba</span><span>${Number(p.sqft||0).toLocaleString()} sq ft</span></div>
        <div class="card-actions">
          <button class="primary" data-property="${esc(p.id)}">View Property</button>
          <button data-map="${esc(p.id)}">Map</button>
        </div>
      </div>
    </article>`).join("");
}

function normalizeApi(p){
  const rent=mode==="rent";
  return {
    ...p,id:p.id||crypto.randomUUID(),mode,title:p.title||p.formattedAddress?.split(",")[0]||"EstateLux Property",
    city:p.city||"",state:p.state||"",price:p.price,beds:p.bedrooms??"—",baths:p.bathrooms??"—",
    sqft:p.squareFootage||0,type:p.propertyType||"Property",tag:p.listingType?.toUpperCase()||(rent?"RENT":"FOR SALE"),
    image:p.photo||p.photos?.[0]||DEMO_LISTINGS[0].image,lat:p.latitude,lng:p.longitude,address:p.formattedAddress,
    description:p.description||"Property details supplied through the EstateLux listing feed.",photos:p.photos||[]
  };
}

async function loadApi(){
  try{
    const qs=new URLSearchParams({mode,limit:"12"});
    const loc=$("#locationInput")?.value.trim();
    if(loc) qs.set("location",loc);
    const r=await fetch("/api/listings?"+qs);
    if(!r.ok) return;
    const data=await r.json();
    if(Array.isArray(data.listings)&&data.listings.length){
      listings=data.listings.map(normalizeApi);
      applyFilters(false);
    }
  }catch(e){console.warn("Live listings unavailable; using demo listings.",e)}
}

function applyFilters(tryApi=true){
  const q=$("#locationInput")?.value.trim().toLowerCase()||"";
  const type=$("#typeInput")?.value||"";
  const beds=$("#bedsInput")?.value||"";
  const max=$("#budgetInput")?.value||"";
  filtered=listings.filter(p=>{
    if(p.mode!==mode) return false;
    const hay=(p.title+" "+p.city+" "+p.state+" "+(p.address||"")).toLowerCase();
    if(q&&!hay.includes(q)) return false;
    if(type&&p.type!==type) return false;
    if(beds&&Number(p.beds)<Number(beds.replace("+",""))) return false;
    if(max&&Number(p.price)>Number(max)) return false;
    return true;
  });
  renderListings();
  if(tryApi) loadApi();
}

function setMode(next){
  mode=next;
  $$(".search-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.mode===next));
  if($("#budgetLabel")) $("#budgetLabel").textContent=next==="rent"?"Max rent":"Max price";
  if($("#budgetInput")) $("#budgetInput").innerHTML=next==="rent"
    ? '<option value="">Any</option><option value="1500">$1.5k</option><option value="2500">$2.5k</option><option value="4000">$4k</option><option value="6000">$6k</option><option value="10000">$10k</option>'
    : '<option value="">Any</option><option value="300000">$300k</option><option value="500000">$500k</option><option value="750000">$750k</option><option value="1000000">$1M</option><option value="2000000">$2M</option>';
  applyFilters(false);
}

async function saveFavorite(id){
  favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];
  localStorage.setItem("estatelux_favorites",JSON.stringify(favorites));
  if(currentUser&&supabaseClient){
    const p=listings.find(x=>x.id===id);
    if(favorites.includes(id)){
      await supabaseClient.from("favorites").upsert({user_id:currentUser.id,listing_id:id,listing_data:p||null},{onConflict:"user_id,listing_id"});
    }else{
      await supabaseClient.from("favorites").delete().eq("user_id",currentUser.id).eq("listing_id",id);
    }
  }
  renderListings();
}

function updateHeader(){
  const signins=$("#loginBtn, [data-auth-button]");
  signins.forEach(b=>{
    b.dataset.open=currentUser?"account":"login";
    if(!b.closest(".mobile-nav")) b.textContent=currentUser?"Account":"Sign in";
  });
  const n=$("#notificationCount");
  if(n&&currentUser) loadNotifications();
  else if(n) n.textContent="";
  const mn=$("#mobileNotificationCount"); if(mn&&n) mn.textContent=n.textContent;
}

async function refreshAuth(){
  if(!supabaseClient) return;
  const {data}=await supabaseClient.auth.getUser();
  currentUser=data?.user||null;
  if(currentUser){
    const {data:profile}=await supabaseClient.from("profiles").select("*").eq("id",currentUser.id).maybeSingle();
    currentProfile=profile;
    if(profile?.username) localStorage.setItem("estatelux_username",profile.username);
  }else currentProfile=null;
  updateHeader();
}

async function loadNotifications(){
  if(!currentUser||!supabaseClient) return;
  const {data}=await supabaseClient.from("notifications").select("*").eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(30);
  const unread=(data||[]).filter(x=>!x.read).length;
  const n=$("#notificationCount"); if(n) n.textContent=unread?String(unread):"";
}

function openModal(type,data=null){
  const back=$("#modalBackdrop"),content=$("#modalContent");
  if(!back||!content) return;
  back.classList.remove("hidden");
  let html="";
  if(type==="property"){
    const p=data;
    html=`<div class="property-modal"><img src="${esc(p.image)}" alt="${esc(p.title)}"><div><span class="eyebrow dark">${esc(p.tag||"PROPERTY")}</span><h2>${esc(p.title)}</h2><div class="price">${money(p.price,p.mode==="rent")}</div><p>${esc(p.beds)} bedrooms · ${esc(p.baths)} bathrooms · ${Number(p.sqft||0).toLocaleString()} sq ft · ${esc(p.type)}</p><p><b>${esc(p.address||p.city+", "+p.state)}</b></p><p>${esc(p.description||"Detailed property information is available on the property page.")}</p><div class="modal-actions"><a class="gold-btn" href="property.html?id=${encodeURIComponent(p.id)}&mode=${p.mode}">Full property details</a><button class="outline-btn" data-open-contact="${esc(p.id)}">Request Information</button><button class="outline-btn" data-map="${esc(p.id)}">Open map</button></div></div></div>`;
  }else if(type==="contact"){
    const listingId=data?.id||"", listingTitle=data?.title||"";
    html=`<span class="eyebrow dark">ESTATELUX CONTACT</span><h2>Talk to EstateLux</h2><p>Your message is saved securely. Once email delivery is configured, the EstateLux team will also receive it by email.</p><form class="modal-form" id="contactForm"><input required name="name" placeholder="Full name"><input required type="email" name="email" placeholder="Email address"><input name="phone" placeholder="Phone number (optional)"><input type="hidden" name="listing_id" value="${esc(listingId)}"><input type="hidden" name="listing_title" value="${esc(listingTitle)}"><textarea required name="message" placeholder="How can we help?">${listingTitle ? "I am interested in "+esc(listingTitle)+"." : ""}</textarea><button class="gold-btn">Send message</button></form><a class="mail-link" href="mailto:${CONTACT_EMAIL}?subject=EstateLux%20Inquiry">Or email EstateLux directly: ${CONTACT_EMAIL}</a>`;
  }else if(type==="login"){
    html=`<span class="eyebrow dark">ESTATELUX ACCOUNT</span><h2>Welcome to your property space.</h2><p>Create an account to keep your profile, favorites, saved searches and notifications together.</p><form class="modal-form" id="loginForm"><input required name="email" type="email" placeholder="Email address"><input required name="password" type="password" minlength="6" placeholder="Password"><input name="full_name" placeholder="Full name (for new accounts)"><input name="username" placeholder="Username (for new accounts)"><button class="gold-btn" type="submit">Sign in</button><button class="outline-btn" type="button" id="googleSignInBtn">Continue with Google</button><button class="outline-btn" type="button" id="signupBtn">Create account</button><p id="authMessage"></p></form>`;
  }else if(type==="account"){
    if(!currentUser){openModal("login");return}
    const name=currentProfile?.full_name||currentUser.user_metadata?.full_name||"EstateLux member";
    const username=currentProfile?.username||"Add username";
    const initials=(name.match(/\b\w/g)||["E","L"]).slice(0,2).join("").toUpperCase();
    html=`<div class="account-head"><div class="avatar">${esc(initials)}</div><div><span class="eyebrow dark">MY ESTATELUX</span><h2>${esc(name)}</h2><p>@${esc(username)}</p></div></div><div class="account-menu"><button data-open="profile">Edit profile</button><button data-open="saved">Saved properties</button><button data-open="alerts">Saved searches</button><button data-open="notifications">Notifications</button></div><button class="outline-btn" id="signOutBtn">Sign out</button>`;
  }else if(type==="profile"){
    if(!currentUser){openModal("login");return}
    const p=currentProfile||{};
    html=`<span class="eyebrow dark">PROFILE</span><h2>Your EstateLux profile</h2><form class="modal-form" id="profileForm"><input name="full_name" value="${esc(p.full_name||currentUser.user_metadata?.full_name||"")}" placeholder="Full name"><input name="username" value="${esc(p.username||"")}" placeholder="Username"><input name="phone" value="${esc(p.phone||"")}" placeholder="Phone number"><input name="country" value="${esc(p.country||"")}" placeholder="Country"><button class="gold-btn">Save profile</button><p id="profileMessage"></p></form>`;
  }else if(type==="saved"){
    const saved=listings.filter(p=>favorites.includes(p.id));
    html=`<span class="eyebrow dark">YOUR COLLECTION</span><h2>Saved properties</h2>${saved.length?'<div class="saved-list">'+saved.map(p=>`<div class="saved-row"><span>${esc(p.title)}<small> · ${esc(p.city)}, ${esc(p.state)}</small></span><button data-property="${esc(p.id)">Open →</button></div>`).join("")+"</div>":'<p>No saved properties yet. Tap ♡ on a property to build your collection.</p>'}`;
  }else if(type==="alerts"){
    html=`<span class="eyebrow dark">PROPERTY ALERTS</span><h2>Stay ahead of new listings.</h2><p>Save the search you care about. Email delivery will activate after the EstateLux mail service is connected.</p><form class="modal-form" id="alertForm"><input required type="email" name="email" value="${esc(currentUser?.email||"")}" placeholder="Email address"><input required name="search" placeholder="e.g. 3+ bedrooms in Houston"><select name="frequency"><option value="daily">Daily digest</option><option value="instant">New listing alerts</option><option value="weekly">Weekly</option></select><button class="gold-btn">Save alert</button><p id="alertMessage"></p></form>`;
  }else if(type==="notifications"){
    html=`<span class="eyebrow dark">NOTIFICATIONS</span><h2>Your updates</h2><div id="notificationList"><p>Loading…</p></div>`;
  }else if(type==="location"){
    html=`<span class="eyebrow dark">LOCATION ACCESS</span><h2>Turn on your location</h2><p>EstateLux asks for your browser location only when you choose directions to a property. Turn on location permission, then tap the map button again.</p><button class="gold-btn" id="locationHelp">I understand</button>`;
  }else if(type==="menu"){
    html=`<span class="eyebrow dark">ESTATELUX</span><h2>Explore the platform</h2><div class="menu-grid"><a href="properties.html?mode=sale">Homes for sale</a><a href="properties.html?mode=rent">Rentals</a><a href="about.html">About EstateLux</a><a href="mailto:${CONTACT_EMAIL}">Contact by email</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a></div>`;
  }
  content.innerHTML=html;
  if(type==="notifications") renderNotifications();
}

async function renderNotifications(){
  const box=$("#notificationList");
  if(!box||!currentUser||!supabaseClient) return;
  const {data,error}=await supabaseClient.from("notifications").select("*").eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(30);
  if(error){box.innerHTML="<p>Notifications are temporarily unavailable.</p>";return}
  if(!data?.length){box.innerHTML="<p>No notifications yet. Property alerts and replies will appear here.</p>";return}
  box.innerHTML=data.map(n=>`<button class="notification-row ${n.read?"":"unread"}" data-notification="${n.id}" data-link="${esc(n.link||"")}"><b>${esc(n.title)}</b><span>${esc(n.message)}</span><small>${new Date(n.created_at).toLocaleString()}</small></button>`).join("");
}

async function closeModal(){ $("#modalBackdrop")?.classList.add("hidden"); if($("#modalContent")) $("#modalContent").innerHTML=""; }

function openMapForProperty(p){
  if(!p) return;
  if(!navigator.geolocation){
    window.open("https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(p.address||p.city+", "+p.state),"_blank");
    return;
  }
  navigator.geolocation.getCurrentPosition(pos=>{
    const origin=pos.coords.latitude+","+pos.coords.longitude;
    const destination=p.lat&&p.lng?p.lat+","+p.lng:(p.address||p.city+", "+p.state);
    window.open("https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(origin)+"&destination="+encodeURIComponent(destination),"_blank");
  },()=>{
    openModal("location");
  },{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
}

document.addEventListener("click",async e=>{
  const fav=e.target.closest("[data-fav]");
  if(fav){await saveFavorite(fav.dataset.fav);return}

  const prop=e.target.closest("[data-property]");
  if(prop){const p=listings.find(x=>x.id===prop.dataset.property);if(p)openModal("property",p);return}

  const map=e.target.closest("[data-map]");
  if(map){const p=listings.find(x=>x.id===map.dataset.map);if(p)openMapForProperty(p);return}

  const open=e.target.closest("[data-open]");
  if(open){if(open.dataset.open==="notifications"&&!currentUser){openModal("login");return}openModal(open.dataset.open);return}

  const contact=e.target.closest("[data-open-contact]");
  if(contact){const p=listings.find(x=>x.id===contact.dataset.openContact);openModal("contact",p);return}

  const quick=e.target.closest("[data-quick]");
  if(quick&&$("#locationInput")){$("#locationInput").value=quick.dataset.quick;$("#featured")?.scrollIntoView({behavior:"smooth"});applyFilters();return}

  const rental=e.target.closest("[data-rental]");
  if(rental){window.location.href="properties.html?mode=rent&type="+encodeURIComponent(rental.dataset.rental);return}

  if(e.target.closest("#viewAllBtn")){window.location.href="properties.html?mode=sale";return}
  if(e.target.closest("#rentBtn")){window.location.href="properties.html?mode=rent";return}
  if(e.target.closest("[data-scroll]")){document.querySelector(e.target.closest("[data-scroll]").dataset.scroll)?.scrollIntoView({behavior:"smooth"});return}
  if(e.target.closest("#menuToggle")){$("#sideMenu")?.classList.toggle("open");return}
  if(e.target.closest("#menuClose")){$("#sideMenu")?.classList.remove("open");return}
  if(e.target.closest("#modalClose")){closeModal();return}
  if(e.target.id==="signOutBtn"){await supabaseClient.auth.signOut();await refreshAuth();closeModal();return}
  if(e.target.id==="googleSignInBtn"){
    try{const {error}=await supabaseClient.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin}});if(error)throw error}catch(err){const msg=$("#authMessage");if(msg)msg.textContent=err.message+" — Google sign-in must first be enabled in Supabase Auth."}
    return;
  }
  if(e.target.id==="signupBtn"){
    const f=new FormData($("#loginForm")),msg=$("#authMessage");
    msg.textContent="Creating account…";
    try{
      const {data,error}=await supabaseClient.auth.signUp({email:f.get("email"),password:f.get("password"),options:{data:{full_name:f.get("full_name")||"",username:f.get("username")||""}}});
      if(error) throw error;
      if(data.user){
        await supabaseClient.from("profiles").upsert({id:data.user.id,full_name:f.get("full_name")||null,username:f.get("username")||null});
      }
      msg.textContent="Account created. Check your email if confirmation is enabled, then sign in.";
    }catch(err){msg.textContent=err.message}
    return;
  }
  const notif=e.target.closest("[data-notification]");
  if(notif&&currentUser&&supabaseClient){
    await supabaseClient.from("notifications").update({read:true}).eq("id",notif.dataset.notification).eq("user_id",currentUser.id);
    await loadNotifications();
    if(notif.dataset.link) location.href=notif.dataset.link;
    else renderNotifications();
  }
  if(e.target.closest("#locationHelp")){openModal("location");return}
});

document.addEventListener("submit",async e=>{
  if(e.target.id==="searchForm"){e.preventDefault();applyFilters();$("#featured")?.scrollIntoView({behavior:"smooth"});return}

  if(e.target.id==="loginForm"){
    e.preventDefault();
    const f=new FormData(e.target),msg=$("#authMessage");msg.textContent="Signing in…";
    try{const {error}=await supabaseClient.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(error)throw error;await refreshAuth();closeModal()}catch(err){msg.textContent=err.message}
    return;
  }

  if(e.target.id==="profileForm"){
    e.preventDefault();
    if(!currentUser)return;
    const f=new FormData(e.target),msg=$("#profileMessage");msg.textContent="Saving…";
    try{
      const {data,error}=await supabaseClient.from("profiles").upsert({id:currentUser.id,full_name:f.get("full_name")||null,username:f.get("username")||null,phone:f.get("phone")||null,country:f.get("country")||null}).select().single();
      if(error)throw error;currentProfile=data;msg.textContent="Profile saved.";updateHeader();
    }catch(err){msg.textContent=err.message}
    return;
  }

  if(e.target.id==="contactForm"){
    e.preventDefault();
    const f=new FormData(e.target);
    const payload={name:f.get("name"),email:f.get("email"),phone:f.get("phone")||"",message:f.get("message"),user_id:currentUser?.id||null,listing_id:f.get("listing_id")||null,listing_title:f.get("listing_title")||""};
    try{
      const db=await supabaseClient.from("inquiries").insert(payload).select("id").single();
      if(db.error)throw db.error;
      payload.inquiry_id=db.data.id;
      const r=await fetch("/api/inquiry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if(!r.ok) console.warn("Email service is not configured yet.");
      e.target.innerHTML='<div class="success-box"><h3>Message received.</h3><p>Your message is safely stored with EstateLux. Email delivery will also notify the EstateLux team once the mail service is connected.</p><button type="button" class="gold-btn" onclick="closeModal()">Close</button></div>';
    }catch(err){e.target.insertAdjacentHTML("beforeend",'<p class="form-error">'+esc(err.message)+'</p>')}
    return;
  }

  if(e.target.id==="alertForm"){
    e.preventDefault();
    if(!currentUser){openModal("login");return}
    const f=new FormData(e.target),msg=$("#alertMessage");
    const text=String(f.get("search")||"").trim();
    const parts=text.split(/\\s+in\\s+/i);
    const bedroomMatch=text.match(/(\\d+)\\s*\\+?\\s*bed/i);
    const alertMode=text.toLowerCase().includes("rent")?"rent":"sale";
    try{
      const {error}=await supabaseClient.from("saved_searches").insert({user_id:currentUser.id,name:text||"EstateLux saved search",mode:alertMode,location:parts[1]||text,bedrooms:bedroomMatch?Number(bedroomMatch[1]):null,email:String(f.get("email")||currentUser.email||""),email_alerts:true,alert_frequency:f.get("frequency")});
      if(error)throw error;
      msg.textContent="Saved. New matching listings will appear in your alert system.";
    }catch(err){msg.textContent=err.message}
    return;
  }
});

$$(".search-tabs button").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
$("#modalBackdrop")?.addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal()});

supabaseClient?.auth.onAuthStateChange(()=>setTimeout(refreshAuth,0));
refreshAuth();
renderListings();
