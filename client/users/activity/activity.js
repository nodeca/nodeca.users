'use strict';


const _ = require('lodash');


// Activity state
//
// - hid:                current user hid
// - type:               current item type
// - reached_start:      true if no more pages exist above first loaded one
// - reached_end:        true if no more pages exist below last loaded one
// - prev_loading_start: time when current xhr request for the previous page is started
// - next_loading_start: time when current xhr request for the next page is started
// - top_marker:         last id of the topmost item (for prefetch)
// - bottom_marker:      last id of the bottom item (for prefetch)
//
let pageState = {};

let $window = $(window);

// offset between navbar and the first item
const TOP_OFFSET = 32;

const navbarHeight = parseInt($('body').css('margin-top'), 10) + parseInt($('body').css('padding-top'), 10);


/////////////////////////////////////////////////////////////////////
// init on page load
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  pageState.hid                = $('.users-activity-root').data('user-hid');
  pageState.type               = $('.users-activity-root').data('type');
  pageState.prev_loading_start = 0;
  pageState.next_loading_start = 0;
  pageState.top_marker         = $('.users-activity-root').data('top-marker');
  pageState.bottom_marker      = $('.users-activity-root').data('bottom-marker');

  // disable automatic scroll to an anchor in the navigator
  data.no_scroll = true;

  let el;

  if (data.state && typeof data.state.id !== 'undefined' && typeof data.state.offset !== 'undefined') {
    el = $('#item' + data.state.id);

    if (el.length) {
      $window.scrollTop(el.offset().top - navbarHeight - TOP_OFFSET + data.state.offset);
      return;
    }

  } else if (data.params.start) {
    el = $('#item' + data.params.start);

    if (el.length) {
      $window.scrollTop(el.offset().top - navbarHeight - TOP_OFFSET);
      //el.addClass('users-activity-item__m-highlight');
      return;
    }
  }

  // If we're on the first page, scroll to the top;
  // otherwise, scroll to the first item on that page
  //
  if (pageState.top_marker && $('.users-activity__list').length) {
    $window.scrollTop($('.users-activity__list').offset().top - $('.navbar').height());
  } else {
    $window.scrollTop(0);
  }
});


/////////////////////////////////////////////////////////////////////
// Change URL when user scrolls the page
//
// Use a separate debouncer that only fires when user stops scrolling,
// so it's executed a lot less frequently.
//
// The reason is that `history.replaceState` is very slow in FF
// on large pages: https://bugzilla.mozilla.org/show_bug.cgi?id=1250972
//
let locationScrollHandler = null;

N.wire.on('navigate.done:' + module.apiPath, function location_updater_init() {
  if ($('.users-activity__list').length === 0) { return; }

  locationScrollHandler = _.debounce(function update_location_on_scroll() {
    let items         = document.getElementsByClassName('users-activity-item'),
        itemThreshold = navbarHeight + TOP_OFFSET,
        currentIdx;

    // Get offset of the first item in the viewport
    //
    currentIdx = _.sortedIndexBy(items, null, item => {
      if (!item) { return itemThreshold; }
      return item.getBoundingClientRect().top;
    }) - 1;

    let state = null;

    if (currentIdx >= 0 && items.length) {
      state = {
        id:     $(items[currentIdx]).data('item-id'),
        offset: itemThreshold - items[currentIdx].getBoundingClientRect().top
      };
    }

    /* eslint-disable no-undefined */
    let href = N.router.linkTo('users.activity', {
      user_hid:  pageState.hid,
      type:      pageState.type,
      start:     currentIdx >= 0 ? $(items[currentIdx]).data('item-id') : undefined
    });

    N.wire.emit('navigate.replace', { href, state });
  }, 500);

  // avoid executing it on first tick because of initial scrollTop()
  setTimeout(function () {
    $window.on('scroll', locationScrollHandler);
  }, 1);
});

N.wire.on('navigate.exit:' + module.apiPath, function location_updater_teardown() {
  if (!locationScrollHandler) return;
  locationScrollHandler.cancel();
  $window.off('scroll', locationScrollHandler);
  locationScrollHandler = null;
});


// Show/hide loading placeholders when new items are fetched,
// adjust scroll when adding/removing top placeholder
//
function reset_loading_placeholders() {
  let prev = $('.users-activity__loading-prev');
  let next = $('.users-activity__loading-next');

  // if topmost item is loaded, hide top placeholder
  if (!pageState.top_marker) {
    if (!prev.hasClass('d-none')) {
      $window.scrollTop($window.scrollTop() - prev.outerHeight(true));
    }

    prev.addClass('d-none');
  } else {
    if (prev.hasClass('d-none')) {
      $window.scrollTop($window.scrollTop() + prev.outerHeight(true));
    }

    prev.removeClass('d-none');
  }

  // if last item is loaded, hide bottom placeholder
  if (!pageState.bottom_marker) {
    next.addClass('d-none');
  } else {
    next.removeClass('d-none');
  }
}


// Init handlers
//
N.wire.once('navigate.done:' + module.apiPath, function init_handlers() {

  ///////////////////////////////////////////////////////////////////////////
  // Whenever we are close to beginning/end of item list, check if we can
  // load more pages from the server
  //

  // an amount of items we try to load when user scrolls to the end of the page
  const LOAD_ITEMS_COUNT = N.runtime.page_data.items_per_page;

  // A delay after failed xhr request (delay between successful requests
  // is set with affix `throttle` argument)
  //
  // For example, suppose user continuously scrolls. If server is up, each
  // subsequent request will be sent each 100 ms. If server goes down, the
  // interval between request initiations goes up to 2000 ms.
  //
  const LOAD_AFTER_ERROR = 2000;

  N.wire.on(module.apiPath + ':load_prev', function load_prev_page() {
    if (!pageState.top_marker) return;

    let now = Date.now();

    // `prev_loading_start` is the last request start time, which is reset to 0 on success
    //
    // Thus, successful requests can restart immediately, but failed ones
    // will have to wait `LOAD_AFTER_ERROR` ms.
    //
    if (Math.abs(pageState.prev_loading_start - now) < LOAD_AFTER_ERROR) return;

    pageState.prev_loading_start = now;

    N.io.rpc('users.activity.list.by_range', {
      user_hid:      pageState.hid,
      type:          pageState.type,
      start:         pageState.top_marker,
      before:        LOAD_ITEMS_COUNT - 1,
      after:         0
    }).then(function (res) {
      if (!res.results) return;

      pageState.top_marker = res.top_marker;

      if (!res.top_marker) reset_loading_placeholders();

      if (res.results.length === 0) return;

      let old_height = $('.users-activity__list').height();

      // render & inject item list
      let $result = $(N.runtime.render('users.activity.blocks.' + pageState.type, res));
      $('.users-activity__list').prepend($result);

      // update scroll so it would point at the same spot as before
      $window.scrollTop($window.scrollTop() + $('.users-activity__list').height() - old_height);

      // reset lock
      pageState.prev_loading_start = 0;
    }).catch(err => {
      N.wire.emit('error', err);
    });
  });


  N.wire.on(module.apiPath + ':load_next', function load_next_page() {
    if (!pageState.bottom_marker) return;

    let now = Date.now();

    // `next_loading_start` is the last request start time, which is reset to 0 on success
    //
    // Thus, successful requests can restart immediately, but failed ones
    // will have to wait `LOAD_AFTER_ERROR` ms.
    //
    if (Math.abs(pageState.next_loading_start - now) < LOAD_AFTER_ERROR) return;

    pageState.next_loading_start = now;

    N.io.rpc('users.activity.list.by_range', {
      user_hid:      pageState.hid,
      type:          pageState.type,
      start:         pageState.bottom_marker,
      before:        0,
      after:         LOAD_ITEMS_COUNT - 1
    }).then(function (res) {
      if (!res.results) return;

      pageState.bottom_marker = res.bottom_marker;

      if (!res.bottom_marker) reset_loading_placeholders();

      if (res.results.length === 0) return;

      // render & inject item list
      let $result = $(N.runtime.render('users.activity.blocks.' + pageState.type, res));
      $('.users-activity__list').append($result);

      // Workaround for FF bug, possibly this one:
      // https://github.com/nodeca/nodeca.core/issues/2
      //
      // When user scrolls down and we insert content to the end
      // of the page, and the page is large enough (~1000 topics
      // or more), next scrollTop() read on 'scroll' event may
      // return invalid (too low) value.
      //
      // Reading scrollTop in the same tick seem to prevent this
      // from happening.
      //
      $window.scrollTop();

      // reset lock
      pageState.next_loading_start = 0;
    }).catch(err => {
      N.wire.emit('error', err);
    });
  });
});
