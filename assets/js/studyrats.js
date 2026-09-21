let sharedStudyratsRows=[];
let sharedStudyratsChannel=null;
let sharedStudyratsTimer=null;
let sharedStudyratsMyVariant='brown';
let sharedStudyratsMyAccessory='none';

const sharedStudyratLaneColors=['#2f80ed','#36a96c','#f2994a','#8b5cf6','#eb5757','#24a0b5'];
const sharedStudyratVariants=[
  {id:'brown',label:'Marrom',src:'/assets/img/studyrats/rat-brown.png?v=9'},
  {id:'gray',label:'Cinza',src:'/assets/img/studyrats/rat-gray.png?v=9'},
  {id:'white',label:'Branco',src:'/assets/img/studyrats/rat-white.png?v=9'},
  {id:'black',label:'Preto',src:'/assets/img/studyrats/rat-black.png?v=9'},
  {id:'blue',label:'Azul',src:'/assets/img/studyrats/rat-blue.png?v=9'},
  {id:'manchado',label:'Manchado',src:'/assets/img/studyrats/rat-manchado.png?v=9'}
];

const sharedStudyratAccessories=[
  {id:'none',label:'Sem acessório',kind:'none',sources:[]},
  {id:'medal-silver',label:'Medalha prata',kind:'body',sources:['medalha-prata.png','medalha_prata.png','medal-silver.png','prata.png','prata.svg']},
  {id:'cap-colorful',label:'Boné colorido',kind:'head',sources:['bone-colorido.png','boné-colorido.png','bone_colorido.png','boné_colorido.png','cap-colorful.png','bone-colorido.svg']},
  {id:'cowboy-hat',label:'Cowboy',kind:'head',sources:['chapeu-cowboy.png','chapéu-cowboy.png','chapeu_de_cowboy.png','cowboy-hat.png','chapeu-cowboy.svg']},
  {id:'santa-hat',label:'Papai Noel',kind:'head',sources:['chapeu-papai-noel.png','chapéu-papai-noel.png','chapeu_papai_noel.png','santa-hat.png','chapeu-papai-noel.svg']},
  {id:'pink-hat',label:'Chapéu rosa',kind:'head',sources:['chapeu-rosa.png','chapéu-rosa.png','chapeu_rosa.png','pink-hat.png','chapeu-rosa.svg']},
  {id:'pink-glasses',label:'Óculos rosa',kind:'face',sources:['oculos-rosa.png','óculos-rosa.png','oculos_rosa.png','pink-glasses.png','oculos-rosa.svg']},
  {id:'crown',label:'Coroa',kind:'head',sources:['coroa.png','crown.png','coroa.svg']},
  {id:'pink-skirt',label:'Saia rosa',kind:'body',sources:['saia_rosa_com_laço_e_babados.png','saia-rosa.png','saia_rosa.png','pink-skirt.png','saia-rosa.svg']},
  {id:'police-cap',label:'Policial',kind:'head',sources:['boné_policial_azul_com_distintivo_dourado.png','bone-policial.png','boné-policial.png','police-cap.png','bone-policial.svg']},
  {id:'astronaut-helmet',label:'Astronauta',kind:'helmet',sources:['capacete_de_astronauta_com_visor_azul.png','capacete-astronauta.png','astronaut-helmet.png','capacete-astronauta.svg']}
];

function sharedStudyratVariant(value){
  if(typeof value==='number'){
    const i=((value%sharedStudyratVariants.length)+sharedStudyratVariants.length)%sharedStudyratVariants.length;
    return sharedStudyratVariants[i];
  }
  return sharedStudyratVariants.find(function(item){return item.id===value;})||sharedStudyratVariants[0];
}
function sharedStudyratAccessory(value){
  return sharedStudyratAccessories.find(function(item){return item.id===value;})||sharedStudyratAccessories[0];
}

function sharedStudyratAccessorySources(item){
  return (item.sources||[]).map(function(file){
    return '/assets/img/studyrats/'+encodeURIComponent(file).replace(/%2F/g,'/')+'?v=9';
  });
}

function sharedStudyratAccessoryImg(value,className){
  const item=sharedStudyratAccessory(value);
  if(item.id==='none')return '';
  const sources=sharedStudyratAccessorySources(item);
  if(!sources.length)return '';
  const encoded=encodeURIComponent(JSON.stringify(sources));
  return '<img class="'+(className||'studyrats-accessory-img')+' accessory-'+item.id+' accessory-kind-'+item.kind+'" src="'+sources[0]+'" data-studyrat-sources="'+encoded+'" data-studyrat-source-index="0" alt="'+item.label+'" draggable="false" loading="eager" decoding="async">';
}

function sharedStudyratComposite(variant,accessory,className){
  return '<span class="'+(className||'studyrats-rat-composite')+'">'+
    sharedRatImg(variant,'studyrats-rat-img')+
    sharedStudyratAccessoryImg(accessory,'studyrats-accessory-img')+
  '</span>';
}

function sharedStudyratsBindImageFallbacks(root){
  (root||document).querySelectorAll('img[data-studyrat-sources]').forEach(function(img){
    if(img.dataset.fallbackBound==='1')return;
    img.dataset.fallbackBound='1';
    img.addEventListener('error',function(){
      let sources=[];
      try{sources=JSON.parse(decodeURIComponent(img.dataset.studyratSources||''));}catch(e){}
      const next=(Number(img.dataset.studyratSourceIndex)||0)+1;
      if(next<sources.length){
        img.dataset.studyratSourceIndex=String(next);
        img.src=sources[next];
      }else{
        img.style.display='none';
        const choice=img.closest('.studyrats-accessory-choice');
        if(choice)choice.classList.add('is-image-missing');
      }
    });
  });
}


function sharedRatImg(variant,className){
  const item=sharedStudyratVariant(variant);
  const cls=(className||'studyrats-rat-img')+' rat-'+item.id;
  return '<img class="'+cls+'" src="'+item.src+'" alt="'+item.label+'" draggable="false" loading="eager" decoding="async">';
}

function sharedStudyratsApplyAccessorySelection(){
  const host=document.getElementById('studyrats-accessory-picker-options');
  if(!host)return;
  host.querySelectorAll('[data-studyrat-accessory]').forEach(function(button){
    const selected=button.dataset.studyratAccessory===sharedStudyratsMyAccessory;
    button.classList.toggle('is-selected',selected);
    button.setAttribute('aria-pressed',selected?'true':'false');
  });
}

function sharedStudyratsApplyVariantSelection(){
  const host=document.getElementById('studyrats-rat-picker-options');
  if(!host)return;
  host.querySelectorAll('[data-studyrat-variant]').forEach(function(button){
    const selected=button.dataset.studyratVariant===sharedStudyratsMyVariant;
    button.classList.toggle('is-selected',selected);
    button.setAttribute('aria-pressed',selected?'true':'false');
  });
}

function sharedStudyratsRenderRatPicker(){
  const host=document.getElementById('studyrats-rat-picker-options');
  if(!host)return;
  host.innerHTML=sharedStudyratVariants.map(function(item){
    const selected=item.id===sharedStudyratsMyVariant;
    return '<button type="button" class="studyrats-rat-choice '+(selected?'is-selected':'')+'" data-studyrat-variant="'+item.id+'" aria-pressed="'+(selected?'true':'false')+'" title="'+item.label+'">'+
      sharedRatImg(item.id,'studyrats-rat-choice-img')+
      '<span>'+item.label+'</span>'+
      '<i aria-hidden="true">✓</i>'+
    '</button>';
  }).join('');

  host.querySelectorAll('[data-studyrat-variant]').forEach(function(button){
    button.addEventListener('click',function(){
      sharedStudyratsSaveVariant(button.dataset.studyratVariant);
    });
  });

  const accessoryHost=document.getElementById('studyrats-accessory-picker-options');
  if(accessoryHost){
    accessoryHost.innerHTML=sharedStudyratAccessories.map(function(item){
      const selected=item.id===sharedStudyratsMyAccessory;
      const preview=item.id==='none'
        ? '<span class="studyrats-accessory-none">×</span>'
        : sharedStudyratAccessoryImg(item.id,'studyrats-accessory-choice-img');
      return '<button type="button" class="studyrats-accessory-choice '+(selected?'is-selected':'')+'" data-studyrat-accessory="'+item.id+'" aria-pressed="'+(selected?'true':'false')+'" title="'+item.label+'">'+
        preview+'<span>'+item.label+'</span><i aria-hidden="true">✓</i></button>';
    }).join('');
    sharedStudyratsBindImageFallbacks(accessoryHost);
    accessoryHost.querySelectorAll('[data-studyrat-accessory]').forEach(function(button){
      button.addEventListener('click',function(){
        sharedStudyratsSaveAccessory(button.dataset.studyratAccessory);
      });
    });
  }
}

async function sharedStudyratsLoadMyVariant(){
  if(!window.supabaseClient||!window.docmapUser)return;
  const result=await window.supabaseClient
    .from('profiles')
    .select('studyrat_variant, studyrat_accessory')
    .eq('user_id',window.docmapUser.id)
    .maybeSingle();

  if(!result.error&&result.data){
    if(result.data.studyrat_variant)sharedStudyratsMyVariant=sharedStudyratVariant(result.data.studyrat_variant).id;
    if(result.data.studyrat_accessory)sharedStudyratsMyAccessory=sharedStudyratAccessory(result.data.studyrat_accessory).id;
  }
  sharedStudyratsRenderRatPicker();
}

async function sharedStudyratsSaveVariant(variant){
  const next=sharedStudyratVariant(variant).id;
  if(next===sharedStudyratsMyVariant)return;

  const previous=sharedStudyratsMyVariant;
  sharedStudyratsMyVariant=next;
  sharedStudyratsApplyVariantSelection();

  const status=document.getElementById('studyrats-rat-picker-status');
  if(status)status.textContent='Salvando...';

  const result=await window.supabaseClient.rpc('set_studyrat_variant',{p_variant:next});
  if(result.error){
    console.error(result.error);
    sharedStudyratsMyVariant=previous;
    sharedStudyratsApplyVariantSelection();
    if(status)status.textContent='Não foi possível salvar o ratinho.';
    return;
  }

  if(status){
    status.textContent='Ratinho selecionado.';
    setTimeout(function(){if(status.textContent==='Ratinho selecionado.')status.textContent='';},1800);
  }
  await sharedStudyratsLoad();
}

async function sharedStudyratsSaveAccessory(accessory){
  const next=sharedStudyratAccessory(accessory).id;
  if(next===sharedStudyratsMyAccessory)return;

  const previous=sharedStudyratsMyAccessory;
  sharedStudyratsMyAccessory=next;
  sharedStudyratsApplyAccessorySelection();

  const status=document.getElementById('studyrats-rat-picker-status');
  if(status)status.textContent='Salvando acessório...';

  const result=await window.supabaseClient.rpc('set_studyrat_accessory',{p_accessory:next});
  if(result.error){
    console.error(result.error);
    sharedStudyratsMyAccessory=previous;
    sharedStudyratsApplyAccessorySelection();
    if(status)status.textContent='Não foi possível salvar o acessório.';
    return;
  }

  if(status){
    status.textContent='Acessório selecionado.';
    setTimeout(function(){if(status.textContent==='Acessório selecionado.')status.textContent='';},1800);
  }
  await sharedStudyratsLoad();
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
      variant:sharedStudyratVariant(row.studyrat_variant||'brown').id,
      accessory:sharedStudyratAccessory(row.studyrat_accessory||'none').id,
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
    host.innerHTML='<div class="studyrats-empty"><div>'+sharedStudyratComposite(sharedStudyratsMyVariant,sharedStudyratsMyAccessory,'studyrats-empty-composite')+'<strong>Nenhuma corrida ativa</strong><span>Crie um desafio com seus amigos e acompanhe os ratinhos avançando até a chegada.</span></div></div>';
    sharedStudyratsBindImageFallbacks(host);
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
          '<span class="studyrats-mouse" style="left:'+pct+'%">'+sharedStudyratComposite(p.variant,p.accessory)+'</span>'+
          '<span class="studyrats-track-score" style="left:min(calc('+pct+'% + 40px),calc(100% - 62px))">'+fEsc(score)+' '+fEsc(type.unit)+'</span>'+
        '</div>'+
      '</div>';
    }).join('');

    const canDelete=ch.creator_user_id===window.docmapUser.id;
    const finished=ch.status==='finished';

    return '<article class="studyrats-challenge">'+
      '<div class="studyrats-challenge-head">'+
        '<div class="studyrats-challenge-title">'+
          '<span class="studyrats-race-badge">'+sharedStudyratComposite(sharedStudyratsMyVariant,sharedStudyratsMyAccessory,'studyrats-badge-composite')+'</span>'+
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

  sharedStudyratsBindImageFallbacks(host);

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
  sharedStudyratsRenderRatPicker();
  sharedStudyratsLoadMyVariant();
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