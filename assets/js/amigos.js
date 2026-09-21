const friendsSb=window.supabaseClient;
let friendsUser=null;
let pendingFriendLookup=null;
let friendLookupTimer=null;

function fEsc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function setFriendsStatus(text,type=""){const el=document.getElementById("friends-status");if(!el)return;el.textContent=text;el.className="friends-status "+type;}

function renderFriendPreview(friend=null,message=""){
  const host=document.getElementById("friend-add-preview");
  if(!host)return;

  if(!friend){
    host.hidden=true;
    host.innerHTML="";
    if(message){
      setFriendsStatus(message,"error");
    }
    return;
  }

  host.hidden=false;
  host.innerHTML=`
    <div class="friend-preview-card">
      <span class="friend-avatar">${fEsc((friend.display_name||"U").charAt(0).toUpperCase())}</span>
      <span class="friend-copy">
        <strong>${fEsc(friend.display_name||"Usuário LURIA")}</strong>
        <small>ID ${fEsc(friend.luria_id||"")}${friend.specialty?" · "+fEsc(friend.specialty):""}</small>
      </span>
    </div>
  `;
}

async function lookupFriendById(value){
  const normalized=String(value||"").trim().toUpperCase();
  pendingFriendLookup=null;

  if(normalized.length<4){
    renderFriendPreview();
    return null;
  }

  const {data,error}=await friendsSb.rpc("lookup_luria_user",{p_luria_id:normalized});

  if(error){
    console.warn(error);
    renderFriendPreview();
    return null;
  }

  const friend=Array.isArray(data)?data[0]:data;

  if(!friend){
    renderFriendPreview();
    return null;
  }

  pendingFriendLookup=friend;
  renderFriendPreview(friend);
  setFriendsStatus("");
  return friend;
}

function scheduleFriendLookup(value){
  clearTimeout(friendLookupTimer);
  friendLookupTimer=setTimeout(()=>lookupFriendById(value),280);
}


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
      const { error: openedError } = await friendsSb.rpc(
        "mark_direct_share_opened",
        { p_share_id: btn.dataset.openShare }
      );
      if (openedError) throw openedError;
      setFriendsStatus("Material adicionado à sua biblioteca.","success");
      await loadInbox();
    }catch(error){console.error(error);setFriendsStatus(error.message||"Não foi possível adicionar.","error");}
    finally{btn.disabled=false;}
  }));
}

async function addFriend(){
  const input=document.getElementById("friend-id-input");
  const value=input.value.trim().toUpperCase();

  if(!value){
    setFriendsStatus("Digite o ID LURIA.","error");
    return;
  }

  const button=document.getElementById("add-friend");
  button.disabled=true;

  try{
    let friend=pendingFriendLookup;

    if(!friend||String(friend.luria_id||"").toUpperCase()!==value){
      friend=await lookupFriendById(value);
    }

    if(!friend){
      throw new Error("ID LURIA não encontrado.");
    }

    const {error}=await friendsSb.rpc("add_friend_by_luria_id",{p_luria_id:value});
    if(error)throw error;

    input.value="";
    pendingFriendLookup=null;
    renderFriendPreview();

    await loadFriends();

    setFriendsStatus(
      `${friend.display_name||"Usuário LURIA"} foi adicionado aos seus amigos.`,
      "success"
    );
  }catch(error){
    console.error(error);
    setFriendsStatus(error.message||"Não foi possível adicionar.","error");
  }finally{
    button.disabled=false;
  }
}

async function initFriends(){
  friendsUser=window.docmapUser;
  if(!friendsUser)return;
  document.getElementById("add-friend")?.addEventListener("click",addFriend);
  const friendInput=document.getElementById("friend-id-input");
  friendInput?.addEventListener("input",e=>{
    e.target.value=e.target.value.toUpperCase();
    scheduleFriendLookup(e.target.value);
  });
  friendInput?.addEventListener("keydown",e=>{if(e.key==="Enter")addFriend();});
  document.getElementById("copy-my-id")?.addEventListener("click",async()=>{
    const id=document.getElementById("my-luria-id").textContent.trim();
    try{await navigator.clipboard.writeText(id);setFriendsStatus("Seu ID LURIA foi copiado.","success");}
    catch{prompt("Copie seu ID LURIA:",id);}
  });
  try{await Promise.all([loadOwnId(),loadFriends(),loadInbox()]);}
  catch(error){console.error(error);setFriendsStatus(error.message||"Não foi possível carregar Amigos.","error");}
}
if(window.docmapUser)initFriends();else window.addEventListener("docmap:ready",initFriends,{once:true});