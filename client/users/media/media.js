'use strict';

var pageParams;


// Page setup
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  pageParams = data.params;
});


N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  // Delete media
  //
  N.wire.on('users.media:delete', function media_delete(__, callback) {
    N.io.rpc('users.media.destroy', { media_id: pageParams.media_id }).done(function () {
      $('.user-mediapage').addClass('deleted');
      callback();
    });
  });


  // Restore media
  //
  N.wire.on('users.media:restore', function media_restore(__, callback) {
    N.io.rpc('users.media.destroy', { media_id: pageParams.media_id, revert: true }).done(function () {
      $('.user-mediapage').removeClass('deleted');
      callback();
    });
  });


  // Edit media
  //
  N.wire.on('users.media:edit', function media_edit(__, callback) {
    N.wire.emit('users.media.edit', { media_id: pageParams.media_id }, function () {

      N.io.rpc('users.media', pageParams).done(function (data) {
        $('#content').html($(N.runtime.render('users.media', data)));
        callback();
      });
    });
  });
});
