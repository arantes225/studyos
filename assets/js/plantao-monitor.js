(() => {
  'use strict';
  let vitals = {}, context = {}, frame = 0;
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
        value+=25*gaussian(d,-.015,.046)-18*gaussian(d,.055,.04)-7*gaussian(d,.19,.065);
      } else {
        // AF has no discrete P wave. Organized post-ROSC does not assert sinus origin.
        if(p.type==='sinus') value+=4*gaussian(d,-.16,.026);
        value+=-5*gaussian(d,-.022,.009)+29*gaussian(d,0,.009)-8*gaussian(d,.025,.011);
        value+=7*gaussian(d,Math.min(.26,60/p.hr*.43),.042);
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
    vitals = {...next};
    const mental = normalize(vitals.mental);
    const unconscious = /inconsciente|desacordad|nao responsiv|nao responde|arresponsiv|coma|irresponsiv/.test(mental);
    const img = document.getElementById('plantao-patient-image');
    const src = `assets/img/plantao/${unconscious ? 'unconscious' : 'awake'}.webp`;
    if (img && img.getAttribute('src') !== src) img.src = src;
    if (img) img.alt = `Ilustração do paciente ${unconscious ? 'desacordado' : 'acordado'} no leito`;
    const badge = document.getElementById('plantao-consciousness');
    if (badge) badge.textContent = vitals.mental || 'Estado neurológico não informado';
    if (!frame) frame = requestAnimationFrame(draw);
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
    ctx.strokeStyle = '#143044';ctx.lineWidth = 1;
    for (let x=0;x<w;x+=25) {ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    const p=profile(vitals,context);
    const rr=number(vitals.rr);
    const seconds=reduced.matches ? 6 : time/1000;
    const rows=[
      {label:'ECG · 6 s',color:'#55ef93',sample:t=>ecg(t,p)},
      {label:'PLET',color:'#50e5f4',sample:t=>pleth(t,p,vitals)},
      {label:'RESP',color:'#f5da57',sample:t=>Number.isFinite(rr)&&rr>=0 ? 15*Math.sin(t*rr/60*Math.PI*2) : null}
    ];
    rows.forEach((row,i)=>{
      const base=42+i*72;
      ctx.fillStyle=row.color;ctx.font='15px sans-serif';ctx.fillText(row.label,8,base-25);
      ctx.beginPath();ctx.strokeStyle=row.color;ctx.lineWidth=2;
      if(row.sample(seconds)===null) {
        ctx.font='15px sans-serif';
        ctx.fillText(i===0?'Traçado não disponível':'Sem sinal',150,base);
        return;
      }
      for(let x=0;x<w;x++) {
        const t=seconds-6+6*x/w;
        const y=base-row.sample(t);
        if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.stroke();
    });
    if(!reduced.matches) frame=requestAnimationFrame(draw);
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!frame)frame=requestAnimationFrame(draw);});
  new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(draw);}).observe(document.getElementById('plantao-simulator'),{attributes:true,attributeFilter:['hidden']});
  reduced.addEventListener('change',()=>{if(!frame)frame=requestAnimationFrame(draw);});
  window.PlantaoMonitor={update};
})();
