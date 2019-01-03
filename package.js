Package.describe({
  name: 'arggh:fireplace',
  version: '0.0.1',
  summary: 'Fireplace is a minimalist lightbox component for Blaze',
  git: 'https://github.com/arggh/fireplace',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.6.1');
  api.use([
    'ecmascript',
    'templating',
    'reactive-var',
    'blaze',
  ], 'client');

  api.addFiles([
    './templates/fireplace.html',
    './templates/fireplace.js'
  ], 'client');

  api.mainModule('fireplace.js', 'client');
});
