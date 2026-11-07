// Project-owned minimal contract fixture; not copied from Astra. Deliberately
// implements only the bridge methods exercised by our controlled host tests.
(function(){
  const documentId='fixture-'+Math.random(),pending=new Map(),listeners=new Map();let next=0;
  function request(method,params={}){
    return new Promise((resolve,reject)=>{
      const id=++next;
      const timer=setTimeout(()=>{pending.delete(id);reject(Error('Test bridge timeout'));},10000);
      pending.set(id,{resolve,reject,timer});
      window.parent.postMessage({type:'astra-bridge-request',documentId,id,method,params},'*');
    });
  }
  window.addEventListener('message',event=>{
    if(event.source!==window.parent)return;
    const message=event.data;
    if(message?.type==='astra-bridge-response'){
      const job=pending.get(message.id);if(!job)return;pending.delete(message.id);clearTimeout(job.timer);
      if(message.error)job.reject(Error(message.error));else job.resolve(message.result);
    }
    if(message?.type==='astra-bridge-event')for(const handler of listeners.get(message.event)||[])handler(message.payload);
  });
  window.astra={
    callBackend:(method,params)=>request('callBackend',{method,params}),
    getData:key=>request('getData',{key}),setData:(key,value)=>request('setData',{key,value}),
    getCssVariables:()=>request('getCssVariables'),setCssVariable:(name,value)=>request('setCssVariable',{name,value}),
    on:(name,handler)=>{const handlers=listeners.get(name)||new Set();handlers.add(handler);listeners.set(name,handlers);return()=>handlers.delete(handler);}
  };
  window.parent.postMessage({type:'astra-bridge-ready',documentId},'*');
})();
