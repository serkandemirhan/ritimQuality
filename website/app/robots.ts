import type {MetadataRoute} from 'next';
import {site} from '@/lib/config';
import {sitePath} from '@/lib/site-path';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/',disallow:['/app','/onboarding','/auth','/api','/reset-password'].map(sitePath)},sitemap:site.url+'/sitemap.xml'};}
