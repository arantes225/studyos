(function(){
  const raw=window.LURIA_EXAM_PRIORITY_DATA||{exams:[],themes:[]};
  const exams=raw.exams||[];
  const normalize=(value)=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const records=(raw.themes||[]).map((row)=>({
    theme:row[0],area:row[1],ranks:Object.fromEntries(exams.map((exam,index)=>[exam,Number(row[index+2]||0)]))
  }));
  const byKey=new Map(records.map((r)=>[normalize(r.theme),r]));
  const maxByExamArea={};
  records.forEach((r)=>exams.forEach((exam)=>{
    const rank=r.ranks[exam]||0;
    if(!rank)return;
    const key=exam+"|"+normalize(r.area);
    maxByExamArea[key]=Math.max(maxByExamArea[key]||0,rank);
  }));
  const aliases=new Map();

  function setAlias(source,canonical){
    const s=normalize(source),c=normalize(canonical);
    if(s&&c&&byKey.has(c)) aliases.set(s,c);
  }

  function resolveRecord(theme,area){
    const key=normalize(theme);
    const alias=aliases.get(key);
    let record=byKey.get(alias||key)||null;
    if(record&&area&&normalize(record.area)!==normalize(area)){
      const same=records.find((r)=>normalize(r.theme)===normalize(record.theme)&&normalize(r.area)===normalize(area));
      if(same) record=same;
    }
    return record;
  }

  function sanitizeExams(selected){
    return Array.from(new Set((selected||[]).filter((exam)=>exams.includes(exam)))).slice(0,3);
  }

  function evaluate(theme,area,selectedExams){
    const selected=sanitizeExams(selectedExams);
    const record=resolveRecord(theme,area);
    if(!record||!selected.length) return {matched:Boolean(record),score:0,tier:"none",coverage:0,total:selected.length,canonicalTheme:record?.theme||null,area:record?.area||area||null,ranks:{}};
    const weights=[0.50,0.30,0.20].slice(0,selected.length);
    const weightTotal=weights.reduce((a,b)=>a+b,0)||1;
    let weightedRelevance=0;
    let coveredWeight=0;
    const ranks={};
    selected.forEach((exam,index)=>{
      const rank=Number(record.ranks[exam]||0);
      ranks[exam]=rank||null;
      if(!rank)return;
      const max=Math.max(1,maxByExamArea[exam+"|"+normalize(record.area)]||rank);
      const relevance=max===1?1:1-((rank-1)/(max-1));
      const weight=weights[index]||0;
      weightedRelevance+=Math.max(0,Math.min(1,relevance))*weight;
      coveredWeight+=weight;
    });
    const coverage=coveredWeight/weightTotal;
    const mean=weightedRelevance/weightTotal;
    const score=(mean*0.72)+(coverage*0.28);
    const tier=score>=0.72?"high":score>=0.46?"medium":score>0?"low":"none";
    return {matched:true,score,tier,coverage:values.length,total:selected.length,canonicalTheme:record.theme,area:record.area,ranks};
  }

  function sortRows(rows,selectedExams){
    const selected=sanitizeExams(selectedExams);
    if(!selected.length)return [...rows];
    return [...rows].map((row,index)=>({row,index,priority:evaluate(row.theme,row.area,selected)}))
      .sort((a,b)=>b.priority.score-a.priority.score||b.priority.coverage-a.priority.coverage||a.index-b.index)
      .map(({row,priority})=>({...row,examPriority:priority}));
  }

  function label(result){
    if(!result||result.tier==="none")return "";
    return result.tier==="high"?"Prioridade alta":result.tier==="medium"?"Prioridade média":"Prioridade baixa";
  }

  // Gancho futuro: a IA poderá registrar equivalências entre títulos de cursinhos e o tema canônico.
  // Ex.: LuriaExamPriority.registerAlias("SCA: diagnóstico e manejo","Síndromes coronarianas agudas")
  window.LuriaExamPriority={
    exams:[...exams],
    normalize,
    sanitizeExams,
    evaluate,
    sortRows,
    label,
    registerAlias:setAlias,
    resolveCanonicalTheme(theme,area){return resolveRecord(theme,area)?.theme||null;},
    ingestAiMatches(matches){
      (matches||[]).forEach((m)=>setAlias(m?.sourceTitle||m?.title,m?.canonicalTheme||m?.theme));
    }
  };
})();
