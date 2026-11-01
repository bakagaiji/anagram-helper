"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Candidate, History, Work, STORAGE_KEY, emptyWork, startWork, insert, remove, commit, undo, redo, readCandidates, sortJapanese, normalizeInput } from "../lib/anagram";

export default function Home() {
  const [draft, setDraft] = useState("");
  const [draftMerge, setDraftMerge] = useState(false);
  const [history, setHistory] = useState<History>({past:[],present:emptyWork,future:[]});
  const work=history.present;
  const [candidates,setCandidates]=useState<Candidate[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [storageError,setStorageError]=useState("");
  const [message,setMessage]=useState("");
  const output=useRef<HTMLTextAreaElement>(null);
  const copyAttempt=useRef(0);
  useEffect(()=>{
    // Browser storage is loaded after hydration; never overwrite unread/invalid data.
    try {
      const raw=localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCandidates(raw ? readCandidates(raw) : []);
      setLoaded(true);
    } catch { setStorageError("保存候補を読み込めませんでした。既存のデータを守るため、保存・削除を停止しています。"); }
  },[]);
  const dirty=draft!==work.source || draftMerge!==work.mergeSmallChars;
  function update(next: Work) {
    copyAttempt.current++;
    setMessage("");
    setHistory(h=>commit(h,next));
  }
  function apply() {
    if(work.phrase.length && !window.confirm("作成中の並びをリセットして、この語句で始めますか？ 元に戻すこともできます。")) return;
    update(startWork(draft,draftMerge));
  }
  function travel(direction: "undo" | "redo") {
    const next=direction==="undo"?undo(history):redo(history);
    copyAttempt.current++;
    setHistory(next);setDraft(next.present.source);setDraftMerge(next.present.mergeSmallChars);setMessage("");
  }
  function persist(next: Candidate[]) {
    if(!loaded) return false;
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(next));setCandidates(next);setStorageError("");return true; }
    catch {setStorageError("候補を保存できませんでした。ブラウザの保存設定や空き容量を確認してください。");return false;}
  }
  function save() {
    if(!work.phrase.length) return;
    if(persist([{...work,id:crypto.randomUUID(),createdAt:Date.now()},...candidates])) setMessage("候補を保存しました。");
  }
  function restore(c: Candidate) {
    if(work.phrase.length && !window.confirm("この候補を復元しますか？ 今の並びは「元に戻す」で戻せます。")) return;
    update({...c,phrase:[...c.phrase],remaining:[...c.remaining]});
    setDraft(c.source);setDraftMerge(c.mergeSmallChars);
    setMessage(c.inferredSource?"旧版の候補を復元しました。元の語句は保存されていないため、保存されている文字から補っています。":"元の語句と設定も一緒に復元しました。");
  }
  async function copy() {
    const attempt=++copyAttempt.current;
    const text=work.phrase.join("");
    if(!text)return;
    try {
      if(!navigator.clipboard)throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      if(attempt===copyAttempt.current)setMessage("コピーしました。");
    } catch {
      if(attempt!==copyAttempt.current)return;
      output.current?.focus();output.current?.select();
      setMessage("自動コピーが使えません。選択された文章を長押し、または Ctrl+C / ⌘C でコピーしてください。");
    }
  }
  return <main className="workspace">
    <header><h1>日本語アナグラム作成支援くん</h1><p>残り文字を選んで、ことばを組み立てよう。</p></header>
    <section className="panel" aria-labelledby="source-title">
      <h2 id="source-title">A：元となる語句</h2>
      <label htmlFor="source">ひらがな・カタカナを入力</label>
      <textarea id="source" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="例：にほんごあなぐらむ" />
      <label className="check"><input type="checkbox" checked={draftMerge} onChange={e=>setDraftMerge(e.target.checked)}/>小文字を前の文字と結合する（例：きゃ）</label>
      <p className="hint">カタカナはひらがなに変換し、空白は除きます。「っ」は結合しません。</p>
      <button className="primary" onClick={apply} disabled={!normalizeInput(draft)}>この語句で始める</button>
      {dirty && <p className="notice">入力・設定の変更は、ボタンを押すまで作業に反映されません。</p>}
      {work.source && <p className="hint">現在の元の語句：{work.source} ／ 小文字結合：{work.mergeSmallChars?"あり":"なし"}</p>}
    </section>
    <section className="panel" aria-labelledby="remaining-title">
      <h2 id="remaining-title">B：残り文字</h2>
      <p className="hint">文字を押すと、作成中の挿入位置に入ります。</p>
      <div className="tiles">{work.remaining.map((char,i)=><button className="tile blue" key={`${char}-${i}`} aria-label={`${char}を追加（${i+1}番目）`} onClick={()=>update(insert(work,i))}>{char}</button>)}</div>
      {!work.source && <p className="hint">元となる語句を入力して始めてください。</p>}
      {work.source && !work.remaining.length && <p>全ての文字を使いました。</p>}
    </section>
    <section className="panel" aria-labelledby="phrase-title">
      <div className="row"><h2 id="phrase-title">C：作成中</h2><div className="actions">
        <button onClick={()=>travel("undo")} disabled={!history.past.length}>元に戻す</button>
        <button onClick={()=>travel("redo")} disabled={!history.future.length}>やり直す</button>
      </div></div>
      <p className="hint">文字の間を押すか、◀・▶で挿入位置を動かせます。</p>
      <div className="cursor-strip" role="group" aria-label="挿入位置の選択">
        {Array.from({length:work.phrase.length+1},(_,i)=><Fragment key={i}>
          <button className={`gap ${work.cursor===i?"selected":""}`} aria-label={`挿入位置：${i}番目`} aria-pressed={work.cursor===i} onClick={()=>setHistory(h=>({...h,present:{...h.present,cursor:i}}))}>{work.cursor===i?"┃":"・"}</button>
          {i<work.phrase.length && <span>{work.phrase[i]}</span>}
        </Fragment>)}
      </div>
      <div className="actions cursor-controls">
        <button aria-label="挿入位置を左へ" disabled={work.cursor===0} onClick={()=>setHistory(h=>({...h,present:{...h.present,cursor:Math.max(0,h.present.cursor-1)}}))}>◀</button>
        <span>挿入位置 {work.cursor} / {work.phrase.length}</span>
        <button aria-label="挿入位置を右へ" disabled={work.cursor===work.phrase.length} onClick={()=>setHistory(h=>({...h,present:{...h.present,cursor:Math.min(h.present.phrase.length,h.present.cursor+1)}}))}>▶</button>
      </div>
      <p className="hint">下の文字を押すと、残り文字に戻せます。</p>
      <div className="tiles phrase-tiles">{work.phrase.map((char,i)=><button key={`${char}-${i}`} className="tile orange" aria-label={`${char}を戻す（${i+1}番目）`} onClick={()=>update(remove(work,i))}>{char}</button>)}</div>
      <label htmlFor="output">作成した文章</label>
      <textarea id="output" ref={output} readOnly value={work.phrase.join("")} placeholder="ここに作成した文章が表示されます" />
      <div className="actions"><button className="primary" disabled={!work.phrase.length} onClick={copy}>コピー</button><button disabled={!loaded||!work.phrase.length} onClick={save}>候補を保存</button><button disabled={!work.phrase.length} onClick={()=>update({...work,phrase:[],remaining:sortJapanese([...work.remaining,...work.phrase]),cursor:0})}>クリア</button></div>
      <p className="status" role="status">{message}</p>
    </section>
    <section className="panel" aria-labelledby="saved-title">
      <h2 id="saved-title">保存候補（{candidates.length}）</h2>
      <p className="hint">この端末・ブラウザに保存されます。作業途中の状態を残すには「候補を保存」を押してください。</p>
      {storageError && <p role="alert" className="notice">{storageError}</p>}
      {!candidates.length && <p className="hint">保存した候補がここに並びます。</p>}
      <ul className="candidates">{candidates.map(c=><li key={c.id}>
        <p className="candidate-phrase">{c.phrase.join("")}</p>
        <p className="hint">残り：{c.remaining.join("")||"なし"}</p>
        <p className="hint">{c.inferredSource?"元の語句：旧版のため文字情報から補完":`元の語句：${c.source}`} ／ 小文字結合：{c.mergeSmallChars?"あり":"なし"}</p>
        <div className="actions"><button onClick={()=>restore(c)}>復元</button><button className="danger" disabled={!loaded} onClick={()=>{if(window.confirm("この保存候補を削除しますか？"))persist(candidates.filter(v=>v.id!==c.id));}}>削除</button></div>
      </li>)}</ul>
    </section>
  </main>;
}
