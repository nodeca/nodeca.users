'use strict';


var pageParams;


N.wire.on('navigate.done:' + module.apiPath, function setup_page(data) {
  pageParams = data.params;
});


// listen successeful album creation & reload albums list
//
N.wire.on('users.album.create:done', function update_list() {
  N.io.rpc('users.albums_root.list', pageParams, function (err, albumsList) {
    if (err) { return false; }

    var $list = $(N.runtime.render('users.albums_root.list', albumsList));
    $('#users-albums-list').html($list);
  });
});
