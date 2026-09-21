let sharedStudyratsRows=[];
let sharedStudyratsChannel=null;
let sharedStudyratsTimer=null;

function sharedRatSvg(){
  return '<svg viewBox="0 0 120 82" aria-hidden="true">'+
    '<path d="M20 48C4 44-1 29 10 18c8-8 19-9 28-5" fill="none" stroke="var(--rat-tail,#7a6a63)" stroke-width="5.5" stroke-linecap="round"/>'+
    '<ellipse cx="58" cy="47" rx="34" ry="23" fill="var(--rat-fill,#d8cfc7)" stroke="var(--rat-stroke,#4d443f)" stroke-width="4"/>'+
    '<path d="M33 43c8-15 35-20 54-7-8-11-28-16-44-10-8 3-12 9-10 17Z" fill="var(--rat-shadow,#c4b3a7)" opacity=".9"/>'+
    '<ellipse cx="89" cy="42" rx="18" ry="15" fill="var(--rat-fill,#d8cfc7)" stroke="var(--rat-stroke,#4d443f)" stroke-width="4"/>'+
    '<circle cx="82" cy="24" r="10" fill="var(--rat-fill,#d8cfc7)" stroke="var(--rat-stroke,#4d443f)" stroke-width="4"/>'+
    '<circle cx="92" cy="22" r="9" fill="var(--rat-fill,#d8cfc7)" stroke="var(--rat-stroke,#4d443f)" stroke-width="4"/>'+
    '<circle cx="82" cy="24" r="4.8" fill="var(--rat-ear,#e6aeb5)"/>'+
    '<circle cx="92" cy="22" r="4.2" fill="var(--rat-ear,#e6aeb5)"/>'+
    '<ellipse cx="106" cy="45" rx="4.7" ry="3.7" fill="var(--rat-nose,#c9868e)" stroke="var(--rat-stroke,#4d443f)" stroke-width="1.8"/>'+
    '<circle cx="96" cy="39" r="2.9" fill="#241f1d"/><circle cx="96.8" cy="38.1" r=".9" fill="#fff"/>'+
    '<path d="M104 48c-3 3-8 4-12 2" fill="none" stroke="var(--rat-stroke,#4d443f)" stroke-width="2.2" stroke-linecap="round"/>'+
    '<path d="M106 43l11-4M107 46h12M106 49l10 5" fill="none" stroke="var(--rat-stroke,#4d443f)" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>'+
    '<path d="M45 66l-7 8M66 66l8 7M80 58l8 5" fill="none" stroke="var(--rat-stroke,#4d443f)" stroke-width="4" stroke-linecap="round"/>'+
    '<ellipse cx="67" cy="52" rx="17" ry="10" fill="var(--rat-belly,#efe7df)" opacity=".72"/>'+
    '<path d="M42 48c6 2 10 2 15 0" fill="none" stroke="var(--rat-stroke,#4d443f)" stroke-width="1.7" stroke-linecap="round" opacity=".28"/>'+
  '</svg>';
}

function sharedStudyratsGroup(rows){
  const map=new Map();
  (rows||[]).forEach(function(row){
    if(!map.has(row.challenge_id)){
      map.set(row.challenge_id,{
        id:row.challenge_id,
        creator_user_id:row.creator_user_id,
        type:row.challenge_type,
        deadline:row.deadline,
        created_at:row.created_at,
        status:row.status,
        participants:[]
      });
    }
    map.get(row.challenge_id).participants.push({
      id:row.participant_user_id,
      name:row.participant_name||'Usuário LURIA',
      value:Number(row.progress)||0
    });
  });
  return Array.from(map.values());
}

function sharedStudyratsTimeFraction(createdAt,deadline){
  const start=new Date(createdAt).getTime();
  const end=new Date(String(deadline).slice(0,10)+'T23:59:59').getTime();
  const now=Date.now();
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return 1;
  return Math.max(0,Math.min(1,(now-start)/(end-start)));
}

function sharedStudyratsDeadlineText(date){
  if(!date)return 'Sem prazo';
  const end=new Date(String(date).slice(0,10)+'T23:59:59');
  const now=new Date();
  const diff=Math.ceil((end-now)/86400000);
  if(diff<0)return 'Encerrado';
  if(diff===0)return 'Termina hoje';
  if(diff===1)return '1 dia restante';
  return diff+' dias restantes';
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
    host.innerHTML='<div class="studyrats-empty"><div><strong>Nenhuma corrida ativa</strong><span>Crie um desafio, escolha seus amigos e veja quem acumula mais até a data limite.</span></div></div>';
    return;
  }

  host.innerHTML=challenges.map(function(ch){
    const type=studyratsTypeLabels[ch.type]||studyratsTypeLabels.flashcards;
    const ordered=(ch.participants||[]).slice().sort(function(a,b){return b.value-a.value;});
    const leaderValue=ordered.length?Math.max.apply(null,ordered.map(function(p){return Number(p.value)||0;})):0;
    const timeFraction=sharedStudyratsTimeFraction(ch.created_at,ch.deadline);

    const lanes=ordered.map(function(p,index){
      const value=Number(p.value)||0;
      const performanceRatio=leaderValue>0?Math.max(0,Math.min(1,value/leaderValue)):0;
      const movementFactor=0.25+(0.75*performanceRatio);
      const pct=Math.max(5,Math.min(88,5+(83*timeFraction*movementFactor)));
      const score=Number.isInteger(value)?value:value.toFixed(1);
      const mouseColor=index===0?'var(--accent)':'color-mix(in srgb,var(--text) 62%,var(--muted))';

      return '<div class="studyrats-lane">'+
        '<div class="studyrats-runner"><span class="studyrats-rank">'+(index+1)+'</span><span class="studyrats-runner-copy"><strong>'+fEsc(p.name)+'</strong><small>'+fEsc(score)+' '+fEsc(type.unit)+'</small></span></div>'+
        '<div class="studyrats-progress"><span class="studyrats-progress-fill" style="width:'+pct+'%"></span><span class="studyrats-mouse" style="left:'+pct+'%;color:'+mouseColor+'">'+sharedRatSvg()+'</span></div>'+
      '</div>';
    }).join('');

    const canDelete=ch.creator_user_id===window.docmapUser.id;
    const finished=ch.status==='finished';
    const statusText=finished?'Desafio encerrado':'Corrida em andamento';

    return '<article class="studyrats-challenge">'+
      '<div class="studyrats-challenge-head">'+
        '<div class="studyrats-challenge-title"><span class="studyrats-race-badge">'+sharedRatSvg()+'</span><span><strong>'+fEsc(type.title)+'</strong><small>'+ch.participants.length+' participantes · '+statusText+'</small></span></div>'+
        '<div class="studyrats-challenge-meta">'+
          '<span class="studyrats-pill">Até '+formatStudyratsDate(ch.deadline)+'</span>'+
          '<span class="studyrats-pill">'+sharedStudyratsDeadlineText(ch.deadline)+'</span>'+
          (canDelete?'<button class="studyrats-delete" type="button" aria-label="Apagar desafio" data-delete-studyrat="'+fEsc(ch.id)+'">×</button>':'')+
        '</div>'+
      '</div>'+
      '<div class="studyrats-track">'+lanes+'</div>'+
      '<div class="studyrats-race-footer"><span>A pista combina tempo restante e desempenho relativo.</span><span>'+fEsc(type.title)+' até '+formatStudyratsDate(ch.deadline)+'</span></div>'+
    '</article>';
  }).join('');

  host.querySelectorAll('[data-delete-studyrat]').forEach(function(btn){
    btn.addEventListener('click',async function(){
      if(window.LuriaDialog&&window.LuriaDialog.confirm){
        const ok=await window.LuriaDialog.confirm('Apagar este desafio do Studyrats?');
        if(!ok)return;
      }
      const result=await window.supabaseClient.rpc('delete_studyrats_challenge',{p_challenge_id:btn.dataset.deleteStudyrat});
      if(result.error){
        console.error(result.error);
        setFriendsStatus(result.error.message||'Não foi possível apagar o desafio.','error');
        return;
      }
      await sharedStudyratsLoad();
    });
  });
}

async function sharedStudyratsStart(){
  const type=document.getElementById('studyrats-type')?.value||'flashcards';
  const deadline=document.getElementById('studyrats-deadline')?.value||defaultDeadline();
  const selected=Array.from(document.querySelectorAll('#studyrats-friends input:checked')).map(function(el){return el.value;});
  const button=document.getElementById('studyrats-start');

  if(!selected.length){
    setFriendsStatus('Selecione pelo menos um amigo para a corrida.','error');
    return;
  }

  if(button)button.disabled=true;
  try{
    const result=await window.supabaseClient.rpc('create_studyrats_challenge',{
      p_challenge_type:type,
      p_goal:1,
      p_deadline:deadline,
      p_friend_user_ids:selected
    });
    if(result.error)throw result.error;

    document.getElementById('studyrats-create').hidden=true;
    document.querySelectorAll('#studyrats-friends input:checked').forEach(function(el){el.checked=false;});
    await sharedStudyratsLoad();
    setFriendsStatus('Desafio Studyrats criado para todos os participantes.','success');
  }catch(error){
    console.error(error);
    setFriendsStatus(error.message||'Não foi possível criar o desafio.','error');
  }finally{
    if(button)button.disabled=false;
  }
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