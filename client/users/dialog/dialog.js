'use strict';


const _ = require('lodash');
const ScrollableList = require('nodeca.core/lib/app/scrollable_list');


// Page state
//
// - dialog_id           current dialog id
// - current_offset:     offset of the current message (first in the viewport)
// - message_count:      total count of messages
// - first_message_id:   id of the first message
// - last_message_id:    id of the last message
//
let pageState = {};
let scrollable_list;

let $window = $(window);


function load(start, direction) {
  return N.io.rpc('users.dialog.list.by_range', {
    dialog_id:       pageState.dialog_id,
    last_message_id: start,
    before:          direction === 'top' ? N.runtime.page_data.pagination.per_page : 0,
    after:           direction === 'bottom' ? N.runtime.page_data.pagination.per_page : 0
  }).then(res => {
    pageState.message_count = res.pagination.total;

    return N.wire.emit('common.blocks.navbar.blocks.page_progress:update', {
      max: pageState.message_count
    }).then(() => {
      return {
        $html: $(N.runtime.render('users.blocks.message_list', res)),
        locals: res,
        offset: res.pagination.chunk_offset,
        reached_end: res.messages.length !== N.runtime.page_data.pagination.per_page
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
        message_id: $(item).data('message-id'),
        offset:     item_offset
      };
    }

    // save current offset, and only update url if offset is different,
    // it protects url like /f1/topic23/page4 from being overwritten instantly
    if (pageState.current_offset !== index) {
      /* eslint-disable no-undefined */
      href = N.router.linkTo('users.dialog', {
        dialog_id:  pageState.dialog_id,
        message_id: item ? $(item).data('message-id') : undefined
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
  let last_visible_message_id = $('.user-messages-list-item:last-child').data('message-id');

  pageState.dialog_id          = N.runtime.page_data.dialog._id;
  pageState.current_offset     = -1;
  pageState.message_count      = pagination.total;
  pageState.first_message_id   = N.runtime.page_data.first_message_id;
  pageState.last_message_id    = N.runtime.page_data.last_message_id;

  let navbar_height = parseInt($('body').css('margin-top'), 10) + parseInt($('body').css('padding-top'), 10);

  // account for some spacing between posts
  navbar_height += 50;

  let scroll_done = false;

  // If we have state in history - scroll to saved offset
  if (!scroll_done && data.state &&
      typeof data.state.message_id !== 'undefined' && typeof data.state.offset !== 'undefined') {
    let el = $(`#message${data.state.message_id}`);

    if (el.length) {
      $window.scrollTop(el.offset().top - navbar_height + data.state.offset);
      scroll_done = true;
    }
  }

  // If navigated to first message - scroll to top
  if (!scroll_done && data.params.message_id === pageState.first_message_id) {
    $window.scrollTop(0);
    scroll_done = true;
  }

  let el = $(`#message${data.params.message_id}`);

  // Scroll to needed message
  if (!scroll_done && el.length) {
    $window.scrollTop(el.offset().top - navbar_height);
    el.addClass('user-messages-list-item__m-highlight');
    scroll_done = true;
  }

  // disable automatic scroll to an anchor in the navigator
  data.no_scroll = true;

  scrollable_list = new ScrollableList({
    N,
    list_selector:               '.user-messages-list',
    item_selector:               '.user-messages-list-item',
    placeholder_top_selector:    '.user-messages-list__loading-prev',
    placeholder_bottom_selector: '.user-messages-list__loading-next',
    get_content_id:              msg => $(msg).data('message-id'),
    load,
    reached_top:                 pagination.chunk_offset === 0,
    reached_bottom:              pageState.last_message_id === last_visible_message_id,
    index_offset:                pagination.chunk_offset,
    navbar_height,
    // whenever there are more than 300 messages, cut off-screen messages down to 200
    need_gc:                     count => (count > 300 ? count - 200 : 0),
    on_list_scroll
  });
});


N.wire.on('navigate.exit:' + module.apiPath, function page_teardown() {
  scrollable_list.destroy();
  scrollable_list = null;

  if (update_url) update_url.cancel();

  pageState = {};
});


// Init handlers
//
N.wire.once('navigate.done:' + module.apiPath, function page_init() {

  // Show editor for reply
  //
  N.wire.on(module.apiPath + ':reply', function reply(data) {
    return N.wire.emit('users.dialog.reply:begin', {
      dialog_id:           data.$this.data('dialog-id'),
      dialog_last_message: data.$this.data('dialog-last-message'),
      to_hid:              data.$this.data('to-hid'),
      to_nick:             data.$this.data('to-nick')
    });
  });


  // Click report button
  //
  N.wire.on(module.apiPath + ':report', function report_message(data) {
    let params = { messages: t('@users.abuse_report.messages') };
    let id = data.$this.data('message-id');

    return Promise.resolve()
      .then(() => N.wire.emit('common.blocks.abuse_report_dlg', params))
      .then(() => N.io.rpc('users.dialog.message.abuse_report', { message_id: id, message: params.message }))
      .then(() => N.wire.emit('notify.info', t('abuse_reported')));
  });


  // Show message IP
  //
  N.wire.on(module.apiPath + ':show_ip', function show_ip(data) {
    return N.wire.emit('users.dialog.ip_info_dlg', { message_id: data.$this.data('message-id') });
  });


  // Add infraction
  //
  N.wire.on(module.apiPath + ':add_infraction', function add_infraction(data) {
    let message_id = data.$this.data('message-id');
    let params = { message_id };

    return Promise.resolve()
      .then(() => N.wire.emit('common.blocks.add_infraction_dlg', params))
      .then(() => N.io.rpc('users.dialog.message.add_infraction', params))
      .then(() => N.io.rpc('users.dialog.list.by_ids', {
        dialog_id: pageState.dialog_id,
        messages_ids: [ message_id ]
      }))
      .then(res => {
        let $result = $(N.runtime.render('users.blocks.message_list', res));

        return N.wire.emit('navigate.content_update', {
          $: $result,
          locals: res,
          $replace: $(`#message${message_id}`)
        });
      })
      .then(() => N.wire.emit('notify.info', t('infraction_added')));
  });


  // Delete message
  //
  N.wire.on(module.apiPath + ':delete_message', function delete_message(data) {
    let message_id = data.$this.data('message-id');
    let $message = $(`#message${message_id}`);

    return Promise.resolve()
      .then(() => N.wire.emit('common.blocks.confirm', t('delete_message_confirmation')))
      .then(() => N.io.rpc('users.dialog.message.destroy', { message_id }))
      .then(res => {
        if (res.message_count === 0) {
          // last message is removed, redirect to dialog list
          return N.wire.emit('navigate.to', {
            apiPath: 'users.dialogs_root',
            params: { user_hid: N.runtime.user_hid }
          });
        }

        $message.fadeOut(() => $message.remove());

        //
        // Update progress bar
        //
        pageState.message_count = res.message_count;

        return N.wire.emit('common.blocks.navbar.blocks.page_progress:update', {
          max: res.message_count
        });
      });
  });


  // Delete dialog
  //
  N.wire.on(module.apiPath + ':delete_dialog', function delete_dialog(data) {
    let dialog_id = data.$this.data('dialog-id');

    return Promise.resolve()
      .then(() => N.wire.emit('common.blocks.confirm', t('delete_dialog_confirmation')))
      .then(() => N.io.rpc('users.dialog.destroy', { dialog_id }))
      .then(() => N.wire.emit('navigate.to', {
        apiPath: 'users.dialogs_root',
        params: { user_hid: N.runtime.user_hid }
      }));
  });
});
