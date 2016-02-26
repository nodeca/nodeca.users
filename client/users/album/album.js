'use strict';


let pageParams;


N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  pageParams = data.params;
});


////////////////////////////////////////////////////////////////////////////////
// Uploader
//

let $dropZone;


N.wire.after('navigate.done:' + module.apiPath, function uploader_setup() {
  $dropZone = $('.user-album-upload');

  $('#user-album-upload__files').on('change', function () {
    let files = $(this).get(0).files;

    if (files.length > 0) {
      let params = {
        files,
        url: N.router.linkTo('users.media.upload', { album_id: pageParams.album_id }),
        config: 'users.uploader_config',
        uploaded: null
      };

      N.wire.emit('users.uploader:add', params)
        .then(() => {
          $('#users-medias-list').prepend(
            $(N.runtime.render('users.album.list', { medias: params.uploaded, user_hid: pageParams.user_hid }))
          );
          $('.user-album-root').removeClass('no-files');
        })
        .catch(err => N.wire.emit('error', err));
    }
  });
});


N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  // Handles the event when user drag file to drag drop zone
  //
  N.wire.on(module.apiPath + ':dd_area', function user_album_dd(data) {
    let x0, y0, x1, y1, ex, ey;

    switch (data.event.type) {
      case 'dragenter':
        $dropZone.addClass('active');
        break;

      case 'dragleave':
        // 'dragleave' occurs when user move cursor over child HTML element
        // track this situation and don't remove 'active' class
        // http://stackoverflow.com/questions/10867506/
        x0 = $dropZone.offset().left;
        y0 = $dropZone.offset().top;
        x1 = x0 + $dropZone.outerWidth();
        y1 = y0 + $dropZone.outerHeight();
        ex = data.event.originalEvent.pageX;
        ey = data.event.originalEvent.pageY;

        if (ex > x1 || ex < x0 || ey > y1 || ey < y0) {
          $dropZone.removeClass('active');
        }
        break;

      case 'drop':
        $dropZone.removeClass('active');

        if (data.files && data.files.length) {
          let params = {
            files: data.files,
            url: N.router.linkTo('users.media.upload', { album_id: pageParams.album_id }),
            config: 'users.uploader_config',
            uploaded: null
          };

          return N.wire.emit('users.uploader:add', params)
            .then(() => {
              $('#users-medias-list').prepend(
                $(N.runtime.render('users.album.list', { medias: params.uploaded, user_hid: pageParams.user_hid }))
              );
              $('.user-album-root').removeClass('no-files');
            });
        }
        break;

      default:
    }
  });
});


////////////////////////////////////////////////////////////////////////////////
// Create medialink button handler
//

N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  N.wire.on(module.apiPath + ':add_medialink', function add_medialink(data) {
    let params = {
      album_id: pageParams.album_id,
      providers: data.$this.data('providers'),
      media_url: null
    };

    return Promise.resolve()
      .then(() => N.wire.emit('users.album.add_medialink', params))
      .then(() => N.io.rpc('users.media.add_medialink', { album_id: params.album_id, media_url: params.media_url }))
      .then(() => {
        $('#users-medias-list').prepend(
          $(N.runtime.render('users.album.list', { medias: [ params.media ], user_hid: pageParams.user_hid }))
        );
        $('.user-album-root').removeClass('no-files');
      });
  });
});


////////////////////////////////////////////////////////////////////////////////
// Lazy load photos on scroll down
//

let nextMediaID;


N.wire.after('navigate.done:' + module.apiPath, function append_setup() {
  // Get from template
  nextMediaID = N.runtime.page_data.next_media_id;
});

N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  // Append more photos
  //
  // If callback not executed, no new event happen
  //
  N.wire.on(module.apiPath + ':append_more_medias', function append_more_medias() {
    if (!nextMediaID) {
      return;
    }

    return N.io.rpc('users.album.list', {
      user_hid: pageParams.user_hid,
      album_id: pageParams.album_id,
      from_media_id: nextMediaID
    }).then(function (mediaList) {
      $('#users-medias-list').append($(N.runtime.render('users.album.list', mediaList)));
      nextMediaID = mediaList.next_media_id;
    });
  });
});
