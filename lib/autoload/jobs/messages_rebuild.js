// Rebuild all messages
//
'use strict';


const Promise  = require('bluebird');
const ObjectId = require('mongoose').Types.ObjectId;

const POSTS_PER_CHUNK = 100;


module.exports = function (N) {
  N.wire.on('init:jobs', function register_messages_rebuild() {
    N.queue.registerWorker({
      name: 'messages_rebuild',

      // static id to make sure it will never be executed twice at the same time
      taskID() {
        return 'messages_rebuild';
      },

      chunksPerInstance: 1,

      timeout: 60000,

      * map() {
        let runid = Date.now();

        //
        // Select first and last posts from Posts collection,
        // and split range between them into chunks
        //

        // find first post id
        let first_post = yield N.models.users.DlgMessage
                                             .findOne()
                                             .select('_id')
                                             .sort({ _id: 1 })
                                             .lean(true);

        // find last post id
        let last_post  = yield N.models.users.DlgMessage
                                             .findOne()
                                             .select('_id')
                                             .sort({ _id: -1 })
                                             .lean(true);

        if (!first_post || !last_post) {
          return [];
        }

        const MSEC_MONTHLY = 30 * 24 * 60 * 60 * 1000;

        // find an amount of posts created last month
        let last_month_id = new ObjectId((last_post._id.getTimestamp() - MSEC_MONTHLY) / 1000);
        let monthly_post_count = yield N.models.users.DlgMessage
                                                     .where('_id').gte(last_month_id)
                                                     .count();

        // we want to process around 1000 posts per chunk,
        // so calculate the post rate based on last month
        let delta  = POSTS_PER_CHUNK / monthly_post_count * MSEC_MONTHLY;

        let chunks = [];
        let from   = first_post._id.getTimestamp().valueOf() - 1;
        let to     = last_post._id.getTimestamp().valueOf() + 1;
        let fromid = null;
        let toid   = new ObjectId(from / 1000);

        for (let ts = from; ts <= to; ts += delta) {
          fromid = toid;
          toid = new ObjectId((ts + delta) / 1000);

          chunks.push({
            from:  fromid.toString(),
            to:    toid.toString(),
            runid
          });
        }

        N.logger.info(`Start rebuilding dialogs (${chunks.length} chunks)`);

        return chunks;
      },

      * process() {
        let posts = yield N.models.users.DlgMessage
                                        .where('_id').gte(this.data.from)
                                        .where('_id').lte(this.data.to)
                                        .select('_id')
                                        .lean(true);

        let start_time = Date.now();

        N.logger.info(`Rebuilding dialogs ${this.data.from}-${this.data.to} - ${posts.length} found`);

        yield Promise.map(
          posts,
          post => N.wire.emit('internal:users.message_rebuild', post._id),
          { concurrency: 50 }
        );

        N.logger.info(`Rebuilding dialogs ${this.data.from}-${this.data.to} - finished (${
          ((Date.now() - start_time) / 1000).toFixed(1)
        }s)`);

        //
        // Send stat update to client
        //

        let data = yield this.task.worker.status(this.task.id);

        if (data) {
          let task_info = {
            current: data.chunks.done + data.chunks.errored,
            total:   data.chunks.done + data.chunks.errored +
                     data.chunks.active + data.chunks.pending,
            runid:   this.data.runid
          };

          N.live.debounce('admin.core.rebuild.messages', task_info);
        }

        return this.data.runid;
      },

      reduce(chunksResult) {
        var task_info = {
          current: 1,
          total:   1,
          runid:   chunksResult[0] || 0
        };

        N.live.emit('admin.core.rebuild.messages', task_info);

        N.logger.info('Finish rebuilding dialogs');
      }
    });
  });
};
