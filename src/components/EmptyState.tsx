import React from 'react';
import { ClipboardList } from 'lucide-react';

export function EmptyState({title,description,action,label}:{title:string;description:string;action?:()=>void;label?:string}) {
  return <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 p-8 text-center"><ClipboardList className="h-9 w-9 text-slate-400"/><h3 className="text-lg font-semibold">{title}</h3><p className="max-w-lg text-sm text-slate-500">{description}</p>{action&&label&&<button type="button" className="quality-primary" onClick={action}>{label}</button>}</div>;
}
