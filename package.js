Package.describe({
  name: 'arggh:fireplace',
  version: '0.0.10',
  summary: 'Fireplace is a minimalist lightbox component for Blaze',
  git: 'https://github.com/arggh/fireplace',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.6.1');
  api.use([
    'ecmascript',
    'templating@1.3.0',
    'reactive-var@1.0.11',
    'blaze@2.3.3',
  ], 'client');

  api.mainModule('index.js', 'client', { lazy: true });
});
