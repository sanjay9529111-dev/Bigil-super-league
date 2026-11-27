import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getDatabase, ref, onValue, set, push, get, runTransaction, update } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { firebaseConfig, ADMIN_UID, TEAM_NAMES } from "./firebase-config.js";

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getDatabase(app);
const $ = id => document.getElementById(id);
let user=null, teamId=null, isAdmin=false, state={};
const retentionFees={1:18,2:12,3:8,4:8};
const teamsRef=ref(db,"teams"), playersRef=ref(db,"players"), auctionRef=ref(db,"auction");

$("loginBtn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value);$("loginMsg").textContent="Login successful";}catch(e){$("loginMsg").textContent=e.message;}};
$("logoutBtn").onclick=()=>signOut(auth);
onAuthStateChanged(auth,async u=>{
 user=u; $("login").hidden=!!u; $("app").hidden=!u;
 if(!u)return;
 isAdmin=u.uid===ADMIN_UID;
 const ownerSnap=await get(ref(db,`owners/${u.uid}`)); teamId=ownerSnap.exists()?ownerSnap.val().teamId:null;
 $("who").textContent=isAdmin?"ADMIN":(teamId?`${teamId} OWNER`:"Account not assigned to a team");
 $("adminPanel").hidden=!isAdmin; $("adminAuction").hidden=!isAdmin;
 $("bidBtn").disabled=!teamId||isAdmin;
 if(isAdmin){$("retTeam").innerHTML=TEAM_NAMES.map(t=>`<option>${t}</option>`).join("");}
 subscribe();
});
function subscribe(){
 onValue(teamsRef,s=>{state.teams=s.val()||{};renderTeams();});
 onValue(playersRef,s=>{state.players=s.val()||{};renderPlayers();});
 onValue(auctionRef,s=>{state.auction=s.val()||{};renderAuction();});
}
function renderTeams(){
 $("teams").innerHTML=TEAM_NAMES.map(t=>{let x=state.teams[t]||{purse:120,squad:0};return `<div class="team"><b>${t}</b><small>₹${Number(x.purse??120).toFixed(2)} Cr left<br>${x.squad||0}/15 players</small></div>`}).join("");
}
function renderPlayers(){
 const list=Object.entries(state.players).filter(([id,p])=>p.status==="available");
 $("players").innerHTML=list.length?list.map(([id,p])=>`<div class="player"><div><b>${esc(p.name)}</b><br><small>${esc(p.role||"")}</small></div><span>₹${Number(p.basePrice||0).toFixed(2)} Cr</span></div>`).join(""):"No available players";
}
function renderAuction(){
 const a=state.auction||{};
 const p=a.playerId?state.players[a.playerId]:null;
 $("currentPlayer").textContent=p?`${p.name} · ${p.role||""}`:"No player is currently up for auction.";
 $("bidAmount").textContent=`₹${Number(a.currentBid||0).toFixed(2)} Cr`;
 $("bidTeam").textContent=a.currentTeamId?`${a.currentTeamId} leading`:"No bids yet";
 $("bidBtn").disabled=!teamId||!p||isAdmin||p.status!=="auction";
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("addPlayerBtn").onclick=async()=>{
 const name=$("playerName").value.trim(),base=Number($("basePrice").value);
 if(!name||!(base>0))return alert("Enter player name and valid base price.");
 await push(playersRef,{name,role:$("playerRole").value,basePrice:base,status:"available"});
 $("playerName").value="";alert("Player added.");
};
$("retainBtn").onclick=async()=>{
 const team=$("retTeam").value,order=Number($("retOrder").value),name=$("retPlayer").value.trim();
 if(!name)return alert("Enter retained player name.");
 const fee=retentionFees[order],tref=ref(db,`teams/${team}`);
 const result=await runTransaction(tref,t=>{
  t=t||{purse:120,squad:0,retentions:{}};
  t.retentionCount=t.retentionCount||0;t.retentions=t.retentions||{};
  if(t.retentions[order])return;
  if(t.retentionCount>=4||Number(t.purse)<fee)return;
  t.purse=Number(t.purse)-fee;t.retentionCount++;t.retentions[order]={name,fee};
  return t;
 });
 if(!result.committed)alert("Retention not saved: slot already used or purse insufficient.");
 else {$("retPlayer").value="";alert("Retention recorded. Add the retained player to the squad/player records before auction.");}
};
$("bidBtn").onclick=async()=>{
 const aRef=ref(db,"auction"),snap=await get(aRef),a=snap.val()||{},p=state.players[a.playerId];
 if(!p||p.status!=="auction")return;
 const team=state.teams[teamId]||{purse:120,squad:0};
 const next=Number(a.currentBid||p.basePrice||0)+0.5;
 if(Number(team.purse)<next||Number(team.squad||0)>=15)return alert("Insufficient purse or squad full.");
 const result=await runTransaction(aRef,cur=>{
  if(!cur||cur.playerId!==a.playerId)return;
  const current=Number(cur.currentBid||p.basePrice||0);
  if(next<=current)return;
  return {...cur,currentBid:next,currentTeamId:teamId,bidderUid:user.uid};
 });
 $("auctionMsg").textContent=result.committed?"Bid placed.":"Another bid was placed first. Try again.";
};
$("nextBtn").onclick=async()=>{
 const item=Object.entries(state.players).find(([id,p])=>p.status==="available");
 if(!item)return alert("No available players.");
 const [id,p]=item;await update(ref(db,`players/${id}`),{status:"auction"});
 await set(auctionRef,{playerId:id,currentBid:Number(p.basePrice||0),currentTeamId:null,bidderUid:null});
};
$("soldBtn").onclick=async()=>{
 const a=state.auction,p=state.players[a?.playerId];if(!p||!a.currentTeamId)return alert("No leading team.");
 const team=a.currentTeamId,price=Number(a.currentBid),tref=ref(db,`teams/${team}`);
 const res=await runTransaction(tref,t=>{
  t=t||{purse:120,squad:0};if(Number(t.purse)<price||Number(t.squad||0)>=15)return;
  t.purse=Number(t.purse)-price;t.squad=Number(t.squad||0)+1;return t;
 });
 if(!res.committed)return alert("Sale failed: purse or squad limit.");
 await update(ref(db,`players/${a.playerId}`),{status:"sold",soldTo:team,soldPrice:price});
 await set(auctionRef,{playerId:null,currentBid:0,currentTeamId:null});
};
$("unsoldBtn").onclick=async()=>{const id=state.auction?.playerId;if(id)await update(ref(db,`players/${id}`),{status:"unsold"});await set(auctionRef,{playerId:null,currentBid:0,currentTeamId:null});};
