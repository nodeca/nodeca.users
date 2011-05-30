var app = module.exports = new (require('nodeca-lib').App)(__dirname);

if (!module.parent) {
  app.start();
}
