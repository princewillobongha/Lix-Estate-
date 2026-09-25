const DEMO=[
{id:"demo-1",mode:"sale",title:"The Grand Modern",city:"Austin",state:"TX",price:895000,beds:4,baths:3,sqft:2840,type:"Single Family",tag:"FEATURED",image:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85",description:"A refined modern residence with generous living areas and contemporary finishes."},
{id:"demo-2",mode:"sale",title:"Cedar Ridge Residence",city:"Atlanta",state:"GA",price:679000,beds:4,baths:3,sqft:2510,type:"Single Family",tag:"NEW",image:"https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85",description:"A spacious family home in a sought-after Atlanta setting."},
{id:"demo-3",mode:"sale",title:"Oceanview House",city:"Miami",state:"FL",price:1250000,beds:5,baths:4,sqft:3380,type:"Single Family",tag:"LUXURY",image:"https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=85",description:"A luxury Miami home designed for indoor-outdoor living."},
{id:"demo-4",mode:"rent",title:"Park Avenue Residence",city:"New York",state:"NY",price:6200,beds:2,baths:2,sqft:1260,type:"Apartment",tag:"RENT",image:"https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1200&q=85",description:"Elegant city apartment living in the heart of New York."},
{id:"demo-5",mode:"rent",title:"Westside Townhome",city:"Los Angeles",state:"CA",price:4800,beds:3,baths:2.5,sqft:1780,type:"Townhouse",tag:"RENT",image:"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85",description:"A comfortable Los Angeles townhome with modern space and privacy."},
{id:"demo-6",mode:"sale",title:"Hill Country Retreat",city:"Dallas",state:"TX",price:1125000,beds:5,baths:4,sqft:3650,type:"Single Family",tag:"LUXURY",image:"https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=85",description:"A spacious Texas retreat with room for entertaining and everyday life."}
];

const params=new URLSearchParams(location.search);
let mode=params.get("mode")==="rent"?"rent":"sale";
let all=[];
let favorites=JSON.parse(localStorage.getItem("estatelux_favorites")||"[]");
let savedProperties=JSON.parse(localStorage.getItem("estatelux_saved_properties")||"[]");

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const norm=s=>String(s||"").toLowerCase().replace(/,/g," ").replace(/\s+/g," ").trim();

function normalize(p){
  return {...p,id:p.id||crypto.randomUUID(),mode,title:p.title||p.formattedAddress?.split(",")[0]||"EstateLux Property",city:p.city||"",state:p.state||"",price:p.price,beds:p.bedrooms??"—",baths:p.bathrooms??"—",sqft:p.squareFootage||0,type:p.propertyType||"Property",tag:p.listingType?.toUpperCase()||(mode==="rent"?"RENT":"FOR SALE"),image:p.photo||p.photos?.[0]||DEMO.find(x=>x.mode===mode)?.image||DEMO[0].image,address:p.formattedAddress||p.address||"",description:p.description||"Property details supplied through the EstateLux listing feed.",lat:p.latitude,lng:p.longitude,photos:p.photos||[]};
}

function render(items){
  const g=$("#propertyGrid"),e=$("#propertyEmpty");
  if(!g)return;
  if(!items.length){g.innerHTML="";e?.classList.remove("hidden");return}
  e?.classList.add("hidden");
  g.innerHTML=items.map(p=>`<article class="listing-card">
    <div class="listing-image" style="background-image:url('${esc(p.image)}')">
      <span class="badge">${esc(p.tag)}</span>
      <button class="heart ${favorites.includes(p.id)?"saved":""}" data-save="${esc(p.id)}" aria-label="Save property">${favorites.includes(p.id)?"♥":"♡"}</button>
    </div>
    <div class="listing-info">
      <div class="price">$ ${Number(p.price||0).toLocaleString()}${mode==="rent"?"/mo":""}</div>
      <div class="listing-title">${esc(p.title)}</div>
      <div class="address">${esc(p.address||p.city+", "+p.state)}</div>
      <div class="stats"><span>${esc(p.beds)} bd</span><span>${esc(p.baths)} ba</span><span>${Number(p.sqft||0).toLocaleString()} sq ft</span></div>
      <div class="card-actions">
        <a class="primary" href="property.html?id=${encodeURIComponent(p.id)}&mode=${mode}">View Property</a>
        <button data-map-id="${esc(p.id)}">Map</button>
      </div>
    </div>
  </article>`).join("");
}

async function fetchLive(){
  const qs=new URLSearchParams({mode,limit:"24"});
  const loc=$("#pLocation")?.value.trim();
  const type=$("#pType")?.value||"";
  const beds=$("#pBeds")?.value||"";
  if(loc)qs.set("location",loc);
  if(type)qs.set("propertyType",type);
  if(beds)qs.set("bedrooms",beds);
  try{
    const r=await fetch("/api/listings?"+qs.toString(),{cache:"no-store"});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error("Live listings unavailable");
    all=Array.isArray(d.listings)&&d.listings.length?d.listings.map(normalize):DEMO.filter(x=>x.mode===mode);
  }catch(e){
    all=DEMO.filter(x=>x.mode===mode);
  }
  filterLocal();
}

function filterLocal(){
  const q=norm($("#pLocation")?.value||"");
  const type=$("#pType")?.value||"";
  const beds=$("#pBeds")?.value||"";
  const items=all.filter(p=>{
    const hay=norm([p.title,p.city,p.state,p.address].join(" "));
    return (!q||q.split(" ").filter(Boolean).every(x=>hay.includes(x)))&&(!type||norm(p.type)===norm(type))&&(!beds||Number(p.beds)>=Number(beds));
  });
  render(items);
}

function openMap(p){
  const destination=p.lat&&p.lng?p.lat+","+p.lng:(p.address||p.city+", "+p.state);
  const blank=window.open("about:blank","_blank");
  const go=url=>{if(blank&&!blank.closed)blank.location.href=url;else location.href=url};
  if(!navigator.geolocation){go("https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(destination));return}
  navigator.geolocation.getCurrentPosition(pos=>{
    go("https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(pos.coords.latitude+","+pos.coords.longitude)+"&destination="+encodeURIComponent(destination));
  },()=>{
    if(blank&&!blank.closed)blank.close();
    alert("Please allow location access for EstateLux, then tap Map again.");
  },{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
}

document.addEventListener("click",async e=>{
  const save=e.target.closest("[data-save]");
  if(save){
    const id=save.dataset.save;
    const p=all.find(x=>x.id===id);
    const removing=favorites.includes(id);
    favorites=removing?favorites.filter(x=>x!==id):[...favorites,id];
    savedProperties=removing?savedProperties.filter(x=>x.id!==id):[...savedProperties.filter(x=>x.id!==id),p].filter(Boolean);
    localStorage.setItem("estatelux_favorites",JSON.stringify(favorites));
    localStorage.setItem("estatelux_saved_properties",JSON.stringify(savedProperties));
    render(all.filter(p=>p.mode===mode));
    return;
  }
  const map=e.target.closest("[data-map-id]");
  if(map){const p=all.find(x=>x.id===map.dataset.mapId);if(p)openMap(p)}
});

$("#pSearch")?.addEventListener("click",fetchLive);
$("#pLocation")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();fetchLive()}});
$("#pType")?.addEventListener("change",filterLocal);
$("#pBeds")?.addEventListener("change",filterLocal);

$("#pageTitle").textContent=mode==="rent"?"Rental properties":"Homes for sale";
if($("#pType"))$("#pType").value=params.get("type")||"";
fetchLive();
