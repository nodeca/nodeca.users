'use strict';


const _ = require('lodash');


// Media state
//
// - user_hid:           user hid
// - album_hid:          album hid
// - reached_start:      true if no more pages exist above first loaded one
// - reached_end:        true if no more pages exist below last loaded one
// - prev_loading_start: time when current xhr request for the previous page is started
// - next_loading_start: time when current xhr request for the next page is started
//
let mediaState = {};

let $window = $(window);

let navbarHeight = $('.navbar').height();


// offset between navbar and the first media
const TOP_OFFSET = 50;


/////////////////////////////////////////////////////////////////////
// init on page load
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  mediaState.user_hid           = data.params.user_hid;
  mediaState.album_id           = data.params.album_id;

  mediaState.reached_start      = !N.runtime.page_data.prev_media;
  mediaState.reached_end        = !N.runtime.page_data.next_media;

  mediaState.prev_loading_start = 0;
  mediaState.next_loading_start = 0;

  // disable automatic scroll to an anchor in the navigator
  data.no_scroll = true;

  let el;

  if (data.state && typeof data.state.media !== 'undefined' && typeof data.state.offset !== 'undefined') {
    el = $('#media' + data.state.media);

    if (el.length) {
      $window.scrollTop(el.offset().top - $('.navbar').height() - TOP_OFFSET + data.state.offset);
      return;
    }

  } else if (data.params.media_id) {
    el = $('#media' + data.params.media_id);

    if (el.length) {
      $window.scrollTop(el.offset().top - $('.navbar').height() - TOP_OFFSET);
      return;
    }
  }


  // If we're on the first page, scroll to the top;
  // otherwise, scroll to the first topic on that page
  //
  if (!mediaState.reached_start && $('#users-media-list').length) {
    $window.scrollTop($('#users-media-list').offset().top - navbarHeight);

  } else {
    $window.scrollTop(0);
  }
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
        url: N.router.linkTo('users.media.upload', { album_id: mediaState.album_id }),
        config: 'users.uploader_config',
        uploaded: null
      };

      N.wire.emit('users.uploader:add', params)
        .then(() => {
          $('#users-media-list').prepend(
            $(N.runtime.render('users.album.list', { media: params.uploaded, user_hid: mediaState.user_hid }))
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
            url: N.router.linkTo('users.media.upload', { album_id: mediaState.album_id }),
            config: 'users.uploader_config',
            uploaded: null
          };

          return N.wire.emit('users.uploader:add', params)
            .then(() => {
              $('#users-media-list').prepend(
                $(N.runtime.render('users.album.list', { media: params.uploaded, user_hid: mediaState.user_hid }))
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
      album_id: mediaState.album_id,
      providers: data.$this.data('providers'),
      media_url: null
    };

    return Promise.resolve()
      .then(() => N.wire.emit('users.album.add_medialink', params))
      .then(() => N.io.rpc('users.media.add_medialink', { album_id: params.album_id, media_url: params.media_url }))
      .then(() => {
        $('#users-media-list').prepend(
          $(N.runtime.render('users.album.list', { media: [ params.media ], user_hid: mediaState.user_hid }))
        );
        $('.user-album-root').removeClass('no-files');
      });
  });
});


/////////////////////////////////////////////////////////////////////
// Change URL when user scrolls the page
//
let locationScrollHandler = null;

N.wire.on('navigate.done:' + module.apiPath, function location_updater_init() {
  locationScrollHandler = _.debounce(function update_location_on_scroll() {
    let media          = document.getElementById('users-media-list').getElementsByClassName('thumb'),
        mediaThreshold = $window.scrollTop() + navbarHeight + TOP_OFFSET,
        currentIdx;

    // Get offset of the first media in the viewport
    //
    currentIdx = _.sortedIndexBy(media, null, medium => {
      if (!medium) { return mediaThreshold; }
      return medium.offsetTop + $(medium).height();
    });

    if (currentIdx === 0 && media[currentIdx].offsetTop > mediaThreshold) {
      currentIdx--;
    }

    if (currentIdx >= media.length) { currentIdx = media.length - 1; }

    let href = null;
    let state = null;

    if (currentIdx >= 0 && media.length) {
      state = {
        media:  $(media[currentIdx]).data('media-id'),
        offset: mediaThreshold - media[currentIdx].offsetTop
      };
    }

    /* eslint-disable no-undefined */
    href = N.router.linkTo('users.album', {
      user_hid: mediaState.user_hid,
      album_id: mediaState.album_id,
      media_id: currentIdx >= 0 ? $(media[currentIdx]).data('media-id') : undefined
    });

    // all photos, 1st page    - noindex, nofollow
    // all photos, other pages - noindex, nofollow
    // album, 1st page         - index,   follow
    // album, other pages      - noindex, follow
    //
    let index  = mediaState.album_id && currentIdx < 0;
    let follow = mediaState.album_id;
    let tag    = $('meta[name="robots"]');

    if (index && follow) {
      tag.remove();
    } else {
      if (!tag.length) $('head').append(tag = $('<meta name="robots">'));

      tag.attr('content', (index  ? 'index'  : 'noindex') + ',' +
                          (follow ? 'follow' : 'nofollow'));
    }

    N.wire.emit('navigate.replace', { href, state })
          .catch(err => N.wire.emit('error', err));

  }, 500);

  // avoid executing it on first tick because of initial scrollTop()
  setTimeout(function () {
    $window.on('scroll', locationScrollHandler);
    $window.on('resize', locationScrollHandler);
  }, 1);
});

N.wire.on('navigate.exit:' + module.apiPath, function location_updater_teardown() {
  if (!locationScrollHandler) return;
  locationScrollHandler.cancel();
  $window.off('scroll', locationScrollHandler);
  $window.off('resize', locationScrollHandler);
  locationScrollHandler = null;
});


///////////////////////////////////////////////////////////////////////////
// Whenever we are close to beginning/end of media list, check if we can
// load more pages from the server
//
let prefetchScrollHandler = null;

N.wire.on('navigate.done:' + module.apiPath, function prefetcher_init() {
  // an amount of time between successful xhr requests and failed xhr requests respectively
  //
  // For example, suppose user continuously scrolls. If server is up, each
  // subsequent request will be sent each 100 ms. If server goes down, the
  // interval between request initiations goes up to 2000 ms.
  //
  const LOAD_INTERVAL    = 100;
  const LOAD_AFTER_ERROR = 2000;

  // an amount of media files we try to load when user scrolls
  // to the end of the page
  const LOAD_MEDIA_ALL   = 30;
  const LOAD_MEDIA_ALBUM = 100;

  function load_prev_page() {
    if (mediaState.reached_start) return;

    let now = Date.now();

    // `prev_loading_start` is the last request start time, which is reset to 0 on success
    //
    // Thus, successful requests can restart immediately, but failed ones
    // will have to wait `LOAD_AFTER_ERROR` ms.
    //
    if (Math.abs(mediaState.prev_loading_start - now) < LOAD_AFTER_ERROR) return;

    mediaState.prev_loading_start = now;

    let media = document.getElementById('users-media-list').getElementsByClassName('thumb');
    let first_offset = media[0].offsetTop;
    let i;

    for (i = 1; i < media.length; i++) {
      if (media[i].offsetTop !== first_offset) break;
    }

    let columns    = i;
    let load_count = mediaState.album_id ? LOAD_MEDIA_ALBUM : LOAD_MEDIA_ALL;

    // Make sure we will have filled lines after load (if possible)
    //
    load_count -= (load_count + media.length) % columns;

    N.io.rpc('users.album.list', {
      user_hid: mediaState.user_hid,
      album_id: mediaState.album_id,
      media_id: $('#users-media-list .thumb:first').data('media-id'),
      before:   load_count,
      after:    0
    }).then(function (res) {
      // Stop debouncer to avoid progress bar jump after page load
      if ($window.scrollTop() <= 0) {
        prefetchScrollHandler.cancel();
      }

      if (!res.media) return;

      if (!res.prev_media) {
        mediaState.reached_start = true;
      }

      if (res.media.length === 0) return;

      let old_height = $('#users-media-list').height();

      // render & inject media list
      let $result = $(N.runtime.render('users.album.list', res));
      $('#users-media-list').prepend($result);

      // update scroll so it would point at the same spot as before
      $window.scrollTop($window.scrollTop() + $('#users-media-list').height() - old_height);

      // update prev/next metadata
      $('link[rel="prev"]').remove();

      if (res.head.prev) {
        let link = $('<link rel="prev">');

        link.attr('href', res.head.prev);
        $('head').append(link);
      }

      mediaState.prev_loading_start = 0;
    }).catch(err => {
      N.wire.emit('error', err);
    });
  }

  function load_next_page() {
    if (mediaState.reached_end) return;

    let now = Date.now();

    // `next_loading_start` is the last request start time, which is reset to 0 on success
    //
    // Thus, successful requests can restart immediately, but failed ones
    // will have to wait `LOAD_AFTER_ERROR` ms.
    //
    if (Math.abs(mediaState.next_loading_start - now) < LOAD_AFTER_ERROR) return;

    mediaState.next_loading_start = now;

    let media = document.getElementById('users-media-list').getElementsByClassName('thumb');
    let first_offset = media[0].offsetTop;
    let i;

    for (i = 1; i < media.length; i++) {
      if (media[i].offsetTop !== first_offset) break;
    }

    let columns    = i;
    let load_count = mediaState.album_id ? LOAD_MEDIA_ALBUM : LOAD_MEDIA_ALL;

    // Make sure we will have filled lines after load (if possible)
    //
    load_count -= (load_count + media.length) % columns;

    N.io.rpc('users.album.list', {
      user_hid: mediaState.user_hid,
      album_id: mediaState.album_id,
      media_id: $('#users-media-list .thumb:last').data('media-id'),
      before:   0,
      after:    load_count
    }).then(function (res) {
      let scrollHeight = (document.documentElement && document.documentElement.scrollHeight) ||
                         document.body.scrollHeight;

      // Stop debouncer to avoid progress bar jump after page load
      if ($window.height() + $window.scrollTop() >= scrollHeight) {
        prefetchScrollHandler.cancel();
      }

      if (!res.media) return;

      if (!res.next_media) {
        mediaState.reached_end = true;
      }

      if (res.media.length === 0) return;

      // render & inject media list
      let $result = $(N.runtime.render('users.album.list', res));
      $('#users-media-list').append($result);

      // update next/next metadata
      $('link[rel="next"]').remove();

      if (res.head.next) {
        let link = $('<link rel="next">');

        link.attr('href', res.head.next);
        $('head').append(link);
      }

      mediaState.next_loading_start = 0;
    }).catch(err => {
      N.wire.emit('error', err);
    });
  }

  // If we're browsing one of the first/last 3 media rows, load more pages from
  // the server in that direction.
  //
  prefetchScrollHandler = _.debounce(function prefetch_on_scroll() {
    let media         = document.getElementById('users-media-list').getElementsByClassName('thumb'),
        viewportStart = $window.scrollTop() + navbarHeight,
        viewportEnd   = $window.scrollTop() + $window.height();

    if (media.length <= 1 || media[media.length - 1].offsetTop < viewportEnd) {
      load_next_page();
    }

    if (media.length <= 1 || media[0].offsetTop > viewportStart) {
      load_prev_page();
    }
  }, LOAD_INTERVAL, { maxWait: LOAD_INTERVAL });


  // avoid executing it on first tick because of initial scrollTop()
  setTimeout(function () {
    $window.on('scroll', prefetchScrollHandler);
    $window.on('resize', prefetchScrollHandler);
  }, 1);
});

N.wire.on('navigate.exit:' + module.apiPath, function prefetcher_teardown() {
  if (!prefetchScrollHandler) return;
  prefetchScrollHandler.cancel();
  $window.off('scroll', prefetchScrollHandler);
  $window.off('resize', prefetchScrollHandler);
  prefetchScrollHandler = null;
});
