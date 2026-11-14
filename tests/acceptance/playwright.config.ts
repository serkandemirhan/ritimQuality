import {resolve} from 'node:path';
import {defineConfig} from '@playwright/test';
if(process.env.ACCEPTANCE_ISOLATED!=='1'||!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.ACCEPTANCE_ORIGIN||''))throw Error('Run npm run test:acceptance with a disposable loopback database.');
export default defineConfig({
 testDir:'.',testMatch:'*.spec.ts',timeout:360000,expect:{timeout:20000},workers:1,retries:0,
 outputDir:resolve(process.env.ACCEPTANCE_OUTPUT||'.runtime/acceptance','browser'),reporter:[['list'],['html',{outputFolder:resolve(process.env.ACCEPTANCE_OUTPUT||'.runtime/acceptance','html'),open:'never'}]],
 use:{baseURL:process.env.ACCEPTANCE_ORIGIN,viewport:{width:1440,height:1000},acceptDownloads:true,actionTimeout:20000,navigationTimeout:30000,
 // No traces, HARs or auth form screenshots: they would record registration secrets.
 trace:'off',screenshot:'off',video:'off',launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:JSON.parse(process.env.CHROMIUM_ARGS||'[]')}:{}},
});
