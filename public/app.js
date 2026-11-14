const LOAI = {tl:"Triển lãm", hc:"Hội chợ", kn:"Kết nối giao thương B2B", hn:"Hội nghị", ht:"Hội thảo", ks:"Khảo sát", cpl:"Chưa phân loại"};
const CV_MAU = {
  tl_hc:["Tờ trình xin chủ trương UBND (nếu ngoài Kế hoạch)","Tham mưu hồ sơ trình BGĐ chấp thuận chủ trương thực hiện chương trình (nếu trong Kế hoạch)","Ban hành Kế hoạch thực hiện","Lập phương án thiết kế, sơ đồ mặt bằng","Hồ sơ mời doanh nghiệp (Thư mời, PĐK, HĐ mẫu)","Ra Quyết định phê duyệt chủ trương và dự kiến kinh phí","Gửi Công văn Sở Tài chính thẩm định kinh phí","Trình phê duyệt Kế hoạch LCNT","Ban hành Công văn chỉ định thầu","Nhà thầu gửi Đơn xác nhận + Báo giá đính kèm","Ký Biên bản hoàn thiện hợp đồng","Trình phê duyệt Kết quả LCNT","Ký kết Hợp đồng với nhà thầu","Công tác tổ chức chương trình (Lịch trực)","Báo cáo kết quả thực hiện chương trình","Thanh quyết toán chương trình, lưu trữ hồ sơ"]
};
/* Loại minh chứng. duoi = phần ký hiệu in sẵn sau số; so:false = chỉ chọn ngày */
const LOAI_VB = [
  {k:"qd",  ten:"Quyết định", duoi:"/QĐ-ITPC"},
  {k:"tt",  ten:"Tờ trình", duoi:"/TTr-XTPTNT&TTTN"},
  {k:"pt",  ten:"Phiếu trình", so:false},
  {k:"ttub",ten:"Tờ trình Ủy ban", duoi:"/TTr-ITPC"},
  {k:"cv",  ten:"Công văn", duoi:"/ITPC-XTPTNT&TTTN"},
  {k:"bbht",ten:"Biên bản hoàn thiện hợp đồng", duoi:""},
  {k:"hd",  ten:"Hợp đồng", duoi:""},
  {k:"bbnt",ten:"Biên bản nghiệm thu", duoi:""},
  {k:"bbtl",ten:"Biên bản thanh lý", duoi:""},
  {k:"bbnttl",ten:"Biên bản nghiệm thu, thanh lý", duoi:""},
  {k:"klcv",ten:"Bảng xác định khối lượng công việc", so:false}
];
const vbOf = k => LOAI_VB.find(x=>x.k===k);
const mcText = (vb,so,ngay) => vb.so===false ? `ngày ${d(ngay)}` : `${vb.duoi?so+vb.duoi:"số "+so} ngày ${d(ngay)}`;
/* Hạn tự động: Ký hợp đồng = 2 ngày trước khai mạc; Tổ chức chương trình = ngày bế mạc */
const HAN_TU_DONG = {"Ký kết Hợp đồng với nhà thầu":p=>p.bd&&!p.chuaRoNgay?addDays(p.bd,-2):"","Công tác tổ chức chương trình (Lịch trực)":p=>p.chuaRoNgay?"":p.kt||""};
const newTask = (p,ten) => {const f=HAN_TU_DONG[ten];return f?{ten,han:f(p),xong:false,autoHan:true}:{ten,han:"",xong:false}};
const capNhatHanTuDong = p => p.cv.forEach(c=>{const f=HAN_TU_DONG[c.ten];if(f&&(c.autoHan||!c.han)){c.han=f(p);c.autoHan=true}});
/* Chèn các bước mẫu còn thiếu vào đúng vị trí theo thứ tự mẫu, giữ nguyên việc tự thêm */
function chenBuocMau(p,mau){
  mau.forEach((ten,k)=>{if(p.cv.some(c=>c.ten===ten))return;
    let pos=0;p.cv.forEach((c,j)=>{const ic=mau.indexOf(c.ten);if(ic>=0&&ic<k)pos=j+1});
    p.cv.splice(pos,0,newTask(p,ten))});
}
const DOI_TEN_CU = {"Tham mưu hồ sơ trình BGĐ chấp thuận chủ trương thực hiện chương trình":"Tham mưu hồ sơ trình BGĐ chấp thuận chủ trương thực hiện chương trình (nếu trong Kế hoạch)","Kế hoạch phối hợp tổ chức":"Ban hành Kế hoạch thực hiện","Hồ sơ mời doanh nghiệp":"Hồ sơ mời doanh nghiệp (Thư mời, PĐK, HĐ mẫu)","Phê duyệt chủ trương và dự kiến kinh phí, thẩm định kinh phí":"Ra Quyết định phê duyệt chủ trương và dự kiến kinh phí","Ký kết các hợp đồng":"Ký kết Hợp đồng với nhà thầu","Công tác tổ chức chương trình":"Công tác tổ chức chương trình (Lịch trực)"};
const mauCho = loai => (loai==="tl"||loai==="hc") ? CV_MAU.tl_hc : null;
const LOAI_MAU = {tl:"var(--accent)", hc:"var(--brand)", kn:"var(--ok)", hn:"var(--info)", ht:"#8a5fa8", ks:"#3f8f8a", cpl:"var(--muted)"};
const TT = {xyk:"Đang xin ý kiến", tk:"Đang triển khai", dr:"Đang diễn ra", ht:"Hoàn thành", huy:"Hủy"};
const TT_CU = {kh:"xyk", cb:"tk", dr:"tk"};
/* Trạng thái do người dùng chọn lưu ở ttGoc; "Đang diễn ra" tự bật khi hôm nay nằm trong thời gian chương trình */
function syncTT(p){if(p.ttGoc===undefined)p.ttGoc=TT_CU[p.tt]||p.tt||"xyk";if(TT_CU[p.ttGoc])p.ttGoc=TT_CU[p.ttGoc];
  p.tt=(p.ttGoc!=="ht"&&p.ttGoc!=="huy"&&!p.chuaRoNgay&&p.bd&&p.bd<=TODAY&&TODAY<=(p.kt||p.bd))?"dr":p.ttGoc;}
const NGUON = ["Nguồn kinh phí XTTM TP giao (100%)","Nguồn kinh phí XTTM TP giao + Xã hội hóa","Nguồn xã hội hóa 100%"];
const NGUON_CU = {"Chương trình XTTM Thành phố":"Nguồn kinh phí XTTM TP giao (100%)","Xã hội hóa":"Nguồn xã hội hóa 100%"};
const DN_TT = ["Đã đăng ký","Đã xác nhận","Đã tham gia","Rút lui"];

/* Dữ liệu nằm trong SQLite phía server (server.js), không nhúng vào trang nữa */
const SAMPLE = [];

const CHUYEN_VIEN=[["Lê Loan Hồng","llhong.itpc"],["Nguyễn Khánh Vy","nkvy.itpc"],["Hồ Trần Ngọc Thanh","htnthanh.itpc"],["Hồ Thanh Phú","htphu.itpc"],["Nguyễn Hồng Phương Trang","nhptrang.itpc"],["Nguyễn Ngô Cẩm Tú","nnctu.itpc"],["Nguyễn Quốc Duy Khải","nqdkhai.itpc"],["Nguyễn Thị Kim Thìn","ntkthin.itpc"],["Đoàn Lê Ngọc Cát Anh","dlncanh.itpc"],["Đặng Trúc Quỳnh","dtquynh.itpc"],["Lê Tấn Minh","ltminh.itpc"],["Nguyễn Lê Nhã Ca","nlnca.itpc"],["Nguyễn Thị Quỳnh Linh","ntqlinh.itpc"],["Nguyễn Thị Vân Anh","ntvanh.itpc"],["Thượng Chí Hoàng","tchoang.itpc"],["Tô Tuấn Anh","ttanh.itpc"],["Tạ Hưng Phúc","thphuc.itpc"],["Trịnh Nhật Hào","tnhao.itpc"],["Lê Thị Minh Nguyệt","ttmnguyet.itpc"],["Vũ Thị Diễm Thúy","vtdthuy.itpc"]]
  .map(([ten,tk])=>({ten,tk}))
  .sort((a,b)=>{const ga=a.ten.split(" ").pop(),gb=b.ten.split(" ").pop();return ga.localeCompare(gb,"vi")||a.ten.localeCompare(b.ten,"vi")});
const LANH_DAO=[{ten:"Trần Xuân Trang",tk:"txtrang.itpc",cv:"Trưởng phòng"},{ten:"Hồ Hoàng Long",tk:"hhlong.itpc",cv:"Phó Trưởng phòng"},{ten:"Trần Thị Kim Oanh",tk:"ttkoanh.itpc",cv:"Phó Trưởng phòng"}];
const cvName=tk=>(CHUYEN_VIEN.find(x=>x.tk===tk)||{}).ten||"";
const cvNames=a=>(a||[]).map(cvName).filter(Boolean);
const ldName=tk=>{const x=LANH_DAO.find(x=>x.tk===tk);return x?`${x.ten} (${x.cv})`:""};
const OLD_CB={"Nguyễn Thị Lan":[["llhong.itpc","nhptrang.itpc"],"txtrang.itpc"],"Trần Minh Quân":[["htphu.itpc","tnhao.itpc","ntvanh.itpc"],"hhlong.itpc"],"Lê Hoàng Phúc":[["nkvy.itpc","llhong.itpc"],"ttkoanh.itpc"],"Phạm Thu Hà":[["dtquynh.itpc","nnctu.itpc"],"hhlong.itpc"]};
const KEY="itpc-ct-v1";
const DATA_VER="snapshot-2026-11-14";
try{if(localStorage.getItem("itpc-data-ver")!==DATA_VER){localStorage.removeItem(KEY);localStorage.removeItem("itpc-dn-v1");localStorage.setItem("itpc-data-ver",DATA_VER)}}catch(e){}
let data;
try{data=JSON.parse(localStorage.getItem(KEY))}catch(e){}
if(!Array.isArray(data))data=JSON.parse(JSON.stringify(SAMPLE));
function normalize(p){
  if(!LOAI[p.loai]){const t=(p.ten||"").toLowerCase();p.loai=p.loai==="doan"?(t.includes("khảo sát")?"ks":"kn"):t.includes("triển lãm")?"tl":t.includes("hội thảo")||t.includes("tập huấn")?"ht":t.includes("hội nghị")?"hn":"hc"}
  delete p.doiTuong;
  if(p.nguon&&!NGUON.includes(p.nguon))p.nguon=NGUON_CU[p.nguon]||"";
  if(p.thuITPC===undefined)p.thuITPC=0;
  if(typeof p.nganh!=="string")p.nganh=""; delete p.daChi;
  if(!Array.isArray(p.chuyenVien)){let a=[];if(p.phuTrach){if(cvName(p.phuTrach))a=[p.phuTrach];else{const m=OLD_CB[p.phuTrach];if(m){a=m[0].slice();if(!p.lanhDao)p.lanhDao=m[1];}}}p.chuyenVien=a;}
  delete p.phuTrach;
  if(p.soDN===undefined)p.soDN=Array.isArray(p.dn)?p.dn.length:0;
  delete p.dn;
  if(p.ten)p.ten=p.ten.toLocaleUpperCase("vi");
  if(Array.isArray(p.chuyenVien)&&typeof p.ghiChu==="string"&&p.ghiChu.includes("D. Thúy")){if(!p.chuyenVien.includes("vtdthuy.itpc"))p.chuyenVien.push("vtdthuy.itpc");p.ghiChu=p.ghiChu.replace(/,?\s*D\. Thúy/,"").replace("Nhân sự khác: .","").trim();}
  if(!Array.isArray(p.cv))p.cv=(mauCho(p.loai)||[]).map(ten=>newTask(p,ten));
  (p.cv||[]).forEach(c=>{if(DOI_TEN_CU[c.ten])c.ten=DOI_TEN_CU[c.ten]});
  if(p.cv)capNhatHanTuDong(p);
  if(p.lanhDao===undefined)p.lanhDao="";
  return p;
}
data.forEach(normalize);
let trash=data.filter(p=>p.daXoa); data=data.filter(p=>!p.daXoa);
let IS_OWNER=false;
const allProgs=()=>data.concat(trash);
function save(){try{localStorage.setItem(KEY,JSON.stringify(allProgs()))}catch(e){};syncPush()}

const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>(+n||0).toLocaleString("de-DE");
const ty=n=>{n=+n||0;return n===0?"0 đ":n<1e6?money(n)+" đ":n>=1e9?(n/1e9).toLocaleString("vi-VN",{maximumFractionDigits:2})+" tỷ":(n/1e6).toLocaleString("vi-VN",{maximumFractionDigits:0})+" triệu"};
const d=s=>{if(!s)return"";const [y,m,dd]=s.split("-");return `${dd}/${m}/${y}`};
const range=p=>p.chuaRoNgay&&p.bd?`Tháng ${+p.bd.slice(5,7)}/${p.bd.slice(0,4)} (chưa rõ ngày)`:p.bd===p.kt?d(p.bd):`${d(p.bd)} – ${d(p.kt)}`;
const pill=t=>`<span class="pill s-${t}">${TT[t]}</span>`;
const parseNum=s=>+String(s||"").replace(/\D/g,"")||0;
/* Bộ chọn ngày kiểu Việt Nam: gõ dd/mm/yyyy hoặc bấm lịch */
const DP_THANG=["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];
function isoOf(y,m,dd){return `${y}-${String(m+1).padStart(2,"0")}-${String(dd).padStart(2,"0")}`}
const vnOf=iso=>{if(!iso)return"";const [y,m,dd]=iso.split("-");return `${dd}/${m}/${y}`};
function parseVN(t){t=t.trim();if(!t)return"";const m=t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);if(!m)return null;
  let [_,dd,mm,y]=m.map(Number);if(y<100)y+=2000;const x=new Date(y,mm-1,dd);if(x.getMonth()!==mm-1||x.getDate()!==dd)return null;return isoOf(y,mm-1,dd)}
const valDesc=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value");
let dpOpen=null;
function closeDP(){if(dpOpen){dpOpen.pop.remove();dpOpen=null}}
function enhanceDate(inp){
  if(inp.dataset.dp)return; inp.dataset.dp="1";
  const iso0=valDesc.get.call(inp);
  inp.type="hidden";
  const wrap=document.createElement("div");wrap.className="dp";
  if(inp.getAttribute("style"))wrap.setAttribute("style",inp.getAttribute("style"));
  if(inp.classList.contains("han"))wrap.style.width="150px",wrap.style.flex="none";
  const txt=document.createElement("input");txt.className="dp-txt";txt.placeholder="dd/mm/yyyy";txt.inputMode="numeric";txt.autocomplete="off";
  txt.setAttribute("aria-label",inp.getAttribute("aria-label")||"Chọn ngày");
  const btn=document.createElement("button");btn.type="button";btn.className="dp-btn";btn.setAttribute("aria-label","Mở lịch");
  btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
  inp.parentNode.insertBefore(wrap,inp);wrap.append(txt,btn,inp);
  if(inp.id){txt.id=inp.id+"-txt";const lb=wrap.closest("label");}
  Object.defineProperty(inp,"value",{configurable:true,get(){return valDesc.get.call(inp)},set(v){valDesc.set.call(inp,v||"");txt.value=vnOf(v||"")}});
  inp.value=iso0;
  const commit=iso=>{const old=valDesc.get.call(inp);inp.value=iso;txt.style.borderColor="";if(old!==iso){inp.dispatchEvent(new Event("input",{bubbles:true}));inp.dispatchEvent(new Event("change",{bubbles:true}))}};
  txt.addEventListener("input",()=>{let v=txt.value.replace(/[^\d]/g,"").slice(0,8);if(v.length>4)v=v.slice(0,2)+"/"+v.slice(2,4)+"/"+v.slice(4);else if(v.length>2)v=v.slice(0,2)+"/"+v.slice(2);txt.value=v;
    if(v.length===10){const iso=parseVN(v);if(iso){commit(iso);if(dpOpen&&dpOpen.inp===inp)closeDP()}}});
  txt.addEventListener("blur",()=>{const iso=parseVN(txt.value);if(iso===null){txt.style.borderColor="var(--bad)"}else commit(iso)});
  txt.addEventListener("keydown",e=>{if(e.key==="Escape")closeDP();if(e.key==="ArrowDown"){e.preventDefault();openDP(inp,txt,wrap,commit)}});
  txt.addEventListener("click",()=>openDP(inp,txt,wrap,commit));
  btn.addEventListener("click",()=>{if(dpOpen&&dpOpen.inp===inp)closeDP();else openDP(inp,txt,wrap,commit)});
}
function openDP(inp,txt,wrap,commit){
  closeDP();
  const host=wrap.closest("dialog")||document.body;
  const pop=document.createElement("div");pop.className="dp-pop";pop.setAttribute("role","dialog");pop.setAttribute("aria-label","Chọn ngày");
  host.appendChild(pop);
  const cur=valDesc.get.call(inp)||TODAY;let y=+cur.slice(0,4),m=+cur.slice(5,7)-1;
  const yNow=+TODAY.slice(0,4);
  const draw=()=>{
    const sel=valDesc.get.call(inp);
    const first=new Date(y,m,1),start=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate(),prevDays=new Date(y,m,0).getDate();
    let cells="";
    for(let k=0;k<42;k++){let dd,mm=m,yy=y,out=false;
      if(k<start){dd=prevDays-start+k+1;mm=m-1;out=true}else if(k>=start+days){dd=k-start-days+1;mm=m+1;out=true}else dd=k-start+1;
      if(mm<0){mm=11;yy--}if(mm>11){mm=0;yy++}
      const iso=isoOf(yy,mm,dd),cn=k%7===6;
      if(k>=35&&start+days<=35)break;
      cells+=`<button type="button" data-d="${iso}" class="${out?"out":""} ${cn&&!out?"cn":""} ${iso===TODAY?"today":""} ${iso===sel?"sel":""}">${dd}</button>`}
    const ys=[];for(let k=yNow-5;k<=yNow+3;k++)ys.push(k);if(!ys.includes(y))ys.push(y),ys.sort();
    pop.innerHTML=`<div class="dp-head"><button type="button" data-nav="-1" aria-label="Tháng trước">‹</button>
      <select data-m aria-label="Tháng">${DP_THANG.map((t,k)=>`<option value="${k}" ${k===m?"selected":""}>${t}</option>`).join("")}</select>
      <select data-y aria-label="Năm" style="flex:0 0 84px">${ys.map(k=>`<option ${k===y?"selected":""}>${k}</option>`).join("")}</select>
      <button type="button" data-nav="1" aria-label="Tháng sau">›</button></div>
      <div class="dp-grid">${["T2","T3","T4","T5","T6","T7","CN"].map((w,k)=>`<div class="wd ${k===6?"cn":""}">${w}</div>`).join("")}${cells}</div>
      <div class="dp-foot"><button type="button" data-q="0">Hôm nay</button><button type="button" data-q="-1">Hôm qua</button><button type="button" data-q="7">+1 tuần</button><button type="button" class="clr" data-clr>Xóa ngày</button></div>`;
    pop.querySelector("[data-m]").onchange=e=>{m=+e.target.value;draw()};
    pop.querySelector("[data-y]").onchange=e=>{y=+e.target.value;draw()};
    pop.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>{m+=+b.dataset.nav;if(m<0){m=11;y--}if(m>11){m=0;y++}draw()});
    pop.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{commit(b.dataset.d);closeDP();txt.focus()});
    pop.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>{commit(addDays(TODAY,+b.dataset.q));closeDP()});
    pop.querySelector("[data-clr]").onclick=()=>{commit("");closeDP()};
    place();
  };
  const place=()=>{const r=wrap.getBoundingClientRect(),ph=pop.offsetHeight,pw=pop.offsetWidth;
    let top=r.bottom+6;if(top+ph>innerHeight-8&&r.top-ph-6>8)top=r.top-ph-6;
    let left=Math.min(r.left,innerWidth-pw-12);pop.style.top=Math.max(8,top)+"px";pop.style.left=Math.max(12,left)+"px"};
  dpOpen={inp,pop,go:iso=>{y=+iso.slice(0,4);m=+iso.slice(5,7)-1;draw()}};
  draw();
}
document.addEventListener("mousedown",e=>{if(dpOpen&&!dpOpen.pop.contains(e.target)&&!e.target.closest(".dp"))closeDP()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&dpOpen){e.stopPropagation();closeDP()}},true);
window.addEventListener("resize",closeDP);document.addEventListener("scroll",e=>{if(dpOpen&&!dpOpen.pop.contains(e.target))closeDP()},true);
new MutationObserver(()=>document.querySelectorAll('input[type=date]:not([data-dp])').forEach(enhanceDate)).observe(document.body,{childList:true,subtree:true});
document.addEventListener("close",closeDP,true);
const TODAY=(()=>{const x=new Date();return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`})();
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,2200)}

let filt={q:"",loai:"",tt:"",nam:"",cv:"",nganh:""};
let detailTab="info";

function route(){
  data.forEach(syncTT);
  const h=(location.hash||"#tong-quan").slice(1);
  const m=h.match(/^ct-(\d+)$/);
  document.querySelectorAll("#nav a").forEach(a=>a.classList.toggle("on",a.dataset.v===(m?"chuong-trinh":h)));
  if(m)return viewDetail(+m[1]);
  ({"chuong-trinh":viewList,"lich":viewCal,"doanh-nghiep":viewDN,"thong-ke":viewStats}[h]||viewDash)();
  window.scrollTo(0,0);
}
window.addEventListener("hashchange",route);

function viewDash(){
  const act=data.filter(p=>p.tt!=="huy");
  const kp=act.reduce((s,p)=>s+(+p.kinhPhi||0),0);
  const s30=data.filter(p=>p.tt!=="huy"&&p.bd>=TODAY&&p.bd<=addDays(TODAY,30)).length;
  const tongThu=act.reduce((s,p)=>s+(+p.thuITPC||0),0), coThu=act.filter(p=>+p.thuITPC>0).length;
  const sap=data.filter(p=>p.kt>=TODAY&&p.tt!=="huy"&&p.tt!=="ht").sort((a,b)=>a.bd.localeCompare(b.bd)).slice(0,5);
  const cvTre=[]; data.forEach(p=>{if(p.tt==="huy")return;p.cv.forEach(c=>{if(!c.xong&&c.han&&c.han<=addDays(TODAY,14))cvTre.push({...c,p})})});
  cvTre.sort((a,b)=>a.han.localeCompare(b.han));
  const byT=Object.keys(TT).map(k=>[k,data.filter(p=>p.tt===k).length]);
  const max=Math.max(1,...byT.map(x=>x[1]));
  $("#view").innerHTML=`
  <div class="head"><div><h1>Tổng quan chương trình</h1><p class="sub">Phòng XTPTNT&amp;TTTN · cập nhật đến ${d(TODAY)}</p></div>
  <button class="btn pri" onclick="openForm()">+ Thêm chương trình</button></div>
  <div class="kpis k5">
    <div class="kpi"><span>Chương trình</span><strong>${data.length}</strong><em>${data.filter(p=>p.tt==="tk"||p.tt==="dr").length} đang triển khai / diễn ra</em></div>
    <div class="kpi"><span>Kinh phí dự kiến</span><strong>${ty(kp)}</strong><em>không tính chương trình hủy</em></div>
    <div class="kpi"><span>Sắp diễn ra</span><strong>${s30}</strong><em>chương trình trong 30 ngày tới</em></div>
    <div class="kpi"><span>Nguồn thu về ITPC</span><strong style="color:var(--ok)">${ty(tongThu)}</strong><em>từ ${coThu} chương trình, không tính chương trình hủy</em></div>
    <a class="kpi kpi-link" href="#doanh-nghiep"><span>Doanh nghiệp đã thu thập</span><strong>${dnData.length.toLocaleString("de-DE")}</strong><em>${dnData.filter(x=>x.nlh).length} có người liên hệ · bấm để xem</em></a>
  </div>
  <div class="grid2">
    <div class="panel"><h2>Sắp diễn ra</h2><div class="list">${sap.map(p=>{const [y,m,dd]=p.bd.split("-");return `<div class="li" onclick="location.hash='ct-${p.id}'"><div class="date-chip"><b>${dd}</b><small>Th${+m}</small></div><div class="t"><div class="t-name">${esc(p.ten)}</div><div class="t-meta">${LOAI[p.loai]} · ${esc(p.diaDiem)} · ${p.soDN||0}/${p.toiDa||"–"} DN</div></div>${pill(p.tt)}</div>`}).join("")||'<div class="empty">Chưa có chương trình sắp tới.</div>'}</div></div>
    <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
      <div class="panel"><h2>Công việc đến hạn (14 ngày)</h2>${cvTre.map(c=>`<div class="li" onclick="detailTab='cv';location.hash='ct-${c.p.id}'"><div class="t"><div class="t-name">${esc(c.ten)}</div><div class="t-meta">${esc(c.p.ten)}</div></div><span class="pill ${c.han<TODAY?"s-huy":"s-cb"}">${c.han<TODAY?"Quá hạn":"Hạn"} ${d(c.han)}</span></div>`).join("")||'<div class="empty">Không có việc đến hạn hoặc quá hạn.</div>'}</div>
      <div class="panel"><h2>Theo trạng thái</h2>${byT.map(([k,n])=>`<div class="row-stat"><span>${TT[k]}</span><div class="bar"><i style="width:${n/max*100}%"></i></div><span class="num">${n}</span></div>`).join("")}</div>
    </div>
  </div>`;
}
function addDays(s,n){const x=new Date(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10)+n);return isoOf(x.getFullYear(),x.getMonth(),x.getDate())}

function drawTrash(){
  const b=$("#trashBox");if(!b)return;
  if(!trash.length){b.innerHTML=`<div class="panel" style="margin-bottom:14px"><h2>Thùng rác <span class="t-meta" style="font-weight:400">· chỉ chủ sở hữu thấy</span></h2><div class="empty">Thùng rác trống. Chương trình bị xóa sẽ nằm ở đây để khôi phục khi cần.</div></div>`;return}
  b.innerHTML=`<div class="panel" style="margin-bottom:14px"><h2>Thùng rác <span class="t-meta" style="font-weight:400">· chỉ chủ sở hữu thấy</span></h2>${trash.map(p=>`<div class="li" style="cursor:default" data-t="${p.id}"><div class="t"><div class="t-name">${esc(p.ten)}</div><div class="t-meta">${range(p)} · xóa ngày ${d(p.ngayXoa)}</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center" class="tact"><button type="button" class="btn sm ok" data-rs="${p.id}">Khôi phục</button><button type="button" class="btn sm danger" data-pd="${p.id}">Xóa vĩnh viễn</button></div></div>`).join("")}</div>`;
  b.querySelectorAll("[data-rs]").forEach(x=>x.onclick=()=>{const p=trash.find(t=>t.id===+x.dataset.rs);delete p.daXoa;delete p.ngayXoa;trash=trash.filter(t=>t!==p);data.push(p);data.sort((a,b)=>a.id-b.id);save();toast("Đã khôi phục chương trình");viewList();drawTrash()});
  b.querySelectorAll("[data-pd]").forEach(x=>x.onclick=()=>{const box=x.closest(".tact");box.innerHTML=`<span class="confirm" style="padding:4px 10px">Xóa hẳn, không khôi phục được? <button type="button" class="btn sm danger" data-yes>Xóa hẳn</button><button type="button" class="btn sm" data-no>Thôi</button></span>`;
    box.querySelector("[data-yes]").onclick=()=>{trash=trash.filter(t=>t.id!==+x.dataset.pd);save();toast("Đã xóa vĩnh viễn");viewList();drawTrash()};
    box.querySelector("[data-no]").onclick=()=>drawTrash()});
}
function viewList(){
  const years=[...new Set(data.map(p=>p.bd.slice(0,4)))].sort();
  $("#view").innerHTML=`
  <div class="head"><div><h1>Danh sách chương trình</h1><p class="sub" id="cnt"></p></div><div style="display:flex;gap:8px;flex-wrap:wrap">${IS_OWNER?`<button class="btn" id="trashBtn">Thùng rác (${trash.length})</button>`:""}<button class="btn pri" onclick="openForm()">+ Thêm chương trình</button></div></div>
  <div id="trashBox"></div>
  <div class="toolbar">
    <input id="q" placeholder="Tìm theo tên, thị trường, chuyên viên…" value="${esc(filt.q)}">
    <select id="fng"><option value="">Tất cả ngành hàng</option>${["Đa ngành",...NGANH.filter(n=>n!=="Đa ngành"&&!NGANH_DN.includes(n))].map(n=>`<option ${filt.nganh===n?"selected":""}>${n}</option>`).join("")}</select>
    <select id="fl"><option value="">Tất cả loại hình</option>${Object.entries(LOAI).map(([k,v])=>`<option value="${k}" ${filt.loai===k?"selected":""}>${v}</option>`).join("")}</select>
    <select id="ft"><option value="">Tất cả trạng thái</option>${Object.entries(TT).map(([k,v])=>`<option value="${k}" ${filt.tt===k?"selected":""}>${v}</option>`).join("")}</select>
    <select id="fcv"><option value="">Tất cả chuyên viên</option>${CHUYEN_VIEN.map(c=>`<option value="${c.tk}" ${filt.cv===c.tk?"selected":""}>${c.ten}</option>`).join("")}</select>
    <select id="fn"><option value="">Mọi năm</option>${years.map(y=>`<option ${filt.nam===y?"selected":""}>${y}</option>`).join("")}</select>
  </div>
  <div class="tbl-wrap"><table><thead><tr><th>Chương trình</th><th>Thời gian</th><th>Thị trường</th><th>Phụ trách</th><th style="text-align:right">Kinh phí (đ)</th><th>DN</th><th>Trạng thái</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const draw=()=>{
    const q=filt.q.toLowerCase();
    const rows=data.filter(p=>(!filt.loai||p.loai===filt.loai)&&(!filt.nganh||p.nganh===filt.nganh)&&(!filt.tt||p.tt===filt.tt)&&(!filt.nam||p.bd.startsWith(filt.nam))&&(!filt.cv||p.chuyenVien.includes(filt.cv))&&(!q||[p.ten,p.thiTruong,...cvNames(p.chuyenVien),ldName(p.lanhDao),p.diaDiem].join(" ").toLowerCase().includes(q))).sort((a,b)=>a.bd.localeCompare(b.bd));
    $("#cnt").textContent=`${rows.length} / ${data.length} chương trình`;
    $("#tb").innerHTML=rows.map(p=>`<tr class="click" onclick="location.hash='ct-${p.id}'"><td><div class="t-name">${esc(p.ten)}</div><div class="t-meta">${LOAI[p.loai]}${p.nganh?" · "+esc(p.nganh):""}</div></td><td class="num">${range(p)}</td><td>${esc(p.thiTruong)}<div class="t-meta">${esc(p.diaDiem)}</div></td><td>${cvNames(p.chuyenVien).map(n=>`<div>${esc(n)}</div>`).join("")||"—"}${p.lanhDao?`<div class="t-meta">LĐ: ${esc((LANH_DAO.find(x=>x.tk===p.lanhDao)||{}).ten||"")}</div>`:""}</td><td class="num" style="text-align:right">${money(p.kinhPhi)}</td><td class="num">${p.soDN||0}/${p.toiDa||"–"}</td><td>${pill(p.tt)}</td></tr>`).join("")||`<tr><td colspan="7" class="empty">Không có chương trình phù hợp bộ lọc.</td></tr>`;
  };
  $("#q").oninput=e=>{filt.q=e.target.value;draw()};
  $("#fl").onchange=e=>{filt.loai=e.target.value;draw()};
  $("#fng").onchange=e=>{filt.nganh=e.target.value;draw()};
  $("#ft").onchange=e=>{filt.tt=e.target.value;draw()};
  if($("#trashBtn"))$("#trashBtn").onclick=()=>{$("#trashBox").innerHTML?($("#trashBox").innerHTML=""):drawTrash()};
  $("#fcv").onchange=e=>{filt.cv=e.target.value;draw()};
  $("#fn").onchange=e=>{filt.nam=e.target.value;draw()};
  draw();
}

const stCls=t=>t==="tk"||t==="dr"?"dang":t==="ht"?"ht":t==="huy"?"huy":"kh";
const ICON={dang:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="12" cy="12" r="1"/><path d="M12 6v6l4 2"/></svg>',ht:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',huy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',kh:''};
const stIcon=t=>ICON[stCls(t)];
function viewCal(){
  const years=[...new Set(data.map(p=>p.bd.slice(0,4)))].sort();
  let y=viewCal.y||TODAY.slice(0,4);
  const ev=data.filter(p=>p.bd.startsWith(y));
  $("#view").innerHTML=`
  <div class="head"><div><h1>Lịch chương trình năm ${y}</h1><p class="sub">${ev.length} chương trình</p></div>
  <select id="cy" style="width:auto">${years.map(v=>`<option ${v===y?"selected":""}>${v}</option>`).join("")}</select></div>
  <div class="legend">${Object.entries(LOAI).map(([k,v])=>`<span><i style="background:${LOAI_MAU[k]}"></i>${v}</span>`).join("")}</div>
  <div class="legend st"><span><span class="ic" style="background:#e0a91b;color:#fff">${ICON.dang}</span>Đang triển khai / Đang diễn ra</span><span><span class="ic" style="background:var(--ok);color:#fff">${ICON.ht}</span>Hoàn thành</span><span><span class="ic" style="background:var(--bad);color:#fff">${ICON.huy}</span>Hủy</span><span><span class="ic" style="border:1.5px dashed var(--muted)"></span>Đang xin ý kiến</span></div>
  <div class="months">${Array.from({length:12},(_,i)=>{const m=String(i+1).padStart(2,"0");const list=ev.filter(p=>p.bd.slice(5,7)===m).sort((a,b)=>a.bd.localeCompare(b.bd));return `<div class="panel month"><h3>Tháng ${i+1}</h3>${list.map(p=>`<div class="ev st-${stCls(p.tt)}" style="border-left-color:${LOAI_MAU[p.loai]}" onclick="location.hash='ct-${p.id}'" title="${TT[p.tt]}"><span class="ic">${stIcon(p.tt)}</span><div class="evb"><div class="t-name" style="font-size:13px">${esc(p.ten)}</div><small>${range(p)} · ${TT[p.tt]}</small></div></div>`).join("")||'<div class="t-meta">—</div>'}</div>`}).join("")}</div>`;
  $("#cy").onchange=e=>{viewCal.y=e.target.value;viewCal()};
}

const NGANH=["Nông sản","Thực phẩm chế biến","Thủy sản","Đồ uống","Dệt may – Da giày","Gỗ – Nội thất","Thủ công mỹ nghệ","Mỹ phẩm – Hóa mỹ phẩm","Dược phẩm – Thiết bị y tế","Cơ khí – Máy móc","Điện – Điện tử","Nhựa – Cao su","Vật liệu xây dựng","Hóa chất","Bao bì – In ấn","Logistics – Vận tải","Công nghệ thông tin","Du lịch – Dịch vụ","Thương mại điện tử","Ô tô – Phụ tùng","Công nghiệp hỗ trợ","Dịch vụ","Đa ngành","Cơ quan nhà nước, ngoại giao","Trung tâm xúc tiến","Hiệp hội ngành nghề"];
const NGANH_DN=["Cơ quan nhà nước, ngoại giao","Trung tâm xúc tiến","Hiệp hội ngành nghề"];
const QG=["Việt Nam","Nhật Bản","Hàn Quốc","Trung Quốc","Đài Loan","Hoa Kỳ","Canada","Úc","Ấn Độ","Thái Lan","Singapore","Malaysia","Indonesia","Campuchia","Lào","Đức","Pháp","Hà Lan","Anh","UAE"];
const DKEY="itpc-dn-v1";
const SAMPLE_DN = [];
let dnData;
try{dnData=JSON.parse(localStorage.getItem(DKEY))}catch(e){}
if(!Array.isArray(dnData))dnData=JSON.parse(JSON.stringify(SAMPLE_DN));
let dnTrash=dnData.filter(x=>x.daXoa); dnData=dnData.filter(x=>!x.daXoa);
const allDN=()=>dnData.concat(dnTrash);
function saveDN(){try{localStorage.setItem(DKEY,JSON.stringify(allDN()))}catch(e){};syncPush()}
const ctName=id=>(data.find(p=>p.id===+id)||{}).ten||"";
let dfilt={q:"",nganh:"",ct:"",qg:""};

function drawDNTrash(){
  const b=$("#dnTrashBox");if(!b)return;
  const head='<h2>Thùng rác <span class="t-meta" style="font-weight:400">· chỉ chủ sở hữu thấy</span></h2>';
  if(!dnTrash.length){b.innerHTML=`<div class="panel" style="margin-bottom:14px">${head}<div class="empty">Thùng rác trống. Doanh nghiệp bị xóa sẽ nằm ở đây để khôi phục khi cần.</div></div>`;return}
  b.innerHTML=`<div class="panel" style="margin-bottom:14px">${head}${dnTrash.map(x=>`<div class="li" style="cursor:default"><div class="t"><div class="t-name">${esc(x.ten)}</div><div class="t-meta">${x.mst?"MST "+esc(x.mst)+" · ":""}xóa ngày ${d(x.ngayXoa)}</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center" class="tact"><button type="button" class="btn sm ok" data-rs="${x.id}">Khôi phục</button><button type="button" class="btn sm danger" data-pd="${x.id}">Xóa vĩnh viễn</button></div></div>`).join("")}</div>`;
  b.querySelectorAll("[data-rs]").forEach(el=>el.onclick=()=>{const x=dnTrash.find(t=>t.id===+el.dataset.rs);delete x.daXoa;delete x.ngayXoa;dnTrash=dnTrash.filter(t=>t!==x);dnData.push(x);dnData.sort((a,b)=>a.id-b.id);saveDN();toast("Đã khôi phục doanh nghiệp");viewDN();drawDNTrash()});
  b.querySelectorAll("[data-pd]").forEach(el=>el.onclick=()=>{const box=el.closest(".tact");box.innerHTML=`<span class="confirm" style="padding:4px 10px">Xóa hẳn, không khôi phục được? <button type="button" class="btn sm danger" data-yes>Xóa hẳn</button><button type="button" class="btn sm" data-no>Thôi</button></span>`;
    box.querySelector("[data-yes]").onclick=()=>{dnTrash=dnTrash.filter(t=>t.id!==+el.dataset.pd);saveDN();toast("Đã xóa vĩnh viễn");viewDN();drawDNTrash()};
    box.querySelector("[data-no]").onclick=()=>drawDNTrash()});
}
const splitLines=(v,em)=>String(v||"").split(/\s*\/\s+|\s+\/\s*|\n/).filter(Boolean).map(t=>`<div>${em?esc(t).replace("@","<wbr>@"):esc(t)}</div>`).join("");
const webHref=w=>/^https?:\/\//i.test(w)?w:"https://"+w;
function viewDN(){
  const qgs=[...new Set(dnData.map(x=>x.qg).filter(Boolean))].sort();
  const ngs=[...new Set([...NGANH,...dnData.map(x=>x.nganh)].filter(Boolean))];
  $("#view").innerHTML=`
  <div class="head"><div><h1>Dữ liệu doanh nghiệp thu thập của Phòng</h1><p class="sub" id="dcnt"></p></div><div style="display:flex;gap:8px;flex-wrap:wrap">${IS_OWNER?`<button class="btn" id="dnTrashBtn">Thùng rác (${dnTrash.length})</button>`:""}<button class="btn pri" onclick="openDN()">+ Thêm doanh nghiệp</button></div></div>
  <div id="dnTrashBox"></div>
  <div class="toolbar">
    <input id="dq" placeholder="Tìm theo tên, MST, sản phẩm, người liên hệ…" value="${esc(dfilt.q)}">
    <select id="dng"><option value="">Tất cả ngành hàng</option>${ngs.map(n=>`<option ${dfilt.nganh===n?"selected":""}>${esc(n)}</option>`).join("")}</select>
    <select id="dqg"><option value="">Mọi quốc gia</option>${qgs.map(n=>`<option ${dfilt.qg===n?"selected":""}>${esc(n)}</option>`).join("")}</select>
  </div>
  <div class="tbl-wrap"><table class="dn-tbl" style="min-width:1080px"><colgroup><col style="width:28%"><col style="width:9%"><col style="width:18%"><col style="width:6%"><col style="width:13%"><col style="width:14%"><col style="width:12%"></colgroup><thead><tr><th>Doanh nghiệp</th><th>Mã số thuế</th><th>Ngành hàng · Sản phẩm</th><th>Quốc gia</th><th>Người liên hệ</th><th>Liên lạc</th><th>Website</th></tr></thead><tbody id="dtb"></tbody></table></div>`;
  const draw=()=>{
    const q=dfilt.q.toLowerCase();
    const rows=dnData.filter(x=>(!dfilt.nganh||x.nganh===dfilt.nganh)&&(!dfilt.qg||x.qg===dfilt.qg)&&(!q||[x.ten,x.mst,x.sp,x.nlh,x.email,x.sdt,x.dc,x.web,x.ghiChu,...(x.lienHeKhac||[]).flatMap(l=>[l.nlh,l.sdt,l.email])].join(" ").toLowerCase().includes(q))).sort((a,b)=>b.id-a.id);
    $("#dcnt").textContent=`${rows.length} / ${dnData.length} doanh nghiệp · bấm vào một dòng để sửa`;
    $("#dtb").innerHTML=rows.map(x=>`<tr class="click" data-id="${x.id}">
      <td><div class="t-name">${esc(x.ten)}</div><div class="t-meta">${esc(x.dc)||"—"}</div></td>
      <td class="num">${esc(x.mst)||"—"}</td>
      <td><span class="tag">${esc(x.nganh)||"—"}</span><div class="t-meta clamp3" style="margin-top:4px" title="${esc(x.sp)}">${esc(x.sp)}</div></td>
      <td>${esc(x.qg)||"—"}</td>
      <td><div style="font-weight:500">${esc(x.nlh)||"—"}${(x.lienHeKhac||[]).length?`<span class="tag-more" title="${esc(x.lienHeKhac.map(l=>l.nlh).join(", "))}">+${x.lienHeKhac.length}</span>`:""}</div><div class="t-meta">${esc(x.cv)}</div></td>
      <td><div class="num ph">${x.sdt?splitLines(x.sdt):"—"}</div><div class="t-meta em" style="margin-top:2px">${splitLines(x.email,true)}</div></td>
      <td>${x.web?`<a class="weblink" href="${esc(webHref(x.web))}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(x.web.replace(/^https?:\/\//,"").replace(/\/$/,""))}</a>`:'<span class="t-meta">—</span>'}</td></tr>`).join("")||`<tr><td colspan="7" class="empty">Chưa có doanh nghiệp phù hợp. Bấm “+ Thêm doanh nghiệp” để nhập mới.</td></tr>`;
    $("#dtb").querySelectorAll("tr.click").forEach(r=>r.onclick=()=>openDN(+r.dataset.id));
  };
  $("#dq").oninput=e=>{dfilt.q=e.target.value;draw()};
  $("#dng").onchange=e=>{dfilt.nganh=e.target.value;draw()};
  $("#dqg").onchange=e=>{dfilt.qg=e.target.value;draw()};
  if($("#dnTrashBtn"))$("#dnTrashBtn").onclick=()=>{$("#dnTrashBox").innerHTML?($("#dnTrashBox").innerHTML=""):drawDNTrash()};
  draw();
}

/* Form doanh nghiệp */
$("#qgList").innerHTML=QG.map(q=>`<option value="${q}">`).join("");
$("#d-ten").addEventListener("input",e=>{const c=e.target.selectionStart;e.target.value=e.target.value.toLocaleUpperCase("vi");e.target.setSelectionRange(c,c)});
$("#d-mst").addEventListener("input",e=>{let v=e.target.value.replace(/\D/g,"").slice(0,13);if(v.length>10)v=v.slice(0,10)+"-"+v.slice(10);e.target.value=v});
$("#d-nganh").addEventListener("change",e=>{$("#d-nganh-khac-wrap").hidden=e.target.value!=="__khac"});
let dnEdit=null;
function drawLHK(list){
  $("#d-lhk").innerHTML=list.map((l,i)=>`<div class="lhk" data-i="${i}"><label>Họ tên<input class="lh-nlh" value="${esc(l.nlh||"")}"></label><label>Chức vụ<input class="lh-cv" value="${esc(l.cv||"")}"></label><label>Số điện thoại<input class="lh-sdt" inputmode="tel" value="${esc(l.sdt||"")}"></label><label>Email<input class="lh-email" type="email" value="${esc(l.email||"")}"></label><button type="button" class="btn danger lh-x" aria-label="Bỏ người liên hệ này">×</button></div>`).join("");
  $("#d-lhk").querySelectorAll(".lh-x").forEach((b,i)=>b.onclick=()=>{const cur=readLHK(true);cur.splice(i,1);drawLHK(cur)});
}
function readLHK(keepEmpty){return [...$("#d-lhk").querySelectorAll(".lhk")].map(r=>({nlh:r.querySelector(".lh-nlh").value.trim(),cv:r.querySelector(".lh-cv").value.trim(),sdt:r.querySelector(".lh-sdt").value.trim(),email:r.querySelector(".lh-email").value.trim()})).filter(l=>keepEmpty||l.nlh||l.sdt||l.email)}
$("#d-lhk-add").onclick=()=>{const cur=readLHK(true);cur.push({});drawLHK(cur);const ins=$("#d-lhk").querySelectorAll(".lh-nlh");ins[ins.length-1].focus()};
function openDN(id){
  if(RO)return;
  dnEdit=id??null; const x=dnData.find(r=>r.id===id)||{qg:"Việt Nam"};
  $("#dnTitle").textContent=id?"Sửa thông tin doanh nghiệp":"Thêm doanh nghiệp";
  const known=NGANH.includes(x.nganh);
  $("#d-nganh").innerHTML=`<option value="">— Chọn ngành hàng —</option>`+NGANH.map(n=>`<option>${n}</option>`).join("")+`<option value="__khac">Khác (tự ghi)</option>`;
  $("#d-nganh").value=!x.nganh?"":known?x.nganh:"__khac";
  $("#d-nganh-khac").value=known?"":(x.nganh||"");
  $("#d-nganh-khac-wrap").hidden=$("#d-nganh").value!=="__khac";
  $("#d-ten").value=x.ten||"";$("#d-sp").value=x.sp||"";$("#d-qg").value=x.qg||"";$("#d-mst").value=x.mst||"";
  $("#d-dc").value=x.dc||"";$("#d-web").value=x.web||"";$("#d-nlh").value=x.nlh||"";$("#d-cv").value=x.cv||"";$("#d-sdt").value=x.sdt||"";$("#d-email").value=x.email||"";$("#d-gc").value=x.ghiChu||"";drawLHK((x.lienHeKhac||[]).map(l=>({...l})));
  $("#d-err").hidden=true;$("#dnDelBox").innerHTML="";$("#dnDel").hidden=!id||!IS_OWNER;
  $("#dlgDN").showModal();$("#d-ten").focus();
}
$("#dnX").onclick=$("#dnCancel").onclick=()=>$("#dlgDN").close();
$("#dnDel").onclick=()=>{$("#dnDelBox").innerHTML=`<div class="confirm">Chuyển doanh nghiệp này vào Thùng rác? Có thể khôi phục lại sau. <button type="button" class="btn sm danger" id="dnYes">Xóa</button><button type="button" class="btn sm" id="dnNo">Giữ lại</button></div>`;
  $("#dnYes").onclick=()=>{const o=dnData.find(r=>r.id===dnEdit);if(!o)return;o.daXoa=true;o.ngayXoa=TODAY;dnData=dnData.filter(r=>r!==o);dnTrash.push(o);saveDN();$("#dlgDN").close();toast("Đã chuyển vào Thùng rác");viewDN()};
  $("#dnNo").onclick=()=>$("#dnDelBox").innerHTML=""};
$("#frmDN").onsubmit=e=>{
  e.preventDefault();const er=$("#d-err");const fail=m=>{er.textContent=m;er.hidden=false};
  const ng=$("#d-nganh").value==="__khac"?$("#d-nganh-khac").value.trim():$("#d-nganh").value;
  const v={ten:$("#d-ten").value.trim().toLocaleUpperCase("vi"),nganh:ng,sp:$("#d-sp").value.trim(),qg:$("#d-qg").value.trim(),mst:$("#d-mst").value.trim(),dc:$("#d-dc").value.trim(),web:$("#d-web").value.trim(),nlh:$("#d-nlh").value.trim(),cv:$("#d-cv").value.trim(),sdt:$("#d-sdt").value.trim(),email:$("#d-email").value.trim(),ghiChu:$("#d-gc").value.trim(),lienHeKhac:readLHK()};
  if(!v.ten)return fail("Nhập tên doanh nghiệp.");
  const digits=v.mst.replace(/\D/g,"");
  if(v.mst&&!(digits.length===10||digits.length===13))return fail("Mã số thuế phải gồm 10 chữ số, hoặc 13 chữ số dạng 0123456789-001.");
  if(v.sdt&&v.sdt.replace(/\D/g,"").length<8)return fail("Số điện thoại chưa đủ chữ số.");
  if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))return fail("Email chưa đúng định dạng, ví dụ ten@congty.vn.");
  if(v.mst&&dnData.some(r=>r.id!==dnEdit&&r.mst===v.mst))return fail("Doanh nghiệp có mã số thuế này đã có trong dữ liệu.");
  if(dnEdit){const o=dnData.find(r=>r.id===dnEdit);delete o.ctId;Object.assign(o,v)}else dnData.push({id:Math.max(0,...allDN().map(r=>r.id))+1,...v});
  saveDN();$("#dlgDN").close();toast("Đã lưu doanh nghiệp");viewDN();
};

let sYear="";
function viewStats(){
  const years=[...new Set(data.map(p=>p.bd.slice(0,4)))].sort();
  const src=data.filter(p=>!sYear||p.bd.startsWith(sYear));
  const isAct=p=>p.tt==="tk"||p.tt==="dr";
  const rows=CHUYEN_VIEN.map(c=>{const ps=src.filter(p=>p.chuyenVien.includes(c.tk));const n=k=>ps.filter(p=>p.tt===k).length;
    return {...c,ps,act:ps.filter(isAct),kh:n("xyk"),ht:n("ht"),huy:n("huy"),tong:ps.length}})
    .sort((a,b)=>b.act.length-a.act.length||b.tong-a.tong||a.ten.split(" ").pop().localeCompare(b.ten.split(" ").pop(),"vi"));
  const maxT=Math.max(1,...rows.map(r=>r.tong));
  const unassigned=src.filter(p=>!p.chuyenVien.length&&p.tt!=="huy");
  const idle=rows.filter(r=>!r.act.length&&!r.kh).length;
  const nz=n=>`<td class="stat-n ${n?"":"z"}">${n}</td>`;
  $("#view").innerHTML=`
  <div class="head"><div><h1>Thống kê theo chuyên viên</h1><p class="sub">${sYear?"Năm "+sYear:"Tất cả các năm"} · ${src.length} chương trình · bấm vào tên để xem chi tiết</p></div>
  <select id="sy" style="width:auto"><option value="">Tất cả các năm</option>${years.map(y=>`<option ${y===sYear?"selected":""}>${y}</option>`).join("")}</select></div>
  <div class="kpis">
    <div class="kpi"><span>Đang thực hiện</span><strong>${src.filter(isAct).length}</strong><em>chương trình đang triển khai hoặc diễn ra</em></div>
    <div class="kpi"><span>Đã hoàn thành</span><strong>${src.filter(p=>p.tt==="ht").length}</strong><em>chương trình</em></div>
    <div class="kpi"><span>Chưa phân công</span><strong>${unassigned.length}</strong><em>chương trình chưa có chuyên viên</em></div>
    <div class="kpi"><span>Chuyên viên rảnh</span><strong>${idle}</strong><em>chưa có chương trình đang làm hoặc xin ý kiến</em></div>
  </div>
  <div class="tbl-wrap" style="margin-bottom:16px"><table style="min-width:900px"><thead><tr><th>Chuyên viên</th><th style="text-align:center">Đang thực hiện</th><th style="text-align:center">Xin ý kiến</th><th style="text-align:center">Hoàn thành</th><th style="text-align:center">Hủy</th><th>Tổng</th><th>Đang phụ trách</th></tr></thead><tbody>
  ${rows.map((r,i)=>`<tr class="click" data-i="${i}"><td><div class="t-name">${esc(r.ten)}</div><div class="t-meta">${r.tk}</div></td>
    ${nz(r.act.length)}${nz(r.kh)}${nz(r.ht)}${nz(r.huy)}
    <td style="min-width:120px"><div style="display:flex;gap:8px;align-items:center"><div class="bar" style="flex:1"><i style="width:${r.tong/maxT*100}%"></i></div><span class="num">${r.tong}</span></div></td>
    <td>${r.act.map(p=>`<div><a href="#ct-${p.id}" style="color:var(--brand)" onclick="event.stopPropagation()">${esc(p.ten)}</a> <span class="t-meta">· ${TT[p.tt]}</span></div>`).join("")||'<span class="t-meta">—</span>'}</td></tr>
    <tr class="exp" id="exp${i}" hidden><td colspan="7">${r.ps.length?r.ps.sort((a,b)=>b.bd.localeCompare(a.bd)).map(p=>`<div style="display:flex;gap:10px;align-items:center;padding:4px 0;flex-wrap:wrap">${pill(p.tt)}<a href="#ct-${p.id}" style="color:var(--ink);font-weight:500">${esc(p.ten)}</a><span class="t-meta">${range(p)} · ${LOAI[p.loai]} · cùng làm: ${cvNames(p.chuyenVien.filter(x=>x!==r.tk)).join(", ")||"một mình"}</span></div>`).join(""):'<span class="t-meta">Chưa có chương trình nào.</span>'}</td></tr>`).join("")}
  </tbody></table></div>
  <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
  ${LANH_DAO.map(l=>{const ps=src.filter(p=>p.lanhDao===l.tk);return `<div class="panel"><h2 style="margin-bottom:2px">${l.ten}</h2><div class="t-meta">${l.cv} · phụ trách ${ps.length} chương trình</div>
    <div class="mini">${Object.keys(TT).map(k=>{const n=ps.filter(p=>p.tt===k).length;return n?`<span class="pill s-${k}">${TT[k]}: ${n}</span>`:""}).join("")||'<span class="t-meta">Chưa có chương trình</span>'}</div></div>`}).join("")}
  </div>`;
  $("#sy").onchange=e=>{sYear=e.target.value;viewStats()};
  document.querySelectorAll("tr.click[data-i]").forEach(t=>t.onclick=()=>{const x=$("#exp"+t.dataset.i);x.hidden=!x.hidden});
}

let mcCtx=null;
let cvFocusItem=null;
function mcRowHTML(it){
  const vb=it.loai?vbOf(it.loai):null;
  let mid='<div class="t-meta" style="align-self:center">Chọn loại văn bản để nhập số và ngày</div>';
  if(vb){
    const soIn=vb.so===false?'<div class="t-meta" style="align-self:center">Chỉ cần ngày</div>'
      :vb.duoi?`<div class="so"><input class="mc-so" inputmode="numeric" placeholder="Số" value="${esc(it.so||"")}"><span>${esc(vb.duoi)}</span></div>`
      :`<div class="so"><span style="border-left:1px solid var(--line);border-right:none;border-radius:10px 0 0 10px">Số</span><input class="mc-so" placeholder="VD: 15/2026" value="${esc(it.so||"")}" style="border-radius:0 10px 10px 0"></div>`;
    mid=`${soIn}<input type="date" class="mc-ngay" value="${it.ngay||""}" aria-label="Ngày ${esc(vb.ten)}">`;
  }
  return `<div class="mcr"><select class="mc-loai" aria-label="Loại minh chứng"><option value="">— Chọn loại văn bản —</option>${LOAI_VB.map(v=>`<option value="${v.k}" ${v.k===it.loai?"selected":""}>${v.ten}</option>`).join("")}</select>
    <div class="mc-val">${mid}</div><button type="button" class="btn sm danger mc-del" aria-label="Xóa dòng minh chứng">×</button></div>`;
}
function readMCRows(){return [...document.querySelectorAll("#mcRows .mcr")].map(r=>({loai:r.querySelector(".mc-loai").value,so:(r.querySelector(".mc-so")||{}).value?.trim()||"",ngay:(r.querySelector(".mc-ngay")||{}).value||""}))}
function drawMCRows(rows){
  $("#mcRows").innerHTML=rows.map(mcRowHTML).join("");
  document.querySelectorAll("#mcRows .mcr").forEach((r,k)=>{
    r.querySelector(".mc-loai").onchange=e=>{const cur=readMCRows();cur[k]={loai:e.target.value,so:"",ngay:cur[k].ngay};drawMCRows(cur);const n=document.querySelectorAll("#mcRows .mcr")[k].querySelector(".mc-so,.dp-txt");if(n)n.focus()};
    r.querySelector(".mc-del").onclick=()=>{const cur=readMCRows();cur.splice(k,1);drawMCRows(cur.length?cur:[{}])};
    const so=r.querySelector(".mc-so");const vb=vbOf(r.querySelector(".mc-loai").value);
    if(so&&vb&&vb.duoi)so.addEventListener("input",e=>e.target.value=e.target.value.replace(/[^\d.]/g,""));
  });
  document.querySelectorAll("#mcRows input[type=date]").forEach(enhanceDate);
}
$("#mcAdd").onclick=()=>{const cur=readMCRows();cur.push({});drawMCRows(cur);const s=[...document.querySelectorAll("#mcRows .mc-loai")].pop();s.focus()};
function openMC(p,i,done){
  const c=p.cv[i];
  mcCtx={p,i,done};
  $("#mcTen").textContent=`Bước ${i+1}: ${c.ten}`;
  const old=((c.mc&&c.mc.items)||[]).filter(x=>x.loai);
  drawMCRows(old.length?old.map(x=>({loai:x.loai,so:x.so,ngay:x.ngay})):[{}]);
  $("#mcNgay").value=(c.mc&&c.mc.ngay)||TODAY; $("#mcGc").value=(c.mc&&c.mc.gc)||"";
  $("#mcErr").hidden=true; $("#dlgMC").showModal(); $("#mcRows .mc-loai").focus();
}
$("#mcX").onclick=$("#mcCancel").onclick=()=>$("#dlgMC").close();
$("#frmMC").onsubmit=e=>{
  e.preventDefault(); const {p,i,done}=mcCtx; const er=$("#mcErr"); const fail=m=>{er.textContent=m;er.hidden=false};
  const rows=readMCRows().filter(x=>x.loai);
  if(!rows.length)return fail("Chọn ít nhất một loại văn bản làm minh chứng.");
  for(const x of rows){const vb=vbOf(x.loai);
    if(vb.so!==false&&!x.so)return fail(`Chưa điền số cho ${vb.ten}.`);
    if(!x.ngay)return fail(`Chưa chọn ngày cho ${vb.ten}.`);}
  const items=rows.map(x=>{const vb=vbOf(x.loai);return {loai:x.loai,ten:vb.ten,so:x.so,ngay:x.ngay,v:x.so||x.ngay,hien:mcText(vb,x.so,x.ngay)}});
  p.cv[i].xong=true; p.cv[i].mc={items,ngay:$("#mcNgay").value||TODAY,gc:$("#mcGc").value.trim()};
  $("#dlgMC").close(); toast("Đã hoàn thành: "+p.cv[i].ten); done();
};

function viewDetail(id){
  const p=data.find(x=>x.id===id);
  if(!p){$("#view").innerHTML=`<a class="back" href="#chuong-trinh">← Danh sách</a><div class="empty">Không tìm thấy chương trình.</div>`;return}
  const cvDone=p.cv.filter(c=>c.xong).length;
  $("#view").innerHTML=`
  <a class="back" href="#chuong-trinh">← Danh sách chương trình</a>
  <div class="head"><div style="min-width:0"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">${pill(p.tt)}<span class="tag">${LOAI[p.loai]}</span></div><h1>${esc(p.ten)}</h1><p class="sub">${range(p)}${p.diaDiem?" · "+esc(p.diaDiem):""}</p></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="openForm(${p.id})">Sửa</button>${IS_OWNER?'<button class="btn danger" id="delBtn">Xóa</button>':""}</div></div>
  <div id="delBox"></div>
  <div class="tabs">
    <button data-t="info">Thông tin</button><button data-t="cv">Công việc (${cvDone}/${p.cv.length})</button>
  </div>
  <div id="tab"></div>`;
  if($("#delBtn"))$("#delBtn").onclick=()=>{$("#delBox").innerHTML=`<div class="confirm">Chuyển chương trình này vào Thùng rác? Có thể khôi phục lại sau. <button class="btn sm danger" id="delYes">Xóa</button><button class="btn sm" id="delNo">Giữ lại</button></div>`;
    $("#delYes").onclick=()=>{const x=data.find(x=>x.id===id);if(!x)return;x.daXoa=true;x.ngayXoa=TODAY;data=data.filter(y=>y!==x);trash.push(x);save();toast("Đã chuyển vào Thùng rác");location.hash="chuong-trinh"};$("#delNo").onclick=()=>$("#delBox").innerHTML=""};
  document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{detailTab=b.dataset.t;drawTab()});
  function drawTab(){
    document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("on",b.dataset.t===detailTab));
    const t=$("#tab");
    if(detailTab==="info"){
      t.innerHTML=`<div class="grid2"><div class="panel"><dl class="facts">
        <div><dt>Ngành hàng</dt><dd>${esc(p.nganh)||"—"}</dd></div><div><dt>Thị trường</dt><dd>${esc(p.thiTruong)||"—"}</dd></div><div><dt>Nguồn kinh phí</dt><dd>${esc(p.nguon)||"—"}</dd></div>
        <div><dt>Chuyên viên phụ trách</dt><dd>${cvNames(p.chuyenVien).map(n=>`<div>${esc(n)}</div>`).join("")||"—"}</dd></div><div><dt>Lãnh đạo phụ trách</dt><dd>${esc(ldName(p.lanhDao))||"—"}</dd></div>
        <div><dt>Thời gian</dt><dd class="num">${range(p)}</dd></div><div><dt>Chỉ tiêu</dt><dd>${p.toiDa||"—"} doanh nghiệp</dd></div>
      </dl>${p.ghiChu?`<p style="margin:16px 0 0;padding-top:14px;border-top:1px solid var(--line)"><span class="t-meta">Ghi chú:</span> ${esc(p.ghiChu)}</p>`:""}</div>
      <div class="panel"><h2>Kinh phí</h2>
        <div class="row-stat" style="grid-template-columns:90px 1fr"><span class="t-meta">Dự kiến</span><span class="num" style="text-align:right">${money(p.kinhPhi)} đ</span></div>
        <div class="row-stat" style="grid-template-columns:120px 1fr"><span class="t-meta">Nguồn thu về ITPC</span><span class="num" style="text-align:right;color:var(--ok)">${money(p.thuITPC)} đ</span></div>
        <h2 style="margin-top:22px;margin-bottom:0">Doanh nghiệp đăng ký</h2>
        <div class="counter"><div class="big" id="dnBig"></div>
          <div class="stepper"><button type="button" id="dnMinus" aria-label="Bớt 1 doanh nghiệp">−</button><input id="dnIn" inputmode="numeric" aria-label="Số doanh nghiệp đã đăng ký"><button type="button" id="dnPlus" aria-label="Thêm 1 doanh nghiệp">+</button></div></div>
        <div class="bar" style="margin-top:12px"><i id="dnBar"></i></div><p class="t-meta" id="dnNote" style="margin:6px 0 0"></p>
        <h2 style="margin-top:24px;margin-bottom:0">Tiến độ công việc</h2>
        ${(()=>{const n=p.cv.length,xong=p.cv.filter(c=>c.xong).length;if(!n)return `<p class="t-meta" style="margin:6px 0 0">Chưa có công việc. <a href="#ct-${p.id}" onclick="detailTab='cv'" style="color:var(--brand)">Thêm công việc</a></p>`;
          let last=-1;p.cv.forEach((c,k)=>{if(c.xong)last=k});const next=p.cv.findIndex(c=>!c.xong);const pct=Math.round(xong/n*100);
          const lc=last>=0?p.cv[last]:null;
          return `<div class="counter"><div class="big">${pct}<small>%</small></div><span class="t-meta">${xong}/${n} bước đã xong</span></div>
          <div class="bar" style="margin-top:12px"><i style="width:${pct}%;background:${pct===100?"var(--ok)":"var(--brand)"}"></i></div>
          <dl style="margin:12px 0 0;display:grid;gap:10px">
            <div><dt class="t-meta" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Đã hoàn thành đến</dt><dd style="margin:2px 0 0;font-weight:600;color:var(--ok)">${lc?`Bước ${last+1}: ${esc(lc.ten)}${lc.ngayXong?` <span class="t-meta" style="font-weight:400">· ${d(lc.ngayXong)}</span>`:""}`:'<span class="t-meta" style="font-weight:400">Chưa có bước nào hoàn thành</span>'}</dd></div>
            ${next>=0?`<div><dt class="t-meta" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Bước tiếp theo</dt><dd style="margin:2px 0 0;font-weight:500">Bước ${next+1}: ${esc(p.cv[next].ten)}${p.cv[next].han?` <span class="pill ${p.cv[next].han<TODAY?"s-huy":"s-kh"}">${p.cv[next].han<TODAY?"Quá hạn":"Hạn"} ${d(p.cv[next].han)}</span>`:""}</dd></div>`:`<div><dd style="margin:0;font-weight:600;color:var(--ok)">Đã hoàn thành tất cả công việc</dd></div>`}
          </dl>`})()}
      </div></div>`;
      const setDN=(n,persist)=>{n=Math.max(0,Math.min(99999,n|0));p.soDN=n;
        const pct=p.toiDa?Math.round(n/p.toiDa*100):0;
        $("#dnBig").innerHTML=`${n}<small> / ${p.toiDa||"–"}</small>`;$("#dnIn").value=n;
        $("#dnBar").style.width=Math.min(100,pct)+"%";
        $("#dnNote").textContent=p.toiDa?(n>=p.toiDa?`Đã đủ chỉ tiêu${n>p.toiDa?` (vượt ${n-p.toiDa})`:""}`:`Đạt ${pct}% chỉ tiêu · còn ${p.toiDa-n} chỗ`):"Chưa đặt chỉ tiêu. Bấm Sửa để nhập số doanh nghiệp tối đa.";
        if(persist){save();clearTimeout(setDN.t);setDN.t=setTimeout(()=>toast("Đã cập nhật số doanh nghiệp"),600)}};
      $("#dnMinus").onclick=()=>setDN((p.soDN||0)-1,true);
      $("#dnPlus").onclick=()=>setDN((p.soDN||0)+1,true);
      $("#dnIn").onchange=e=>setDN(parseNum(e.target.value),true);
      setDN(p.soDN||0,false);
    } else {
      const mau=mauCho(p.loai)||CV_MAU.tl_hc;
      const thieu=mau.filter(m=>!p.cv.some(c=>c.ten===m));
      const done=p.cv.filter(c=>c.xong).length;
      const tag=(c)=>c.xong?`<span class="pill s-ht" style="flex:none">Xong</span>`:!c.han?"":c.han<TODAY?`<span class="pill s-huy" style="flex:none">Quá hạn</span>`:c.han<=addDays(TODAY,7)?`<span class="pill s-cb" style="flex:none">Sắp đến hạn</span>`:"";
      const isTL=!!mauCho(p.loai);
      t.innerHTML=`<div class="panel">
      ${thieu.length?`<div class="tpl-box"><p>${p.cv.length?`Còn <b>${thieu.length}</b> bước trong danh sách công việc chuẩn ${isTL?"của Triển lãm/Hội chợ ":""}chưa có ở đây.`:`Áp dụng danh sách <b>${mau.length} công việc chuẩn</b> ${isTL?"của Triển lãm/Hội chợ":"(theo quy trình Triển lãm/Hội chợ)"} để khỏi nhập tay.`}</p><button class="btn pri sm" id="cvTpl" type="button">${p.cv.length?"Thêm các bước còn thiếu":"Áp dụng danh sách chuẩn"}</button></div>`:""}
      ${p.cv.length?`<div class="progress-line"><div class="bar" style="flex:1"><i style="width:${done/p.cv.length*100}%"></i></div><span class="num">${done}/${p.cv.length} xong</span></div>`:""}
      <div id="cvList">${p.cv.map((c,i)=>`<div class="task ${c.xong?"done":""}" data-i="${i}">
        <button type="button" class="drag" aria-label="Kéo để đổi chỗ (hoặc dùng phím mũi tên lên/xuống)" title="Kéo để đổi chỗ"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>
        <span class="no">${i+1}.</span>
        <div class="task-main"><div class="tn">${esc(c.ten)}</div>
          ${false?`<div class="mc-list">${c.mc.items.filter(x=>x.v!==""&&x.v!==false).map(x=>`<span class="mc-chip">${esc(x.ten)}: <b>${esc(x.hien)}</b></span>`).join("")}${c.mc.gc?`<span class="mc-chip" style="background:var(--bg);color:var(--muted)">${esc(c.mc.gc)}</span>`:""}</div>`:""}</div>
        ${c.xong?`<span class="pill s-ht" style="flex:none">Xong ${c.ngayXong?d(c.ngayXong):c.mc&&c.mc.ngay?d(c.mc.ngay):""}</span>`:tag(c)}
        ${c.xong?"":`<input type="date" class="han" data-i="${i}" value="${c.han||""}" aria-label="Hạn hoàn thành" title="Hạn hoàn thành">`}
        ${c.autoHan&&!c.xong&&c.han?`<span class="t-meta" style="font-size:11.5px;flex:none" title="Hạn tự tính theo ngày diễn ra chương trình. Sửa ngày nếu cần.">tự động</span>`:""}
        ${c.xong?`<button type="button" class="btn sm" data-undo="${i}">Mở lại</button>`:`<button type="button" class="btn sm ok" data-mc="${i}">✓ Hoàn thành</button>`}
        <button class="btn sm danger cvX" data-i="${i}">Bỏ</button></div>`).join("")||'<div class="empty">Chưa có công việc.</div>'}</div>
      <form class="inline-add" id="cvAdd"><input id="cvT" placeholder="Thêm công việc khác…"><select id="cvPos" style="flex:0 1 190px" aria-label="Vị trí thêm"><option value="end">Thêm vào cuối</option><option value="0">Thêm lên đầu</option>${p.cv.map((c,i)=>`<option value="${i+1}">Sau bước ${i+1}</option>`).join("")}</select><input id="cvH" type="date" style="flex:0 1 170px" aria-label="Hạn hoàn thành"><button class="btn pri">Thêm công việc</button></form></div>`;
      const re=()=>{save();viewDetail(id)};
      if($("#cvTpl"))$("#cvTpl").onclick=()=>{chenBuocMau(p,mau);toast(`Đã thêm ${thieu.length} công việc`);re()};
      t.querySelectorAll("[data-mc]").forEach(b=>b.onclick=()=>{const c=p.cv[+b.dataset.mc];c.xong=true;c.ngayXong=TODAY;toast("Đã hoàn thành: "+c.ten);re()});
      t.querySelectorAll(".task .han").forEach(c=>c.onchange=()=>{const x=p.cv[c.dataset.i];x.han=c.value;x.autoHan=false;re()});
      t.querySelectorAll("[data-undo]").forEach(b=>b.onclick=()=>{p.cv[b.dataset.undo].xong=false;toast("Đã mở lại công việc");re()});
      const list=$("#cvList");
      const applyOrder=()=>{const order=[...list.querySelectorAll(".task")].map(x=>+x.dataset.i);if(order.some((v,k)=>v!==k)){const old=p.cv.slice();p.cv=order.map(k=>old[k]);re()}};
      list.querySelectorAll(".drag").forEach(h=>{
        h.onpointerdown=e=>{if(e.button)return;e.preventDefault();const row=h.closest(".task");row.classList.add("dragging");document.body.classList.add("is-dragging");
          const move=ev=>{const others=[...list.querySelectorAll(".task:not(.dragging)")];const after=others.find(o=>{const b=o.getBoundingClientRect();return ev.clientY<b.top+b.height/2});
            if(after){if(after!==row.nextElementSibling)list.insertBefore(row,after)}else if(row!==list.lastElementChild)list.appendChild(row);
            if(ev.clientY<50)scrollBy(0,-14);else if(ev.clientY>innerHeight-50)scrollBy(0,14)};
          const end=()=>{document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",end);document.removeEventListener("pointercancel",end);
            row.classList.remove("dragging");document.body.classList.remove("is-dragging");applyOrder()};
          document.addEventListener("pointermove",move);document.addEventListener("pointerup",end);document.addEventListener("pointercancel",end)};
        h.onkeydown=e=>{const row=h.closest(".task");if(e.key==="ArrowUp"&&row.previousElementSibling){e.preventDefault();list.insertBefore(row,row.previousElementSibling);cvFocusItem=p.cv[+row.dataset.i];applyOrder()}
          else if(e.key==="ArrowDown"&&row.nextElementSibling){e.preventDefault();list.insertBefore(row.nextElementSibling,row);cvFocusItem=p.cv[+row.dataset.i];applyOrder()}};
      });
      if(cvFocusItem){const k=p.cv.indexOf(cvFocusItem);cvFocusItem=null;if(k>=0)list.querySelectorAll(".drag")[k].focus()}
      t.querySelectorAll(".cvX").forEach(b=>b.onclick=()=>{p.cv.splice(b.dataset.i,1);re()});
      $("#cvAdd").onsubmit=e=>{e.preventDefault();const ten=$("#cvT").value.trim();if(!ten)return;const it={ten,han:$("#cvH").value,xong:false},pos=$("#cvPos").value;if(pos==="end")p.cv.push(it);else p.cv.splice(+pos,0,it);toast(pos==="end"?"Đã thêm vào cuối danh sách":pos==="0"?"Đã thêm lên đầu danh sách":`Đã thêm sau bước ${pos}`);re()};
    }
  }
  if(!["info","cv"].includes(detailTab))detailTab="info";
  drawTab();
}

/* Form thêm / sửa */
$("#f-loai").innerHTML=Object.entries(LOAI).map(([k,v])=>`<option value="${k}">${v}</option>`).join("");
$("#f-tt").innerHTML=Object.entries(TT).filter(([k])=>k!=="dr").map(([k,v])=>`<option value="${k}">${v}</option>`).join("");
$("#f-nganh").innerHTML=`<option value="">— Chưa xác định —</option><option>Đa ngành</option>`+NGANH.filter(n=>n!=="Đa ngành"&&!NGANH_DN.includes(n)).map(n=>`<option>${n}</option>`).join("");
$("#f-nguon").innerHTML=`<option value="">— Chưa xác định —</option>`+NGUON.map(v=>`<option>${v}</option>`).join("");
let formCV=[];
function drawCV(){
  $("#f-cv-chips").innerHTML=formCV.map(tk=>`<span class="chip">${esc(cvName(tk))}<button type="button" data-tk="${tk}" aria-label="Bỏ ${esc(cvName(tk))}">×</button></span>`).join("")||'<span class="t-meta" style="font-weight:400">Chưa chọn chuyên viên nào</span>';
  $("#f-cv-chips").querySelectorAll("button").forEach(b=>b.onclick=()=>{formCV=formCV.filter(x=>x!==b.dataset.tk);drawCV()});
  const left=CHUYEN_VIEN.filter(c=>!formCV.includes(c.tk));
  $("#f-cv-add").innerHTML=`<option value="">${left.length?"+ Thêm chuyên viên…":"Đã chọn đủ cả phòng"}</option>`+left.map(c=>`<option value="${c.tk}">${c.ten} (${c.tk})</option>`).join("");
}
$("#f-cv-add").onchange=e=>{if(e.target.value){formCV.push(e.target.value);drawCV()}};
$("#f-ld").innerHTML='<option value="">— Chọn lãnh đạo —</option>'+LANH_DAO.map(c=>`<option value="${c.tk}">${c.ten} – ${c.cv}</option>`).join("");
const words=s=>s.trim()?s.trim().split(/\s+/).length:0;
["#f-kp","#f-thu"].forEach(s=>$(s).addEventListener("input",e=>{const n=parseNum(e.target.value);e.target.value=n?money(n):""}));
let editId=null;
function openForm(id){
  if(RO)return;
  editId=id??null; const p=data.find(x=>x.id===id)||{loai:"hc",ttGoc:"xyk",nguon:""};
  $("#dlgTitle").textContent=id?"Sửa chương trình":"Thêm chương trình";
  $("#f-ten").value=p.ten||"";$("#f-loai").value=p.loai;$("#f-tt").value=p.ttGoc||"xyk";$("#f-tt2").value=p.thiTruong||"";$("#f-nganh").value=p.nganh||"";$("#f-dd").value=p.diaDiem||"";
  $("#f-bd").value=p.bd||"";$("#f-kt").value=p.kt||"";$("#f-crn").checked=!!p.chuaRoNgay;formCV=(p.chuyenVien||[]).slice();drawCV();$("#f-ld").value=p.lanhDao||"";
  $("#f-kp").value=p.kinhPhi?money(p.kinhPhi):"";$("#f-thu").value=p.thuITPC?money(p.thuITPC):"";$("#f-max").value=p.toiDa||"";$("#f-sodn").value=p.soDN||"";$("#f-nguon").value=p.nguon||"";$("#f-gc").value=p.ghiChu||"";
  $("#f-err").hidden=true; $("#dlg").showModal(); $("#f-ten").focus();
}
$("#f-ten").addEventListener("input",e=>{const c=e.target.selectionStart;e.target.value=e.target.value.toLocaleUpperCase("vi");e.target.setSelectionRange(c,c)});
$("#dlgX").onclick=$("#dlgCancel").onclick=()=>$("#dlg").close();
$("#frm").onsubmit=e=>{
  e.preventDefault();const er=$("#f-err");
  const v={ten:$("#f-ten").value.trim().toLocaleUpperCase("vi"),loai:$("#f-loai").value,ttGoc:$("#f-tt").value,thiTruong:$("#f-tt2").value.trim(),nganh:$("#f-nganh").value,diaDiem:$("#f-dd").value.trim(),bd:$("#f-bd").value,kt:$("#f-kt").value,chuyenVien:formCV.slice(),lanhDao:$("#f-ld").value,kinhPhi:parseNum($("#f-kp").value),thuITPC:parseNum($("#f-thu").value),toiDa:parseNum($("#f-max").value),soDN:parseNum($("#f-sodn").value),nguon:$("#f-nguon").value,ghiChu:$("#f-gc").value.trim()};
  if(!v.ten){er.textContent="Nhập tên chương trình.";er.hidden=false;return}
  v.chuaRoNgay=$("#f-crn").checked;
  if(v.chuaRoNgay){if(!v.bd){er.textContent="Chọn một ngày bất kỳ trong tháng dự kiến ở ô Ngày bắt đầu.";er.hidden=false;return}
    const y=+v.bd.slice(0,4),m=+v.bd.slice(5,7)-1;v.bd=isoOf(y,m,1);v.kt=isoOf(y,m,new Date(y,m+1,0).getDate());}
  if(!v.bd||!v.kt){er.textContent="Chọn ngày bắt đầu và ngày kết thúc.";er.hidden=false;return}
  if(v.kt<v.bd){er.textContent="Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.";er.hidden=false;return}
  if(editId){const x=data.find(x=>x.id===editId);Object.assign(x,v);capNhatHanTuDong(x)}else{editId=Math.max(0,...allProgs().map(x=>x.id))+1;const x={id:editId,cv:[],...v};x.cv=(mauCho(v.loai)||[]).map(ten=>newTask(x,ten));data.push(x)}
  save();$("#dlg").close();toast("Đã lưu chương trình");
  if(location.hash==="#ct-"+editId)route();else location.hash="ct-"+editId;
};
document.querySelectorAll("input[type=date]").forEach(enhanceDate);

/* ===== Dữ liệu dùng chung ===== */
let DB=null, RO=false, lastJ={programs:{},doanhnghiep:{}}, pendingRender=false;
const strip=o=>{const c={...o};delete c.tt;return c};
const jOf=o=>JSON.stringify(strip(o));
const queues={};
function writeDoc(col,id,body){const k=col+"/"+id;queues[k]=(queues[k]||Promise.resolve()).then(()=>body?DB.collection(col).doc(String(id)).set(body):DB.collection(col).doc(String(id)).delete()).catch(e=>{if(e&&e.code==="invalid_argument"){setRO(true)}else if(e&&e.code==="quota_exceeded")toast("Dữ liệu chung đã đầy, không lưu thêm được");else toast("Chưa lưu được lên dữ liệu chung, thử lại sau")});return queues[k]}
function pushCol(col,arr){if(!DB||RO)return;const seen=new Set();
  arr.forEach(o=>{const id=String(o.id),j=jOf(o);seen.add(id);if(lastJ[col][id]!==j){lastJ[col][id]=j;writeDoc(col,id,JSON.parse(j))}});
  Object.keys(lastJ[col]).forEach(id=>{if(!seen.has(id)){delete lastJ[col][id];writeDoc(col,id,null)}})}
function syncPush(){pushCol("programs",allProgs());pushCol("doanhnghiep",allDN())}
function setNote(html){const n=$("#syncNote");if(n)n.innerHTML=html}
function setRO(v){RO=v;document.body.classList.toggle("ro",v);if(v)setNote('<span class="sync-dot"></span><strong>Chế độ xem.</strong> Dữ liệu chung của phòng, cập nhật trực tiếp.')}
function safeRender(){if(document.querySelector("dialog[open]")||document.body.classList.contains("is-dragging")||dpOpen||document.activeElement&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&document.activeElement.closest("#view .toolbar,.inline-add")){pendingRender=true;return}pendingRender=false;const y=scrollY;route();scrollTo(0,y)}
document.addEventListener("close",()=>{if(pendingRender)setTimeout(safeRender,50)},true);
(async()=>{
  const timer=setTimeout(()=>setNote('<span class="sync-dot off"></span>Chưa kết nối được dữ liệu chung, đang dùng dữ liệu trên máy này.'),10000);
  const db=await (window.claude?.use?.("db")||Promise.resolve(null)).catch(()=>null);
  if(!db){IS_OWNER=true;safeRender();clearTimeout(timer);setNote('<span class="sync-dot off"></span>Dữ liệu chỉ lưu trên trình duyệt này (chưa đăng nhập hoặc không kết nối được dữ liệu chung).');return}
  const user=await (window.claude.use("user")).catch(()=>null);
  const canW=user?await user.can("data.write").catch(()=>null):null;
  IS_OWNER=user?await user.isOwner().catch(()=>false):false;
  DB=db; if(canW===false)setRO(true);
  let first={programs:true,doanhnghiep:true};
  const listen=(col,apply)=>db.collection(col).onSnapshot(snap=>{
    if(snap.metadata.fromCache&&first[col])return;
    clearTimeout(timer);
    if(first[col]){first[col]=false;
      if(snap.empty&&!RO){const arr=col==="programs"?allProgs():allDN();lastJ[col]={};pushCol(col,arr);
        if(!RO)setNote('<span class="sync-dot"></span><strong>Dữ liệu chung.</strong> Đã đưa dữ liệu trên máy này lên cho cả phòng.');return}}
    const arr=snap.docs.map(d=>JSON.parse(JSON.stringify(d.data())));
    lastJ[col]={};arr.forEach(o=>lastJ[col][String(o.id)]=jOf(o));
    apply(arr);
    if(!RO)setNote('<span class="sync-dot"></span><strong>Dữ liệu chung.</strong> Mọi người được chia sẻ đều thấy cùng dữ liệu, cập nhật trực tiếp.');
    try{localStorage.setItem(col==="programs"?KEY:DKEY,JSON.stringify(col==="programs"?allProgs():allDN()))}catch(e){}
    safeRender();
  },e=>{clearTimeout(timer);setNote('<span class="sync-dot off"></span>Mất kết nối dữ liệu chung. Tải lại trang để thử lại.')});
  listen("programs",arr=>{const all=arr.map(normalize).sort((a,b)=>a.id-b.id);data=all.filter(p=>!p.daXoa);trash=all.filter(p=>p.daXoa)});
  listen("doanhnghiep",arr=>{const all=arr.sort((a,b)=>a.id-b.id);dnData=all.filter(x=>!x.daXoa);dnTrash=all.filter(x=>x.daXoa)});
})();
/* ===== Xuất Excel ===== */
let DL=null;
(async()=>{DL=await (window.claude?.use?.("downloads")||Promise.resolve(null)).catch(()=>null);if(DL)$("#xlsBtn").hidden=false})();
function loadXLSX(){return window.XLSX?Promise.resolve():new Promise((ok,no)=>{const sc=document.createElement("script");sc.src="vendor/xlsx.full.min.js";sc.onload=ok;sc.onerror=no;document.head.appendChild(sc)})}
$("#xlsBtn").onclick=async()=>{
  const b=$("#xlsBtn");b.disabled=true;
  try{
    await loadXLSX();data.forEach(syncTT);
    const ct=[...data].sort((a,b)=>a.bd.localeCompare(b.bd)).map(p=>{const xong=p.cv.filter(c=>c.xong).length;return {
      "STT":p.id,"Tên chương trình":p.ten,"Loại hình":LOAI[p.loai]||"","Ngành hàng":p.nganh||"","Trạng thái":TT[p.tt]||"",
      "Thời gian":range(p),"Ngày bắt đầu":p.chuaRoNgay?"":d(p.bd),"Ngày kết thúc":p.chuaRoNgay?"":d(p.kt),
      "Thị trường / Quốc gia":p.thiTruong||"","Địa điểm":p.diaDiem||"","Chuyên viên phụ trách":cvNames(p.chuyenVien).join(", "),
      "Lãnh đạo phụ trách":ldName(p.lanhDao),"Nguồn kinh phí":p.nguon||"","Kinh phí dự kiến (đồng)":+p.kinhPhi||0,"Nguồn thu về ITPC (đồng)":+p.thuITPC||0,
      "DN đã đăng ký":+p.soDN||0,"Chỉ tiêu DN":+p.toiDa||0,"Công việc đã xong":p.cv.length?`${xong}/${p.cv.length}`:"","Tiến độ (%)":p.cv.length?Math.round(xong/p.cv.length*100):"","Ghi chú":p.ghiChu||""}});
    const cv=[];[...data].sort((a,b)=>a.bd.localeCompare(b.bd)).forEach(p=>p.cv.forEach((c,i)=>cv.push({"Chương trình":p.ten,"Bước":i+1,"Công việc":c.ten,"Hạn hoàn thành":c.han?d(c.han):"","Trạng thái":c.xong?"Hoàn thành":(c.han&&c.han<TODAY?"Quá hạn":"Chưa xong"),"Ngày hoàn thành":c.xong&&c.ngayXong?d(c.ngayXong):""})));
    const dn=dnData.map((x,i)=>({"STT":i+1,"Tên doanh nghiệp":x.ten||"","Mã số thuế":x.mst||"","Ngành hàng":x.nganh||"","Sản phẩm / dịch vụ":x.sp||"","Quốc gia":x.qg||"","Địa chỉ":x.dc||"","Website":x.web||"","Người liên hệ":x.nlh||"","Chức vụ":x.cv||"","Số điện thoại":x.sdt||"","Email":x.email||"","Người liên hệ khác":(x.lienHeKhac||[]).map(l=>[l.nlh,l.cv,l.sdt,l.email].filter(Boolean).join(" – ")).join("\n"),"Ghi chú":x.ghiChu||""}));
    const wb=XLSX.utils.book_new();
    const add=(rows,name,w)=>{const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{"(Chưa có dữ liệu)":""}]);ws["!cols"]=w.map(n=>({wch:n}));XLSX.utils.book_append_sheet(wb,ws,name)};
    add(ct,"Chương trình",[5,45,20,18,16,26,13,13,18,22,40,30,36,18,18,12,10,14,10,30]);
    add(cv,"Công việc",[45,6,60,14,12,14]);
    add(dn,"Doanh nghiệp",[5,50,16,20,30,12,60,30,28,20,32,30,60,40]);
    const buf=XLSX.write(wb,{bookType:"xlsx",type:"array"});
    await DL.save({filename:`QLCT-ITPC_${TODAY}.xlsx`,data:buf});
    toast("Đã tải file Excel");
  }catch(e){if(!e||e.code!=="declined")toast(e&&e.code==="unavailable"?"Trang này chưa tải được file trong chế độ xem hiện tại":"Chưa xuất được file Excel, thử lại sau")}
  finally{b.disabled=false}
};
route();
