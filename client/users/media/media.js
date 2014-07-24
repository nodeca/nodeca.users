'use strict';


N.wire.on('users.media:delete', function media_delete(event) {
  var $target = $(event.target);
  var mediaId = $target.data('mediaId');

  N.io.rpc('users.media.destroy', { 'media_id': mediaId }).done(function () {
    $('.user-mediapage').addClass('user-mediapage__m-deleted');
  });
});


N.wire.on('users.media:restore', function media_restore(event) {
  var $target = $(event.target);
  var mediaId = $target.data('mediaId');

  N.io.rpc('users.media.destroy', { 'media_id': mediaId, restore: true }).done(function () {
    $('.user-mediapage').removeClass('user-mediapage__m-deleted');
  });
});
