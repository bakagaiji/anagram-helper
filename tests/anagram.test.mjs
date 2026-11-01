import { test } from 'node:test';
import assert from 'node:assert/strict';
import {startWork,insert,remove,commit,undo,redo,readCandidates,sortJapanese} from '../lib/anagram.ts';

test('duplicate letters and merged kana are conserved during insert/remove',()=>{
 for(const merge of [false,true]) {
  let w=startWork('キョウ キョウ あいう',merge);
  const tokens=sortJapanese(w.remaining);
  for(let i=0;i<1000;i++){
   w=w.remaining.length && i%3!==0?insert({...w,cursor:Math.floor(w.phrase.length/2)},0):remove(w,0);
   assert.deepEqual(sortJapanese([...w.phrase,...w.remaining]),tokens);
   assert(w.cursor>=0 && w.cursor<=w.phrase.length);
  }
 }
});
test('undo/redo restores source, settings, phrase and cursor; new edits discard redo',()=>{
 const initial=startWork('きゃく',true);
 let h={past:[],present:initial,future:[]};
 h=commit(h,insert(h.present,0));const composed=h.present;
 h=commit(h,startWork('べつのことば',false));
 h=undo(h);assert.deepEqual(h.present,composed);
 h=redo(h);assert.equal(h.present.source,'べつのことば');
 h=undo(h);h=commit(h,remove(h.present,0));assert.equal(h.future.length,0);
 h=undo(h);assert.deepEqual(h.present,composed);
});
test('legacy candidates retain exact tokens and infer missing metadata',()=>{
 const c=readCandidates(JSON.stringify([{id:'old',createdAt:1,phrase:['きゃ'],remaining:['く'],cursor:100}]))[0];
 assert.equal(c.source,'きゃく');assert(c.mergeSmallChars);assert(c.inferredSource);assert.equal(c.cursor,1);
 assert.deepEqual(c.phrase,['きゃ']);assert.deepEqual(c.remaining,['く']);
 assert.deepEqual(readCandidates(JSON.stringify([c]))[0],c);
});
test('new candidates round-trip original source and mode',()=>{
 const c={...insert(startWork('キャク',true),0),id:'new',createdAt:2,inferredSource:false};
 assert.deepEqual(readCandidates(JSON.stringify([c]))[0],c);
});
test('invalid storage is rejected rather than silently replacing saved candidates',()=>{
 for(const raw of ['{','{}','[null]','[{"id":"bad"}]'])assert.throws(()=>readCandidates(raw));
});
