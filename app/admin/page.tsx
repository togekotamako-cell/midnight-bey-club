"use client";

import { useEffect, useMemo, useState } from "react";

type Format = "3ON3" | "TEAM";
type Status = "ENTRY OPEN" | "UPCOMING" | "FINISHED";
type Player = { id: string; name: string; nickname?: string | null; points?: number; wins?: number; tournaments?: number; is_active?: boolean };
type Tournament = { id: string; name: string; date: string; location: string; status: Status; format: Format };
type Result = { id?: string; rank: number; player_id: string; player_name?: string; bey1: string; bey2: string; bey3: string; points: number };
type Team = { id?: string; name: string; rank: 1 | 2; members: string[] };
type Custom = { id?: string; label: string; value: string };
type Session = { access_token: string; user?: { id: string; email?: string } };

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function hdr(token?: string) { return { apikey: KEY, Authorization: `Bearer ${token || KEY}`, "Content-Type": "application/json", Accept: "application/json" }; }
async function api(path: string, init: RequestInit = {}, token?: string) {
  if (!URL || !KEY) throw new Error("SUPABASE ENVIRONMENT VARIABLES ARE MISSING.");
  return fetch(`${URL}${path}`, { ...init, headers: { ...hdr(token), ...(init.headers || {}) }, cache: "no-store" });
}
function enc(v: string) { return encodeURIComponent(v); }
function dateOut(v: unknown) { const s = String(v ?? ""); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.replaceAll("-", ".") : s; }
function dateIn(v: string) { return v.replaceAll(".", "-"); }
function uid() { return crypto.randomUUID(); }
function errText(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"tournaments" | "players">("tournaments");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [customs, setCustoms] = useState<Custom[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selected = tournaments.find(t => t.id === selectedId) ?? null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("midnight_session");
      if (!raw) return setAuthorized(false);
      const s = JSON.parse(raw) as Session;
      if (!s?.access_token || !s.user?.id) return setAuthorized(false);
      setSession(s);
    } catch { setAuthorized(false); }
  }, []);

  const loadAll = async () => {
    if (!session?.access_token || !session.user?.id) return;
    setMessage("LOADING...");
    const a = await api(`/rest/v1/accounts?select=is_admin,player_id,display_name&id=eq.${enc(session.user.id)}&limit=1`, {}, session.access_token);
    if (!a.ok) throw new Error(await a.text());
    const accounts = await a.json();
    if (!accounts?.[0]?.is_admin) { setAuthorized(false); setMessage("ADMIN ACCESS REQUIRED."); return; }
    setAuthorized(true);
    const [tr, pr] = await Promise.all([
      api("/rest/v1/tournaments?select=*&order=tournament_date.asc", {}, session.access_token),
      api("/rest/v1/players?select=*&order=name.asc", {}, session.access_token),
    ]);
    if (tr.ok) {
      const rows = await tr.json();
      setTournaments(Array.isArray(rows) ? rows.map((r: any) => ({ id:String(r.id), name:String(r.name??""), date:dateOut(r.tournament_date??r.date), location:String(r.location??""), status:(String(r.status??"UPCOMING") as Status), format:(String(r.format??r.tournament_format??r.tournament_type??"3ON3").toUpperCase().includes("TEAM")?"TEAM":"3ON3") })) : []);
    }
    if (pr.ok) {
      const rows = await pr.json();
      setPlayers(Array.isArray(rows) ? rows.map((r:any)=>({ id:String(r.id), name:String(r.name??"PLAYER"), nickname:r.nickname==null?null:String(r.nickname), points:Number(r.points??0), wins:Number(r.wins??0), tournaments:Number(r.tournaments??0), is_active:r.is_active!==false })) : []);
    }
    setMessage("");
  };

  useEffect(() => { if (session) loadAll().catch(e => { setAuthorized(false); setMessage(errText(e)); }); }, [session]);

  const openTournament = async (id: string) => {
    setSelectedId(id); setLoadingDetail(true); setMessage("");
    try {
      const [rr, cr, tr] = await Promise.all([
        api(`/rest/v1/tournament_results?select=*&tournament_id=eq.${enc(id)}&order=rank.asc`, {}, session?.access_token),
        api(`/rest/v1/custom_registrations?select=*&tournament_id=eq.${enc(id)}`, {}, session?.access_token),
        api(`/rest/v1/teams?select=*&tournament_id=eq.${enc(id)}`, {}, session?.access_token),
      ]);
      const rrows = rr.ok ? await rr.json() : [];
      const crows = cr.ok ? await cr.json() : [];
      const trows = tr.ok ? await tr.json() : [];
      setResults(Array.isArray(rrows) ? rrows.map((r:any)=>({ id:r.id, rank:Number(r.rank??r.place??r.placement??1), player_id:String(r.player_id??""), player_name:r.player_name, bey1:String(r.bey1??r.bey_1??""), bey2:String(r.bey2??r.bey_2??""), bey3:String(r.bey3??r.bey_3??""), points:Number(r.points??(Number(r.rank)===1?3:Number(r.rank)===2?2:1)) })) : []);
      setCustoms(Array.isArray(crows) ? crows.map((r:any)=>({ id:r.id, label:String(r.label??r.name??r.title??"CUSTOM"), value:typeof (r.custom_data??r.custom??r.value) === "string" ? String(r.custom_data??r.custom??r.value) : JSON.stringify(r.custom_data??r.custom??r.value??"") })) : []);
      if (Array.isArray(trows)) {
        const ids=trows.map((r:any)=>String(r.id)).filter(Boolean);
        let members:any[]=[];
        if(ids.length){ const mr=await api(`/rest/v1/team_members?select=*&team_id=in.(${ids.map(enc).join(",")})`,{},session?.access_token); if(mr.ok) members=await mr.json(); }
        setTeams(trows.map((r:any)=>({ id:r.id, name:String(r.name??r.team_name??"TEAM"), rank:(Number(r.rank??r.place??1)===2?2:1) as 1|2, members:members.filter(m=>String(m.team_id??"")===String(r.id)).map(m=>String(m.player_id??m.player_name??"")) })));
      } else setTeams([]);
    } catch(e){ setMessage(errText(e)); } finally { setLoadingDetail(false); }
  };

  const newTournament = () => {
    const id=uid();
    setTournaments(v=>[...v,{id,name:"NEW MIDNIGHT BEY CLUB",date:"",location:"",status:"UPCOMING",format:"3ON3"}]);
    setSelectedId(id); setResults([]); setTeams([]); setCustoms([]);
  };
  const updateT=(field:keyof Tournament,value:string)=>setTournaments(v=>v.map(t=>t.id===selectedId?({...t,[field]:value} as Tournament):t));
  const addResult=()=>setResults(v=>[...v,{id:uid(),rank:v.length+1,player_id:"",bey1:"",bey2:"",bey3:"",points:v.length===0?3:v.length===1?2:1}]);
  const addTeam=()=>setTeams(v=>[...v,{id:uid(),name:`TEAM ${v.length+1}`,rank:v.some(x=>x.rank===1)?2:1,members:["","",""]}]);
  const addCustom=()=>setCustoms(v=>[...v,{id:uid(),label:"CUSTOM",value:""}]);

  const save = async () => {
    if(!session?.access_token || !selected) return;
    setSaving(true); setMessage("SAVING...");
    try {
      const tBody={name:selected.name,tournament_date:dateIn(selected.date),location:selected.location,status:selected.status,format:selected.format};
      let res=await api(`/rest/v1/tournaments?id=eq.${enc(selected.id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(tBody)},session.access_token);
      if(!res.ok){
        res=await api("/rest/v1/tournaments",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({id:selected.id,...tBody})},session.access_token);
        if(!res.ok) throw new Error(`TOURNAMENT SAVE FAILED: ${await res.text()}`);
      }
      if(selected.format==="3ON3"){
        const old=await api(`/rest/v1/tournament_results?tournament_id=eq.${enc(selected.id)}`,{},session.access_token);
        if(old.ok){for(const r of await old.json()) if(r.id) await api(`/rest/v1/tournament_results?id=eq.${enc(String(r.id))}`,{method:"DELETE"},session.access_token);}
        for(const r of results.filter(x=>x.player_id)){
          const body={id:r.id??uid(),tournament_id:selected.id,player_id:r.player_id,rank:r.rank,place:r.rank,player_name:players.find(p=>p.id===r.player_id)?.nickname||players.find(p=>p.id===r.player_id)?.name||"PLAYER",bey1:r.bey1,bey2:r.bey2,bey3:r.bey3,points:r.rank===1?3:r.rank===2?2:1};
          const x=await api("/rest/v1/tournament_results",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(body)},session.access_token); if(!x.ok) throw new Error(`RESULT SAVE FAILED: ${await x.text()}`);
        }
      } else {
        const old=await api(`/rest/v1/teams?tournament_id=eq.${enc(selected.id)}`,{},session.access_token);
        if(old.ok){for(const r of await old.json()) if(r.id) await api(`/rest/v1/team_members?team_id=eq.${enc(String(r.id))}`,{method:"DELETE"},session.access_token); for(const r of await old.json()) if(r.id) await api(`/rest/v1/teams?id=eq.${enc(String(r.id))}`,{method:"DELETE"},session.access_token);}
        for(const team of teams){
          const tid=team.id??uid(); const x=await api("/rest/v1/teams",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({id:tid,tournament_id:selected.id,name:team.name,team_name:team.name,rank:team.rank,place:team.rank,points:team.rank===1?2:1})},session.access_token); if(!x.ok) throw new Error(`TEAM SAVE FAILED: ${await x.text()}`);
          for(const pid of team.members.filter(Boolean)){const m=await api("/rest/v1/team_members",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({id:uid(),team_id:tid,player_id:pid})},session.access_token);if(!m.ok) throw new Error(`TEAM MEMBER SAVE FAILED: ${await m.text()}`);}
        }
      }
      for(const c of customs.filter(x=>x.label||x.value)){
        const body={id:c.id??uid(),tournament_id:selected.id,label:c.label,name:c.label,title:c.label,value:c.value,custom:c.value,custom_data:c.value};
        const x=await api("/rest/v1/custom_registrations",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(body)},session.access_token); if(!x.ok) throw new Error(`CUSTOM SAVE FAILED: ${await x.text()}`);
      }
      setMessage("SAVED."); await loadAll(); await openTournament(selected.id);
    } catch(e){ setMessage(errText(e)); } finally { setSaving(false); }
  };

  const sortedPlayers=useMemo(()=>[...players].sort((a,b)=>(b.points??0)-(a.points??0)),[players]);

  if(authorized===false) return <main className="admin"><div className="gate"><p className="eyebrow">MIDNIGHT BEY CLUB</p><h1>ADMIN</h1><p>{message||"ADMIN ACCESS REQUIRED."}</p><a href="/" className="back">BACK TO SITE ↗</a></div><style jsx global>{styles}</style></main>;
  if(authorized===null) return <main className="admin"><div className="gate"><p className="eyebrow">MIDNIGHT BEY CLUB</p><h1>ADMIN</h1><p>CHECKING ACCESS...</p></div><style jsx global>{styles}</style></main>;

  return <main className="admin">
    <header className="adminHeader"><div><div className="eyebrow">MIDNIGHT BEY CLUB</div><h1>ADMIN</h1><p>TOURNAMENT / PLAYER MANAGEMENT</p></div><a href="/" className="back">BACK TO SITE ↗</a></header>
    <nav className="tabs"><button className={tab==="tournaments"?"active":""} onClick={()=>setTab("tournaments")}>TOURNAMENTS</button><button className={tab==="players"?"active":""} onClick={()=>setTab("players")}>PLAYERS / RANKING</button><button className="new" onClick={newTournament}>+ NEW TOURNAMENT</button></nav>
    {tab==="tournaments" && <div className="workspace">
      <aside className="list"><div className="listHead"><span>EVENTS</span><strong>{tournaments.length}</strong></div>{tournaments.length===0?<div className="empty">NO DATA</div>:tournaments.map(t=><button key={t.id} className={t.id===selectedId?"event active":"event"} onClick={()=>openTournament(t.id)}><span>{t.status}</span><strong>{t.name||"NO DATA"}</strong><small>{t.date||"NO DATE"} · {t.location||"NO LOCATION"}</small><em>{t.format}</em></button>)}</aside>
      <section className="editor">{!selected?<div className="empty big">SELECT A TOURNAMENT<br/>OR CREATE A NEW ONE</div>:<>
        <div className="editorHead"><div><span className="eyebrow">TOURNAMENT EDITOR</span><h2>{selected.name||"NEW TOURNAMENT"}</h2></div><span className="formatBadge">{selected.format==="3ON3"?"3ON3 / INDIVIDUAL":"TEAM BATTLE"}</span></div>
        <div className="grid three"><Field label="TOURNAMENT NAME"><input value={selected.name} onChange={e=>updateT("name",e.target.value)}/></Field><Field label="DATE"><input value={selected.date} placeholder="2026.09.12" onChange={e=>updateT("date",e.target.value)}/></Field><Field label="LOCATION"><input value={selected.location} onChange={e=>updateT("location",e.target.value)}/></Field></div>
        <div className="grid two"><Field label="BATTLE FORMAT"><select value={selected.format} onChange={e=>{updateT("format",e.target.value);setResults([]);setTeams([])}}><option value="3ON3">3ON3 / INDIVIDUAL</option><option value="TEAM">TEAM BATTLE</option></select></Field><Field label="STATUS"><select value={selected.status} onChange={e=>updateT("status",e.target.value)}><option>ENTRY OPEN</option><option>UPCOMING</option><option>FINISHED</option></select></Field></div>
        {selected.format==="3ON3"?<section className="resultSection"><div className="sectionTitle"><span>RESULT</span><h3>3ON3 TOP 3</h3><p>3ON3 = INDIVIDUAL BATTLE USING 3 BEYS</p></div>{results.map((r,i)=><div className="resultRow" key={r.id??i}><div className="place">{r.rank}<small>{r.rank===1?"3 PT":r.rank===2?"2 PT":"1 PT"}</small></div><Field label="PLAYER"><select value={r.player_id} onChange={e=>setResults(v=>v.map(x=>x===r?{...x,player_id:e.target.value}:x))}><option value="">SELECT PLAYER</option>{players.map(p=><option key={p.id} value={p.id}>{p.nickname||p.name}</option>)}</select></Field>{[1,2,3].map(n=><Field key={n} label={`BEY ${n}`}><input value={r[`bey${n}` as "bey1"|"bey2"|"bey3"]} onChange={e=>setResults(v=>v.map(x=>x===r?{...x,[`bey${n}`]:e.target.value}:x))}/></Field>)}<button className="remove" onClick={()=>setResults(v=>v.filter(x=>x!==r))}>×</button></div>)}{results.length<3&&<button className="add" onClick={addResult}>+ ADD PLACED PLAYER</button>}</section>:
        <section className="resultSection"><div className="sectionTitle"><span>RESULT</span><h3>TEAM BATTLE</h3><p>1ST TEAM = 2 PT EACH · 2ND TEAM = 1 PT EACH</p></div>{teams.map((team,i)=><div className="teamEditor" key={team.id??i}><div className="teamTop"><strong>{team.rank===1?"1ST PLACE":"2ND PLACE"}</strong><select value={team.rank} onChange={e=>setTeams(v=>v.map(x=>x===team?{...x,rank:Number(e.target.value)===2?2:1}:x))}><option value="1">1ST</option><option value="2">2ND</option></select><input value={team.name} onChange={e=>setTeams(v=>v.map(x=>x===team?{...x,name:e.target.value}:x))}/><button className="remove" onClick={()=>setTeams(v=>v.filter(x=>x!==team))}>×</button></div><div className="members">{team.members.map((m,j)=><select key={j} value={m} onChange={e=>setTeams(v=>v.map(x=>x===team?{...x,members:x.members.map((z,k)=>k===j?e.target.value:z)}:x))}><option value="">MEMBER {j+1}</option>{players.map(p=><option key={p.id} value={p.id}>{p.nickname||p.name}</option>)}</select>)}</div></div>)}{teams.length<2&&<button className="add" onClick={addTeam}>+ ADD TEAM</button>}</section>}
        <section className="resultSection"><div className="sectionTitle"><span>EXTRA DATA</span><h3>CUSTOM</h3><p>OPTIONAL INFORMATION FOR THIS TOURNAMENT</p></div>{customs.map((c,i)=><div className="customRow" key={c.id??i}><input className="labelInput" placeholder="LABEL" value={c.label} onChange={e=>setCustoms(v=>v.map(x=>x===c?{...x,label:e.target.value}:x))}/><input placeholder="VALUE" value={c.value} onChange={e=>setCustoms(v=>v.map(x=>x===c?{...x,value:e.target.value}:x))}/><button className="remove" onClick={()=>setCustoms(v=>v.filter(x=>x!==c))}>×</button></div>)}<button className="add" onClick={addCustom}>+ ADD CUSTOM FIELD</button></section>
        <div className="saveBar"><span className={message.includes("FAILED")||message.includes("ERROR")?"error":"ok"}>{loadingDetail?"LOADING...":message}</span><button className="save" onClick={save} disabled={saving}>{saving?"SAVING...":"SAVE TO DATABASE"}</button></div>
      </>}</section>
    </div>}
    {tab==="players" && <section className="panel"><div className="sectionTitle"><span>THE NUMBERS</span><h2>PLAYERS / RANKING</h2></div>{sortedPlayers.length===0?<div className="empty">NO DATA</div>:<div className="playerList">{sortedPlayers.map((p,i)=><div className="player" key={p.id}><div className="rank">{String(i+1).padStart(2,"0")}</div><div><label>PLAYER</label><input value={p.name} onChange={e=>setPlayers(v=>v.map(x=>x.id===p.id?{...x,name:e.target.value}:x))}/></div><div><label>NICKNAME</label><input value={p.nickname??""} onChange={e=>setPlayers(v=>v.map(x=>x.id===p.id?{...x,nickname:e.target.value}:x))}/></div><div className="stat"><span>PTS</span><strong>{p.points??0}</strong></div><div className="stat"><span>WINS</span><strong>{p.wins??0}</strong></div><div className="stat"><span>EVENTS</span><strong>{p.tournaments??0}</strong></div></div>)}</div>}<div className="saveArea"><span className="saved">CUMULATIVE POINTS · 3 / 2 / 1 · TEAM 2 / 1</span><button className="save" onClick={async()=>{setSaving(true);try{for(const p of players){const r=await api(`/rest/v1/players?id=eq.${enc(p.id)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({name:p.name,nickname:p.nickname})},session?.access_token);if(!r.ok)throw new Error(await r.text())}setMessage("PLAYERS SAVED.")}catch(e){setMessage(errText(e))}finally{setSaving(false)}}} disabled={saving}>{saving?"SAVING...":"SAVE PLAYERS"}</button></div></section>}
    <style jsx global>{styles}</style>
  </main>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field">{label}{children}</label>}

const styles=`
*{box-sizing:border-box}html,body{margin:0;background:#08060d;color:#f4f1f8;font-family:Arial,Helvetica,sans-serif}button,input,select{font:inherit}.admin{min-height:100vh;padding:55px 5vw;background:radial-gradient(circle at 75% 0,rgba(111,55,190,.16),transparent 34%),#08060d}.adminHeader{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #292331;padding-bottom:30px}.eyebrow,.sectionTitle span{font-size:10px;letter-spacing:4px;color:#a99ab9}.adminHeader h1{font-size:72px;line-height:.9;margin:12px 0 8px;letter-spacing:-4px}.adminHeader p{margin:0;color:#8d8398;font-size:10px;letter-spacing:3px}.back{color:#f4f1f8;text-decoration:none;border:1px solid #40364d;padding:14px 18px;font-size:10px;letter-spacing:2px}.tabs{display:flex;gap:10px;margin:28px 0}.tabs button{border:1px solid #292331;background:#0d0a12;color:#8d8398;padding:13px 18px;font-size:10px;letter-spacing:2px;cursor:pointer}.tabs button.active{color:#fff;border-color:#9d6cff;background:#171020}.tabs .new{margin-left:auto;color:#fff;border-color:#9d6cff}.workspace{display:grid;grid-template-columns:310px 1fr;gap:18px}.list,.editor,.panel{border:1px solid #292331;background:#0c0912}.list{padding:16px;align-self:start}.listHead{display:flex;justify-content:space-between;padding:10px 8px 16px;color:#77717f;font-size:10px;letter-spacing:3px}.listHead strong{color:#9d6cff}.event{position:relative;width:100%;text-align:left;background:transparent;border:1px solid transparent;border-bottom-color:#292331;color:#fff;padding:18px 12px;cursor:pointer}.event.active{background:#171020;border-color:#9d6cff}.event span{display:block;color:#77717f;font-size:8px;letter-spacing:2px}.event strong{display:block;margin:8px 0 5px;font-size:13px}.event small{color:#77717f;font-size:9px}.event em{position:absolute;right:12px;top:18px;color:#9d6cff;font-size:8px;font-style:normal;letter-spacing:1px}.editor{padding:34px}.editorHead{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #292331;padding-bottom:25px;margin-bottom:25px}.editorHead h2{font-size:34px;margin:10px 0 0;letter-spacing:-1px}.formatBadge{border:1px solid #9d6cff;color:#c9b6ff;padding:10px 12px;font-size:9px;letter-spacing:2px}.grid{display:grid;gap:14px;margin-bottom:4px}.grid.three{grid-template-columns:2fr 1fr 1fr}.grid.two{grid-template-columns:1fr 1fr}.field{display:block;color:#80758e;font-size:9px;letter-spacing:2px;margin-bottom:14px}.field input,.field select,.customRow input,.teamTop input,.teamTop select,.members select{display:block;width:100%;margin-top:7px;background:#08060d;border:1px solid #342b40;color:#fff;padding:12px;outline:0}.field input:focus,.field select:focus,input:focus,select:focus{border-color:#9d6cff}.resultSection{border-top:1px solid #292331;padding-top:26px;margin-top:25px}.sectionTitle h3{margin:8px 0 5px;font-size:27px}.sectionTitle p{margin:0 0 18px;color:#665d70;font-size:9px;letter-spacing:2px}.resultRow{display:grid;grid-template-columns:65px 1.3fr 1fr 1fr 1fr 34px;gap:10px;align-items:end;border-bottom:1px solid #201b27;padding:18px 0}.place{font-size:26px;color:#9d6cff;padding-bottom:18px}.place small{display:block;font-size:8px;color:#77717f;letter-spacing:1px;margin-top:3px}.remove{border:1px solid #392f44;background:transparent;color:#9a8da5;height:39px;cursor:pointer}.remove:hover{border-color:#ff6b81;color:#ff6b81}.add{border:1px dashed #493b55;background:transparent;color:#9d6cff;padding:13px 17px;margin-top:15px;cursor:pointer;font-size:9px;letter-spacing:2px}.teamEditor{border:1px solid #292331;padding:18px;margin-bottom:12px}.teamTop{display:grid;grid-template-columns:100px 80px 1fr 34px;gap:10px;align-items:center}.teamTop strong{color:#9d6cff;font-size:11px;letter-spacing:1px}.members{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}.customRow{display:grid;grid-template-columns:180px 1fr 34px;gap:10px;margin-bottom:10px}.labelInput{max-width:180px}.saveBar,.saveArea{display:flex;justify-content:flex-end;align-items:center;gap:18px;margin-top:30px}.ok,.saved{color:#9d6cff;font-size:10px;letter-spacing:2px}.error{color:#ff6b81;font-size:10px;letter-spacing:1px;max-width:70%}.save{border:0;background:#f4f1f8;color:#08060d;padding:14px 22px;font-weight:700;font-size:10px;letter-spacing:2px;cursor:pointer}.save:hover{background:#9d6cff;color:#fff}.save:disabled{opacity:.5}.panel{padding:35px}.panel .sectionTitle h2{font-size:42px;margin:8px 0 30px}.playerList{border-top:1px solid #292331}.player{display:grid;grid-template-columns:55px 2fr 2fr 90px 90px 90px;gap:14px;align-items:end;border-bottom:1px solid #292331;padding:18px 0}.player label{display:block;color:#80758e;font-size:8px;letter-spacing:2px}.rank{font-size:24px;color:#9d6cff;padding-bottom:15px}.stat{text-align:center;padding-bottom:14px}.stat span{display:block;color:#5f576b;font-size:8px;letter-spacing:2px}.stat strong{font-size:19px}.empty,.gate{min-height:250px;display:grid;place-items:center;align-content:center;gap:15px;color:#77717f;text-align:center;letter-spacing:3px}.empty.big{min-height:500px}.gate h1{margin:0;font-size:65px}.gate p{font-size:10px}@media(max-width:1000px){.workspace{grid-template-columns:1fr}.grid.three,.grid.two,.resultRow,.members,.player{grid-template-columns:1fr}.admin{padding:35px 18px}.adminHeader{display:block}.tabs{flex-wrap:wrap}.tabs .new{margin-left:0}.editor{padding:22px}.teamTop,.customRow{grid-template-columns:1fr}.labelInput{max-width:none}.saveBar,.saveArea{display:block}.save{margin-top:15px}}
`;
