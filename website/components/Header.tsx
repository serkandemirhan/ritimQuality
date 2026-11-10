'use client';
import Link from 'next/link';
import {useState} from 'react';
import {Menu,X,ArrowUpRight} from 'lucide-react';
import {usePathname} from 'next/navigation';
export function Brand(){return <Link href="/" className="brand" aria-label="Ritim Quality ana sayfa"><span className="brand-mark"><i/><i/><i/></span>ritim<span className="brand-quality">quality</span></Link>;}
export function Header(){const[open,setOpen]=useState(false);const path=usePathname();return <header className="site-header" onKeyDown={event=>{if(event.key==='Escape'&&open){setOpen(false);event.currentTarget.querySelector<HTMLButtonElement>('.menu-toggle')?.focus();}}}><div className="container header-inner"><Brand/><button className="menu-toggle" aria-expanded={open} aria-controls="main-navigation" aria-label={open?'Menüyü kapat':'Menüyü aç'} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button><nav id="main-navigation" className={open?'navigation open':'navigation'} aria-label="Ana menü" onClick={()=>setOpen(false)}><Link href="/#nasil-calisir">Nasıl çalışır?</Link><Link href="/#ozellikler">Özellikler</Link><Link href="/pricing" aria-current={path==='/pricing'?'page':undefined}>Fiyatlandırma</Link><Link href="/login" className="nav-login">Giriş yap</Link><Link className="button button-dark" href="/signup">Ücretsiz başla <ArrowUpRight size={16}/></Link></nav></div></header>;}
