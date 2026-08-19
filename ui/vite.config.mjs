// https://github.com/vitejs/vite/discussions/3448
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import jsconfigPaths from 'vite-jsconfig-paths';

// Remaining noise comes from Bootstrap 5.x SCSS in node_modules (legacy patterns).
// Silence until https://github.com/twbs/bootstrap ships module-based Sass entry.
const sassSilenceDeprecations = [
  'import',
  'global-builtin',
  'color-functions',
  'if-function',
  'legacy-js-api',
  'color-4-api'
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_URL = `${env.VITE_APP_BASE_NAME}`;
  // const PORT = `${'80'}`;
  const PORT = 3000;


  return {
    define: {
      global: 'window'
    },
    server: {
      // this ensures that the browser opens upon server start
      open: true,
      // this sets a default port to 3000
      port: PORT
    },
    resolve: {
      alias: [
        {
          find: /^~(.+)/,
          replacement: path.join(process.cwd(), 'node_modules/$1')
        },
        {
          find: /^src(.+)/,
          replacement: path.join(process.cwd(), 'src/$1')
        }
      ]
    },
    css: {
      preprocessorOptions: {
        scss: {
          charset: false,
          quietDeps: true,
          silenceDeprecations: sassSilenceDeprecations
        },
        less: {
          charset: false
        }
      },
      charset: false,
      postcss: {
        plugins: [
          {
            postcssPlugin: 'internal:charset-removal',
            AtRule: {
              charset: (atRule) => {
                if (atRule.name === 'charset') {
                  atRule.remove();
                }
              }
            }
          }
        ]
      }
    },
    base: API_URL,
    plugins: [react(), jsconfigPaths()]
  };
});
