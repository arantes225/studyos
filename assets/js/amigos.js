const friendsSb=window.supabaseClient;
let friendsUser=null;

function fEsc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function setFriendsStatus(text,type=""){const el=document.getElementById("friends-status");if(!el)return;el.textContent=text;el.className="friends-status "+type;}

async function loadOwnId(){
  const {data,error}=await friendsSb.from("profiles").select("luria_id").eq("user_id",friendsUser.id).maybeSingle();
  if(error) throw error;
  document.getElementById("my-luria-id").textContent=data?.luria_id||"—";
}

async function loadFriends(){
  const {data,error}=await friendsSb.rpc("my_friends");
  if(error) throw error;
  const host=document.getElementById("friends-list");
  const rows=data||[];
  host.innerHTML=rows.length?rows.map(friend=>`
    <div class="friend-row">
      <div class="friend-main">
        <span class="friend-avatar">${fEsc((friend.display_name||"U").charAt(0).toUpperCase())}</span>
        <span class="friend-copy">
          <strong>${fEsc(friend.display_name||"Usuário LURIA")}</strong>
          <small>ID ${fEsc(friend.luria_id||"")}${friend.specialty?" · "+fEsc(friend.specialty):""}</small>
        </span>
      </div>
      <div class="friends-actions">
        <button class="button secondary" type="button" data-remove-friend="${fEsc(friend.user_id)}">Remover</button>
      </div>
    </div>`).join(""):'<div class="friends-empty">Nenhum amigo adicionado ainda.</div>';

  host.querySelectorAll("[data-remove-friend]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!confirm("Remover esta pessoa da sua lista de amigos?"))return;
    const {error}=await friendsSb.rpc("remove_friend",{p_friend_user_id:btn.dataset.removeFriend});
    if(error){setFriendsStatus(error.message,"error");return;}
    await loadFriends();
    setFriendsStatus("Amigo removido.","success");
  }));
}

async function loadInbox(){
  const {data,error}=await friendsSb.rpc("my_direct_shares");
  if(error) throw error;
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
        const {error}=await friendsSb.rpc("redeem_flashcard_deck_share",{p_token:btn.dataset.token});
        if(error)throw error;
      }else{
        const personalize=confirm("Deseja adicionar e personalizar este caderno?\n\nOK = editar em cima\nCancelar = somente leitura");
        const {error}=await friendsSb.rpc("redeem_study_note_bundle_share",{p_token:btn.dataset.token,p_mode:personalize?"overlay":"view"});
        if(error)throw error;
      }
      await friendsSb.from("direct_shares").update({opened_at:new Date().toISOString()}).eq("id",btn.dataset.openShare);
      setFriendsStatus("Material adicionado à sua biblioteca.","success");
      await loadInbox();
    }catch(error){console.error(error);setFriendsStatus(error.message||"Não foi possível adicionar.","error");}
    finally{btn.disabled=false;}
  }));
}

async function addFriend(){
  const input=document.getElementById("friend-id-input");
  const value=input.value.trim().toUpperCase();
  if(!value){setFriendsStatus("Digite o ID LURIA.","error");return;}
  const button=document.getElementById("add-friend");
  button.disabled=true;
  try{
    const {error}=await friendsSb.rpc("add_friend_by_luria_id",{p_luria_id:value});
    if(error)throw error;
    input.value="";
    await loadFriends();
    setFriendsStatus("Pessoa adicionada aos amigos.","success");
  }catch(error){console.error(error);setFriendsStatus(error.message||"Não foi possível adicionar.","error");}
  finally{button.disabled=false;}
}

async function initFriends(){
  friendsUser=window.docmapUser;
  if(!friendsUser)return;
  document.getElementById("add-friend")?.addEventListener("click",addFriend);
  document.getElementById("friend-id-input")?.addEventListener("keydown",e=>{if(e.key==="Enter")addFriend();});
  document.getElementById("copy-my-id")?.addEventListener("click",async()=>{
    const id=document.getElementById("my-luria-id").textContent.trim();
    try{await navigator.clipboard.writeText(id);setFriendsStatus("Seu ID LURIA foi copiado.","success");}
    catch{prompt("Copie seu ID LURIA:",id);}
  });
  try{await Promise.all([loadOwnId(),loadFriends(),loadInbox()]);}
  catch(error){console.error(error);setFriendsStatus(error.message||"Não foi possível carregar Amigos.","error");}
}
if(window.docmapUser)initFriends();else window.addEventListener("docmap:ready",initFriends,{once:true});