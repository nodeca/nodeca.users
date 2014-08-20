// Member page
//

'use strict';


// Click to avatar
//
N.wire.on('users.member:change_avatar', function change_avatar() {
  var data = {};

  N.wire.emit('users.avatar.change', data, function () {

    $('.member-avatar__image').attr('src', N.router.linkTo('core.gridfs', { bucket: data.avatar_id }));
    $('.member-layout').addClass('member-layout__m-avatar-exists');
  });
});


// Click to delete avatar button
//
N.wire.on('users.member:detete_avatar', function change_avatar() {
  N.io.rpc('users.avatar.delete').done(function (result) {

    $('.member-avatar__image').attr('src', N.router.linkTo('core.gridfs', { bucket: result.avatar_id }));
    $('.member-layout').removeClass('member-layout__m-avatar-exists');
  });
});
