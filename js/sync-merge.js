/* Pure three-way merge shared by the browser and regression tests. */
(() => {
  const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
  const equal=(a,b)=>canonical(a)===canonical(b);
  function merge(base,local,remote){
    const records={},conflicts=[];
    for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
      const l=!equal(local[key],base[key]),r=!equal(remote[key],base[key]);
      if(l&&r&&!equal(local[key],remote[key]))conflicts.push(key);
      const value=l?local[key]:remote[key];if(value!==undefined)records[key]=value;
    }return {records,conflicts};
  }
  function diff(base,next){return [...new Set([...Object.keys(base),...Object.keys(next)])].filter(k=>!equal(base[k],next[k])).map(k=>{const [store,id]=k.split('/');return {store,id,value:next[k]??null};});}
  globalThis.HD_SYNC_MERGE={equal,merge,diff};
})();
