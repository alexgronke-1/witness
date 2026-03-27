"use client";

import { useState, useEffect, useRef } from "react";

const P = {
  bg:"#0C0C14", surface:"#13131E", surface2:"#1A1A28",
  border:"#22223A", border2:"#2E2E4A",
  blue:"#0057FF", blueD:"#0046CC",
  red:"#FF3B30", yellow:"#FFD600",
  white:"#F2F0EA", dim:"#8888AA", muted:"#4A4A66", text:"#E8E6E0",
};

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

const STAGES = ["Orient","The Before","Decision","What Broke","Moment It Worked","The Personal"];
const getStage = n => [0,4,8,12,16,20].findIndex((v,i,a) => n < (a[i+1] ?? 999));

const gss = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&family=DM+Serif+Display:ital@0;1&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;background:${P.bg};}
::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${P.border2};}
@keyframes fadeUp{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
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
  const bottomRef = useRef(null);
  const recRef    = useRef(null);

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

  async function start() {
    if (!name.trim()) return;
    setPhase("interview"); setLoading(true); setErr(null);
    try {
      const ctx = `Subject: ${name}${company ? ` at ${company}` : ""}${product ? `. They implemented: ${product}` : ""}.`;
      const reply = await callClaude([{ role:"user", content:ctx }], SYSTEM);
      setMessages([{ role:"interviewer", content:reply }]);
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }

  async function send() {
    const text = (input + interim).trim();
    if (!text || loading) return;
    if (listening) { recRef.current?.stop(); setListen(false); }
    setInput(""); setInterim("");
    const next = [...messages, { role:"subject", content:text }];
    setMessages(next); setLoading(true); setErr(null);
    try {
      const reply = await callClaude(buildMsgs(next, name, company, product), SYSTEM);
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

  const sc = messages.filter(m=>m.role==="subject").length;
  const stage = getStage(sc);

  if (phase === "intro") return (
    <>
      <style dangerouslySetInnerHTML={{ __html: gss }} />
      <div style={{position:"fixed",inset:0,background:P.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",overflow:"hidden"}}>
        {/* Orb background */}
        <img src="/pretzl-orb.svg" alt="" aria-hidden="true" style={{position:"absolute",width:700,height:700,top:"50%",left:"50%",transform:"translate(-50%,-50%)",mixBlendMode:"screen",opacity:0.35,pointerEvents:"none",userSelect:"none"}} />
        <div style={{maxWidth:440,width:"100%",padding:"0 32px",position:"relative",zIndex:1}}>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:46,color:P.white,lineHeight:1.05,marginBottom:8,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            The <img src="/pretzl-wordmark.png" alt="Pretzl" style={{height:42,display:"inline-block",verticalAlign:"middle",opacity:0.9}} /> Interview Project
          </div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#8A8AAA",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:44}}>
            Market Narrative Builder
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
      {/* Orb background */}
      <img src="/pretzl-orb.svg" alt="" aria-hidden="true" style={{position:"fixed",width:600,height:600,bottom:"-150px",right:"-150px",mixBlendMode:"screen",opacity:0.2,pointerEvents:"none",userSelect:"none",zIndex:0}} />
      <div style={{display:"grid",gridTemplateRows:"58px 1fr",height:"100vh",fontFamily:"'DM Sans',sans-serif",background:P.bg,position:"relative",zIndex:1}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",borderBottom:`1px solid ${P.border}`,background:P.bg}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
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
            <button onClick={exportFile} disabled={messages.length<2}
              style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",padding:"7px 16px",border:`1px solid ${P.border2}`,background:"transparent",color:"#AAAACC",cursor:"pointer"}}>
              Export
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 360px",overflow:"hidden"}}>

          {/* Interview */}
          <div style={{display:"flex",flexDirection:"column",borderRight:`1px solid ${P.border}`}}>

            {/* Stage bar */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px 12px",borderBottom:`1px solid ${P.border}`,flexShrink:0}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:P.blue,letterSpacing:"0.14em",textTransform:"uppercase"}}>{STAGES[stage]}</div>
              <div style={{display:"flex",gap:6}}>
                {STAGES.map((_,i)=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:i<stage?P.muted:i===stage?P.blue:P.border2,transition:"background 0.3s"}}/>)}
              </div>
            </div>

            {/* Messages */}
            <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"flex",flexDirection:"column"}}>
              {err && <div style={{background:`${P.red}18`,border:`1px solid ${P.red}44`,color:P.red,fontFamily:"'DM Mono',monospace",fontSize:11,padding:"8px 14px",marginBottom:10}}>{err}</div>}
              {messages.map((m,i)=>{
                const subjectsBefore = messages.slice(0,i).filter(x=>x.role==="subject").length;
                const stageNow = getStage(subjectsBefore);
                const stagePrev = i===0 ? -1 : getStage(messages.slice(0,i-1).filter(x=>x.role==="subject").length);
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
            <div style={{padding:"16px 24px",borderTop:`1px solid ${P.border}`,flexShrink:0,background:P.surface}}>
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
                <button onClick={send} disabled={loading||(!input.trim()&&!interim)}
                  style={{width:42,height:42,background:(input.trim()||interim)&&!loading?P.blue:P.border2,border:"none",color:(input.trim()||interim)&&!loading?"#fff":P.muted,cursor:(input.trim()||interim)&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16}}>
                  ↑
                </button>
              </div>
              {interim && <div style={{fontSize:12,color:P.dim,fontStyle:"italic",marginTop:6}}>{interim}</div>}
            </div>
          </div>

          {/* Story Map */}
          <div style={{display:"flex",flexDirection:"column",background:P.surface}}>
            <div style={{padding:"14px 18px 12px",borderBottom:`1px solid ${P.border}`,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontFamily:"'DM Serif Display',serif",fontStyle:"italic",fontSize:16,color:"#AAAACC"}}>Story Map</div>
              {storyMap && <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:P.blue,letterSpacing:"0.1em",textTransform:"uppercase"}}>Live</div>}
            </div>

            <div style={{flex:1,overflowY:"auto",padding:"18px",display:"flex",flexDirection:"column",gap:18}}>
              {!storyMap ? (
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:14,opacity:0.25,textAlign:"center"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",border:`1px solid ${P.muted}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:P.muted}}/>
                  </div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#8888AA",letterSpacing:"0.1em",textTransform:"uppercase",lineHeight:1.8}}>Map builds<br/>as scenes<br/>surface</div>
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

            <div style={{padding:"14px 18px",borderTop:`1px solid ${P.border}`,flexShrink:0}}>
              <button onClick={()=>doExtract(messages)} disabled={messages.length<4||extracting}
                style={{width:"100%",padding:"10px",background:"transparent",border:`1px solid ${P.border2}`,color:"#8A8AAA",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer"}}>
                {extracting?"Analyzing…":"Update Story Map"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
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
