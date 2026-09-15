import React,{useEffect,useState} from 'react';
export function Toast() {
  const [message,setMessage]=useState('');
  useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const onSaved=()=>{setMessage('İşlem başarıyla kaydedildi.');clearTimeout(timer);timer=setTimeout(()=>setMessage(''),3500);};window.addEventListener('quality-saved',onSaved);return()=>{window.removeEventListener('quality-saved',onSaved);clearTimeout(timer);};},[]);
  return message?<div role="status" className="fixed bottom-24 right-4 z-[90] rounded-xl bg-emerald-800 px-5 py-3 text-sm text-white shadow-lg lg:bottom-6">{message}</div>:null;
}
