// Rebuild all messages
//
'use strict';


const Promise  = require('bluebird');
const _        = require('lodash');
const Queue    = require('ido');


const CHUNKS_TO_ADD    = 100;
const CHUNKS_MIN_COUNT = 50;
const POSTS_PER_CHUNK  = 100;


module.exports = function (N) {
  N.wire.on('init:jobs', function register_messages_rebuild() {
    let poolName = (N.config.fork || {}).qhard ? 'hard' : 'default';


    // Iterator
    //
    N.queue.registerTask({
      name: 'messages_rebuild',
      poolName,
      baseClass: Queue.IteratorTemplate,
      taskID: () => 'messages_rebuild',

      iterate: Promise.coroutine(function* (state) {
        let active_chunks = this.children_created - this.children_finished;


        // Idle if we still have more than `CHUNKS_MIN_COUNT` chunks
        //
        if (active_chunks >= CHUNKS_MIN_COUNT) return {};


        // Fetch posts _id
        //
        let query = N.models.users.DlgMessage.find()
          .select('_id')
          .sort({ _id: -1 })
          .limit(POSTS_PER_CHUNK * CHUNKS_TO_ADD)
          .lean(true);

        if (state) {
          query.where('_id').lt(state);
        }

        let posts = yield query;


        // Check finished
        //
        if (!posts.length) {

          // Send stat update to client
          // TODO: don't send progress here, send notification about finish instead
          N.live.debounce('admin.core.rebuild.messages', {
            current: this.progress,
            total:   this.total
          });

          return null;
        }


        // Add chunks
        //
        let chunks = _.chunk(posts.map(p => String(p._id)), POSTS_PER_CHUNK)
          .map(ids => N.queue.messages_rebuild_chunk(ids));

        return {
          tasks: chunks,
          state: String(posts[posts.length - 1]._id)
        };
      }),

      init: Promise.coroutine(function* () {
        let post_count = yield N.models.users.DlgMessage.count();

        this.total = Math.ceil(post_count / POSTS_PER_CHUNK);
      })
    });


    // Chunk
    //
    N.queue.registerTask({
      name: 'messages_rebuild_chunk',
      poolName,
      process: Promise.coroutine(function* (ids) {
        let start_time = Date.now();

        N.logger.info(`Rebuilding dialogs ${ids[0]}-${ids[ids.length - 1]} - ${ids.length} found`);

        yield Promise.map(
          ids,
          id => N.wire.emit('internal:users.message_rebuild', id),
          // TODO: is this needed?
          { concurrency: 50 }
        );

        N.logger.info(`Rebuilding dialogs ${ids[0]}-${ids[ids.length - 1]} - finished (${
          ((Date.now() - start_time) / 1000).toFixed(1)
          }s)`);


        // Send stat update to client
        //
        let task = yield N.queue.getTask('messages_rebuild');

        if (task) {
          let task_info = {
            current: task.progress,
            total:   task.total
          };

          N.live.debounce('admin.core.rebuild.messages', task_info);
        }
      })
    });
  });
};
