import {redirect} from 'next/navigation';
import {site} from '@/lib/config';
export default function Page(){const url=new URL(site.applicationUrl);url.searchParams.set('view','logs');redirect(url.toString());}
