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
  N.wire.on('users.media:delete', function media_delete(event) {
    var $target = $(event.target);
    var mediaId = $target.data('mediaId');

    N.io.rpc('users.media.destroy', { 'media_id': mediaId }).done(function () {
      $('.user-mediapage').addClass('deleted');
    });
  });


  // Restore media
  //
  N.wire.on('users.media:restore', function media_restore(event) {
    var $target = $(event.target);
    var mediaId = $target.data('mediaId');

    N.io.rpc('users.media.destroy', { 'media_id': mediaId, restore: true }).done(function () {
      $('.user-mediapage').removeClass('deleted');
    });
  });


  // Edit media
  //
  N.wire.on('users.media:edit', function media_edit() {
    N.wire.emit('users.media.edit', { file_id: pageParams.file_id }, function () {

      N.io.rpc('users.media', pageParams).done(function (data) {
        $('#content').html($(N.runtime.render('users.media', data)));
      });
    });
  });
});
