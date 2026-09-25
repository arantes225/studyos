(() => {
  'use strict';
  let vitals = {}, context = {}, enabled = false, frame = 0, reaction = null;
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const number = value => value === null || value === undefined || value === '' ? NaN : parseFloat(value);
  // Educational rhythm strip: fixed time scale and durations in seconds, not a 12-lead ECG.
  const AF_RR = Array.from({length:64},(_,i)=>0.6+(((Math.imul(i+17,1597334677)>>>0)%997)/997)*0.85);
  const meanRR = AF_RR.reduce((a,b)=>a+b,0)/AF_RR.length;
  const AF_EDGES = [0];
  AF_RR.forEach(v=>AF_EDGES.push(AF_EDGES.at(-1)+v/meanRR));
  function profile(v, context={}) {
    const rhythm=normalize(v.rhythm);
    let type='unknown';
    if (/nao analisado|nao identificado|desconhecido/.test(rhythm)) type='unknown';
    else if (/fibrilacao ventricular|\bfv\b/.test(rhythm)) type='vf';
    else if (/assistolia/.test(rhythm)) type='asystole';
    else if (/polimorfic|torsades/.test(rhythm)) type='unknown';
    else if (/taquicardia ventricular|\btv\b/.test(rhythm)) type='vt';
    else if (/fibrilacao atrial|\bfa\b/.test(rhythm) || (context.slug==='af-unstable-ed' && /irregular.*qrs estreito/.test(rhythm))) type='af';
    else if (/estimulado|marcapasso|paced/.test(rhythm)) type='paced';
    else if (/sinusal/.test(rhythm)) type='sinus';
    else if (/ritmo organizado/.test(rhythm)) type='organized';
    return {type,hr:number(v.hr)};
  }
  function beatWindow(t,p) {
    const period=60/p.hr;
    if (!Number.isFinite(period)||period<=0) return [];
    if(p.type!=='af') {
      const beat=Math.floor(t/period)*period;
      return [beat-period,beat,beat+period];
    }
    const block=64*period;
    const start=Math.floor(t/block)*block;
    const beats=[];
    for(let cycle=-1;cycle<=1;cycle++) {
      for(let j=0;j<64;j++) {
        const beat=start+cycle*block+AF_EDGES[j]*period;
        if(Math.abs(t-beat)<.8) beats.push(beat);
      }
    }
    return beats;
  }
  const gaussian=(t,center,width)=>Math.exp(-Math.pow((t-center)/width,2));
  function ecg(t,p) {
    if(p.type==='unknown') return null;
    if(p.type==='asystole') return 0;
    if(p.type==='vf') return (0.7+.25*Math.sin(t*1.7))*(15*Math.sin(t*35+1.2*Math.sin(t*2.1))+8*Math.sin(t*51+.7*Math.sin(t*3.3))+5*Math.sin(t*73));
    if(!Number.isFinite(p.hr)||p.hr<=0) return null;
    let value=p.type==='af' ? 1.2*Math.sin(t*43+.8*Math.sin(t*2.3))+.6*Math.sin(t*67) : 0;
    for(const beat of beatWindow(t,p)) {
      const d=t-beat;
      if(p.type==='vt') {
        // TV: complexo largo, arredondado e com amplitude controlada, como em monitor multiparamétrico.
        value+=18*gaussian(d,-.025,.075)-12*gaussian(d,.075,.07)-5*gaussian(d,.23,.085);
      } else {
        // AF has no discrete P wave. Organized post-ROSC does not assert sinus origin.
        if(p.type==='sinus') value+=3.2*gaussian(d,-.17,.035);
        // Marcapasso: espícula curta antes do QRS, seguida de complexo capturado.
        if(p.type==='paced') value+=24*gaussian(d,-.055,.004);
        // QRS de monitor: menos "agulha", largura visual mais uniforme e ganho controlado.
        value+=-3.2*gaussian(d,-.035,.018)+18*gaussian(d,0,.021)-5.2*gaussian(d,.045,.022);
        value+=4.8*gaussian(d,Math.min(.28,60/p.hr*.43),.065);
      }
    }
    return value;
  }
  function pleth(t,p,v) {
    if(p.type==='vf'||p.type==='asystole'||v.pulse===false||/sem pulso/.test(normalize(v.rhythm)))return null;
    if(!Number.isFinite(p.hr)||p.hr<=0||!(number(v.spo2)>0))return null;
    let value=0;
    for(const beat of beatWindow(t,p)) {
      const d=t-beat-.16;
      if(d>=0 && d<.55) value+=85*(1-Math.exp(-d/.045))*Math.exp(-d/.10);
    }
    return value;
  }
  window.PlantaoECG={profile,ecg,beatWindow,pleth};

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function update(next, caseContext={}) {
    context=caseContext;
    enabled=caseContext.enabled===true;
    vitals = {...next};
    const mental = normalize(vitals.mental);
    const unconscious = /inconsciente|desacordad|nao responsiv|nao responde|arresponsiv|coma|irresponsiv/.test(mental);
    const img = document.getElementById('plantao-patient-image');
    const src = unconscious ? caseContext.unconscious_image : caseContext.patient_image;
    if (img && src && img.getAttribute('src') !== src) img.src = src;
    if (img) img.alt = `Ilustração do paciente ${unconscious ? 'desacordado' : 'acordado'} no leito`;
    const badge = document.getElementById('plantao-consciousness');
    if (badge) badge.textContent = vitals.mental || 'Estado neurológico não informado';
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function react(type, details={}) {
    const durationByType = {
      defibrillation: 1150,
      cardioversion: 900,
      pacing: 1400,
      cpr: 1400,
      ventilation: 900,
      oxygen: 700,
      procedure: 700,
      medication: 550
    };
    reaction = {
      type: String(type || 'procedure'),
      details: {...details},
      start: performance.now(),
      duration: Number(details.duration || durationByType[type] || 650)
    };
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function drawReaction(ctx,w,h,time) {
    if(!reaction) return;
    const elapsed=time-reaction.start;
    if(elapsed<0 || elapsed>reaction.duration){reaction=null;return;}
    const progress=Math.max(0,Math.min(1,elapsed/reaction.duration));
    const type=reaction.type;

    if(type==='defibrillation' || type==='cardioversion'){
      const alpha=Math.max(0,1-progress*3);
      if(alpha>0){
        ctx.save();
        ctx.fillStyle='rgba(255,255,255,'+(alpha*.36)+')';
        ctx.fillRect(0,0,w,h);
        ctx.restore();
      }
      const x=w*(.58+Math.min(.08,progress*.08));
      ctx.save();
      ctx.strokeStyle=type==='defibrillation'?'#ffffff':'#ffe66d';
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.moveTo(x,8);ctx.lineTo(x-7,45);ctx.lineTo(x+11,67);ctx.lineTo(x-5,105);ctx.lineTo(x+6,118);
      ctx.stroke();
      ctx.font='bold 13px sans-serif';
      ctx.fillStyle=type==='defibrillation'?'#ffffff':'#ffe66d';
      ctx.fillText(type==='defibrillation'?'CHOQUE':'SYNC',Math.max(8,x-28),18);
      ctx.restore();
      return;
    }

    if(type==='cpr'){
      ctx.save();
      ctx.strokeStyle='rgba(255,255,255,.72)';
      ctx.lineWidth=1.6;
      ctx.beginPath();
      const offset=(elapsed/1000)*120;
      for(let x=-40;x<w+40;x+=34){
        const xx=x+(offset%34);
        ctx.moveTo(xx,88);ctx.lineTo(xx+9,60);ctx.lineTo(xx+18,92);
      }
      ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.85)';
      ctx.font='bold 12px sans-serif';
      ctx.fillText('RCP',8,112);
      ctx.restore();
      return;
    }

    if(type==='pacing'){
      ctx.save();
      ctx.fillStyle='#ffe66d';
      ctx.font='bold 12px sans-serif';
      ctx.fillText('PACING',8,112);
      ctx.restore();
    }
  }

  function draw(time) {
    frame = 0;
    const canvas = document.getElementById('plantao-waveforms');
    const section = document.getElementById('plantao-simulator');
    if (!canvas || !section || section.hidden || document.hidden) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    if(!enabled){
      ctx.fillStyle='#07131d';ctx.fillRect(0,0,w,h);
      ctx.fillStyle='#6f8797';ctx.font='bold 22px sans-serif';ctx.textAlign='center';
      ctx.fillText('MONITOR DESLIGADO',w/2,h/2);
      ctx.textAlign='start';
      if(!reduced.matches) frame=requestAnimationFrame(draw);
      return;
    }
    ctx.strokeStyle = '#143044';ctx.lineWidth = 1;
    for (let x=0;x<w;x+=25) {ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    const p=profile(vitals,context);
    const rr=number(vitals.rr);
    const seconds=reduced.matches ? 6 : time/1000;
    // Hierarquia visual do monitor: ECG é o traçado principal e ocupa a maior faixa vertical.
    // PLET fica intermediário e RESP propositalmente compacto.
    const rows=[
      {label:'ECG · 6 s',color:'#55ef93',sample:t=>ecg(t,p),top:0,height:120,base:72,scale:1.08,lineWidth:2.2},
      {label:'PLET',color:'#50e5f4',sample:t=>pleth(t,p,vitals),top:120,height:62,base:153,scale:.54,lineWidth:1.9},
      {label:'RESP',color:'#f5da57',sample:t=>Number.isFinite(rr)&&rr>=0 ? 15*Math.sin(t*rr/60*Math.PI*2) : null,top:182,height:38,base:204,scale:.34,lineWidth:1.6}
    ];
    rows.forEach((row,i)=>{
      ctx.save();
      ctx.beginPath();
      ctx.rect(0,row.top,w,row.height);
      ctx.clip();

      ctx.fillStyle=row.color;
      ctx.font=i===0?'bold 15px sans-serif':'13px sans-serif';
      ctx.fillText(row.label,8,row.top+(i===0?18:14));

      ctx.beginPath();
      ctx.strokeStyle=row.color;
      ctx.lineWidth=row.lineWidth;
      const first=row.sample(seconds);
      if(first===null) {
        ctx.font='13px sans-serif';
        ctx.fillText(i===0?'Traçado não disponível':'Sem sinal',150,row.base);
        ctx.restore();
        return;
      }
      for(let x=0;x<w;x++) {
        const t=seconds-6+6*x/w;
        const y=row.base-row.sample(t)*row.scale;
        if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.stroke();
      ctx.restore();
    });
    drawReaction(ctx,w,h,time);
    if(!reduced.matches || reaction) frame=requestAnimationFrame(draw);
  }
  function setupMonitorExpansion() {
    const monitor = document.querySelector('.plantao-monitor');
    if (!monitor || monitor.dataset.expandReady === '1') return;
    monitor.dataset.expandReady = '1';
    monitor.setAttribute('role','button');
    monitor.setAttribute('tabindex','0');
    monitor.setAttribute('aria-expanded','false');
    monitor.setAttribute('title','Toque para ampliar o monitor');

    const backdrop = document.createElement('div');
    backdrop.className = 'plantao-monitor-backdrop';
    backdrop.hidden = true;
    document.body.appendChild(backdrop);

    const monitorHome = monitor.parentNode;
    const monitorNextSibling = monitor.nextSibling;

    const setExpanded = expanded => {
      if (expanded) {
        document.body.appendChild(monitor);
      } else if (monitorHome) {
        if (monitorNextSibling && monitorNextSibling.parentNode === monitorHome) monitorHome.insertBefore(monitor, monitorNextSibling);
        else monitorHome.appendChild(monitor);
      }
      monitor.classList.toggle('is-expanded', expanded);
      backdrop.hidden = !expanded;
      document.body.classList.toggle('plantao-monitor-open', expanded);
      monitor.setAttribute('aria-expanded', String(expanded));
      monitor.setAttribute('title', expanded ? 'Toque para fechar o monitor ampliado' : 'Toque para ampliar o monitor');
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const toggle = () => setExpanded(!monitor.classList.contains('is-expanded'));

    monitor.addEventListener('click', toggle);
    backdrop.addEventListener('click', () => setExpanded(false));
    monitor.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && monitor.classList.contains('is-expanded')) setExpanded(false);
    });
  }

  setupMonitorExpansion();

  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!frame)frame=requestAnimationFrame(draw);});
  new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(draw);}).observe(document.getElementById('plantao-simulator'),{attributes:true,attributeFilter:['hidden']});
  reduced.addEventListener('change',()=>{if(!frame)frame=requestAnimationFrame(draw);});
  window.PlantaoMonitor={update,react};
})();
