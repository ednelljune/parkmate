const fs = require('fs');
const { createParkMateAnimatedLogoHtml } = require('../anything/apps/mobile/src/components/parkmateLogoAnimatedV8.js');

// mock the dependencies to just extract BASE_SVG
const content = fs.readFileSync('../anything/apps/mobile/src/components/parkmateLogoAnimatedV8.js', 'utf8');

fs.writeFileSync('scratch/test.html', content);
