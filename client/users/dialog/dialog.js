'use strict';


const _ = require('lodash');


// Offset between navbar and the first dialog
const TOP_OFFSET = 50;

const navbarHeight = parseInt($('body').css('margin-top'), 10) + parseInt($('body').css('padding-top'), 10);

let $window = $(window);
// State
//
// - dialog_id           current dialog id
// - first_offset:       offset of the first message in the DOM
// - current_offset:     offset of the current message (first in the viewport)
// - message_count:      total count of messages
// - reached_start:      true iff no more message exist above first loaded one
// - reached_end:        true iff no more message exist below last loaded one
// - first_message_id:   id of the first message
// - last_message_id:    id of the last message
// - prev_loading_start: time when current xhr request for the previous page is started
// - next_loading_start: time when current xhr request for the next page is started
//
let dlgState = {};


/////////////////////////////////////////////////////////////////////
// init on page load

N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  let pagination = N.runtime.page_data.pagination;
  let last_visible_message_id = $('.user-messages-list-item:last-child').data('message-id');

  dlgState.dialog_id          = N.runtime.page_data.dialog._id;
  dlgState.first_offset       = pagination.chunk_offset;
  dlgState.current_offset     = -1;
  dlgState.message_count      = pagination.total;
  dlgState.first_message_id   = N.runtime.page_data.first_message_id;
  dlgState.last_message_id    = N.runtime.page_data.last_message_id;
  dlgState.reached_start      = pagination.chunk_offset === 0;
  dlgState.reached_end        = dlgState.last_message_id === last_visible_message_id;
  dlgState.prev_loading_start = 0;
  dlgState.next_loading_start = 0;

  // disable automatic scroll to an anchor in the navigator
  data.no_scroll = true;

  // If we have state in history - scroll to saved offset
  if (data.state && typeof data.state.message_id !== 'undefined' && typeof data.state.offset !== 'undefined') {
    let el = $(`#message${data.state.message_id}`);

    if (el.length) {
      $window.scrollTop(el.offset().top - $('.navbar').height() - TOP_OFFSET + data.state.offset);
      return;
    }

  }

  // If navigated to first message - scroll to top
  if (data.params.message_id === dlgState.first_message_id) {
    $window.scrollTop(0);
    return;
  }

  let el = $(`#message${data.params.message_id}`);

  // Scroll to needed message
  if (el.length) {
    $window.scrollTop(el.offset().top - $('.navbar').height() - TOP_OFFSET);
    el.addClass('user-messages-list-item__m-highlight');
    return;
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
  if ($('.user-messages-list').length === 0) return;

  locationScrollHandler = _.debounce(function update_location_on_scroll() {
    let messages         = document.getElementsByClassName('user-messages-list-item');
    let messageThreshold = navbarHeight + TOP_OFFSET;
    let offset;
    let currentIdx;

    // Get offset of the first topic in the viewport
    //
    currentIdx = _.sortedIndexBy(messages, null, msg => {
      if (!msg) { return messageThreshold; }
      return msg.getBoundingClientRect().top;
    });

    if (currentIdx >= messages.length) {
      currentIdx = messages.length - 1;
    }

    let href = null;
    let state = null;

    offset = currentIdx + dlgState.first_offset;

    if (currentIdx > 0 && messages.length) {
      state = {
        message_id: $(messages[currentIdx + 1]).data('message-id'),
        offset: messageThreshold - messages[currentIdx + 1].getBoundingClientRect().top
      };
    }

    // save current offset, and only update url if offset is different,
    // it protects url like /messages/4ecabbd0821e2864cda37762 from being overwritten instantly
    if (dlgState.current_offset !== offset) {
      /* eslint-disable no-undefined */
      href = N.router.linkTo('users.dialog', {
        dialog_id: dlgState.dialog_id,
        message_id: state ? state.message_id : undefined
      });

      dlgState.current_offset = offset;
    }

    N.wire.emit('navigate.replace', { href, state });
  }, 500);

  // avoid executing it on first tick because of initial scrollTop()
  setTimeout(() => {
    $window.on('scroll', locationScrollHandler);
  }, 1);
});


N.wire.on('navigate.exit:' + module.apiPath, function location_updater_teardown() {
  if (!locationScrollHandler) return;
  locationScrollHandler.cancel();
  $window.off('scroll', locationScrollHandler);
  locationScrollHandler = null;
});


/////////////////////////////////////////////////////////////////////
// When user scrolls the page:
//
//  1. update progress bar
//  2. show/hide navbar
//
let progressScrollHandler = null;


N.wire.on('navigate.done:' + module.apiPath, function progress_updater_init() {
  if ($('.user-messages-list').length === 0) return;

  progressScrollHandler = _.debounce(function update_progress_on_scroll() {
    // If we scroll below page title, show the secondary navbar
    //
    let title = document.getElementsByClassName('page-head__title');

    if (title.length && title[0].getBoundingClientRect().bottom > navbarHeight) {
      $('.navbar').removeClass('navbar__m-secondary');
    } else {
      $('.navbar').addClass('navbar__m-secondary');
    }

    // Update progress bar
    //
    let messages         = document.getElementsByClassName('user-messages-list-item');
    let messageThreshold = navbarHeight + TOP_OFFSET;
    let offset;
    let currentIdx;

    // Get offset of the first topic in the viewport
    //
    currentIdx = _.sortedIndexBy(messages, null, msg => {
      if (!msg) { return messageThreshold; }
      return msg.getBoundingClientRect().top;
    }) - 1;

    offset = currentIdx + dlgState.first_offset;

    N.wire.emit('common.blocks.navbar.blocks.page_progress:update', {
      current:  offset + 1 // `+1` because offset is zero based
    }).catch(err => N.wire.emit('error', err));
  }, 100, { maxWait: 100 });

  // avoid executing it on first tick because of initial scrollTop()
  setTimeout(() => {
    $window.on('scroll', progressScrollHandler);
  });

  // execute it once on page load
  progressScrollHandler();
});


N.wire.on('navigate.exit:' + module.apiPath, function progress_updater_teardown() {
  if (!progressScrollHandler) return;
  progressScrollHandler.cancel();
  $window.off('scroll', progressScrollHandler);
  progressScrollHandler = null;
});


// Show/hide loading placeholders when new messages are fetched,
// adjust scroll when adding/removing top placeholder
//
function reset_loading_placeholders() {
  let prev = $('.user-messages-list__loading-prev');
  let next = $('.user-messages-list__loading-next');

  // if topmost dialog is loaded, hide top placeholder
  if (dlgState.reached_start) {
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

  // if last message is loaded, hide bottom placeholder
  if (dlgState.reached_end) {
    next.addClass('d-none');
  } else {
    next.removeClass('d-none');
  }
}


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
  N.wire.on(module.apiPath + ':report', function dialog_message_report(data) {
    let params = { messages: t('@users.abuse_report.messages') };
    let id = data.$this.data('message-id');

    return Promise.resolve()
      .then(() => N.wire.emit('common.blocks.abuse_report_dlg', params))
      .then(() => N.io.rpc('users.dialog.abuse_report', { message_id: id, message: params.message }))
      .then(() => N.wire.emit('notify.info', t('abuse_reported')));
  });


  // Delete dialog
  //
  N.wire.on(module.apiPath + ':delete_dialog', function delete_dialog(data) {
    let dialog_id = data.$this.data('dialog-id');

    return Promise.resolve()
      .then(() => N.wire.emit('common.blocks.confirm', t('delete_confirmation')))
      .then(() => N.io.rpc('users.dialog.destroy', { dialog_id }))
      .then(() => N.wire.emit('navigate.to', {
        apiPath: 'users.dialogs_root',
        params: { user_hid: N.runtime.user_hid }
      }));
  });


  ///////////////////////////////////////////////////////////////////////////
  // Whenever we are close to beginning/end of dialog list, check if we can
  // load more pages from the server
  //

  // an amount of topics we try to load when user scrolls to the end of the page
  const LOAD_MSGS_COUNT = N.runtime.page_data.pagination.per_page;

  // A delay after failed xhr request (delay between successful requests
  // is set with affix `throttle` argument)
  //
  // For example, suppose user continuously scrolls. If server is up, each
  // subsequent request will be sent each 100 ms. If server goes down, the
  // interval between request initiations goes up to 2000 ms.
  //
  const LOAD_AFTER_ERROR = 2000;

  N.wire.on(module.apiPath + ':load_prev', function load_prev_page() {
    if (dlgState.reached_start) return;

    let now = Date.now();

    // `prev_loading_start` is the last request start time, which is reset to 0 on success
    //
    // Thus, successful requests can restart immediately, but failed ones
    // will have to wait `LOAD_AFTER_ERROR` ms.
    //
    if (Math.abs(dlgState.prev_loading_start - now) < LOAD_AFTER_ERROR) return;

    dlgState.prev_loading_start = now;

    N.io.rpc('users.dialog.list.by_range', {
      dialog_id: dlgState.dialog_id,
      last_message_id: $('.user-messages-list-item:first-child').data('message-id'),
      before: LOAD_MSGS_COUNT,
      after: 0
    }).then(function (res) {
      if (!res.messages) return;

      if (res.messages.length !== LOAD_MSGS_COUNT) {
        dlgState.reached_start = true;
        reset_loading_placeholders();
      }

      if (res.messages.length === 0) return;

      // remove duplicate topics
      res.messages.forEach(msg => $(`#message${msg._id}`).remove());

      let $list = $('.user-messages-list');
      let old_height = $list.height();
      // render & inject topics list
      let $result = $(N.runtime.render('users.blocks.message_list', res));

      $list.prepend($result);

      // update scroll so it would point at the same spot as before
      $window.scrollTop($window.scrollTop() + $list.height() - old_height);

      dlgState.first_offset = res.pagination.chunk_offset;
      dlgState.topic_count = res.pagination.total;

      dlgState.prev_loading_start = 0;

      return N.wire.emit('common.blocks.navbar.blocks.page_progress:update', {
        max: dlgState.message_count
      });
    }).catch(err => N.wire.emit('error', err));
  });


  N.wire.on(module.apiPath + ':load_next', function load_next_page() {
    if (dlgState.reached_end) return;

    let now = Date.now();

    // `next_loading_start` is the last request start time, which is reset to 0 on success
    //
    // Thus, successful requests can restart immediately, but failed ones
    // will have to wait `LOAD_AFTER_ERROR` ms.
    //
    if (Math.abs(dlgState.next_loading_start - now) < LOAD_AFTER_ERROR) return;

    dlgState.next_loading_start = now;

    N.io.rpc('users.dialog.list.by_range', {
      dialog_id: dlgState.dialog_id,
      last_message_id: $('.user-messages-list-item:last-child').data('message-id'),
      before: 0,
      after: LOAD_MSGS_COUNT
    }).then(function (res) {
      if (!res.messages) return;

      if (res.messages.length !== LOAD_MSGS_COUNT) {
        dlgState.reached_end = true;
        reset_loading_placeholders();
      }

      if (res.messages.length === 0) return;

      let $list = $('.user-messages-list');
      let old_height = $list.height();
      // render & inject topics list
      let $result = $(N.runtime.render('users.blocks.message_list', res));

      // remove duplicate topics
      let deleted_count = res.messages.filter(msg => {
        let el = $(`#message${msg._id}`);

        if (el.length) {
          el.remove();
          return true;
        }
      }).length;

      // update scroll so it would point at the same spot as before
      if (deleted_count > 0) {
        $window.scrollTop($window.scrollTop() + $list.height() - old_height);
      }

      dlgState.first_offset = res.pagination.chunk_offset - $('.user-messages-list-item').length;
      dlgState.topic_count = res.pagination.total;


      $list.append($result);

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

      dlgState.next_loading_start = 0;

      return N.wire.emit('common.blocks.navbar.blocks.page_progress:update', {
        max: dlgState.message_count
      });
    }).catch(err => N.wire.emit('error', err));
  });
});
