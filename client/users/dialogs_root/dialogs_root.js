'use strict';


const _ = require('lodash');
const ScrollableList = require('nodeca.core/lib/app/scrollable_list');


// Page state
//
// - current_offset:     offset of the current dialog (first in the viewport)
// - dialog_count:       total count of dialogs
// - last_dialog_id:     id of the last dialog
// - first_message_id:   id of the last message in the first loaded dialog
// - last_message_id:    id of the last message in the last loaded dialog
// - user_hid:           hid of the user that owns those dialogs
//
let pageState = {};
let scrollable_list;

let $window = $(window);


function load(start, direction) {
  return N.io.rpc('users.dialogs_root.list.by_range', {
    user_hid:        pageState.user_hid,
    last_message_id: start,
    before:          direction === 'top' ? N.runtime.page_data.pagination.per_page : 0,
    after:           direction === 'bottom' ? N.runtime.page_data.pagination.per_page : 0,
    hide_answered: N.runtime.page_data.dialogs_hide_answered
  }).then(res => {
    pageState.dialog_count = res.pagination.total;

    return N.wire.emit('common.blocks.navbar.blocks.page_progress:update', {
      max: pageState.dialog_count
    }).then(() => {
      return {
        $html: $(N.runtime.render('users.blocks.dialog_list', res)),
        locals: res,
        offset: res.pagination.chunk_offset,
        reached_end: res.dialogs.length !== N.runtime.page_data.pagination.per_page
      };
    });
  }).catch(err => {
    // User deleted, refreshing the page so user can see the error
    if (err.code === N.io.NOT_FOUND) return N.wire.emit('navigate.reload');
    throw err;
  });
}


let update_url;

function on_list_scroll(item, index, item_offset) {
  N.wire.emit('common.blocks.navbar.blocks.page_progress:update', {
    current: index + 1 // `+1` because offset is zero based
  }).catch(err => N.wire.emit('error', err));

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
        dialog_id: $(item).data('dialog-id'),
        offset:    item_offset
      };
    }

    // save current offset, and only update url if offset is different,
    // it protects url like /f1/topic23/page4 from being overwritten instantly
    if (pageState.current_offset !== index) {
      /* eslint-disable no-undefined */
      href = N.router.linkTo('users.dialogs_root', {
        user_hid:  pageState.user_hid,
        dialog_id: item ? $(item).data('dialog-id') : undefined
      });

      pageState.current_offset = index;
    }

    N.wire.emit('navigate.replace', { href, state })
          .catch(err => N.wire.emit('error', err));
  }, 500);

  update_url(item, index, item_offset);
}


/////////////////////////////////////////////////////////////////////
// init on page load

N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  let pagination = N.runtime.page_data.pagination;
  let last_visible_dialog_id = $('.dialog-list-item:last-child').data('dialog-id');

  pageState.current_offset     = -1;
  pageState.dialog_count       = pagination.total;
  pageState.last_dialog_id     = N.runtime.page_data.last_dialog_id;
  pageState.first_message_id   = N.runtime.page_data.first_message_id;
  pageState.last_message_id    = N.runtime.page_data.last_message_id;
  pageState.user_hid           = data.params.user_hid;

  let navbar_height = parseInt($('body').css('margin-top'), 10) + parseInt($('body').css('padding-top'), 10);

  // account for some spacing between posts
  navbar_height += 32;

  let scroll_done = false;

  if (!scroll_done && data.state &&
       typeof data.state.dialog_id !== 'undefined' && typeof data.state.offset !== 'undefined') {
    let el = $(`#dialog${data.state.dialog_id}`);

    if (el.length) {
      $window.scrollTop(el.offset().top - navbar_height + data.state.offset);
      scroll_done = true;
    }
  }

  if (!scroll_done && data.params.dialog_id) {
    let el = $(`#dialog${data.params.dialog_id}`);

    if (el.length) {
      $window.scrollTop(el.offset().top - navbar_height);
      el.addClass('dialog-list-item__m-highlight');
      scroll_done = true;
    }
  }

  // If we're on the first page, scroll to the top;
  // otherwise, scroll to the first dialog on that page
  //
  if (!scroll_done) {
    if (pagination.chunk_offset > 1 && $('.dialog-list').length) {
      $window.scrollTop($('.dialog-list').offset().top - navbar_height);
    } else {
      $window.scrollTop(0);
    }
    scroll_done = true;
  }

  // disable automatic scroll to an anchor in the navigator
  data.no_scroll = true;

  scrollable_list = new ScrollableList({
    N,
    list_selector:               '.dialog-list',
    item_selector:               '.dialog-list-item',
    placeholder_top_selector:    '.dialog-list__loading-prev',
    placeholder_bottom_selector: '.dialog-list__loading-next',
    get_content_id:              dlg => $(dlg).data('last-message'),
    load,
    reached_top:                 pagination.chunk_offset === 0,
    reached_bottom:              pageState.last_dialog_id === last_visible_dialog_id,
    index_offset:                pagination.chunk_offset,
    navbar_height,
    // whenever there are more than 600 dialogs, cut off-screen dialogs down to 400
    need_gc:                     count => (count > 600 ? count - 400 : 0),
    on_list_scroll
  });
});


N.wire.on('navigate.exit:' + module.apiPath, function page_teardown() {
  scrollable_list.destroy();
  scrollable_list = null;

  if (update_url) update_url.cancel();

  pageState = {};
});


//////////////////////////////////////////////////////////////////////////
// Toggle "hide answered messages" flag

N.wire.on(module.apiPath + ':toggle_answered', function toggle_answered(data) {
  // toggle target is a label, trying to find an actual checkbox inside
  let checkbox = data.$this.find('input[type=checkbox]');

  return Promise.resolve()
    .then(() => N.io.rpc('users.dialogs_root.save_filter', { hide_answered: checkbox.prop('checked') }))
    .then(() => N.wire.emit('navigate.reload'));
});


// Init handlers
//
N.wire.once('navigate.done:' + module.apiPath, function page_init() {

  // Delete dialog
  //
  N.wire.on(module.apiPath + ':delete_dialog', function delete_dialog(data) {
    let dialog_id = data.$this.data('dialog-id');
    let $dialog = $(`#dialog${dialog_id}`);

    return Promise.resolve()
      .then(() => N.wire.emit('common.blocks.confirm', t('delete_confirmation')))
      .then(() => N.io.rpc('users.dialog.destroy', { dialog_id }))
      .then(res => {
        $dialog.fadeOut(() => $dialog.remove());

        //
        // Update progress bar
        //
        pageState.dialog_count = res.dialog_count;

        return N.wire.emit('common.blocks.navbar.blocks.page_progress:update', {
          max: res.dialog_count
        });
      });
  });


  // Show editor for new dialog
  //
  N.wire.on(module.apiPath + ':create_message', function create_message() {
    return N.wire.emit('users.dialog.create:begin');
  });
});
