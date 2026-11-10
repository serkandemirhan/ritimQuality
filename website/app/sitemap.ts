import type {MetadataRoute} from 'next';
import {site} from '@/lib/config';
export default function sitemap():MetadataRoute.Sitemap{return ['','/demo','/pricing','/signup','/login','/help','/privacy','/terms'].map(path=>({url:site.url+path,changeFrequency:'monthly',priority:path===''?1:.6}));}
