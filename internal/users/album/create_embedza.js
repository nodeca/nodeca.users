// Create embedza instance for album's video links. Add templates for item preview (on album page).
//
// - data.embedza (Embedza)
//
'use strict';


const thenify   = require('thenify');
const _         = require('lodash');
const Embedza   = require('embedza');
const templates = require('embedza/lib/templates');


module.exports = function (N, apiPath) {

  templates['default_thumb_url'] = result => {
    let thumbnail = _.find(result.snippets, snippet => snippet.tags.indexOf('thumbnail') !== -1);

    return thumbnail.href;
  };

  templates['vimeo.com_thumb_url'] = result => {
    let thumbnail = _.find(result.snippets, snippet => snippet.tags.indexOf('thumbnail') !== -1);

    return thumbnail.href.replace(/_[0-9]+\.jpg$/, '_200.jpg');
  };

  templates['youtube.com_thumb_url'] = result => {
    let thumbnail = _.find(result.snippets, snippet => snippet.tags.indexOf('thumbnail') !== -1);

    return thumbnail.href.replace('hqdefault.jpg', 'mqdefault.jpg');
  };


  let instance = new Embedza({
    cache: N.models.core.EmbedzaCache,
    enabledProviders: N.config.album.embed
  });


  // Wrap embedza async methods with thenify
  //
  instance.render = thenify.withCallback(instance.render);
  instance.info = thenify.withCallback(instance.info);


  N.wire.on(apiPath, function create_embedza_for_albums(data) {
    data.embedza = instance;
  });
};
