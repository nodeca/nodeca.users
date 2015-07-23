// Init embedza instance for albums
//
// - data.embedza (Embedza)
//
'use strict';


var _         = require('lodash');
var Embedza   = require('embedza');
var templates = require('embedza/lib/templates');


module.exports = function (N, apiPath) {

  // Apply 'thumb_url' template to enabled providers
  templates['default_thumb_url'] = function (result) {
    var thumbnail = _.find(result.snippets, function (snippet) {
      return snippet.tags.indexOf('thumbnail') !== -1;
    });

    return thumbnail.href;
  };

  templates['vimeo.com_thumb_url'] = function (result) {
    var thumbnail = _.find(result.snippets, function (snippet) {
      return snippet.tags.indexOf('thumbnail') !== -1;
    });

    return thumbnail.href.replace(/_[0-9]+\.jpg$/, '_200.jpg');
  };

  templates['youtube.com_thumb_url'] = function (result) {
    var thumbnail = _.find(result.snippets, function (snippet) {
      return snippet.tags.indexOf('thumbnail') !== -1;
    });

    return thumbnail.href.replace('hqdefault.jpg', 'mqdefault.jpg');
  };

  var instance = new Embedza({
    cache: N.models.core.EmbedzaCache,
    enabledProviders: N.config.album.embed
  });

  N.wire.on(apiPath, function init_embedza_for_albums(data) {
    data.embedza = instance;
  });
};
