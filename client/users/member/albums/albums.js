'use strict';

var pageParams;

N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  pageParams = data.params;
});


N.wire.on('users.blocks.albums_create:done', function update_list() {
  N.io.rpc('users.member.albums.albums_list', pageParams, function (err, albumsList) {
    if (err) { return false; }

    var $list = $(N.runtime.render('users.blocks.albums_list', albumsList));
    $('#users-albums-list').html($list);
  });
});
