// Init embedza instance for albums
//
// - data.embedza (Embedza)
//
'use strict';


var _ = require('lodash');


var Embedza = require('embedza');


module.exports = function (N, apiPath) {

  var enabledProviders;

  // If config is array - convert to hash (embedza compatible)
  if (_.isArray(N.config.album.embed)) {
    enabledProviders = {};
    N.config.album.embed.forEach(function (id) {
      enabledProviders[id] = true;
    });
  } else {
    enabledProviders = N.config.album.embed;
  }

  var instance = new Embedza({
    cache: N.models.core.EmbedzaCache,
    enabledProviders: enabledProviders
  });

  // Apply thumb url template to enabled providers
  Object.keys(instance.providers).forEach(function (id) {
    if (instance.providers[id].enabled) {
      instance.providers[id].template_thumb_url = function (__, data) {
        return data.thumbnail_url.replace(/^https?:/, '').replace(/\?.+$/, '?size=s');
      };
    }
  });

  N.wire.on(apiPath, function init_embedza_for_albums(data) {
    data.embedza = instance;
  });
};
