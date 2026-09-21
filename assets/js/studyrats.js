let sharedStudyratsRows=[];
let sharedStudyratsChannel=null;
let sharedStudyratsTimer=null;

function sharedStudyratsGroup(rows){
  const map=new Map();
  (rows||[]).forEach(function(row){
    if(!map.has(row.challenge_id)){
      map.set(row.challenge_id,{id:row.challenge_id,creator_user_id:row.creator_user_id,type:row.challenge_type,goal:Number(row.goal)||0,deadline:row.deadline,created_at:row.created_at,status:row.status,participants:[]});
    }
    map.get(row.challenge_id).participants.push({id:row.participant_user_id,name:row.participant_name||'Usuário LURIA',value:Number(row.progress)||0});
  });
  return Array.from(map.values());
}

async function sharedStudyratsLoad(){
  const host=document.getElementById('studyrats-list');
  if(!host||!window.supabaseClient)return;
  const result=await window.supabaseClient.rpc('my_studyrats_challenges');
  if(result.error){
    console.error(result.error);
    host.innerHTML='<div class="studyrats-empty"><div><strong>Não foi possível carregar os desafios</strong><span>Tente atualizar a página.</span></div></div>';
    return;
  }
  sharedStudyratsRows=result.data||[];
  sharedStudyratsRender();
}

function sharedStudyratsRender(){
  const host=document.getElementById('studyrats-list');
  if(!host)return;
  const challenges=sharedStudyratsGroup(sharedStudyratsRows);
  if(!challenges.length){
    host.innerHTML='<div class="studyrats-empty"><div><strong>Nenhuma corrida ativa</strong><span>Crie um desafio, escolha seus amigos e acompanhe cada participante avançando pela pista.</span></div></div>';
    return;
  }
  host.innerHTML=challenges.map(function(ch){
    const type=studyratsTypeLabels[ch.type]||studyratsTypeLabels.flashcards;
    const ordered=(ch.participants||[]).slice().sort(function(a,b){return b.value-a.value;});
    const lanes=ordered.map(function(p,index){
      const pct=Math.max(2,Math.min(94,ch.goal?((Number(p.value)||0)/Number(ch.goal))*92:2));
      const score=Number.isInteger(p.value)?p.value:p.value.toFixed(1);
      const mouseColor=index===0?'var(--accent)':'color-mix(in srgb,var(--text) 58%,var(--muted))';
      return '<div class="studyrats-lane">'+
        '<div class="studyrats-runner"><span class="studyrats-rank">'+(index+1)+'</span><span class="studyrats-runner-name">'+fEsc(p.name)+'</span></div>'+
        '<div class="studyrats-progress"><span class="studyrats-progress-fill" style="width:'+pct+'%"></span><span class="studyrats-mouse" style="left:'+pct+'%;color:'+mouseColor+'">'+mouseSvg()+'</span></div>'+
        '<div class="studyrats-score"><strong>'+fEsc(score)+'</strong><small>'+fEsc(type.unit)+'</small></div>'+
      '</div>';
    }).join('');
    const canDelete=ch.creator_user_id===window.docmapUser.id;
    return '<article class="studyrats-challenge">'+
      '<div class="studyrats-challenge-head">'+
        '<div class="studyrats-challenge-title"><span class="studyrats-race-badge">'+mouseSvg()+'</span><span><strong>'+fEsc(type.title)+'</strong><small>'+ch.participants.length+' participantes · progresso automático</small></span></div>'+
        '<div class="studyrats-challenge-meta"><span class="studyrats-pill">Meta: '+fEsc(ch.goal)+' '+fEsc(type.unit)+'</span><span class="studyrats-pill">Até '+formatStudyratsDate(ch.deadline)+'</span>'+(canDelete?'<button class="studyrats-delete" type="button" aria-label="Apagar desafio" data-delete-studyrat="'+fEsc(ch.id)+'">×</button>':'')+'</div>'+
      '</div>'+
      '<div class="studyrats-track">'+lanes+'</div>'+
      '<div class="studyrats-race-footer"><span>Os ratinhos avançam a partir dos dados reais de estudo.</span><span>CHEGADA · '+fEsc(ch.goal)+' '+fEsc(type.unit)+'</span></div>'+
    '</article>';
  }).join('');
  host.querySelectorAll('[data-delete-studyrat]').forEach(function(btn){
    btn.addEventListener('click',async function(){
      if(window.LuriaDialog&&window.LuriaDialog.confirm){
        const ok=await window.LuriaDialog.confirm('Apagar este desafio do Studyrats?');
        if(!ok)return;
      }
      const result=await window.supabaseClient.rpc('delete_studyrats_challenge',{p_challenge_id:btn.dataset.deleteStudyrat});
      if(result.error){console.error(result.error);setFriendsStatus(result.error.message||'Não foi possível apagar o desafio.','error');return;}
      await sharedStudyratsLoad();
    });
  });
}

async function sharedStudyratsStart(){
  const type=document.getElementById('studyrats-type')?.value||'flashcards';
  const goal=Math.max(1,Number(document.getElementById('studyrats-goal')?.value)||1);
  const deadline=document.getElementById('studyrats-deadline')?.value||defaultDeadline();
  const selected=Array.from(document.querySelectorAll('#studyrats-friends input:checked')).map(function(el){return el.value;});
  const button=document.getElementById('studyrats-start');
  if(button)button.disabled=true;
  try{
    const result=await window.supabaseClient.rpc('create_studyrats_challenge',{p_challenge_type:type,p_goal:goal,p_deadline:deadline,p_friend_user_ids:selected});
    if(result.error)throw result.error;
    document.getElementById('studyrats-create').hidden=true;
    document.querySelectorAll('#studyrats-friends input:checked').forEach(function(el){el.checked=false;});
    await sharedStudyratsLoad();
    setFriendsStatus('Desafio Studyrats criado para todos os participantes.','success');
  }catch(error){
    console.error(error);
    setFriendsStatus(error.message||'Não foi possível criar o desafio.','error');
  }finally{if(button)button.disabled=false;}
}

window.initSharedStudyrats=function(){
  const create=document.getElementById('studyrats-create');
  const deadline=document.getElementById('studyrats-deadline');
  if(deadline&&!deadline.value)deadline.value=defaultDeadline();
  document.getElementById('studyrats-toggle-create')?.addEventListener('click',function(){create.hidden=!create.hidden;});
  document.getElementById('studyrats-cancel')?.addEventListener('click',function(){create.hidden=true;});
  document.getElementById('studyrats-start')?.addEventListener('click',sharedStudyratsStart);
  renderStudyratsFriendOptions();
  sharedStudyratsLoad();
  if(sharedStudyratsChannel)window.supabaseClient.removeChannel(sharedStudyratsChannel);
  sharedStudyratsChannel=window.supabaseClient.channel('studyrats-'+window.docmapUser.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'studyrats_challenges'},sharedStudyratsLoad)
    .on('postgres_changes',{event:'*',schema:'public',table:'studyrats_participants'},sharedStudyratsLoad)
    .subscribe();
  clearInterval(sharedStudyratsTimer);
  sharedStudyratsTimer=setInterval(function(){if(!document.hidden)sharedStudyratsLoad();},30000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)sharedStudyratsLoad();});
};