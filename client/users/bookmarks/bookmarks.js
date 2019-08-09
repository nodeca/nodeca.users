'use strict';


const _ = require('lodash');
const ScrollableList = require('nodeca.core/lib/app/scrollable_list');


// Page state
//
// - hid: current user hid
// - active: true if user is currently on this page
//
let pageState = {};
let scrollable_list;
let resize_observer;

let $window = $(window);


function load(start, direction) {
  return N.io.rpc('users.bookmarks.list.by_range', {
    user_hid:      pageState.hid,
    start,
    before:        direction === 'top' ? N.runtime.page_data.items_per_page : 0,
    after:         direction === 'bottom' ? N.runtime.page_data.items_per_page : 0
  }).then(function (res) {
    return {
      $html: $(N.runtime.render('users.bookmarks.items', res)),
      locals: res,
      reached_end: direction === 'top' ? res.reached_top : res.reached_bottom
    };
  }).catch(err => {
    // User deleted, refreshing the page so user can see the error
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
        id:     $(item).data('bookmark-id'),
        offset: item_offset
      };
    }

    /* eslint-disable no-undefined */
    href = N.router.linkTo('users.bookmarks', {
      user_hid:  pageState.hid,
      start:     item ? $(item).data('bookmark-id') : undefined
    });

    N.wire.emit('navigate.replace', { href, state })
          .catch(err => N.wire.emit('error', err));
  }, 500);

  update_url(item, index, item_offset);
}


function track_expand(element) {
  if (resize_observer) {
    resize_observer.observe(element);
  } else {
    // fallback for older browsers
    let $element = $(element);

    $element.closest('.users-bookmarks-item').toggleClass(
      'users-bookmarks-item__m-can-expand',
      $element.height() > $element.parent().height()
    );
  }
}


/////////////////////////////////////////////////////////////////////
// init on page load
//
N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  pageState.hid = $('.users-bookmarks-root').data('user-hid');
  pageState.active = true;

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
      //el.addClass('users-bookmarks-item__m-highlight');
      scroll_done = true;
    }
  }

  // If we're on the first page, scroll to the top;
  // otherwise, scroll to the first item on that page
  //
  if (!scroll_done) {
    if (pageState.top_marker && $('.users-bookmarks__list').length) {
      $window.scrollTop($('.users-bookmarks__list').offset().top - navbar_height);
    } else {
      $window.scrollTop(0);
    }
    scroll_done = true;
  }

  // disable automatic scroll to an anchor in the navigator
  data.no_scroll = true;

  scrollable_list = new ScrollableList({
    N,
    list_selector:               '.users-bookmarks__list',
    item_selector:               '.users-bookmarks-item',
    placeholder_top_selector:    '.users-bookmarks__loading-prev',
    placeholder_bottom_selector: '.users-bookmarks__loading-next',
    get_content_id:              item => $(item).data('bookmark-id'),
    load,
    reached_top:                 typeof $('.users-bookmarks-root').data('reached-top') !== 'undefined',
    reached_bottom:              typeof $('.users-bookmarks-root').data('reached-bottom') !== 'undefined',
    navbar_height,
    on_list_scroll
  });

  if (typeof window.ResizeObserver === 'function') {
    resize_observer = new window.ResizeObserver(function (entries) {
      for (let entry of entries) {
        let $target = $(entry.target);

        $target.closest('.users-bookmarks-item').toggleClass(
          'users-bookmarks-item__m-can-expand',
          entry.contentRect.height > $target.parent().height()
        );
      }
    });
  }

  $('.users-bookmarks-item__content > .markup').each((idx, element) => track_expand(element));
});


N.wire.on('navigate.exit:' + module.apiPath, function page_teardown() {
  if (resize_observer) resize_observer.disconnect();
  resize_observer = null;

  scrollable_list.destroy();
  scrollable_list = null;

  if (update_url) update_url.cancel();

  pageState = {};
});


N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  N.wire.on('navigate.update', function set_tracker_on_update(data) {
    if (!pageState.active) return;

    data.$.find('.users-bookmarks-item__content > .markup').each((idx, element) => track_expand(element));
  });

  // Delete bookmark
  //
  N.wire.before('users.bookmarks:delete', function delete_bookmark_confirm() {
    return N.wire.emit('common.blocks.confirm', t('delete_confirmation'));
  });

  N.wire.on('users.bookmarks:delete', function delete_bookmark(data) {
    let bookmark_id = data.$this.data('item-id');

    return N.io.rpc('users.bookmarks.destroy', { bookmark_id }).then(function () {
      let $item = data.$this.closest('.users-bookmarks-item');

      $item
        .fadeTo('fast', 0)
        .slideUp('fast', function () {
          $item.remove();
        });
    });
  });


  // Expand post text
  //
  N.wire.on('users.bookmarks:expand', function expand_post(data) {
    data.$this.closest('.users-bookmarks-item')
              .addClass('users-bookmarks-item__m-expanded');
  });
});
