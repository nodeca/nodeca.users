var nodeca  = require('nodeca-lib'),
    app     = module.exports = new (nodeca.App)(__dirname);

if (undefined === module.parent) {
  nodeca.start(app);
}
