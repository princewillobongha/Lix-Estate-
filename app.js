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

let mode="sale";
let listings=[...DEMO_LISTINGS];
let filtered=[...listings];
let favorites=JSON.parse(localStorage.getItem("estatelux_favorites")||"[]");
let savedProperties=JSON.parse(localStorage.getItem("estatelux_saved_properties")||"[]");
let currentUser=null;
let currentProfile=null;
let notificationChannel=null;

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function money(n,rent=false){
  if(n==null||n==="") return "Price on request";
  return rent?"$"+Number(n).toLocaleString()+"/mo":"$"+Number(n).toLocaleString();
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function normalized(s){return String(s||"").toLowerCase().replace(/,/g," ").replace(/\s+/g," ").trim()}
function matchesLocation(p,q){
  if(!q)return true;
  const hay=normalized([p.title,p.city,p.state,p.address,p.formattedAddress].filter(Boolean).join(" "));
  return normalized(q).split(" ").filter(Boolean).every(part=>hay.includes(part));
}

function renderListings(items=filtered){
  const grid=$("#listingGrid"),empty=$("#emptyState");
  if(!grid)return;
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
        <div class="address">${esc(p.address||((p.city||"")+(p.state?", "+p.state:"")))}</div>
        <div class="stats"><span>${esc(p.beds)} bd</span><span>${esc(p.baths)} ba</span><span>${Number(p.sqft||0).toLocaleString()} sq ft</span></div>
        <div class="card-actions">
          <button class="primary" data-property="${esc(p.id)}">View Property</button>
          <button data-map="${esc(p.id)}">Map</button>
        </div>
      </div>
    </article>`).join("");
}

function normalizeApi(p){
  return {
    ...p,
    id:p.id||crypto.randomUUID(),
    mode,
    title:p.title||p.formattedAddress?.split(",")[0]||"EstateLux Property",
    city:p.city||"",
    state:p.state||"",
    price:p.price,
    beds:p.bedrooms??"—",
    baths:p.bathrooms??"—",
    sqft:p.squareFootage||0,
    type:p.propertyType||"Property",
    tag:p.listingType?.toUpperCase()||(mode==="rent"?"RENT":"FOR SALE"),
    image:p.photo||p.photos?.[0]||DEMO_LISTINGS.find(x=>x.mode===mode)?.image||DEMO_LISTINGS[0].image,
    lat:p.latitude,
    lng:p.longitude,
    address:p.formattedAddress||p.address||"",
    description:p.description||"Property details supplied through the EstateLux listing feed.",
    photos:p.photos||[]
  };
}

function localFilter(){
  const q=$("#locationInput")?.value.trim()||"";
  const type=$("#typeInput")?.value||"";
  const beds=$("#bedsInput")?.value||"";
  const max=$("#budgetInput")?.value||"";
  filtered=listings.filter(p=>{
    if(p.mode!==mode)return false;
    if(!matchesLocation(p,q))return false;
    if(type&&normalized(p.type)!==normalized(type))return false;
    if(beds&&Number(p.beds)<Number(beds.replace("+","")))return false;
    if(max&&Number(p.price)>Number(max))return false;
    return true;
  });
  renderListings();
}

async function loadApi(){
  try{
    const qs=new URLSearchParams({mode,limit:"24"});
    const loc=$("#locationInput")?.value.trim();
    const type=$("#typeInput")?.value;
    const beds=$("#bedsInput")?.value;
    const max=$("#budgetInput")?.value;
    if(loc)qs.set("location",loc);
    if(type)qs.set("propertyType",type);
    if(beds)qs.set("bedrooms",beds.replace("+",""));
    if(max)qs.set("price",max);
    const r=await fetch("/api/listings?"+qs.toString(),{cache:"no-store"});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error?.message||data.error||"Live listing feed unavailable");
    if(Array.isArray(data.listings)&&data.listings.length){
      listings=data.listings.map(normalizeApi);
    }else{
      listings=DEMO_LISTINGS.filter(x=>x.mode===mode);
    }
    localFilter();
  }catch(e){
    console.warn("EstateLux live listings unavailable:",e);
    listings=DEMO_LISTINGS.filter(x=>x.mode===mode);
    localFilter();
  }
}

function setMode(next){
  mode=next==="rent"?"rent":"sale";
  $$(".search-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  if($("#budgetLabel"))$("#budgetLabel").textContent=mode==="rent"?"Max rent":"Max price";
  if($("#budgetInput"))$("#budgetInput").innerHTML=mode==="rent"
    ?'<option value="">Any</option><option value="1500">$1.5k</option><option value="2500">$2.5k</option><option value="4000">$4k</option><option value="6000">$6k</option><option value="10000">$10k</option>'
    :'<option value="">Any</option><option value="300000">$300k</option><option value="500000">$500k</option><option value="750000">$750k</option><option value="1000000">$1M</option><option value="2000000">$2M</option>';
  listings=DEMO_LISTINGS.filter(x=>x.mode===mode);
  localFilter();
  loadApi();
}

async function saveFavorite(id){
  const p=listings.find(x=>x.id===id);
  const removing=favorites.includes(id);
  favorites=removing?favorites.filter(x=>x!==id):[...favorites,id];
  savedProperties=removing?savedProperties.filter(x=>x.id!==id):[...savedProperties.filter(x=>x.id!==id),p].filter(Boolean);
  localStorage.setItem("estatelux_favorites",JSON.stringify(favorites));
  localStorage.setItem("estatelux_saved_properties",JSON.stringify(savedProperties));
  if(currentUser&&supabaseClient){
    const p=listings.find(x=>x.id===id);
    try{
      if(favorites.includes(id)){
        const {error}=await supabaseClient.from("favorites").upsert({user_id:currentUser.id,listing_id:id,listing_data:p||null},{onConflict:"user_id,listing_id"});
        if(error)console.warn(error);
      }else{
        const {error}=await supabaseClient.from("favorites").delete().eq("user_id",currentUser.id).eq("listing_id",id);
        if(error)console.warn(error);
      }
    }catch(e){console.warn(e)}
  }
  renderListings();
}

function updateHeader(){
  const buttons=$("[data-auth-button], #loginBtn");
  buttons.forEach(b=>{
    b.dataset.open=currentUser?"account":"login";
    if(currentUser){
      if(b.closest(".mobile-nav")){
        b.innerHTML='<span class="profile-icon" aria-hidden="true">👤</span><span>Profile</span>';
      }else{
        b.innerHTML='<span class="profile-icon" aria-hidden="true">👤</span>';
      }
      b.classList.remove("auth-signin");
    }else{
      if(b.closest(".mobile-nav")){
        b.innerHTML='<span>Sign in</span>';
      }else{
        b.innerHTML='Sign in';
      }
      b.classList.add("auth-signin");
    }
  });
  if($("#notificationCount")&&currentUser)loadNotifications();
  else if($("#notificationCount"))$("#notificationCount").textContent="";
  if($("#mobileNotificationCount"))$("#mobileNotificationCount").textContent=$("#notificationCount")?.textContent||"";
}

async function loadCloudFavorites(){
  if(!currentUser||!supabaseClient)return;
  const {data,error}=await supabaseClient.from("favorites").select("listing_id,listing_data").eq("user_id",currentUser.id);
  if(error){console.warn("Favorites sync:",error);return}
  favorites=(data||[]).map(x=>x.listing_id).filter(Boolean);
  savedProperties=(data||[]).map(x=>x.listing_data).filter(Boolean);
  localStorage.setItem("estatelux_favorites",JSON.stringify(favorites));
  localStorage.setItem("estatelux_saved_properties",JSON.stringify(savedProperties));
  renderListings();
}

function subscribeNotifications(){
  if(!supabaseClient||!currentUser)return;
  if(notificationChannel){
    try{supabaseClient.removeChannel(notificationChannel)}catch(e){}
  }
  notificationChannel=supabaseClient
    .channel("estatelux-notifications-"+currentUser.id)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:"user_id=eq."+currentUser.id},()=>{
      loadNotifications();
      if(!$("#modalBackdrop")?.classList.contains("hidden")&&$("#notificationList"))renderNotifications();
    })
    .subscribe();
}

async function refreshAuth(){
  if(!supabaseClient){updateHeader();return}
  try{
    const {data}=await supabaseClient.auth.getUser();
    currentUser=data?.user||null;
    currentProfile=null;
    if(currentUser){
      const {data:profile}=await supabaseClient.from("profiles").select("*").eq("id",currentUser.id).maybeSingle();
      currentProfile=profile||null;
      await loadCloudFavorites();
      subscribeNotifications();
    }else{
      if(notificationChannel){try{supabaseClient.removeChannel(notificationChannel)}catch(e){} notificationChannel=null}
    }
  }catch(e){console.warn("Auth refresh:",e)}
  updateHeader();
}

async function loadNotifications(){
  if(!currentUser||!supabaseClient)return;
  const {data,error}=await supabaseClient.from("notifications").select("*").eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(30);
  if(error)return;
  const unread=(data||[]).filter(x=>!x.read).length;
  if($("#notificationCount"))$("#notificationCount").textContent=unread?String(unread):"";
  if($("#mobileNotificationCount"))$("#mobileNotificationCount").textContent=unread?String(unread):"";
}

function openModal(type,data=null){
  const back=$("#modalBackdrop"),content=$("#modalContent");
  if(!back||!content)return;
  back.classList.remove("hidden");
  let html="";
  if(type==="property"){
    const p=data;
    html=`<div class="property-modal"><img src="${esc(p.image)}" alt="${esc(p.title)}"><div><span class="eyebrow dark">${esc(p.tag||"PROPERTY")}</span><h2>${esc(p.title)}</h2><div class="price">${money(p.price,p.mode==="rent")}</div><p>${esc(p.beds)} bedrooms · ${esc(p.baths)} bathrooms · ${Number(p.sqft||0).toLocaleString()} sq ft · ${esc(p.type)}</p><p><b>${esc(p.address||p.city+", "+p.state)}</b></p><p>${esc(p.description||"Detailed property information is available on the property page.")}</p><div class="modal-actions"><a class="gold-btn" href="property.html?id=${encodeURIComponent(p.id)}&mode=${p.mode}">Full property details</a><button class="outline-btn" data-open-contact="${esc(p.id)}">Request Information</button><button class="outline-btn" data-map="${esc(p.id)}">Open map</button></div></div></div>`;
  }else if(type==="contact"){
    const listingId=data?.id||"",listingTitle=data?.title||"";
    html=`<span class="eyebrow dark">ESTATELUX CONTACT</span><h2>Request information</h2><p>Send us your request and the EstateLux team will receive it securely.</p><form class="modal-form" id="contactForm"><input required name="name" placeholder="Full name"><input required type="email" name="email" placeholder="Email address"><input name="phone" placeholder="Phone number (optional)"><input type="hidden" name="listing_id" value="${esc(listingId)}"><input type="hidden" name="listing_title" value="${esc(listingTitle)}"><textarea required name="message" placeholder="How can we help?">${listingTitle?"I am interested in "+esc(listingTitle)+".":""}</textarea><button class="gold-btn" type="submit">Send request</button></form>`;
  }else if(type==="login"){
    html=`<span class="eyebrow dark">ESTATELUX ACCOUNT</span><h2>Welcome to EstateLux.</h2><p>Sign in to manage your profile, saved properties, alerts and notifications.</p><form class="modal-form" id="loginForm"><input required name="email" type="email" autocomplete="email" placeholder="Email address"><input required name="password" type="password" minlength="6" autocomplete="current-password" placeholder="Password"><input name="full_name" placeholder="Full name (for new accounts)"><input name="username" placeholder="Username (for new accounts)"><button class="gold-btn" type="submit">Sign in</button><button class="outline-btn" type="button" id="googleSignInBtn">Continue with Google</button><button class="outline-btn" type="button" id="signupBtn">Create account</button><p id="authMessage"></p></form>`;
  }else if(type==="account"){
    if(!currentUser){openModal("login");return}
    const name=currentProfile?.full_name||currentUser.user_metadata?.full_name||"EstateLux member";
    const avatar=currentProfile?.avatar_url||currentUser.user_metadata?.avatar_url||"";
    const username=currentProfile?.username||"Add username";
    const initials=(name.match(/\b\w/g)||["E","L"]).slice(0,2).join("").toUpperCase();
    html=`<div class="account-head"><div class="avatar">${avatar?`<img src="${esc(avatar)}" alt="Profile picture">`:esc(initials)}</div><div><span class="eyebrow dark">MY ESTATELUX</span><h2>${esc(name)}</h2><p>@${esc(username)}</p></div></div><div class="account-menu"><button data-open="profile">Edit profile</button><button data-open="saved">Saved properties</button><button data-open="alerts">Saved searches</button><button data-open="notifications">Notifications</button></div><button class="outline-btn" id="signOutBtn">Sign out</button>`;
  }else if(type==="profile"){
    if(!currentUser){openModal("login");return}
    const p=currentProfile||{};
    html=`<span class="eyebrow dark">PROFILE</span><h2>Your EstateLux profile</h2><form class="modal-form" id="profileForm"><div class="profile-upload"><div class="avatar large" id="profilePreview">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="Profile picture">`:"👤"}</div><label class="outline-btn file-btn">Add profile picture<input type="file" id="profilePicture" name="profile_picture" accept="image/*" hidden></label></div><input name="full_name" value="${esc(p.full_name||currentUser.user_metadata?.full_name||"")}" placeholder="Full name"><input name="username" value="${esc(p.username||"")}" placeholder="Username"><input name="phone" value="${esc(p.phone||"")}" placeholder="Phone number"><input name="country" value="${esc(p.country||"")}" placeholder="Country"><button class="gold-btn">Save profile</button><p id="profileMessage"></p></form>`;
  }else if(type==="saved"){
    const saved=savedProperties.filter(p=>favorites.includes(p.id));
    html=`<span class="eyebrow dark">YOUR COLLECTION</span><h2>Saved properties</h2>${saved.length?'<div class="saved-list">'+saved.map(p=>`<div class="saved-row"><span>${esc(p.title)}<small> · ${esc(p.city)}, ${esc(p.state)}</small></span><button data-property="${esc(p.id)}">Open →</button></div>`).join("")+"</div>":'<p>No saved properties yet. Tap ♡ on a property to build your collection.</p>'}`;
  }else if(type==="alerts"){
    if(!currentUser){openModal("login");return}
    html=`<span class="eyebrow dark">PROPERTY ALERTS</span><h2>Stay ahead of new listings.</h2><form class="modal-form" id="alertForm"><input required type="email" name="email" value="${esc(currentUser.email||"")}" placeholder="Email address"><input required name="search" placeholder="e.g. 3+ bedrooms in Houston"><select name="frequency"><option value="daily">Daily digest</option><option value="instant">New listing alerts</option><option value="weekly">Weekly</option></select><button class="gold-btn">Save alert</button><p id="alertMessage"></p></form>`;
  }else if(type==="notifications"){
    if(!currentUser){openModal("login");return}
    html=`<span class="eyebrow dark">ESTATELUX UPDATES</span><h2>Your notifications</h2><div id="notificationList"><p>Loading…</p></div>`;
  }else if(type==="location"){
    html=`<span class="eyebrow dark">LOCATION ACCESS</span><h2>Turn on your location</h2><p>EstateLux uses your location only to calculate directions from you to a property. After allowing it, tap the map button again.</p><button class="gold-btn" id="retryLocation">Try again</button>`;
  }
  content.innerHTML=html;
  if(type==="notifications")renderNotifications();
  if(type==="profile"){$("#profilePicture")?.addEventListener("change",e=>{const f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{$("#profilePreview").innerHTML=`<img src="${esc(reader.result)}" alt="Profile picture preview">`};reader.readAsDataURL(f)});}
}

async function renderNotifications(){
  const box=$("#notificationList");
  if(!box||!currentUser||!supabaseClient)return;
  const {data,error}=await supabaseClient.from("notifications").select("*").eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(30);
  if(error){box.innerHTML="<p>Notifications are temporarily unavailable.</p>";return}
  if(!data?.length){box.innerHTML="<p>No notifications yet.</p>";return}
  box.innerHTML=data.map(n=>`<button class="notification-row ${n.read?"":"unread"}" data-notification="${n.id}" data-link="${esc(n.link||"")}"><b>${esc(n.title)}</b><span>${esc(n.message)}</span><small>${new Date(n.created_at).toLocaleString()}</small></button>`).join("");
}

function openMapForProperty(p){
  if(!p)return;
  const destination=p.lat&&p.lng?p.lat+","+p.lng:(p.address||p.city+", "+p.state);
  const mapSearch="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(destination);
  if(!navigator.geolocation){window.location.href=mapSearch;return}
  navigator.geolocation.getCurrentPosition(pos=>{
    const origin=pos.coords.latitude+","+pos.coords.longitude;
    const url="https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(origin)+"&destination="+encodeURIComponent(destination);
    window.location.href=url;
  },()=>{
    openModal("location");
  },{enableHighAccuracy:false,timeout:15000,maximumAge:300000});
}

async function closeModal(){
  $("#modalBackdrop")?.classList.add("hidden");
  if($("#modalContent"))$("#modalContent").innerHTML="";
}

document.addEventListener("click",async e=>{
  const fav=e.target.closest("[data-fav]");
  if(fav){e.preventDefault();await saveFavorite(fav.dataset.fav);return}

  const prop=e.target.closest("[data-property]");
  if(prop){e.preventDefault();const p=listings.find(x=>x.id===prop.dataset.property);if(p)openModal("property",p);return}

  const map=e.target.closest("[data-map]");
  if(map){e.preventDefault();const p=listings.find(x=>x.id===map.dataset.map);if(p)openMapForProperty(p);return}

  const open=e.target.closest("[data-open]");
  if(open){e.preventDefault();openModal(open.dataset.open);return}

  const contact=e.target.closest("[data-open-contact]");
  if(contact){e.preventDefault();const p=listings.find(x=>x.id===contact.dataset.openContact);if(p)openModal("contact",p);return}

  const quick=e.target.closest("[data-quick]");
  if(quick){e.preventDefault();if($("#locationInput"))$("#locationInput").value=quick.dataset.quick;$("#featured")?.scrollIntoView({behavior:"smooth"});localFilter();loadApi();return}

  if(e.target.closest("#viewAllBtn")){e.preventDefault();location.href="properties.html?mode="+mode;return}
  if(e.target.closest("#rentBtn")){e.preventDefault();location.href="properties.html?mode=rent";return}
  if(e.target.closest("#menuToggle")){$("#sideMenu")?.classList.add("open");return}
  if(e.target.closest("#menuClose")){$("#sideMenu")?.classList.remove("open");return}
  if(e.target.closest("#modalClose")){closeModal();return}

  const notif=e.target.closest("[data-notification]");
  if(notif&&currentUser&&supabaseClient){
    await supabaseClient.from("notifications").update({read:true}).eq("id",notif.dataset.notification).eq("user_id",currentUser.id);
    await loadNotifications();
    if(notif.dataset.link)location.href=notif.dataset.link;else renderNotifications();
    return;
  }

  if(e.target.id==="signOutBtn"){
    await supabaseClient?.auth.signOut();
    currentUser=null;currentProfile=null;
    favorites=[];savedProperties=[];
    localStorage.removeItem("estatelux_favorites");
    localStorage.removeItem("estatelux_saved_properties");
    if(notificationChannel){try{supabaseClient.removeChannel(notificationChannel)}catch(e){} notificationChannel=null}
    updateHeader();closeModal();renderListings();return;
  }

  if(e.target.id==="googleSignInBtn"){
    try{
      const {error}=await supabaseClient.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin}});
      if(error)throw error;
    }catch(err){const msg=$("#authMessage");if(msg)msg.textContent=err.message+" — enable Google in Supabase Auth first."}
    return;
  }

  if(e.target.id==="signupBtn"){
    const f=new FormData($("#loginForm")),msg=$("#authMessage");
    msg.textContent="Creating account…";
    try{
      const response=await fetch("/api/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        email:String(f.get("email")||"").trim(),
        password:String(f.get("password")||""),
        full_name:String(f.get("full_name")||"").trim(),
        username:String(f.get("username")||"").trim()
      })});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||"Could not create your account.");
      msg.textContent=data.message||"EstateLux sent a confirmation email. Tap the link in that email to finish creating your account."
    }catch(err){msg.textContent=err.message}
    return;
  }

  if(e.target.id==="retryLocation"){
    closeModal();
    const p=filtered[0];
    if(p)openMapForProperty(p);
  }
});

document.addEventListener("submit",async e=>{
  if(e.target.id==="searchForm"){
    e.preventDefault();
    localFilter();
    $("#featured")?.scrollIntoView({behavior:"smooth"});
    await loadApi();
    return;
  }

  if(e.target.id==="loginForm"){
    e.preventDefault();
    const f=new FormData(e.target),msg=$("#authMessage");
    msg.textContent="Signing in…";
    try{
      const {error}=await supabaseClient.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});
      if(error)throw error;
      await refreshAuth();closeModal();
    }catch(err){msg.textContent=err.message}
    return;
  }

  if(e.target.id==="profileForm"){
    e.preventDefault();
    if(!currentUser)return;
    const f=new FormData(e.target),msg=$("#profileMessage");msg.textContent="Saving…";
    try{
      let avatar_url=currentProfile?.avatar_url||null;
      const file=f.get("profile_picture");
      if(file&&file.size){
        const dataUrl=await new Promise((resolve,reject)=>{
          const reader=new FileReader();
          reader.onload=()=>{
            const img=new Image();
            img.onload=()=>{
              const size=256,canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
              canvas.width=size;canvas.height=size;
              const scale=Math.max(size/img.width,size/img.height),w=img.width*scale,h=img.height*scale;
              ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
              resolve(canvas.toDataURL("image/jpeg",0.86));
            };
            img.onerror=reject;img.src=reader.result;
          };
          reader.onerror=reject;reader.readAsDataURL(file);
        });
        const blob=await (await fetch(dataUrl)).blob();
        const path=currentUser.id+"/"+crypto.randomUUID()+".jpg";
        const {error:uploadError}=await supabaseClient.storage.from("avatars").upload(path,blob,{contentType:"image/jpeg",upsert:true,cacheControl:"3600"});
        if(uploadError)throw uploadError;
        const {data:publicData}=supabaseClient.storage.from("avatars").getPublicUrl(path);
        avatar_url=publicData?.publicUrl||avatar_url;
      }
      const profilePayload={id:currentUser.id,full_name:String(f.get("full_name")||"").trim()||null,username:String(f.get("username")||"").trim()||null,phone:String(f.get("phone")||"").trim()||null,country:String(f.get("country")||"").trim()||null,avatar_url};
      const {data,error}=await supabaseClient.from("profiles").upsert(profilePayload,{onConflict:"id"}).select().single();
      if(error)throw error;
      currentProfile=data;msg.textContent="Profile saved.";updateHeader();setTimeout(()=>openModal("account"),350);
    }catch(err){
      console.error("Profile save error:",err);
      msg.textContent=err?.message||"Could not save your profile. Please try again.";
    }
    return;
  }

  if(e.target.id==="contactForm"){
    e.preventDefault();
    const form=e.target,f=new FormData(form);
    const payload={name:String(f.get("name")||"").trim(),email:String(f.get("email")||"").trim(),phone:String(f.get("phone")||"").trim(),message:String(f.get("message")||"").trim(),user_id:currentUser?.id||null,listing_id:f.get("listing_id")||null,listing_title:f.get("listing_title")||""};
    const submit=form.querySelector("button[type=submit]");if(submit){submit.disabled=true;submit.textContent="Sending…"}
    try{
      const {data:inquiryRow,error:dbError}=await supabaseClient.from("inquiries").insert(payload).select("id").single();
      if(dbError)throw dbError;
      payload.inquiry_id=inquiryRow?.id||"";
      if(currentUser){
        await supabaseClient.from("notifications").insert({
          user_id:currentUser.id,
          type:"inquiry",
          title:"Request received",
          message:"EstateLux received your property request"+(payload.listing_title?" for "+payload.listing_title+".":"."),
          link:payload.listing_id?"property.html?id="+encodeURIComponent(payload.listing_id):""
        });
      }
      const r=await fetch("/api/inquiry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await r.json().catch(()=>({}));
      if(!r.ok){
        const emailIssue=typeof data.error==="string"?data.error:(data.error?.message||"Email delivery is not configured yet.");
        form.innerHTML='<div class="success-box"><h3>Request received.</h3><p>Your request has been saved securely. The EstateLux team email notification is not fully configured yet.</p><p class="form-error">'+esc(emailIssue)+'</p><button type="button" class="gold-btn" id="closeSuccess">Close</button></div>';
        return;
      }
      form.innerHTML='<div class="success-box"><h3>Thank you.</h3><p>Your request has been sent to EstateLux. We will review it and respond using the contact information you provided.</p><button type="button" class="gold-btn" id="closeSuccess">Close</button></div>';
    }catch(err){
      if(submit){submit.disabled=false;submit.textContent="Send request"}
      form.insertAdjacentHTML("beforeend",'<p class="form-error">We could not save your request right now. Please try again.</p>');
    }
    return;
  }

  if(e.target.id==="alertForm"){
    e.preventDefault();
    if(!currentUser){openModal("login");return}
    const f=new FormData(e.target),msg=$("#alertMessage"),textValue=String(f.get("search")||"").trim();
    const parts=textValue.split(/\s+in\s+/i),bedroomMatch=textValue.match(/(\d+)\s*\+?\s*bed/i);
    const alertMode=textValue.toLowerCase().includes("rent")?"rent":"sale";
    try{
      const {error}=await supabaseClient.from("saved_searches").insert({user_id:currentUser.id,name:textValue||"EstateLux saved search",mode:alertMode,location:parts[1]||textValue,bedrooms:bedroomMatch?Number(bedroomMatch[1]):null,email:String(f.get("email")||currentUser.email||""),email_alerts:true,alert_frequency:f.get("frequency")});
      if(error)throw error;
      msg.textContent="Saved. EstateLux will check for matching listings on the alert schedule.";
    }catch(err){msg.textContent=err.message}
  }
});

document.addEventListener("click",async e=>{
  if(e.target.id==="closeSuccess")closeModal();
  const row=e.target.closest("[data-notification]");
  if(row&&currentUser&&supabaseClient){
    const id=row.dataset.notification;
    await supabaseClient.from("notifications").update({read:true}).eq("id",id).eq("user_id",currentUser.id);
    row.classList.remove("unread");
    loadNotifications();
    const link=row.dataset.link;
    if(link)location.href=link;
  }
});
$$(".search-tabs button").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
$("#modalBackdrop")?.addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal()});
supabaseClient?.auth.onAuthStateChange(()=>setTimeout(refreshAuth,0));
refreshAuth();
setMode("sale");
