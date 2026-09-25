(() => {
  'use strict';
  let vitals = {}, frame = 0;
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const number = value => value === null || value === undefined || value === '' ? NaN : parseFloat(value);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function update(next) {
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
    const rhythm = normalize(vitals.rhythm);
    const vf = /fibrilacao ventricular|\bfv\b/.test(rhythm);
    const flat = /assistolia/.test(rhythm);
    const vt = /taquicardia ventricular|\btv\b/.test(rhythm);
    const af = /fibrilacao atrial|\bfa\b/.test(rhythm);
    const hr = number(vitals.hr), rr = number(vitals.rr), spo = number(vitals.spo2);
    const seconds = reduced.matches ? 0 : time / 1000;
    const rows = [{label:'ECG',color:'#55ef93',rate:hr},{label:'PLET',color:'#50e5f4',rate:hr},{label:'RESP',color:'#f5da57',rate:rr}];
    rows.forEach((row,i)=>{
      const base=42+i*72;
      ctx.fillStyle=row.color;ctx.font='17px sans-serif';ctx.fillText(row.label,8,base-24);
      ctx.beginPath();ctx.strokeStyle=row.color;ctx.lineWidth=2.8;
      const valid=i===0 ? (flat||vf||Number.isFinite(hr)) : i===1 ? (Number.isFinite(hr)&&Number.isFinite(spo)&&spo>0&&!vf&&!flat) : Number.isFinite(rr);
      if (!valid) {ctx.fillText('—',w/2,base);return;}
      for(let x=0;x<w;x++) {
        const t=seconds+x/110;
        const rate=Math.max(0,Number.isFinite(row.rate)?row.rate:0);
        const cycle=t*rate/60;
        const p=((cycle+(af&&i===0?.14*Math.sin(t*3):0))%1+1)%1;
        let value=0;
        if(i===0&&!flat) {
          if(vf) value=13*Math.sin(t*29)+7*Math.sin(t*47)+4*Math.sin(t*71);
          else if(rate>0&&vt) value=24*Math.sin(p*Math.PI*2);
          else if(rate>0) value=4*Math.exp(-Math.pow((p-.16)/.05,2))-6*Math.exp(-Math.pow((p-.34)/.018,2))+30*Math.exp(-Math.pow((p-.38)/.014,2))-10*Math.exp(-Math.pow((p-.42)/.02,2))+8*Math.exp(-Math.pow((p-.65)/.09,2));
        } else if(i===1&&rate>0) value=19*Math.sin(Math.PI*p)**4;
        else if(i===2&&rate>0) value=15*Math.sin(p*Math.PI*2);
        const y=base-value;
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
