'use strict';
const path = require('node:path');
const { buildSync } = require('esbuild');
buildSync({ absWorkingDir: path.resolve(__dirname, '..'), entryPoints: ['entry.js'], bundle: true,
  format: 'iife', platform: 'browser', outfile: '미르.js', logLevel: 'info' });
