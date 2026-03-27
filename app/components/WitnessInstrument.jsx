"use client";

import { useState, useEffect, useRef } from "react";

const P = {
  bg:"#0C0C14", surface:"#13131E", surface2:"#1A1A28",
  border:"#22223A", border2:"#2E2E4A",
  blue:"#0057FF", blueD:"#0046CC",
  red:"#FF3B30", yellow:"#FFD600",
  white:"#F2F0EA", dim:"#8888AA", muted:"#4A4A66", text:"#E8E6E0",
};

const STAGES = ["Orient","The Before","Decision","What Broke","Moment It Worked","The Personal"];

const STAGE_DESC = [
  "A few quick questions to set context — who you are and what you built.",
  "Let's paint a picture of what the situation looked like before the change.",
  "How the decision actually got made — the honest version.",
  "Every implementation has a rough patch. Let's find yours.",
  "The specific moment you knew something had shifted.",
  "What this means beyond the work itself.",
];

const DURATION_CONFIG = {
  5:  {
    activeStages:  [0, 1],
    thresholds:    [0, 3],
    timeRemaining: [5, 2],
    pacingNote: "TIME CONSTRAINT: This is a 5-minute interview. Cover ONLY Orient (1-2 questions) and The Before (2-3 questions). Move briskly. Do not proceed past The Before.",
  },
  10: {
    activeStages:  [0, 1, 2, 3, 4],
    thresholds:    [0, 3, 6, 9, 12],
    timeRemaining: [10, 8, 6, 4, 2],
    pacingNote: "TIME CONSTRAINT: This is a 10-minute interview. Cover Orient, The Before, Decision, What Broke, and Moment It Worked. Skip The Personal. Max 2-3 questions per stage.",
  },
  15: {
    activeStages:  [0, 1, 2, 3, 4, 5],
    thresholds:    [0, 4, 8, 12, 16, 20],
    timeRemaining: [15, 12, 10, 7, 5, 2],
    pacingNote: "TIME CONSTRAINT: This is a 15-minute interview. Cover all 6 stages at a natural pace.",
  },
};

function getStagePos(n, cfg) {
  const t = cfg.thresholds;
  return Math.min(t.findIndex((v,i) => n < (t[i+1] ?? 999)), cfg.activeStages.length - 1);
}
function getStageIdx(n, cfg) {
  return cfg.activeStages[getStagePos(n, cfg)];
}

const FINAL_Q = "What didn't you ask me that you should have?";

const SYSTEM = `You are a documentary interviewer doing pre-production research. Surface witness moments — specific, irreplaceable knowledge only this person has — not spokesperson talking points.

THE CORE DISTINCTION: A spokesperson tells you what they believe. A witness tells you what they saw. Find the witness.

WHAT YOU WANT:
- Scenes with a before, during, after
- What they personally had at risk
- The irregular detail: specific number, name, day, thing that almost didn't work
- Personal connection: how life outside work connects to what they built
- Doubt: what they feared, what they almost did instead

WHAT YOU DON'T WANT:
- Beliefs about the product
- Industry trends
- Generic transformation narratives
- Anything a marketing team could have written before the interview

STAGES — work through these, but follow energy:
ORIENT (2-3 questions): Just enough context. Role, what they built, roughly when.
THE BEFORE: What was specifically broken? Who felt it most? Push for concrete — not "processes were inefficient" but "what did a Tuesday morning look like?"
THE DECISION: How did they actually decide? What were they afraid of? What did they almost do instead?
WHAT BROKE FIRST: Every implementation has a moment something goes wrong. Where's the honest testimony?
THE MOMENT IT WORKED: Not "when did you see ROI." What was the specific moment they knew?
THE PERSONAL: Anything in their life outside work connecting to why this matters?

QUESTION RULES:
- One question at a time. Never stack.
- Vague answer → go narrower: "Can you give me a specific example?"
- Number or proper noun → follow it immediately
- "I remember..." → stop everything and follow that thread
- Never ask "what would you say to others considering this" — that's a spokesperson question
- Short responses like "Tell me more about that." often beat new questions

TONE: Genuinely curious. You're trying to understand, not build a case.
Keep responses concise. One question. Don't explain why. Just ask.`;

const EXTRACTOR = `Analyze this interview transcript. Return ONLY valid JSON, nothing else:
{"subject":"name and role or null","the_before":"specific description of what was broken or null","stakes":"what they personally had at risk or null","scenes":[{"label":"short title","detail":"specific detail from their words"}],"witness_moments":[{"quote":"their actual words","why":"why witness not spokesperson"}],"personal_thread":"any personal connection or null","best_question_remaining":"single best unasked question"}`;

const STUDIO_OUTPUTS = [
  {
    key: "battleCard",
    label: "Battle Card",
    description: "Problem / Solution / Outcome / Quote / Objection Handler",
    system: `You are a strategic content writer. Based on this interview transcript, create a concise battle card with: 1) The Problem (2-3 sentences of what was broken), 2) The Solution (what they did), 3) The Outcome (specific results with numbers if available), 4) Key Quote (best pull quote from the transcript), 5) Objection Handler (one likely objection and how this story addresses it). Be specific. Use their actual words where possible.`,
  },
  {
    key: "brief",
    label: "Brief",
    description: "200-250 word narrative treatment in third person",
    system: `You are a content strategist. Write a 200-250 word narrative brief based on this interview. It should read like a story treatment — the before, the decision, the implementation, the outcome, and what it means. Write in third person. Be specific and concrete. No marketing language.`,
  },
  {
    key: "storyAngles",
    label: "Story Angles",
    description: "4 distinct editorial angles with headlines and hooks",
    system: `You are an editorial strategist. Based on this interview transcript, suggest 4 distinct story angles. For each angle provide: a headline (under 10 words), a one-sentence hook, and the key interview moment that supports it. Format clearly with angle numbers.`,
  },
  {
    key: "heygenScript",
    label: "HeyGen Script",
    description: "90-second video script for AI avatar presenter",
    system: `You are a video scriptwriter. Write a 90-second video script based on this interview for an AI avatar presenter. The script should: open with a hook (the most compelling moment), tell the story arc (before/decision/outcome), end with a specific memorable line. Include [PAUSE] directions. Target 220 words. Write in a warm, direct conversational tone — not corporate.`,
  },
];

async function callClaude(messages, system, maxTokens = 500) {
  const res = await fetch("/api/interview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:maxTokens, system, messages }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text || "";
}

function buildMsgs(msgs, name, company, product) {
  const ctx = `Subject: ${name}${company ? ` at ${company}` : ""}${product ? `. They implemented: ${product}` : ""}.`;
  const out = [{ role:"user", content:ctx }];
  for (const m of msgs) out.push({ role: m.role === "interviewer" ? "assistant" : "user", content: m.content });
  return out;
}

function buildTranscript(msgs) {
  return msgs.map(m => `${m.role === "interviewer" ? "INTERVIEWER" : "SUBJECT"}: ${m.content}`).join("\n\n");
}

const gss = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&family=DM+Serif+Display:ital@0;1&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;background:${P.bg};}
::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${P.border2};}
@keyframes fadeUp{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeDown{from{opacity:0;transform:translateY(-5px);}to{opacity:1;transform:translateY(0);}}
@keyframes pulse{0%,100%{opacity:0.25;}50%{opacity:1;}}
@keyframes ripple{0%{transform:scale(1);opacity:0.7;}100%{transform:scale(2.2);opacity:0;}}
`;

export default function Witness() {
  const [phase, setPhase]       = useState("intro");
  const [name, setName]         = useState("Fiona Ryan");
  const [company, setCompany]   = useState("Pretzl");
  const [product, setProduct]   = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [listening, setListen]  = useState(false);
  const [interim, setInterim]   = useState("");
  const [storyMap, setMap]      = useState(null);
  const [extracting, setExt]    = useState(false);
  const [speechOk, setSpeech]   = useState(false);
  const [err, setErr]           = useState(null);
  const [stageCard, setStageCard] = useState(null);
  const [duration, setDuration]   = useState(15);
  const [studioTab, setStudioTab] = useState("client");
  const [studioOutputs, setStudioOutputs] = useState({});
  const [studioLoading, setStudioLoading] = useState({});
  const [studioCopied, setStudioCopied] = useState({});
  const [sharecopied, setShareCopied] = useState(false);
  const bottomRef  = useRef(null);
  const recRef     = useRef(null);
  const prevStage  = useRef(-1);
  const cardTimer  = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setSpeech(true);
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = "en-US";
    r.onresult = e => {
      let fin = "", int = "";
      for (let i = e.resultIndex; i < e.results.length; i++)
        e.results[i].isFinal ? fin += e.results[i][0].transcript : int += e.results[i][0].transcript;
      if (fin) setInput(p => p + fin);
      setInterim(int);
    };
    r.onend = () => { setListen(false); setInterim(""); };
    r.onerror = () => { setListen(false); setInterim(""); };
    recRef.current = r;
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  const sc = messages.filter(m=>m.role==="subject").length;
  const cfg = DURATION_CONFIG[duration];
  const stagePos = getStagePos(sc, cfg);
  const stageIdx = getStageIdx(sc, cfg);

  useEffect(() => {
    if (stageIdx !== prevStage.current) {
      prevStage.current = stageIdx;
      setStageCard(stageIdx);
      clearTimeout(cardTimer.current);
      cardTimer.current = setTimeout(() => setStageCard(null), 5000);
    }
  }, [stageIdx]);

  function reset() {
    setPhase("intro");
    setMessages([]);
    setInput("");
    setMap(null);
    setErr(null);
    setStageCard(null);
    setStudioTab("client");
    setStudioOutputs({});
    setStudioLoading({});
    setStudioCopied({});
    prevStage.current = -1;
  }

  async function start() {
    if (!name.trim()) return;
    setPhase("interview"); setLoading(true); setErr(null);
    prevStage.current = -1;
    try {
      const ctx = `Subject: ${name}${company ? ` at ${company}` : ""}${product ? `. They implemented: ${product}` : ""}.`;
      const system = SYSTEM + "\n\n" + DURATION_CONFIG[duration].pacingNote;
      const reply = await callClaude([{ role:"user", content:ctx }], system);
      setMessages([{ role:"interviewer", content:reply }]);
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }

  async function send(overrideText) {
    const text = (overrideText || input + interim).trim();
    if (!text || loading) return;
    if (listening) { recRef.current?.stop(); setListen(false); }
    setInput(""); setInterim("");
    const next = [...messages, { role:"subject", content:text }];
    setMessages(next); setLoading(true); setErr(null);
    try {
      const system = SYSTEM + "\n\n" + DURATION_CONFIG[duration].pacingNote;
      const reply = await callClaude(buildMsgs(next, name, company, product), system);
      const final = [...next, { role:"interviewer", content:reply }];
      setMessages(final);
      const sc = final.filter(m => m.role === "subject").length;
      if (sc % 3 === 0 && sc > 0) doExtract(final);
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }

  async function doExtract(msgs) {
    if (extracting) return;
    setExt(true);
    try {
      const tx = (msgs||messages).map(m => `${m.role==="interviewer"?"INTERVIEWER":"SUBJECT"}: ${m.content}`).join("\n\n");
      const raw = await callClaude([{ role:"user", content:`Extract story map:\n\n${tx}` }], EXTRACTOR, 900);
      setMap(JSON.parse(raw.replace(/```json|```/g,"").trim()));
    } catch(e) { console.error(e); }
    setExt(false);
  }

  async function generateStudioOutput(outputKey, system) {
    if (messages.length < 2) return;
    setStudioLoading(prev => ({ ...prev, [outputKey]: true }));
    try {
      const transcript = buildTranscript(messages);
      const text = await callClaude(
        [{ role:"user", content:`Here is the interview transcript:\n\n${transcript}` }],
        system,
        1200
      );
      setStudioOutputs(prev => ({ ...prev, [outputKey]: text }));
    } catch(e) {
      setStudioOutputs(prev => ({ ...prev, [outputKey]: `Error: ${e.message}` }));
    }
    setStudioLoading(prev => ({ ...prev, [outputKey]: false }));
  }

  async function copyStudioOutput(outputKey) {
    const text = studioOutputs[outputKey];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStudioCopied(prev => ({ ...prev, [outputKey]: true }));
      setTimeout(() => setStudioCopied(prev => ({ ...prev, [outputKey]: false })), 2000);
    } catch(e) { console.error(e); }
  }

  async function shareWithClient() {
    if (!storyMap) return;
    try {
      const encoded = encodeURIComponent(btoa(JSON.stringify(storyMap)));
      const url = `${window.location.origin}/review?d=${encoded}`;
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch(e) { console.error(e); }
  }

  function toggleListen() {
    if (!recRef.current) return;
    if (listening) { recRef.current.stop(); setListen(false); }
    else { recRef.current.start(); setListen(true); }
  }

  function onKey(e) { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); send(); } }

  function exportFile() {
    const body = messages.map(m=>`[${m.role==="interviewer"?"INTERVIEWER":name.toUpperCase()}]\n${m.content}`).join("\n\n---\n\n");
    const map = storyMap ? `\n\n${"═".repeat(50)}\nSTORY MAP\n${"═".repeat(50)}\n\n${JSON.stringify(storyMap,null,2)}` : "";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body+map],{type:"text/plain"}));
    a.download = `witness-${name.toLowerCase().replace(/\s+/g,"-")}.txt`;
    a.click();
  }

  if (phase === "intro") return (
    <>
      <style dangerouslySetInnerHTML={{ __html: gss }} />
      <div style={{position:"fixed",inset:0,background:P.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",overflow:"hidden"}}>
        <img src="/pretzl-orb.svg" alt="" aria-hidden="true" style={{position:"absolute",width:700,height:700,top:"50%",left:"50%",transform:"translate(-50%,-50%)",mixBlendMode:"screen",opacity:0.35,pointerEvents:"none",userSelect:"none"}} />
        <div style={{maxWidth:440,width:"100%",padding:"0 32px",position:"relative",zIndex:1}}>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:46,color:P.white,lineHeight:1.05,marginBottom:8,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            The <img src="/pretzl-wordmark.png" alt="Pretzl" style={{height:42,display:"inline-block",verticalAlign:"middle",opacity:0.9}} /> Interview Project
          </div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#8A8AAA",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:8}}>
            Market Narrative Builder
          </div>
          <div style={{fontSize:14,color:"#7A7A99",fontWeight:300,lineHeight:1.7,marginBottom:20}}>
            {duration} minutes. {DURATION_CONFIG[duration].activeStages.length} stages. Your story, captured precisely.
          </div>
          <div style={{display:"flex",gap:8,marginBottom:36}}>
            {[5,10,15].map(d=>(
              <button key={d} onClick={()=>setDuration(d)}
                style={{flex:1,padding:"9px 0",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.12em",textTransform:"uppercase",border:`1px solid ${duration===d?P.blue:P.border2}`,background:duration===d?`${P.blue}18`:"transparent",color:duration===d?P.blue:"#7A7A99",cursor:"pointer",transition:"all 0.2s"}}>
                {d} min
              </button>
            ))}
          </div>
          {[
            ["Subject name","Fiona Ryan",name,setName],
            ["Company","Pretzl",company,setCompany],
            ["What they implemented","",product,setProduct],
          ].map(([lbl,ph,val,set]) => (
            <div key={lbl} style={{marginBottom:24}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:"#AAAACC",marginBottom:8}}>{lbl}</div>
              <input style={{width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${P.border2}`,color:P.white,fontFamily:"'DM Sans',sans-serif",fontSize:17,fontWeight:400,padding:"9px 0",outline:"none"}}
                placeholder={ph} value={val} onChange={e=>set(e.target.value)} onKeyDown={e=>e.key==="Enter"&&start()} />
            </div>
          ))}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:24}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:speechOk?P.yellow:"#5A5A78"}} />
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#8A8AAA",letterSpacing:"0.08em"}}>
              {speechOk ? "Voice input ready" : "Text only — use Chrome for voice"}
            </span>
          </div>
          <button onClick={start} disabled={!name.trim()}
            style={{width:"100%",padding:15,background:name.trim()?P.blue:P.border2,border:"none",color:name.trim()?"#fff":"#7A7A99",fontFamily:"'DM Mono',monospace",fontSize:12,letterSpacing:"0.14em",textTransform:"uppercase",cursor:name.trim()?"pointer":"not-allowed"}}>
            Begin Interview
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: gss }} />
      <img src="/pretzl-orb.svg" alt="" aria-hidden="true" style={{position:"fixed",width:600,height:600,bottom:"-150px",right:"-150px",mixBlendMode:"screen",opacity:0.2,pointerEvents:"none",userSelect:"none",zIndex:0}} />
      <div style={{display:"grid",gridTemplateRows:"58px 1fr",height:"100vh",fontFamily:"'DM Sans',sans-serif",background:P.bg,position:"relative",zIndex:1}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",borderBottom:`1px solid ${P.border}`,background:P.bg}}>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <button onClick={reset}
              style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.1em",color:"#7A7A99",background:"transparent",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:6}}>
              ← New Interview
            </button>
            <div style={{width:1,height:18,background:P.border2}}/>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <img src="/pretzl-wordmark.png" alt="Pretzl" style={{height:16,display:"inline-block",opacity:0.9}} />
              <span style={{fontFamily:"'DM Serif Display',serif",fontSize:16,color:"#AAAACC",fontStyle:"italic"}}>Interview Project</span>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>doExtract(messages)} disabled={messages.length<4||extracting}
              style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",padding:"7px 16px",border:`1px solid ${P.blue}`,background:"transparent",color:P.blue,cursor:"pointer"}}>
              {extracting?"Reading…":"Extract Map"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 360px",overflow:"hidden"}}>

          {/* Interview */}
          <div style={{display:"flex",flexDirection:"column",borderRight:`1px solid ${P.border}`}}>

            {/* Stage bar */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 24px",borderBottom:`1px solid ${P.border}`,flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:P.blue,letterSpacing:"0.14em",textTransform:"uppercase"}}>{STAGES[stageIdx]}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#5A5A78"}}>·</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#7A7A99"}}>~{cfg.timeRemaining[stagePos]} min remaining</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                {cfg.activeStages.map((sIdx,i)=>(
                  <div key={sIdx} style={{width:28,height:4,borderRadius:2,background:i<stagePos?"#3A3A5A":i===stagePos?P.blue:P.border2,transition:"background 0.4s"}}/>
                ))}
              </div>
            </div>

            {/* Stage intro card */}
            {stageCard !== null && (
              <div onClick={()=>setStageCard(null)} style={{margin:"16px 24px 0",padding:"14px 18px",background:`${P.blue}10`,border:`1px solid ${P.blue}30`,cursor:"pointer",animation:"fadeDown 0.3s ease forwards",flexShrink:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                  <div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.16em",textTransform:"uppercase",color:P.blue,marginBottom:5}}>{STAGES[stageCard]}</div>
                    <div style={{fontSize:14,color:"#C0C0D8",lineHeight:1.6,fontWeight:300}}>{STAGE_DESC[stageCard]}</div>
                  </div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#4A4A66",flexShrink:0,marginTop:2}}>tap to dismiss</div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"flex",flexDirection:"column"}}>
              {err && <div style={{background:`${P.red}18`,border:`1px solid ${P.red}44`,color:P.red,fontFamily:"'DM Mono',monospace",fontSize:11,padding:"8px 14px",marginBottom:10}}>{err}</div>}
              {messages.map((m,i)=>{
                const subjectsBefore = messages.slice(0,i).filter(x=>x.role==="subject").length;
                const stageNow = getStageIdx(subjectsBefore, cfg);
                const stagePrev = i===0 ? -1 : getStageIdx(messages.slice(0,i-1).filter(x=>x.role==="subject").length, cfg);
                const showDivider = i>0 && stageNow !== stagePrev;
                return (
                  <div key={i}>
                    {showDivider && (
                      <div style={{display:"flex",alignItems:"center",gap:12,padding:"24px 0 8px",animation:"fadeUp 0.4s ease forwards"}}>
                        <div style={{flex:1,height:1,background:P.border2}}/>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.18em",textTransform:"uppercase",color:P.blue,whiteSpace:"nowrap"}}>{STAGES[stageNow]}</div>
                        <div style={{flex:1,height:1,background:P.border2}}/>
                      </div>
                    )}
                    <div style={{padding:"18px 0",borderBottom:`1px solid ${P.border}`,animation:"fadeUp 0.3s ease forwards"}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:m.role==="interviewer"?P.blue:"#AAAACC",marginBottom:10}}>
                        {m.role==="interviewer"?"Interviewer":name}
                      </div>
                      <div style={{fontSize:16,lineHeight:1.9,color:m.role==="interviewer"?"#E8E6E0":P.white,fontWeight:m.role==="subject"?400:300}}>
                        {m.content}
                      </div>
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div style={{display:"flex",gap:5,padding:"18px 0",alignItems:"center"}}>
                  {[0,1,2].map(i=><div key={i} style={{width:4,height:4,borderRadius:"50%",background:P.blue,animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}
                </div>
              )}
              <div ref={bottomRef}/>
            </div>

            {/* Input */}
            <div style={{padding:"12px 24px 16px",borderTop:`1px solid ${P.border}`,flexShrink:0,background:P.surface}}>
              {/* Final question chip */}
              {stagePos >= cfg.activeStages.length - 1 && messages.length > 4 && (
                <div style={{marginBottom:10}}>
                  <button onClick={()=>send(FINAL_Q)} disabled={loading}
                    style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:300,color:"#9A9ABB",background:"transparent",border:`1px solid ${P.border2}`,padding:"7px 14px",cursor:"pointer",fontStyle:"italic",transition:"border-color 0.2s, color 0.2s"}}
                    onMouseEnter={e=>{e.target.style.borderColor=P.blue;e.target.style.color=P.white;}}
                    onMouseLeave={e=>{e.target.style.borderColor=P.border2;e.target.style.color="#9A9ABB";}}>
                    "{FINAL_Q}"
                  </button>
                </div>
              )}
              <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                <textarea
                  style={{flex:1,background:P.bg,border:`1px solid ${P.border2}`,color:P.white,fontFamily:"'DM Sans',sans-serif",fontSize:15,fontWeight:300,padding:"10px 14px",resize:"none",outline:"none",lineHeight:1.7,minHeight:44,maxHeight:120}}
                  placeholder={listening?"Listening…":"Type your answer, or tap the mic…"}
                  value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey} disabled={loading} rows={1}
                />
                {speechOk && (
                  <button onClick={toggleListen}
                    style={{width:42,height:42,borderRadius:"50%",border:`1px solid ${listening?P.red:P.border2}`,background:listening?`${P.red}18`:"transparent",color:listening?P.red:P.dim,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16,position:"relative"}}>
                    {listening ? "■" : "🎙"}
                    {listening && <div style={{position:"absolute",inset:-4,borderRadius:"50%",border:`2px solid ${P.red}`,animation:"ripple 1.2s ease-out infinite",pointerEvents:"none"}}/>}
                  </button>
                )}
                <button onClick={()=>send()} disabled={loading||(!input.trim()&&!interim)}
                  style={{width:42,height:42,background:(input.trim()||interim)&&!loading?P.blue:P.border2,border:"none",color:(input.trim()||interim)&&!loading?"#fff":P.muted,cursor:(input.trim()||interim)&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16}}>
                  ↑
                </button>
              </div>
              {interim && <div style={{fontSize:12,color:P.dim,fontStyle:"italic",marginTop:6}}>{interim}</div>}
            </div>
          </div>

          {/* Right Panel */}
          <div style={{display:"flex",flexDirection:"column",background:P.surface}}>

            {/* Tab switcher */}
            <div style={{padding:"10px 18px",borderBottom:`1px solid ${P.border}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div style={{display:"flex",gap:4,background:P.surface2,borderRadius:20,padding:3}}>
                {[["client","Client View"],["studio","Studio"]].map(([tab,label]) => (
                  <button key={tab} onClick={()=>setStudioTab(tab)}
                    style={{
                      fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",
                      padding:"5px 14px",borderRadius:16,border:"none",cursor:"pointer",
                      background: studioTab===tab ? P.blue : "transparent",
                      color: studioTab===tab ? "#fff" : P.dim,
                      transition:"background 0.2s, color 0.2s",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              {studioTab === "client" && storyMap && (
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:P.blue,letterSpacing:"0.1em",textTransform:"uppercase"}}>Live</div>
              )}
            </div>

            {/* Client View tab */}
            {studioTab === "client" && (
              <>
                <div style={{flex:1,overflowY:"auto",padding:"18px",display:"flex",flexDirection:"column",gap:18}}>
                  {!storyMap ? (
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:14,textAlign:"center"}}>
                      <div style={{width:28,height:28,borderRadius:"50%",border:`1px solid #4A4A66`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:"#4A4A66"}}/>
                      </div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#CCCCDD",letterSpacing:"0.1em",textTransform:"uppercase",lineHeight:1.8}}>Map builds<br/>as scenes<br/>surface</div>
                    </div>
                  ) : (
                    <>
                      {storyMap.subject && <MapSection label="Subject" color={P.muted} text={storyMap.subject}/>}
                      {storyMap.the_before && <MapSection label="The Before" color={P.red} text={storyMap.the_before}/>}
                      {storyMap.stakes && <MapSection label="Stakes" color={P.yellow} text={storyMap.stakes}/>}
                      {storyMap.scenes?.length > 0 && (
                        <div style={{borderLeft:`2px solid ${P.blue}`,paddingLeft:13}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:P.blue,marginBottom:10}}>Scenes</div>
                          {storyMap.scenes.map((sc,i)=>(
                            <div key={i} style={{marginBottom:14}}>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:P.blue,marginBottom:4}}>{sc.label}</div>
                              <div style={{fontSize:14,lineHeight:1.8,color:"#C0C0D8",fontWeight:300}}>{sc.detail}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {storyMap.witness_moments?.length > 0 && (
                        <div style={{borderLeft:`2px solid ${P.blue}`,paddingLeft:13}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:P.blue,marginBottom:10}}>Witness Moments</div>
                          {storyMap.witness_moments.map((w,i)=>(
                            <div key={i} style={{marginBottom:18}}>
                              <div style={{fontFamily:"'DM Serif Display',serif",fontStyle:"italic",fontSize:15,lineHeight:1.7,color:P.white,marginBottom:6}}>"{w.quote}"</div>
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#9A9ABB",lineHeight:1.65}}>{w.why}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {storyMap.personal_thread && <MapSection label="Personal Thread" color="#8B6E9E" text={storyMap.personal_thread}/>}
                      {storyMap.best_question_remaining && (
                        <div style={{background:`${P.blue}10`,border:`1px solid ${P.blue}22`,padding:14}}>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:P.blue,display:"block",marginBottom:8}}>Next Best Question</span>
                          <div style={{fontFamily:"'DM Serif Display',serif",fontStyle:"italic",fontSize:15,color:"#90C8EE",lineHeight:1.7}}>{storyMap.best_question_remaining}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div style={{padding:"14px 18px",borderTop:`1px solid ${P.border}`,flexShrink:0,display:"flex",flexDirection:"column",gap:8}}>
                  <button onClick={()=>doExtract(messages)} disabled={messages.length<4||extracting}
                    style={{width:"100%",padding:"10px",background:"transparent",border:`1px solid ${P.border2}`,color:"#8A8AAA",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer"}}>
                    {extracting?"Analyzing…":"Update Story Map"}
                  </button>
                  {storyMap && (
                    <button onClick={shareWithClient}
                      style={{width:"100%",padding:"10px",background:sharecopied?`${P.blue}22`:P.blue,border:`1px solid ${sharecopied?P.blue:P.blueD}`,color:"#fff",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",transition:"background 0.2s"}}>
                      {sharecopied ? "Copied!" : "Share with Client"}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Studio tab */}
            {studioTab === "studio" && (
              <div style={{flex:1,overflowY:"auto",padding:"18px",display:"flex",flexDirection:"column",gap:16}}>
                {messages.length < 2 && (
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:14,textAlign:"center"}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#CCCCDD",letterSpacing:"0.1em",textTransform:"uppercase",lineHeight:1.8}}>Start the interview<br/>to generate outputs</div>
                  </div>
                )}
                {messages.length >= 2 && STUDIO_OUTPUTS.map(({ key, label, description, system }) => (
                  <StudioCard
                    key={key}
                    label={label}
                    description={description}
                    content={studioOutputs[key]}
                    isLoading={studioLoading[key]}
                    isCopied={studioCopied[key]}
                    onGenerate={() => generateStudioOutput(key, system)}
                    onCopy={() => copyStudioOutput(key)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function StudioCard({ label, description, content, isLoading, isCopied, onGenerate, onCopy }) {
  return (
    <div style={{border:`1px solid ${P.border2}`,background:P.surface2,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"12px 14px",borderBottom:`1px solid ${P.border}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
        <div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:P.white,marginBottom:3}}>{label}</div>
          <div style={{fontSize:12,color:P.dim,fontWeight:300,lineHeight:1.5}}>{description}</div>
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          {content && (
            <button onClick={onCopy}
              style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",padding:"5px 10px",border:`1px solid ${P.border2}`,background:"transparent",color:isCopied?P.blue:P.dim,cursor:"pointer",transition:"color 0.2s"}}>
              {isCopied ? "Copied!" : "Copy"}
            </button>
          )}
          <button onClick={onGenerate} disabled={isLoading}
            style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",padding:"5px 10px",border:`1px solid ${isLoading?P.border2:P.blue}`,background:isLoading?"transparent":`${P.blue}18`,color:isLoading?P.dim:P.blue,cursor:isLoading?"not-allowed":"pointer",transition:"all 0.2s"}}>
            {isLoading ? "Generating…" : content ? "Regenerate" : "Generate"}
          </button>
        </div>
      </div>
      {isLoading && (
        <div style={{padding:"14px",display:"flex",gap:5,alignItems:"center"}}>
          {[0,1,2].map(i=><div key={i} style={{width:4,height:4,borderRadius:"50%",background:P.blue,animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}
        </div>
      )}
      {content && !isLoading && (
        <div style={{padding:"14px",overflowY:"auto",maxHeight:240}}>
          <div style={{fontSize:13,lineHeight:1.85,color:"#C0C0D8",fontWeight:300,whiteSpace:"pre-wrap"}}>{content}</div>
        </div>
      )}
    </div>
  );
}

function MapSection({ label, color, text }) {
  return (
    <div style={{borderLeft:`2px solid ${color}`,paddingLeft:13}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.12em",textTransform:"uppercase",color,marginBottom:7}}>{label}</div>
      <div style={{fontSize:14,lineHeight:1.8,color:"#C0C0D8",fontWeight:300}}>{text}</div>
    </div>
  );
}
