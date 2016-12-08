// Create embedza instance for album's video links. Add templates for item preview (on album page).
//
// - data.embedza (Embedza)
//
'use strict';


const _           = require('lodash');
const Embedza     = require('embedza');
const embedza_pkg = require('embedza/package.json');
const templates   = require('embedza/lib/templates');


module.exports = function (N, apiPath) {

  let rootUrl = _.get(N.config, 'bind.default.mount', 'http://localhost') + '/';
  let userAgentEmbedza = `${embedza_pkg.name}/${embedza_pkg.version} (Nodeca; +${rootUrl})`;

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
    enabledProviders: N.config.album.embed,
    request: {
      headers: {
        'user-agent': userAgentEmbedza
      }
    }
  });


  // Convert embedza async methods to promise
  //
  instance.render = instance.render;
  instance.info = instance.info;


  N.wire.on(apiPath, function create_embedza_for_albums(data) {
    data.embedza = instance;
  });
};
