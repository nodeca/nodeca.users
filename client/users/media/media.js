'use strict';


N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  // Delete media
  //
  N.wire.on('users.media:delete', function media_delete(data, callback) {
    let media_id     = data.$this.data('media-id');
    let as_moderator = !!data.$this.data('as-moderator');

    N.io.rpc('users.media.destroy', { media_id, as_moderator }).then(function () {
      $('.user-media-root').addClass('deleted');
      callback();
    });
  });


  // Restore media
  //
  N.wire.on('users.media:restore', function media_restore(data, callback) {
    let media_id     = data.$this.data('media-id');
    let as_moderator = !!data.$this.data('as-moderator');

    N.io.rpc('users.media.destroy', { media_id, as_moderator, revert: true }).then(function () {
      $('.user-media-root').removeClass('deleted');
      callback();
    });
  });


  // Edit media
  //
  N.wire.on('users.media:edit', function media_edit(data, callback) {
    let media_id = data.$this.data('media-id');

    N.wire.emit('users.media.edit', { media_id }, function () {
      N.wire.emit('navigate.reload', callback);
    });
  });
});
