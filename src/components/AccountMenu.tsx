import {useEffect,useRef} from 'react';
import {ROLE_LABELS} from '../services/terms';
import type {User} from '../types';
export function AccountMenu({user,onSettings,onLogout}:{user:User;onSettings:()=>void;onLogout:()=>void}) {
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const close=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))ref.current?.removeAttribute('open');};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 const initials=user.name.split(' ').slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase('tr');
 return <details className="rq-account-menu" ref={ref} onKeyDown={e=>{if(e.key==='Escape'){ref.current?.removeAttribute('open');ref.current?.querySelector('summary')?.focus();}}}><summary aria-label="Profil menüsü">{initials}</summary><div className="rq-account-popover"><strong>{user.name}</strong><span>{ROLE_LABELS[user.role]}</span><button onClick={()=>{ref.current?.removeAttribute('open');onSettings();}}>Kişisel ayarlar</button><button onClick={onLogout}>Oturumu kapat</button></div></details>;
}
