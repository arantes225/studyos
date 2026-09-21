let sharedStudyratsRows=[];
let sharedStudyratsChannel=null;
let sharedStudyratsTimer=null;

const sharedStudyratLaneColors=['#2f80ed','#36a96c','#f2994a','#8b5cf6','#eb5757','#24a0b5'];

function sharedRatImg(index,className){
  return '<span class="'+(className||'studyrats-rat-img')+' rat-'+(index%4)+'" aria-hidden="true"></span>';
}
function sharedStudyratsInitials(name){
  return String(name||'L').trim().split(/\s+/).slice(0,2).map(function(part){return part.charAt(0).toUpperCase();}).join('')||'L';
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
  if(diff===1)return 'Falta 1 dia';
  return 'Faltam '+diff+' dias';
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
    host.innerHTML='<div class="studyrats-empty"><div>'+sharedRatImg(0,'studyrats-empty-rat')+'<strong>Nenhuma corrida ativa</strong><span>Crie um desafio com seus amigos e acompanhe os ratinhos avançando até a chegada.</span></div></div>';
    return;
  }

  host.innerHTML=challenges.map(function(ch){
    const type=studyratsTypeLabels[ch.type]||studyratsTypeLabels.flashcards;
    const ordered=(ch.participants||[]).slice().sort(function(a,b){return b.value-a.value;});
    const leaderValue=ordered.length?Math.max.apply(null,ordered.map(function(p){return Number(p.value)||0;})):0;
    const timeFraction=ch.status==='finished'?1:sharedStudyratsTimeFraction(ch.created_at,ch.deadline);

    const lanes=ordered.map(function(p,index){
      const value=Number(p.value)||0;
      const performanceRatio=leaderValue>0?Math.max(0,Math.min(1,value/leaderValue)):0;
      const movementFactor=0.25+(0.75*performanceRatio);
      const pct=Math.max(4,Math.min(93,4+(89*timeFraction*movementFactor)));
      const score=Number.isInteger(value)?value:value.toFixed(1);
      const laneColor=sharedStudyratLaneColors[index%sharedStudyratLaneColors.length];

      return '<div class="studyrats-lane" style="--lane-color:'+laneColor+'">'+
        '<div class="studyrats-runner-card">'+
          '<span class="studyrats-rank '+(index===0?'is-first':'')+'">'+(index+1)+'</span>'+
          '<span class="studyrats-avatar">'+fEsc(sharedStudyratsInitials(p.name))+'</span>'+
          '<span class="studyrats-runner-copy"><strong>'+fEsc(p.name)+'</strong><small>'+fEsc(score)+' '+fEsc(type.unit)+'</small></span>'+
        '</div>'+
        '<div class="studyrats-road">'+
          '<span class="studyrats-road-dash"></span>'+
          '<span class="studyrats-progress-fill" style="width:'+pct+'%"></span>'+
          '<span class="studyrats-mouse" style="left:'+pct+'%">'+sharedRatImg(index)+'</span>'+
          '<span class="studyrats-track-score" style="left:min(calc('+pct+'% + 40px),calc(100% - 62px))">'+fEsc(score)+' '+fEsc(type.unit)+'</span>'+
        '</div>'+
      '</div>';
    }).join('');

    const canDelete=ch.creator_user_id===window.docmapUser.id;
    const finished=ch.status==='finished';

    return '<article class="studyrats-challenge">'+
      '<div class="studyrats-challenge-head">'+
        '<div class="studyrats-challenge-title">'+
          '<span class="studyrats-race-badge">'+sharedRatImg(0,'studyrats-badge-rat')+'</span>'+
          '<span><strong>'+fEsc(type.title)+'</strong><small>'+(finished?'Desafio encerrado':'Quem estiver na frente na data limite vence.')+'</small></span>'+
        '</div>'+
        (canDelete?'<button class="studyrats-delete" type="button" aria-label="Apagar desafio" data-delete-studyrat="'+fEsc(ch.id)+'">×</button>':'')+
      '</div>'+
      '<div class="studyrats-summary">'+
        '<div class="studyrats-summary-item"><span class="studyrats-status-dot '+(finished?'is-finished':'')+'"></span><span><small>Status</small><strong>'+(finished?'Encerrado':'Desafio ativo')+'</strong></span></div>'+
        '<div class="studyrats-summary-item"><span class="studyrats-summary-icon">↗</span><span><small>Modalidade</small><strong>'+fEsc(type.title)+'</strong></span></div>'+
        '<div class="studyrats-summary-item"><span class="studyrats-summary-icon">▣</span><span><small>Prazo</small><strong>'+formatStudyratsDate(ch.deadline)+'</strong><em>'+sharedStudyratsDeadlineText(ch.deadline)+'</em></span></div>'+
        '<div class="studyrats-summary-item"><span class="studyrats-summary-icon">●●</span><span><small>Participantes</small><strong>'+ch.participants.length+'</strong><em>Boa sorte, ratos de estudo!</em></span></div>'+
      '</div>'+
      '<div class="studyrats-race-scene">'+
        '<div class="studyrats-skyline"><i></i><i></i><i></i><i></i></div>'+
        '<div class="studyrats-lanes">'+lanes+'</div>'+
        '<div class="studyrats-finish"><span>CHEGADA</span><i></i></div>'+
        '<div class="studyrats-bush studyrats-bush-left"></div><div class="studyrats-bush studyrats-bush-right"></div>'+
      '</div>'+
      '<div class="studyrats-race-footer"><span>Os ratinhos avançam com o tempo e com o desempenho relativo de cada participante.</span><strong>'+fEsc(type.title)+' · até '+formatStudyratsDate(ch.deadline)+'</strong></div>'+
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
    setFriendsStatus('Desafio Studyrats criado.','success');
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