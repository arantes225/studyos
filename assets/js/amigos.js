const friendsSb=window.supabaseClient;
let friendsUser=null;
let pendingFriendLookup=null;
let friendLookupTimer=null;
let friendsRowsCache=[];

function fEsc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function setFriendsStatus(text,type=""){const el=document.getElementById("friends-status");if(!el)return;el.textContent=text;el.className="friends-status "+type;}

function renderFriendPreview(friend=null,message=""){
  const host=document.getElementById("friend-add-preview");
  if(!host)return;
  if(!friend){host.hidden=true;host.innerHTML="";if(message)setFriendsStatus(message,"error");return;}
  host.hidden=false;
  host.innerHTML=`
    <div class="friend-preview-card">
      <span class="friend-avatar">${fEsc((friend.display_name||"U").charAt(0).toUpperCase())}</span>
      <span class="friend-copy">
        <strong>${fEsc(friend.display_name||"Usuário LURIA")}</strong>
        <small>ID ${fEsc(friend.luria_id||"")}</small>
      </span>
    </div>`;
}

async function lookupFriendById(value){
  const normalized=String(value||"").trim().toUpperCase();
  pendingFriendLookup=null;
  if(normalized.length<4){renderFriendPreview();return null;}
  const {data,error}=await friendsSb.rpc("lookup_luria_user",{p_luria_id:normalized});
  if(error){console.warn(error);renderFriendPreview();return null;}
  const friend=Array.isArray(data)?data[0]:data;
  if(!friend){renderFriendPreview();return null;}
  pendingFriendLookup=friend;renderFriendPreview(friend);setFriendsStatus("");return friend;
}
function scheduleFriendLookup(value){clearTimeout(friendLookupTimer);friendLookupTimer=setTimeout(()=>lookupFriendById(value),280);}

async function loadOwnId(){
  const {data,error}=await friendsSb.from("profiles").select("luria_id").eq("user_id",friendsUser.id).maybeSingle();
  if(error)throw error;
  document.getElementById("my-luria-id").textContent=data?.luria_id||"—";
}

async function loadFriends(){
  const {data,error}=await friendsSb.rpc("my_friends");
  if(error)throw error;
  const host=document.getElementById("friends-list");
  const rows=data||[];
  friendsRowsCache=rows;
  host.innerHTML=rows.length?rows.map(friend=>`
    <div class="friend-row">
      <div class="friend-main">
        <span class="friend-avatar">${fEsc((friend.display_name||"U").charAt(0).toUpperCase())}</span>
        <span class="friend-copy">
          <strong>${fEsc(friend.display_name||"Usuário LURIA")}</strong>
          <small>ID ${fEsc(friend.luria_id||"")}</small>
        </span>
      </div>
      <div class="friends-actions">
        <button class="button secondary" type="button" data-remove-friend="${fEsc(friend.user_id)}">Remover</button>
      </div>
    </div>`).join(""):'<div class="friends-empty">Nenhum amigo adicionado ainda.</div>';

  host.querySelectorAll("[data-remove-friend]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!await window.LuriaDialog.confirm("Remover esta pessoa da sua lista de amigos?"))return;
    const {error}=await friendsSb.rpc("remove_friend",{p_friend_user_id:btn.dataset.removeFriend});
    if(error){setFriendsStatus(error.message,"error");return;}
    await loadFriends();renderStudyratsFriendOptions();setFriendsStatus("Amigo removido.","success");
  }));
  renderStudyratsFriendOptions();
}

async function loadInbox(){
  const {data,error}=await friendsSb.rpc("my_direct_shares");
  if(error)throw error;
  const host=document.getElementById("friends-inbox");
  const rows=data||[];
  host.innerHTML=rows.length?rows.map(item=>`
    <div class="inbox-row">
      <div class="inbox-main">
        <span class="friend-avatar">${fEsc((item.sender_name||"U").charAt(0).toUpperCase())}</span>
        <span class="friend-copy">
          <strong>${fEsc(item.title|| (item.resource_type==="flashcard_deck"?"Deck de Flashcards":"Caderno compartilhado"))}</strong>
          <small>De ${fEsc(item.sender_name||"Usuário LURIA")} · ID ${fEsc(item.sender_luria_id||"")}</small>
        </span>
      </div>
      <div class="friends-actions">
        <button class="button primary" type="button" data-open-share="${fEsc(item.id)}" data-type="${fEsc(item.resource_type)}" data-token="${fEsc(item.share_token)}">Adicionar</button>
      </div>
    </div>`).join(""):'<div class="friends-empty">Nenhum material recebido.</div>';

  host.querySelectorAll("[data-open-share]").forEach(btn=>btn.addEventListener("click",async()=>{
    btn.disabled=true;
    try{
      if(btn.dataset.type==="flashcard_deck"){
        const {error}=await friendsSb.rpc("redeem_flashcard_deck_share",{p_token:btn.dataset.token});if(error)throw error;
      }else{
        const {error}=await friendsSb.rpc("redeem_study_note_bundle_share",{p_token:btn.dataset.token,p_mode:"view"});if(error)throw error;
      }
      const {error:openedError}=await friendsSb.rpc("mark_direct_share_opened",{p_share_id:btn.dataset.openShare});
      if(openedError)throw openedError;
      setFriendsStatus("Material adicionado à sua biblioteca.","success");await loadInbox();
    }catch(error){console.error(error);setFriendsStatus(error.message||"Não foi possível adicionar.","error");}
    finally{btn.disabled=false;}
  }));
}

async function addFriend(){
  const input=document.getElementById("friend-id-input");
  const value=input.value.trim().toUpperCase();
  if(!value){setFriendsStatus("Digite o ID LURIA.","error");return;}
  const button=document.getElementById("add-friend");button.disabled=true;
  try{
    let friend=pendingFriendLookup;
    if(!friend||String(friend.luria_id||"").toUpperCase()!==value)friend=await lookupFriendById(value);
    if(!friend)throw new Error("ID LURIA não encontrado.");
    const {error}=await friendsSb.rpc("add_friend_by_luria_id",{p_luria_id:value});if(error)throw error;
    input.value="";pendingFriendLookup=null;renderFriendPreview();await loadFriends();
    setFriendsStatus(`${friend.display_name||"Usuário LURIA"} foi adicionado aos seus amigos.`,"success");
  }catch(error){console.error(error);setFriendsStatus(error.message||"Não foi possível adicionar.","error");}
  finally{button.disabled=false;}
}

const studyratsTypeLabels={
  flashcards:{title:"Mais flashcards",unit:"flashcards"},
  study_days:{title:"Mais dias de estudo",unit:"dias"},
  retention:{title:"Maior retenção",unit:"%"},
  classes:{title:"Mais aulas vistas",unit:"aulas"},
  ccqs:{title:"Mais CCQs respondidos",unit:"CCQs"}
};
function studyratsStorageKey(){return `luria:studyrats:${friendsUser?.id||"guest"}`;}
function getStudyrats(){try{return JSON.parse(localStorage.getItem(studyratsStorageKey())||"[]");}catch{return [];}}
function saveStudyrats(items){localStorage.setItem(studyratsStorageKey(),JSON.stringify(items));}
function mouseSvg(){
  return `<svg viewBox="0 0 72 50" aria-hidden="true">
    <path d="M13 35C6 35 4 26 9 20c5-6 16-7 25-5 5-7 14-9 21-5 8 5 8 15 3 22-6 8-18 11-30 9-6 0-10-2-15-6Z" fill="currentColor" opacity=".92"/>
    <circle cx="48" cy="11" r="7" fill="currentColor"/><circle cx="59" cy="17" r="6" fill="currentColor" opacity=".78"/>
    <circle cx="58" cy="23" r="2.1" fill="var(--surface)"/><circle cx="68" cy="28" r="2.5" fill="currentColor"/>
    <path d="M12 31C2 29 1 20 5 15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <path d="M23 40l-5 6M42 39l5 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}
function selfStudyratName(){
  return friendsUser?.user_metadata?.display_name||friendsUser?.user_metadata?.full_name||friendsUser?.email?.split("@")[0]||"Você";
}
function defaultDeadline(){
  const d=new Date();d.setDate(d.getDate()+14);return d.toISOString().slice(0,10);
}
function renderStudyratsFriendOptions(){
  const host=document.getElementById("studyrats-friends");if(!host)return;
  host.innerHTML=friendsRowsCache.length?friendsRowsCache.map(friend=>`
    <label class="studyrats-friend-option">
      <input type="checkbox" value="${fEsc(friend.user_id)}" data-name="${fEsc(friend.display_name||"Usuário LURIA")}">
      <span class="studyrats-friend-chip"><span class="friend-avatar">${fEsc((friend.display_name||"U").charAt(0).toUpperCase())}</span>${fEsc(friend.display_name||"Usuário LURIA")}</span>
    </label>`).join(""):'<span class="friends-empty">Adicione amigos para incluí-los na corrida.</span>';
}
function formatStudyratsDate(date){
  if(!date)return"Sem prazo";
  const [y,m,d]=date.split("-");return `${d}/${m}/${y}`;
}
function renderStudyrats(){
  const host=document.getElementById("studyrats-list");if(!host)return;
  const challenges=getStudyrats();
  if(!challenges.length){
    host.innerHTML='<div class="studyrats-empty"><div><strong>Nenhuma corrida ativa</strong><span>Crie um desafio, escolha seus amigos e acompanhe cada participante avançando pela pista.</span></div></div>';
    return;
  }
  host.innerHTML=challenges.map(ch=>{
    const type=studyratsTypeLabels[ch.type]||studyratsTypeLabels.flashcards;
    const ordered=[...(ch.participants||[])].sort((a,b)=>(b.value||0)-(a.value||0));
    const lanes=ordered.map((p,index)=>{
      const pct=Math.max(2,Math.min(94,ch.goal?((Number(p.value)||0)/Number(ch.goal))*92:2));
      return `<div class="studyrats-lane">
        <div class="studyrats-runner"><span class="studyrats-rank">${index+1}</span><span class="studyrats-runner-name">${fEsc(p.name)}</span></div>
        <div class="studyrats-progress"><span class="studyrats-progress-fill" style="width:${pct}%"></span><span class="studyrats-mouse" style="left:${pct}%;color:${index===0?'var(--accent)':'color-mix(in srgb,var(--text) 58%,var(--muted))'}">${mouseSvg()}</span></div>
        <div class="studyrats-score"><strong>${fEsc(p.value||0)}</strong><small>${fEsc(type.unit)}</small></div>
      </div>`;
    }).join("");
    return `<article class="studyrats-challenge">
      <div class="studyrats-challenge-head">
        <div class="studyrats-challenge-title">
          <span class="studyrats-race-badge">${mouseSvg()}</span>
          <span><strong>${fEsc(type.title)}</strong><small>${ch.participants.length} participantes · corrida ativa</small></span>
        </div>
        <div class="studyrats-challenge-meta">
          <span class="studyrats-pill">Meta: ${fEsc(ch.goal)} ${fEsc(type.unit)}</span>
          <span class="studyrats-pill">Até ${formatStudyratsDate(ch.deadline)}</span>
          <button class="studyrats-delete" type="button" aria-label="Apagar desafio" data-delete-studyrat="${fEsc(ch.id)}">×</button>
        </div>
      </div>
      <div class="studyrats-track">${lanes}</div>
      <div class="studyrats-race-footer"><span>Os ratinhos avançam conforme o progresso do desafio.</span><span>CHEGADA · ${fEsc(ch.goal)} ${fEsc(type.unit)}</span></div>
    </article>`;
  }).join("");
  host.querySelectorAll("[data-delete-studyrat]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(window.LuriaDialog?.confirm && !await window.LuriaDialog.confirm("Apagar este desafio do Studyrats?"))return;
    saveStudyrats(getStudyrats().filter(x=>x.id!==btn.dataset.deleteStudyrat));renderStudyrats();
  }));
}
function startStudyratsChallenge(){
  const type=document.getElementById("studyrats-type")?.value||"flashcards";
  const goal=Math.max(1,Number(document.getElementById("studyrats-goal")?.value)||1);
  const deadline=document.getElementById("studyrats-deadline")?.value||defaultDeadline();
  const selected=[...document.querySelectorAll("#studyrats-friends input:checked")].map(el=>({id:el.value,name:el.dataset.name,value:0}));
  const participants=[{id:friendsUser.id,name:selfStudyratName(),value:0},...selected];
  const challenges=getStudyrats();
  challenges.unshift({id:String(Date.now()),type,goal,deadline,createdAt:new Date().toISOString(),participants});
  saveStudyrats(challenges.slice(0,8));
  document.getElementById("studyrats-create").hidden=true;
  document.querySelectorAll("#studyrats-friends input:checked").forEach(el=>el.checked=false);
  renderStudyrats();
}
function initStudyrats(){
  const create=document.getElementById("studyrats-create");
  const deadline=document.getElementById("studyrats-deadline");
  if(deadline&&!deadline.value)deadline.value=defaultDeadline();
  document.getElementById("studyrats-toggle-create")?.addEventListener("click",()=>{create.hidden=!create.hidden;});
  document.getElementById("studyrats-cancel")?.addEventListener("click",()=>{create.hidden=true;});
  document.getElementById("studyrats-start")?.addEventListener("click",startStudyratsChallenge);
  renderStudyratsFriendOptions();renderStudyrats();
}

async function initFriends(){
  friendsUser=window.docmapUser;
  if(!friendsUser)return;
  document.getElementById("add-friend")?.addEventListener("click",addFriend);
  const friendInput=document.getElementById("friend-id-input");
  friendInput?.addEventListener("input",e=>{e.target.value=e.target.value.toUpperCase();scheduleFriendLookup(e.target.value);});
  friendInput?.addEventListener("keydown",e=>{if(e.key==="Enter")addFriend();});
  document.getElementById("copy-my-id")?.addEventListener("click",async()=>{
    const id=document.getElementById("my-luria-id").textContent.trim();
    try{await navigator.clipboard.writeText(id);setFriendsStatus("Seu ID LURIA foi copiado.","success");}
    catch{await window.LuriaDialog.prompt("Copie seu ID LURIA:",id);}
  });
  initStudyrats();
  try{await Promise.all([loadOwnId(),loadFriends(),loadInbox()]);}
  catch(error){console.error(error);setFriendsStatus(error.message||"Não foi possível carregar Amigos.","error");}
}
if(window.docmapUser)initFriends();else window.addEventListener("docmap:ready",initFriends,{once:true});