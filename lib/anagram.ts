export interface Work {
  source: string;
  mergeSmallChars: boolean;
  phrase: string[];
  remaining: string[];
  cursor: number;
}
export interface Candidate extends Work {
  id: string;
  createdAt: number;
  inferredSource?: boolean;
}
export const STORAGE_KEY = "anagram_candidates";
export const emptyWork: Work = { source: "", mergeSmallChars: false, phrase: [], remaining: [], cursor: 0 };
export function normalizeInput(text: string) {
  return text.replace(/[\u30A1-\u30F6]/g, s => String.fromCharCode(s.charCodeAt(0) - 0x60)).replace(/\s/g, "");
}
export function sortJapanese(chars: string[]) { return [...chars].sort((a,b) => a.localeCompare(b,"ja")); }
export function splitPhrase(text: string, merge: boolean) {
  const result: string[] = [];
  for (const char of text) {
    if (merge && /[ゃゅょぁぃぅぇぉ]/.test(char) && result.length) result[result.length - 1] += char;
    else result.push(char);
  }
  return result;
}
export function startWork(source: string, mergeSmallChars: boolean): Work {
  return {source, mergeSmallChars, phrase: [], remaining: sortJapanese(splitPhrase(normalizeInput(source), mergeSmallChars)), cursor: 0};
}
export function insert(work: Work, index: number): Work {
  if(index < 0 || index >= work.remaining.length) return work;
  const remaining = [...work.remaining], phrase = [...work.phrase];
  const [char] = remaining.splice(index,1);
  phrase.splice(work.cursor,0,char);
  return {...work, phrase, remaining, cursor:work.cursor+1};
}
export function remove(work: Work, index: number): Work {
  if(index < 0 || index >= work.phrase.length) return work;
  const phrase=[...work.phrase]; const [char]=phrase.splice(index,1);
  return {...work,phrase,remaining:sortJapanese([...work.remaining,char]),cursor:work.cursor-(index<work.cursor?1:0)};
}
export interface History { past: Work[]; present: Work; future: Work[] }
export function commit(history: History, work: Work): History {
  if(work === history.present) return history;
  return {past:[...history.past,history.present].slice(-100),present:work,future:[]};
}
export function undo(h: History): History { return h.past.length ? {past:h.past.slice(0,-1),present:h.past[h.past.length-1],future:[h.present,...h.future]} : h; }
export function redo(h: History): History { return h.future.length ? {past:[...h.past,h.present],present:h.future[0],future:h.future.slice(1)} : h; }
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every(v => typeof v === "string" && v.length>0);
export function readCandidates(raw: string): Candidate[] {
  const value: unknown=JSON.parse(raw);
  if(!Array.isArray(value)) throw new Error("Invalid candidates");
  return value.map((v: unknown) => {
    if(!v || typeof v!=="object") throw new Error("Invalid candidate");
    const c=v as Record<string,unknown>;
    if(typeof c.id!=="string" || !strings(c.phrase) || !strings(c.remaining) || typeof c.createdAt!=="number" || !Number.isFinite(c.createdAt) || typeof c.cursor!=="number" || !Number.isInteger(c.cursor)) throw new Error("Invalid candidate");
    const legacy=typeof c.source!=="string" || typeof c.mergeSmallChars!=="boolean";
    return {
      id:c.id,createdAt:c.createdAt,phrase:[...c.phrase],remaining:[...c.remaining],cursor:Math.max(0,Math.min(c.phrase.length,c.cursor)),
      source:legacy?[...c.phrase,...c.remaining].join(""):c.source as string,
      mergeSmallChars:legacy?[...c.phrase,...c.remaining].some(s=>[...s].length>1):c.mergeSmallChars as boolean,
      inferredSource:legacy || c.inferredSource===true,
    };
  });
}
