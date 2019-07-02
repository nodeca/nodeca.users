'use strict';


const _ = require('lodash');
const ScrollableList = require('nodeca.core/lib/app/scrollable_list');


// Page state
//
// - hid:  current user hid
// - type: current item type
//
let pageState = {};
let scrollable_list;

let $window = $(window);


function load(start, direction) {
  return N.io.rpc('users.activity.list.by_range', {
    user_hid:      pageState.hid,
    type:          pageState.type,
    start,
    before:        direction === 'top' ? N.runtime.page_data.items_per_page : 0,
    after:         direction === 'bottom' ? N.runtime.page_data.items_per_page : 0
  }).then(function (res) {
    return {
      $html: $(N.runtime.render('users.activity.blocks.' + pageState.type, res)),
      locals: res,
      reached_end: direction === 'top' ? res.reached_top : res.reached_bottom
    };
  }).catch(err => {
    // User deleted, refreshing the page so user can see the error
    if (err.code === N.io.NOT_FOUND) return N.wire.emit('navigate.reload');
    throw err;
  });
}


// Use a separate debouncer that only fires when user stops scrolling,
// so it's executed a lot less frequently.
//
// The reason is that `history.replaceState` is very slow in FF
// on large pages: https://bugzilla.mozilla.org/show_bug.cgi?id=1250972
//
let update_url = _.debounce((item, index, item_offset) => {
  let href, state;

  if (item) {
    state = {
      id:     $(item).data('item-id'),
      offset: item_offset
    };
  }

  /* eslint-disable no-undefined */
  href = N.router.linkTo('users.activity', {
    user_hid:  pageState.hid,
    type:      pageState.type,
    start:     item ? $(item).data('item-id') : undefined
  });

  N.wire.emit('navigate.replace', { href, state })
        .catch(err => N.wire.emit('error', err));
}, 500);


function on_list_scroll(item, index, item_offset) {
  update_url(item, index, item_offset);
}


/////////////////////////////////////////////////////////////////////
// init on page load
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  pageState.hid                = $('.users-activity-root').data('user-hid');
  pageState.type               = $('.users-activity-root').data('type');

  let navbar_height = parseInt($('body').css('margin-top'), 10) + parseInt($('body').css('padding-top'), 10);

  // account for some spacing between posts
  navbar_height += 32;

  let scroll_done = false;

  if (!scroll_done && data.state && typeof data.state.id !== 'undefined' && typeof data.state.offset !== 'undefined') {
    let el = $('#item' + data.state.id);

    if (el.length) {
      $window.scrollTop(el.offset().top - navbar_height + data.state.offset);
      scroll_done = true;
    }
  }

  if (!scroll_done && data.params.start) {
    let el = $('#item' + data.params.start);

    if (el.length) {
      $window.scrollTop(el.offset().top - navbar_height);
      //el.addClass('users-activity-item__m-highlight');
      scroll_done = true;
    }
  }

  // If we're on the first page, scroll to the top;
  // otherwise, scroll to the first item on that page
  //
  if (!scroll_done) {
    if (pageState.top_marker && $('.users-activity__list').length) {
      $window.scrollTop($('.users-activity__list').offset().top - navbar_height);
    } else {
      $window.scrollTop(0);
    }
    scroll_done = true;
  }

  // disable automatic scroll to an anchor in the navigator
  data.no_scroll = true;

  scrollable_list = new ScrollableList({
    N,
    list_selector:               '.users-activity__list',
    item_selector:               '.users-activity-item',
    placeholder_top_selector:    '.users-activity__loading-prev',
    placeholder_bottom_selector: '.users-activity__loading-next',
    get_content_id:              item => $(item).data('item-id'),
    load,
    reached_top:                 $('.users-activity-root').data('reached-top'),
    reached_bottom:              $('.users-activity-root').data('reached-bottom'),
    navbar_height,
    on_list_scroll
  });
});


N.wire.on('navigate.exit:' + module.apiPath, function page_teardown() {
  scrollable_list.destroy();
  scrollable_list = null;
  update_url.cancel();
  pageState = {};
});
