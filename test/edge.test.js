import test from "node:test";
import assert from "node:assert/strict";
import {blankDocument, identity, parseDocument, dimensions, makePattern, History, LIMITS} from "../dist/src/model.js";
import {exportSize, toSVG} from "../dist/src/render.js";
// Synthetic minimal drawing fixture; no real artwork or storage.
const fixture = () => {
  const d=blankDocument(256,256);
  d.layers[0].items=[{id:"fixture",type:"text",x:0,y:0,width:1,height:1,size:.1,color:"#123456",fill:"none",opacity:1,transform:identity(),font:"serif",fontSize:1,text:"한글<&>"}];
  return d;
};
const set=(o,path,value)=>{const keys=path.split(".");for(const k of keys.slice(0,-1))o=o[k];o[keys.at(-1)]=value;};
for(const [path,min,max] of [
  ["layers.0.opacity",0,1],["layers.0.items.0.size",.1,512],["layers.0.items.0.opacity",0,1],
  ["layers.0.items.0.x",-32768,32768],["layers.0.items.0.y",-32768,32768],
  ["layers.0.items.0.width",.1,16384],["layers.0.items.0.height",.1,16384],
  ["layers.0.items.0.fontSize",1,512],["layers.0.items.0.transform.x",-32768,32768],
  ["layers.0.items.0.transform.y",-32768,32768],["layers.0.items.0.transform.sx",.01,32],
  ["layers.0.items.0.transform.sy",.01,32],["layers.0.items.0.transform.angle",-36000,36000],
]) test("numeric boundary "+path,()=>{
  for(const v of [min,max]){const d=fixture();set(d,path,v);assert(parseDocument(JSON.stringify(d)),String(v));}
  for(const v of [min-.001,max+.001,NaN,Infinity,-Infinity,null,true,String(min)]){const d=fixture();set(d,path,v);assert.equal(parseDocument(JSON.stringify(d)),null,String(v));}
});
test("dimension integer and area endpoints; portrait export precision",()=>{
  assert(dimensions(256,256));assert(dimensions(8000,4000));
  for(const x of [255,8193,256.5,NaN,Infinity,"256",null])assert(!dimensions(x,256));
  assert(!dimensions(8000,4001));
  assert.deepEqual(exportSize(blankDocument(1600,2400),4096),{width:2731,height:4096,scale:4096/2400});
  for(const x of [255,8193,256.5,NaN,Infinity,"256"])assert.throws(()=>exportSize(fixture(),x));
});
test("layer/item/eraser count boundaries and cross-layer duplicate IDs",()=>{
  const d=fixture(),layer=d.layers[0];
  d.layers=Array.from({length:16},(_,i)=>({...structuredClone(layer),id:"l"+i,items:[]}));
  assert(parseDocument(JSON.stringify(d)));d.layers.push({...layer,id:"extra",items:[]});assert.equal(parseDocument(JSON.stringify(d)),null);
  d.layers=[layer];layer.items=Array.from({length:5000},(_,i)=>({...fixture().layers[0].items[0],id:"i"+i}));
  assert(parseDocument(JSON.stringify(d)));layer.items.push({...layer.items[0],id:"extra"});assert.equal(parseDocument(JSON.stringify(d)),null);
  layer.items=Array.from({length:64},(_,i)=>({id:"e"+i,type:"stroke",tool:"eraser",size:.1,color:"#000000",opacity:1,transform:identity(),points:[{x:0,y:0,p:0}]}));
  assert(parseDocument(JSON.stringify(d)));layer.items.push({...layer.items[0],id:"e64"});assert.equal(parseDocument(JSON.stringify(d)),null);
  d.layers=[{...layer,items:[]},{...layer,id:"other",items:[{...fixture().layers[0].items[0],id:layer.id}]}];assert.equal(parseDocument(JSON.stringify(d)),null);
});
test("sampled point limits are aggregate, pressure zero and one are valid",()=>{
  const d=fixture(),stroke={id:"s",type:"stroke",tool:"ink",size:.1,color:"#000000",opacity:1,transform:identity(),points:Array.from({length:50000},()=>({x:.125,y:-.125,p:0}))};
  d.layers[0].items=Array.from({length:6},(_,i)=>({...stroke,id:"s"+i}));
  assert(parseDocument(JSON.stringify(d)));d.layers[0].items.push({...stroke,id:"overflow",points:[{x:0,y:0,p:1}]});assert.equal(parseDocument(JSON.stringify(d)),null);
  d.layers[0].items=[{...stroke,points:[...stroke.points,{x:0,y:0,p:1}]}];assert.equal(parseDocument(JSON.stringify(d)),null);
  for(const p of [-.001,1.001,"1",null]){d.layers[0].items=[{...stroke,points:[{x:0,y:0,p}]}];assert.equal(parseDocument(JSON.stringify(d)),null);}
});
test("text length, sanitized extras, hidden layer and transparent SVG",()=>{
  const d=fixture();d.layers[0].items[0].text="가".repeat(2000);assert(parseDocument(JSON.stringify(d)));
  d.layers[0].items[0].text+="가";assert.equal(parseDocument(JSON.stringify(d)),null);
  d.layers[0].items[0].text="sentinel";d.background="transparent";d.layers[0].visible=false;
  assert(!toSVG(d).includes("sentinel"));assert(!toSVG(d).includes('fill="transparent"'));
});
test("history no-op preserves redo and snapshots are detached",()=>{
  const d=fixture(),h=new History(d);d.title="A";h.commit(d);d.title="B";h.commit(d);
  const a=h.undo();assert.equal(h.commit(a),false);a.title="mutated";assert.equal(h.redo().title,"B");
  h.undo();d.title="branch";h.commit(d);assert.equal(h.redo(),null);
});
test("pattern min/max parameters and rejected input do not mutate options",()=>{
  const options={seed:0,width:256,height:256,count:12,steps:16,strength:.001};
  assert.equal(makePattern(options).items.length,12);
  for(const [key,values] of Object.entries({seed:[-1,4294967296,1.5,"1"],count:[11,161,12.5,NaN],steps:[15,161,16.5,null],strength:[0,2.001,Infinity,".5"]}))
    for(const value of values){const bad={...options,[key]:value};assert.throws(()=>makePattern(bad));assert.deepEqual(bad,{...options,[key]:value});}
});
test("parser enforces UTF-8 file byte limit before sanitizing unknown data",()=>{
  const d=fixture();d.fixturePadding="가".repeat(Math.ceil(LIMITS.file/3));
  const raw=JSON.stringify(d);assert(raw.length<LIMITS.file);assert(new TextEncoder().encode(raw).length>LIMITS.file);
  assert.equal(parseDocument(raw),null);
});
