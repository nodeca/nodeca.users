'use strict';


var pageParams;


N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  pageParams = data.params;
  N.wire.emit('users.media.upload:init', data);
});


// listen successful media upload & reload media list
//
N.wire.on('users.media.upload:done', function update_list() {
  N.io.rpc('users.media.list', pageParams, function (err, mediaList) {
    if (err) { return false; }

    var $list = $(N.runtime.render('users.media.list', mediaList));
    $('#users-medias-list').html($list);
  });
});
