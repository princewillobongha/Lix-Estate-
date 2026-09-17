const DEMO_LISTINGS = [
  {id:"demo-1",mode:"sale",title:"The Grand Modern",city:"Austin",state:"TX",price:895000,beds:4,baths:3,sqft:2840,type:"Single Family",tag:"FEATURED",image:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=85",lat:30.2672,lng:-97.7431},
  {id:"demo-2",mode:"sale",title:"Cedar Ridge Residence",city:"Atlanta",state:"GA",price:679000,beds:4,baths:3,sqft:2510,type:"Single Family",tag:"NEW",image:"https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85",lat:33.749,lng:-84.388},
  {id:"demo-3",mode:"sale",title:"Oceanview House",city:"Miami",state:"FL",price:1250000,beds:5,baths:4,sqft:3380,type:"Single Family",tag:"LUXURY",image:"https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1000&q=85",lat:25.7617,lng:-80.1918},
  {id:"demo-4",mode:"rent",title:"Park Avenue Residence",city:"New York",state:"NY",price:6200,beds:2,baths:2,sqft:1260,type:"Apartment",tag:"RENT",image:"https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1000&q=85",lat:40.7128,lng:-74.006},
  {id:"demo-5",mode:"rent",title:"Westside Townhome",city:"Los Angeles",state:"CA",price:4800,beds:3,baths:2.5,sqft:1780,type:"Townhouse",tag:"RENT",image:"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=85",lat:34.0522,lng:-118.2437},
  {id:"demo-6",mode:"sale",title:"Hill Country Retreat",city:"Dallas",state:"TX",price:1125000,beds:5,baths:4,sqft:3650,type:"Single Family",tag:"LUXURY",image:"https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1000&q=85",lat:32.7767,lng:-96.797}
];

let mode = "sale";
let listings = [...DEMO_LISTINGS];
let filtered = [...listings];
let favorites = JSON.parse(localStorage.getItem("estatelux_favorites") || "[]");

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function money(n, rental=false){
  if(n == null) return "Price on request";
  return rental ? `$${Number(n).toLocaleString()}/mo` : `$${Number(n).toLocaleString()}`;
}
function esc(s){return String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function renderListings(items=filtered){
  const grid = $("#listingGrid"), empty=$("#emptyState");
  if(!items.length){grid.innerHTML="";empty.classList.remove("hidden");return}
  empty.classList.add("hidden");
  grid.innerHTML = items.map(p => `
    <article class="listing-card">
      <div class="listing-image" style="background-image:url('${p.image}')">
        <span class="badge">${esc(p.tag || (p.mode==="rent"?"RENT":"FOR SALE"))}</span>
        <button class="heart ${favorites.includes(p.id)?"saved":""}" data-fav="${esc(p.id)}" aria-label="Save property">${favorites.includes(p.id)?"♥":"♡"}</button>
      </div>
      <div class="listing-info">
        <div class="price">${money(p.price,p.mode==="rent")} ${p.mode==="rent"?"":" "}</div>
        <div class="listing-title">${esc(p.title)}</div>
        <div class="address">${esc(p.city)}, ${esc(p.state)}</div>
        <div class="stats"><span>${p.beds} bd</span><span>${p.baths} ba</span><span>${Number(p.sqft).toLocaleString()} sq ft</span></div>
        <div class="card-actions">
          <button class="primary" data-property="${esc(p.id)}">View Property</button>
          <button data-map="${esc(p.id)}">Map</button>
        </div>
      </div>
    </article>`).join("");
}

async function loadApi(){
  // The frontend is safe to deploy without a key. If /api/listings is available,
  // it replaces demo cards with live RentCast data.
  try{
    const qs = new URLSearchParams({mode,limit:"12"});
    const loc=$("#locationInput").value.trim();
    if(loc) qs.set("location",loc);
    const r=await fetch(`/api/listings?${qs}`);
    if(!r.ok) return;
    const data=await r.json();
    if(Array.isArray(data.listings) && data.listings.length){
      listings=data.listings.map(normalizeApi);
      applyFilters(false);
    }
  }catch(e){ /* demo mode */ }
}

function normalizeApi(p){
  const isRent=mode==="rent";
  return {
    id:p.id || crypto.randomUUID(), mode, title:p.title || p.formattedAddress?.split(",")[0] || "EstateLux Property",
    city:p.city || "", state:p.state || "", price:p.price, beds:p.bedrooms ?? "—", baths:p.bathrooms ?? "—",
    sqft:p.squareFootage || 0, type:p.propertyType || "Property", tag:p.listingType?.toUpperCase() || (isRent?"RENT":"FOR SALE"),
    image:p.photo || p.photos?.[0] || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=85",
    lat:p.latitude,lng:p.longitude,address:p.formattedAddress
  };
}

function applyFilters(tryApi=true){
  const q=$("#locationInput").value.trim().toLowerCase();
  const type=$("#typeInput").value;
  const beds=$("#bedsInput").value;
  const max=$("#budgetInput").value;
  filtered=listings.filter(p=>{
    if(p.mode!==mode) return false;
    const hay=`${p.title} ${p.city} ${p.state} ${p.address||""}`.toLowerCase();
    if(q && !hay.includes(q)) return false;
    if(type && p.type!==type) return false;
    if(beds && Number(p.beds)<Number(beds.replace("+",""))) return false;
    if(max && Number(p.price)>Number(max)) return false;
    return true;
  });
  renderListings();
  if(tryApi) loadApi();
}

function setMode(next){
  mode=next;
  $$(".search-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.mode===next));
  $("#budgetLabel").textContent=next==="rent"?"Max rent":"Max price";
  $("#budgetInput").innerHTML=next==="rent"
    ? `<option value="">Any</option><option value="1500">$1.5k</option><option value="2500">$2.5k</option><option value="4000">$4k</option><option value="6000">$6k</option><option value="10000">$10k</option>`
    : `<option value="">Any</option><option value="300000">$300k</option><option value="500000">$500k</option><option value="750000">$750k</option><option value="1000000">$1M</option><option value="2000000">$2M</option>`;
  applyFilters(false);
}

function saveFavorite(id){
  favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];
  localStorage.setItem("estatelux_favorites",JSON.stringify(favorites));
  renderListings();
}

function openModal(type,data){
  $("#modalBackdrop").classList.remove("hidden");
  let html="";
  if(type==="property"){
    const p=data;
    html=`<div class="property-modal"><img src="${p.image}" alt="${esc(p.title)}"><div><span class="eyebrow dark">${esc(p.tag||"PROPERTY")}</span><h2>${esc(p.title)}</h2><div class="price">${money(p.price,p.mode==="rent")}</div><p>${esc(p.beds)} bedrooms · ${esc(p.baths)} bathrooms · ${Number(p.sqft||0).toLocaleString()} sq ft · ${esc(p.type)}</p><p><b>${esc(p.address||`${p.city}, ${p.state}`)}</b></p><a class="map-link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address||`${p.city}, ${p.state}`)}">View on Google Maps →</a><button class="gold-btn" style="margin-top:20px;width:100%" data-open-contact="${esc(p.id)}">Request Information</button></div></div>`;
  } else if(type==="contact"){
    html=`<span class="eyebrow dark">ESTATELUX CONTACT</span><h2>Request information</h2><p>Send an inquiry about a property or ask the EstateLux team a question.</p><form class="modal-form" id="contactForm"><input required name="name" placeholder="Full name"><input required type="email" name="email" placeholder="Email address"><input name="phone" placeholder="Phone number (optional)"><textarea required name="message" placeholder="How can we help?"></textarea><button class="gold-btn">Send request</button></form>`;
  } else if(type==="login"){
    html=`<span class="eyebrow dark">ESTATELUX ACCOUNT</span><h2>Welcome back.</h2><p>Sign in to keep favorites, saved searches and alerts together. Account authentication will connect to the production database in the next phase.</p><form class="modal-form" id="loginForm"><input required type="email" placeholder="Email address"><input required type="password" placeholder="Password"><button class="gold-btn">Continue</button></form>`;
  } else if(type==="saved"){
    const saved=listings.filter(p=>favorites.includes(p.id));
    html=`<span class="eyebrow dark">YOUR COLLECTION</span><h2>Saved properties</h2>${saved.length?`<div class="saved-list">${saved.map(p=>`<div class="saved-row"><span>${esc(p.title)}<small> · ${esc(p.city)}, ${esc(p.state)}</small></span><button data-property="${esc(p.id)}">Open →</button></div>`).join("")}</div>`:`<p>You haven't saved any properties yet. Tap ♡ on a property to build your collection.</p>`}`;
  } else if(type==="alerts"){
    html=`<span class="eyebrow dark">PROPERTY ALERTS</span><h2>Never miss a match.</h2><p>Create a search and EstateLux can send matching-property email alerts once the email service is connected.</p><form class="modal-form" id="alertForm"><input required type="email" placeholder="Email address"><input required placeholder="Search, e.g. 3+ bedrooms in Houston"><select><option>Daily digest</option><option>New listing alerts</option></select><button class="gold-btn">Save alert</button></form>`;
  }
  $("#modalContent").innerHTML=html;
}

function closeModal(){$("#modalBackdrop").classList.add("hidden");$("#modalContent").innerHTML=""}

document.addEventListener("click",e=>{
  const fav=e.target.closest("[data-fav]"); if(fav){saveFavorite(fav.dataset.fav);return}
  const prop=e.target.closest("[data-property]"); if(prop){const p=listings.find(x=>x.id===prop.dataset.property);if(p)openModal("property",p);return}
  const map=e.target.closest("[data-map]"); if(map){const p=listings.find(x=>x.id===map.dataset.map);if(p)window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address||`${p.city}, ${p.state}`)}`,"_blank");return}
  const open=e.target.closest("[data-open]"); if(open){openModal(open.dataset.open);return}
  const contact=e.target.closest("[data-open-contact]"); if(contact){openModal("contact");return}
  const scroll=e.target.closest("[data-scroll]"); if(scroll){document.querySelector(scroll.dataset.scroll)?.scrollIntoView({behavior:"smooth"});return}
  const quick=e.target.closest("[data-quick]"); if(quick){$("#locationInput").value=quick.dataset.quick;document.querySelector("#featured").scrollIntoView({behavior:"smooth"});applyFilters();return}
  const rental=e.target.closest("[data-rental]"); if(rental){setMode("rent");$("#typeInput").value=rental.dataset.rental;document.querySelector("#featured").scrollIntoView({behavior:"smooth"});applyFilters();return}
});
$$(".search-tabs button").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
$("#searchForm").addEventListener("submit",e=>{e.preventDefault();applyFilters();$("#featured").scrollIntoView({behavior:"smooth"})});
$("#viewAllBtn").addEventListener("click",()=>{$("#locationInput").value="";$("#typeInput").value="";$("#bedsInput").value="";$("#budgetInput").value="";applyFilters(false);$("#featured").scrollIntoView({behavior:"smooth"})});
$("#clearFilters").addEventListener("click",()=>{$("#locationInput").value="";$("#typeInput").value="";$("#bedsInput").value="";$("#budgetInput").value="";applyFilters(false)});
$("#rentBtn").addEventListener("click",()=>{setMode("rent");$("#featured").scrollIntoView({behavior:"smooth"})});
$("#modalClose").addEventListener("click",closeModal);
$("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal()});
document.addEventListener("submit",e=>{
  if(e.target.id==="contactForm"||e.target.id==="loginForm"||e.target.id==="alertForm"){
    e.preventDefault();
    e.target.innerHTML=`<div style="padding:20px 0"><h3 style="font-family:Georgia,serif;font-size:28px">Thank you.</h3><p>Your request was captured in this demo. The production email/auth service will be connected next.</p><button type="button" class="gold-btn" onclick="closeModal()">Close</button></div>`;
  }
});
renderListings();
