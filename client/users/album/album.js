'use strict';


const _ = require('lodash');
const ScrollableList = require('nodeca.core/lib/app/scrollable_list');


// Page state
//
// - user_hid:           user hid
// - album_id:           album id
// - selection_ids:      array of currently selected images
// - selection_started:  true if user is currently in select mode (checkboxes are shown)
//
let pageState = {};
let scrollable_list;

let $window = $(window);


// an amount of media files we try to load when user scrolls
// to the end of the page
const LOAD_MEDIA_ALL   = 30;
const LOAD_MEDIA_ALBUM = 100;

function load(start, direction) {
  let media = document.getElementById('users-media-list').getElementsByClassName('user-medialist__item');
  let first_offset = media[0].getBoundingClientRect().top;
  let i;

  for (i = 1; i < media.length; i++) {
    if (media[i].getBoundingClientRect().top !== first_offset) break;
  }

  let columns    = i;
  let load_count = pageState.album_id ? LOAD_MEDIA_ALBUM : LOAD_MEDIA_ALL;

  // Make sure we will have filled lines after load (if possible)
  //
  load_count -= (load_count + media.length) % columns;

  return N.io.rpc('users.album.list', {
    user_hid: pageState.user_hid,
    album_id: pageState.album_id,
    media_id: start,
    before:   direction === 'top' ? load_count : 0,
    after:    direction === 'bottom' ? load_count : 0
  }).then(res => {
    return {
      $html: $(N.runtime.render('users.album.list', res)),
      locals: res,
      reached_end: !(direction === 'top' ? res.prev_media : res.next_media)
    };
  }).catch(err => {
    // Album deleted, refreshing the page so user can see the error
    if (err.code === N.io.NOT_FOUND) return N.wire.emit('navigate.reload');
    throw err;
  });
}


let update_url;

function on_list_scroll(item, index, item_offset) {
  // Use a separate debouncer that only fires when user stops scrolling,
  // so it's executed a lot less frequently.
  //
  // The reason is that `history.replaceState` is very slow in FF
  // on large pages: https://bugzilla.mozilla.org/show_bug.cgi?id=1250972
  //
  update_url = update_url || _.debounce((item, index, item_offset) => {
    let href, state;

    if (item) {
      state = {
        media:  $(item).data('media-id'),
        offset: item_offset
      };
    }

    /* eslint-disable no-undefined */
    href = N.router.linkTo('users.album', {
      user_hid: pageState.user_hid,
      album_id: pageState.album_id,
      media_id: item ? $(item).data('media-id') : undefined
    });

    N.wire.emit('navigate.replace', { href, state })
          .catch(err => N.wire.emit('error', err));
  }, 500);

  update_url(item, index, item_offset);
}


/////////////////////////////////////////////////////////////////////
// init on page load
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  pageState.user_hid           = data.params.user_hid;
  pageState.album_id           = data.params.album_id;

  pageState.selection_ids      = null;
  pageState.selection_started  = false;

  let navbar_height = parseInt($('body').css('margin-top'), 10) + parseInt($('body').css('padding-top'), 10);

  // account for some spacing between posts
  navbar_height += 50;

  let scroll_done = false;

  if (!scroll_done && data.state &&
      typeof data.state.media !== 'undefined' && typeof data.state.offset !== 'undefined') {
    let el = $('#media' + data.state.media);

    if (el.length) {
      $window.scrollTop(el.offset().top - navbar_height + data.state.offset);
      scroll_done = true;
    }
  }

  if (!scroll_done && data.params.media_id) {
    let el = $('#media' + data.params.media_id);

    if (el.length) {
      $window.scrollTop(el.offset().top - navbar_height);
      scroll_done = true;
    }
  }


  // If we're on the first page, scroll to the top;
  // otherwise, scroll to the first topic on that page
  //
  if (!scroll_done) {
    if (N.runtime.page_data.prev_media && $('#users-media-list').length) {
      $window.scrollTop($('#users-media-list').offset().top - navbar_height);
    } else {
      $window.scrollTop(0);
    }
    scroll_done = true;
  }

  // disable automatic scroll to an anchor in the navigator
  data.no_scroll = true;

  scrollable_list = new ScrollableList({
    N,
    list_selector:               '.user-medialist',
    item_selector:               '.user-medialist__item',
    placeholder_top_selector:    '.user-album-root__loading-prev',
    placeholder_bottom_selector: '.user-album-root__loading-next',
    get_content_id:              media => $(media).data('media-id'),
    load,
    reached_top:                 !N.runtime.page_data.prev_media,
    reached_bottom:              !N.runtime.page_data.next_media,
    navbar_height,
    on_list_scroll
  });
});


N.wire.on('navigate.exit:' + module.apiPath, function page_teardown() {
  scrollable_list.destroy();
  scrollable_list = null;

  if (update_url) update_url.cancel();

  pageState = {};
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
        rpc: [ 'users.media.upload', { album_id: pageState.album_id } ],
        config: 'users.uploader_config',
        uploaded: null
      };

      N.wire.emit('users.uploader:add', params)
        .then(() => {
          $('#users-media-list').prepend(
            $(N.runtime.render('users.album.list', { media: params.uploaded, user_hid: pageState.user_hid }))
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
            rpc: [ 'users.media.upload', { album_id: pageState.album_id } ],
            config: 'users.uploader_config',
            uploaded: null
          };

          return N.wire.emit('users.uploader:add', params)
            .then(() => {
              $('#users-media-list').prepend(
                $(N.runtime.render('users.album.list', { media: params.uploaded, user_hid: pageState.user_hid }))
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
// Dropdown menu buttons handlers
//

N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  // Create medialink
  //
  N.wire.on(module.apiPath + ':add_medialink', function add_medialink(data) {
    let params = {
      album_id: pageState.album_id,
      providers: data.$this.data('providers'),
      media_url: null
    };

    return Promise.resolve()
      .then(() => N.wire.emit('users.album.add_medialink', params))
      .then(() => N.io.rpc('users.media.add_medialink', { album_id: params.album_id, media_url: params.media_url }))
      .then(res => {
        $('#users-media-list').prepend(
          $(N.runtime.render('users.album.list', { media: [ res.media ], user_hid: pageState.user_hid }))
        );
        $('.user-album-root').removeClass('no-files');
      });
  });


  // Delete
  //
  N.wire.before(module.apiPath + ':delete', function confirm_delete_album() {
    return N.wire.emit('common.blocks.confirm', t('delete_album_confirm'));
  });

  N.wire.on(module.apiPath + ':delete', function delete_album() {
    let params = { user_hid: N.runtime.user_hid };

    return N.io.rpc('users.album.destroy', { album_id: pageState.album_id })
      .then(() => N.wire.emit('navigate.to', { apiPath: 'users.albums_root', params }));
  });
});


///////////////////////////////////////////////////////////////////////////////
// Multiselect
//

function update_toolbar() {
  $('.user-album-root__toolbar-controls')
    .replaceWith(N.runtime.render(module.apiPath + '.blocks.toolbar_controls', {
      album:               N.runtime.page_data.album,
      user_hid:            N.runtime.page_data.user_hid,
      medialink_providers: N.runtime.page_data.medialink_providers,
      selection_ids:       pageState.selection_ids,
      selection_started:   pageState.selection_started
    }));
}

// Check or uncheck media
function check_media(media_id, checked) {
  let container = $('#media' + media_id);
  let checkbox  = container.find('.user-medialist-item__select-cb');

  checkbox.prop('checked', checked);
  container.toggleClass('selected', checked);

  if (checked && pageState.selection_ids.indexOf(media_id) === -1) {
    pageState.selection_ids.push(media_id);

  } else if (!checked && pageState.selection_ids.indexOf(media_id) !== -1) {
    pageState.selection_ids = _.without(pageState.selection_ids, media_id);
  }
}

function stop_selection() {
  for (let media_id of pageState.selection_ids) {
    check_media(media_id, false);
  }

  pageState.selection_ids = null;
  pageState.selection_started = false;
  update_toolbar();
  $('.user-medialist').removeClass('user-medialist__m-selection');
}


// Init handlers
//
N.wire.once('navigate.done:' + module.apiPath, function album_selection_init() {

  // User starts selection: show checkboxes, etc.
  //
  N.wire.on(module.apiPath + ':selection_start', function selection_start() {
    pageState.selection_ids = [];
    pageState.selection_started = true;
    update_toolbar();
    $('.user-medialist').addClass('user-medialist__m-selection');
  });


  // User stops selection: hide checkboxes, reset selection state
  //
  N.wire.on(module.apiPath + ':selection_stop', function selection_stop() {
    stop_selection();
  });


  // User toggles checkbox near an image
  //
  N.wire.on(module.apiPath + ':media_check', function media_check(data) {
    let media_id = data.$this.closest('.user-medialist__item').data('media-id');
    let checkbox = data.$this;

    check_media(media_id, checkbox.prop('checked'));
    update_toolbar();
  });


  // Mass-move media
  //
  N.wire.on('users.album:move_many', function media_move() {
    let media_ids = pageState.selection_ids.slice(0);

    return N.wire.emit('users.album.media_move', {
      src_album: pageState.album_id,
      media_ids
    }).then(() => {
      stop_selection();

      let media = $(media_ids.map(id => '#media' + id).join(','));
      media.fadeOut(() => media.remove());

      return N.wire.emit('notify.info', t('media_move_done', { count: media_ids.length }));
    });
  });


  // Mass-delete media
  //
  N.wire.before(module.apiPath + ':delete_many', function confirm_media_delete() {
    return N.wire.emit('common.blocks.confirm', t('delete_media_confirm', {
      count: pageState.selection_ids.length
    }));
  });

  N.wire.on(module.apiPath + ':delete_many', function media_delete() {
    let media_ids = pageState.selection_ids.slice(0);

    return N.io.rpc('users.album.media_destroy', {
      src_album: pageState.album_id,
      media_ids
    }).then(() => {
      stop_selection();

      let media = $(media_ids.map(id => '#media' + id).join(','));
      media.fadeOut(() => media.remove());

      return N.wire.emit('notify.info', t('media_delete_done', { count: media_ids.length }));
    });
  });
});
