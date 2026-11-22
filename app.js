const STORAGE_KEY = "cells-shop-data-v1";
const $ = (id) => document.getElementById(id);
const money = (n) => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(n)||0);
const dateFmt = (d) => new Date(d).toLocaleDateString("es-CO",{day:"2-digit",month:"short",year:"numeric"});
const todayISO = () => new Date().toISOString();
let data = loadData(), pendingPhoto = "", deferredInstall = null, toastTimer;

function loadData(){
  try { const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)); if(raw && Array.isArray(raw.products) && Array.isArray(raw.sales)) return raw; } catch(e){}
  return {products:[],sales:[],movements:[],version:1};
}
function save(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); renderAll(); }
function uid(){return "p_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7)}
function notify(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2600)}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function stockState(p){return p.stock<=0?"out":p.stock<=p.min?"low":"ok"}
function stateLabel(s){return s==="out"?"Agotado":s==="low"?"Bajo inventario":"Disponible"}
function productById(id){return data.products.find(p=>p.id===id)}
function totalSales(){return data.sales.reduce((a,s)=>a+s.total,0)}
function totalCogs(){return data.sales.reduce((a,s)=>a+s.costTotal,0)}
function totalProfit(){return totalSales()-totalCogs()}
function showView(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));
  document.querySelectorAll(".nav-link[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  $("pageTitle").textContent=({dashboard:"Dashboard",catalog:"Catálogo e inventario",products:"Registro y ajustes"})[name];
  if(name==="catalog") renderCatalog(); if(name==="products") refreshProductSelects();
  if(name==="dashboard") renderDashboard();
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
document.addEventListener("click",e=>{const go=e.target.closest("[data-go]");if(go)showView(go.dataset.go);});
$("todayLabel").textContent=new Date().toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"});
$("year").textContent=new Date().getFullYear();

function renderAll(){renderDashboard();renderCatalog();refreshProductSelects();updateProfitPreview()}
function renderDashboard(){
 const refs=data.products.length, units=data.products.reduce((a,p)=>a+p.stock,0), cost=data.products.reduce((a,p)=>a+p.stock*p.cost,0), potential=data.products.reduce((a,p)=>a+p.stock*p.price,0), low=data.products.filter(p=>p.stock<=p.min).length;
 const kpis=[["Referencias",refs,"Productos registrados","▤"],["Unidades en stock",units,"Unidades disponibles","▣"],["Inventario a costo",money(cost),"Valor de compra","$"],["Potencial de venta",money(potential),"Valor a precio de venta","↗"],["Alertas de stock",low,"Productos por reponer","!"]];
 $("inventoryKpis").innerHTML=kpis.map((k,i)=>`<div class="kpi"><div class="kpi-top">${k[0]}<span class="kpi-icon">${k[3]}</span></div><div class="kpi-value">${k[1]}</div><div class="kpi-foot">${k[2]}</div></div>`).join("");
 $("salesSummary").innerHTML=`<div><span>Ingresos por ventas</span><strong>${money(totalSales())}</strong></div><div><span>Utilidad bruta*</span><strong style="color:var(--green)">${money(totalProfit())}</strong></div><div><span>Costo vendido</span><strong>${money(totalCogs())}</strong></div>`;
 const lows=data.products.filter(p=>p.stock<=p.min).sort((a,b)=>a.stock-b.stock).slice(0,5);
 $("lowStockList").innerHTML=lows.length?lows.map(p=>`<div class="compact-item"><div class="compact-left"><div class="mini-thumb">${p.photo?`<img src="${p.photo}" alt="">`:"▧"}</div><div><div class="compact-name">${escapeHtml(p.name)}</div><div class="compact-sub">Mínimo: ${p.min} unidades</div></div></div><div class="compact-right"><span class="status ${stockState(p)}">${p.stock} uds.</span></div></div>`).join(""):'<div class="empty-inline">No hay alertas. ¡Buen trabajo!</div>';
 const ranking=Object.values(data.sales.reduce((acc,s)=>{acc[s.productId]??={name:s.productName,qty:0,revenue:0};acc[s.productId].qty+=s.qty;acc[s.productId].revenue+=s.total;return acc;},{})).sort((a,b)=>b.qty-a.qty).slice(0,5);
 $("topProducts").innerHTML=ranking.length?ranking.map((p,i)=>`<div class="rank-row"><span class="rank-num">${i+1}</span><div class="rank-info"><b>${escapeHtml(p.name)}</b><small>${p.qty} unidades vendidas</small></div><span class="rank-value">${money(p.revenue)}</span></div>`).join(""):'<div class="empty-inline">Aún no hay ventas registradas.</div>';
 const recent=[...data.sales].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
 $("recentSales").innerHTML=recent.length?recent.map(s=>`<div class="compact-item"><div class="compact-left"><div class="mini-thumb">↗</div><div><div class="compact-name">${escapeHtml(s.productName)} · ${s.qty} uds.</div><div class="compact-sub">${dateFmt(s.date)}</div></div></div><div class="compact-right">${money(s.total)}<div class="compact-sub">Utilidad ${money(s.profit)}</div></div></div>`).join(""):'<div class="empty-inline">Tus ventas aparecerán aquí.</div>';
 drawSalesChart();
}
function drawSalesChart(){
 const canvas=$("salesChart"),ctx=canvas.getContext("2d"),rect=canvas.getBoundingClientRect(),w=Math.max(280,rect.width),h=185,dpr=window.devicePixelRatio||1;
 canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 const days=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d)}
 const values=days.map(d=>data.sales.filter(s=>{const x=new Date(s.date);return x.toDateString()===d.toDateString()}).reduce((a,s)=>a+s.total,0));
 const max=Math.max(...values,1),left=8,right=8,top=12,bottom=27,chartH=h-top-bottom,chartW=w-left-right;
 ctx.font="10px DM Sans";ctx.fillStyle="#98a3b3";ctx.strokeStyle="#edf0f5";ctx.lineWidth=1;
 for(let i=0;i<4;i++){let y=top+i*chartH/3;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke()}
 const step=chartW/7,barW=Math.min(25,step*.48);
 values.forEach((v,i)=>{let bh=v/max*(chartH-8),x=left+i*step+(step-barW)/2,y=top+chartH-bh;ctx.fillStyle="#6685ef";roundRect(ctx,x,y,barW,Math.max(3,bh),5);ctx.fill();ctx.fillStyle="#8994a5";ctx.textAlign="center";ctx.fillText(days[i].toLocaleDateString("es-CO",{weekday:"short"}).replace(".",""),x+barW/2,h-8)});
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
window.addEventListener("resize",()=>{if($("view-dashboard").classList.contains("active"))drawSalesChart()});

function renderCatalog(){
 const q=$("searchInput").value.toLowerCase().trim(),cat=$("categoryFilter").value,state=$("stockFilter").value;
 const list=data.products.filter(p=>(!q||p.name.toLowerCase().includes(q))&&(!cat||p.category===cat)&&(!state||stockState(p)===state));
 $("catalogCount").textContent=`${list.length} de ${data.products.length} productos`;
 $("productGrid").innerHTML=list.map(p=>`<article class="product-card ${stockState(p)==="low"?"low-card":stockState(p)==="out"?"out-card":""}"><div class="product-image">${p.photo?`<img src="${p.photo}" alt="${escapeHtml(p.name)}">`:"▧"}<span class="status ${stockState(p)}">${stateLabel(stockState(p))}</span></div><div class="product-body"><div class="product-category">${escapeHtml(p.category)}</div><h3>${escapeHtml(p.name)}</h3><div class="product-stock"><span>Existencias / mínimo</span><b>${p.stock} / ${p.min}</b></div><div class="product-prices"><div><span>Costo</span><b>${money(p.cost)}</b></div><div><span>Precio venta</span><b>${money(p.price)}</b></div></div><div class="card-actions"><button data-edit="${p.id}">Editar</button><button data-sale="${p.id}" ${p.stock<1?"disabled":""}>Vender</button><button data-delete="${p.id}">Eliminar</button></div></div></article>`).join("");
 $("emptyCatalog").hidden=list.length>0;
 const cats=[...new Set(data.products.map(p=>p.category))].sort(),current=$("categoryFilter").value;
 $("categoryFilter").innerHTML='<option value="">Todas las categorías</option>'+cats.map(c=>`<option>${escapeHtml(c)}</option>`).join("");$("categoryFilter").value=current;
}
$("searchInput").addEventListener("input",renderCatalog);$("categoryFilter").addEventListener("change",renderCatalog);$("stockFilter").addEventListener("change",renderCatalog);
$("productGrid").addEventListener("click",e=>{
 const edit=e.target.closest("[data-edit]"),sale=e.target.closest("[data-sale]"),del=e.target.closest("[data-delete]");
 if(edit)editProduct(edit.dataset.edit);if(sale)openSale(sale.dataset.sale);
 if(del){const p=productById(del.dataset.delete);if(p&&confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)){data.products=data.products.filter(x=>x.id!==p.id);save();notify("Producto eliminado.");}}
});
function refreshProductSelects(){
 const opts=data.products.map(p=>`<option value="${p.id}">${escapeHtml(p.name)} · ${p.stock} uds.</option>`).join("");
 $("movementProduct").innerHTML=opts||'<option value="">Registra productos primero</option>';
 $("saleProduct").innerHTML=opts||'<option value="">No hay productos registrados</option>';
}
function openProductForm(){ $("productFormPanel").classList.add("open");$("productFormPanel").scrollIntoView({behavior:"smooth",block:"start"}); }
$("newProductBtn").addEventListener("click",()=>{resetProductForm();openProductForm()});
$("closeProductForm").addEventListener("click",()=> $("productFormPanel").classList.remove("open"));
$("cancelProduct").addEventListener("click",()=>{$("productFormPanel").classList.remove("open");resetProductForm()});
function resetProductForm(){ $("productForm").reset();$("productId").value="";$("pStock").value=0;$("pMin").value=3;pendingPhoto="";$("photoPreview").hidden=true;$("photoHint").textContent="Puedes tomar una foto o seleccionar una imagen.";$("formTitle").textContent="Registrar producto";updateProfitPreview(); }
function editProduct(id){const p=productById(id);if(!p)return;showView("products");openProductForm();$("formTitle").textContent="Editar producto";$("productId").value=p.id;$("pName").value=p.name;$("pCategory").value=p.category;$("pStock").value=p.stock;$("pMin").value=p.min;$("pCost").value=p.cost;$("pPrice").value=p.price;pendingPhoto=p.photo||"";if(p.photo){$("photoPreview").src=p.photo;$("photoPreview").hidden=false;$("photoHint").textContent="Foto actual (puedes reemplazarla)."}updateProfitPreview();}
$("pPhoto").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;if(!file.type.startsWith("image/")){notify("Selecciona un archivo de imagen.");return;}try{pendingPhoto=await compressImage(file);$("photoPreview").src=pendingPhoto;$("photoPreview").hidden=false;$("photoHint").textContent="Imagen optimizada y lista."; }catch(err){notify("No fue posible procesar la imagen.");}});
function compressImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=700,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.78));};img.onerror=reject;img.src=reader.result;};reader.onerror=reject;reader.readAsDataURL(file);});}
["pCost","pPrice"].forEach(id=>$(id).addEventListener("input",updateProfitPreview));
function updateProfitPreview(){const c=Number($("pCost").value)||0,p=Number($("pPrice").value)||0,profit=p-c,margin=p>0?profit/p*100:0;$("profitPreview").textContent=`Utilidad unitaria: ${money(profit)} · Margen sobre venta: ${margin.toFixed(1)}%`;}
$("productForm").addEventListener("submit",e=>{e.preventDefault();const id=$("productId").value,old=productById(id),name=$("pName").value.trim(),category=$("pCategory").value,stock=Number($("pStock").value),min=Number($("pMin").value),cost=Number($("pCost").value),price=Number($("pPrice").value);if(!name||!category||![stock,min,cost,price].every(Number.isFinite)||stock<0||min<0||cost<0||price<0){notify("Revisa los datos del producto.");return;}const p={id:id||uid(),name,category,stock,min,cost,price,photo:pendingPhoto||"",updatedAt:todayISO()};if(old){Object.assign(old,p);}else data.products.push(p);save();resetProductForm();$("productFormPanel").classList.remove("open");notify(old?"Producto actualizado.":"Producto creado.");});
$("movementForm").addEventListener("submit",e=>{e.preventDefault();const p=productById($("movementProduct").value),qty=Number($("movementQty").value),type=$("movementType").value;if(!p||!Number.isInteger(qty)||qty<1)return notify("Selecciona producto y cantidad válida.");if(type==="out"&&qty>p.stock)return notify("No hay existencias suficientes para esa salida.");p.stock+=type==="in"?qty:-qty;data.movements.push({id:uid(),productId:p.id,productName:p.name,type,qty,date:todayISO()});save();notify("Movimiento aplicado correctamente.");});
function openSale(id){refreshProductSelects();if(id)$("saleProduct").value=id;updateSaleInfo();$("saleDialog").showModal();}
$("quickSaleBtn").addEventListener("click",()=>openSale());$("saleProduct").addEventListener("change",updateSaleInfo);$("saleQty").addEventListener("input",updateSaleTotal);$("salePrice").addEventListener("input",updateSaleTotal);
function updateSaleInfo(){const p=productById($("saleProduct").value);$("saleProductInfo").textContent=p?`Disponible: ${p.stock} unidades · Costo: ${money(p.cost)} · Precio sugerido: ${money(p.price)}`:"Selecciona un producto para ver su disponibilidad.";$("salePrice").value=p?p.price:"";$("saleQty").value=1;updateSaleTotal();}
function updateSaleTotal(){const qty=Number($("saleQty").value)||0,price=Number($("salePrice").value)||0;$("saleTotal").textContent=money(qty*price);const p=productById($("saleProduct").value);$("confirmSale").disabled=!p||qty<1||qty>p.stock||price<0;}
$("saleForm").addEventListener("submit",e=>{e.preventDefault();const p=productById($("saleProduct").value),qty=Number($("saleQty").value),price=Number($("salePrice").value);if(!p||!Number.isInteger(qty)||qty<1||qty>p.stock||price<0)return notify("Verifica la cantidad y el stock disponible.");const total=qty*price,costTotal=qty*p.cost;data.sales.push({id:uid(),productId:p.id,productName:p.name,qty,unitPrice:price,unitCost:p.cost,total,costTotal,profit:total-costTotal,note:$("saleNote").value.trim(),date:todayISO()});p.stock-=qty;save();$("saleDialog").close();$("saleNote").value="";notify("Venta registrada y stock actualizado.");});
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close).close()));
$("requisitionBtn").addEventListener("click",openRequisition);
function requisitionRows(){return data.products.filter(p=>p.stock<=p.min).sort((a,b)=>a.stock-b.stock).map(p=>({...p,suggested:Math.max(0,p.min-p.stock)}));}
function openRequisition(){const rows=requisitionRows();$("requisitionContent").innerHTML=rows.length?`<table class="requisition-table"><thead><tr><th>Producto</th><th>Stock</th><th>Mínimo</th><th style="text-align:right">Solicitar</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${escapeHtml(p.name)}</td><td>${p.stock}</td><td>${p.min}</td><td>${p.suggested}</td></tr>`).join("")}</tbody></table>`:'<div class="empty-inline">No hay productos por reponer en este momento.</div>';$("requisitionDialog").showModal();}
function requisitionText(){const rows=requisitionRows();return ["REQUISICIÓN DE MERCANCÍA - CELL'S SHOP","Fecha: "+dateFmt(todayISO()),"Producto;Categoría;Stock actual;Stock mínimo;Cantidad sugerida",...rows.map(p=>`${p.name};${p.category};${p.stock};${p.min};${p.suggested}`)].join("\n");}
$("copyRequisition").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(requisitionText());notify("Requisición copiada.");}catch(e){notify("No se pudo copiar. Descarga el CSV.");}});
$("downloadRequisition").addEventListener("click",()=>downloadFile("requisicion-cells-shop.csv","\uFEFF"+requisitionText(),"text/csv;charset=utf-8"));
function downloadFile(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
$("backupBtn").addEventListener("click",()=>$("backupDialog").showModal());
$("exportJson").addEventListener("click",()=>{downloadFile(`cells-shop-respaldo-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({...data,backupAt:todayISO()},null,2),"application/json");$("backupStatus").textContent="Respaldo descargado correctamente.";});
$("importJson").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const parsed=JSON.parse(await f.text());if(!parsed||!Array.isArray(parsed.products)||!Array.isArray(parsed.sales))throw new Error("Formato");if(!confirm("La importación reemplazará los productos, ventas y movimientos actuales. ¿Deseas continuar?"))return;data={products:parsed.products,sales:parsed.sales,movements:Array.isArray(parsed.movements)?parsed.movements:[],version:1};save();$("backupStatus").textContent="Respaldo importado correctamente.";notify("Datos restaurados.");}catch(err){notify("El archivo no es un respaldo válido de Cell's Shop.");}finally{e.target.value="";}});
$("installHelp").addEventListener("click",()=>$("installDialog").showModal());
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("installNow").hidden=false;});
$("installNow").addEventListener("click",async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$("installNow").hidden=true;$("installDialog").close();});
if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"))window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
renderAll();
