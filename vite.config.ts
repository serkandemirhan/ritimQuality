import {execFileSync} from 'node:child_process';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const version=process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7)||execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).trim();
  return {
    define:{'import.meta.env.VITE_APP_VERSION':JSON.stringify(version)},
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/api': process.env.API_PROXY_TARGET || 'http://localhost:3001',
      },
      // HMR can be disabled in constrained development environments.
      // File watching is also disabled when DISABLE_HMR is enabled.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/.runtime/**', '**/.npm-cache/**'] },
    },
  };
});
