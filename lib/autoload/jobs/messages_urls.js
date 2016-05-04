// Collect all urls from all messages and store them to mongodb
//
'use strict';


const ObjectId  = require('mongoose').Types.ObjectId;
const cheequery = require('nodeca.core/lib/parser/cheequery');

const POSTS_PER_CHUNK = 2000;


module.exports = function (N) {
  N.wire.on('init:jobs', function register_messages_urls() {
    N.queue.registerWorker({
      name: 'messages_urls',

      // static id to make sure it will never be executed twice at the same time
      taskID() {
        return 'messages_urls';
      },

      chunksPerInstance: 1,

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

        return chunks;
      },

      * process() {
        let posts = yield N.models.users.DlgMessage
                                        .where('_id').gte(this.data.from)
                                        .where('_id').lte(this.data.to)
                                        .select('html')
                                        .lean(true);

        N.logger.info('Extracting urls from messages range ' +
          this.data.from + '-' + this.data.to + ' (found ' + posts.length + ')');

        if (!posts.length) return;

        let urls = [];

        posts.forEach(post => {
          let $html = cheequery.parse(post.html);

          // already converted snippets
          $html.find('.ez-block').each(function () {
            var url = cheequery(this).data('nd-orig');

            if (url) {
              urls.push({ url, auto: true });
            }
          });

          // already converted inlines
          $html.find('.ez-inline').each(function () {
            let url = cheequery(this).attr('href');

            if (url) {
              urls.push({ url, auto: true });
            }
          });

          // external urls
          $html.find('.link-ext').each(function () {
            let url = cheequery(this).attr('href');

            if (url) {
              urls.push({ url, auto: cheequery(this).hasClass('link-auto') });
            }
          });
        });

        if (urls.length) {
          let bulk = N.models.core.ExpandUrl.collection.initializeUnorderedBulkOp();

          urls.forEach(u => {
            bulk.find({ url: u.url }).upsert().update({
              $set: {
                url:     u.url,
                is_auto: u.auto,
                rand:    Math.random(),
                status:  N.models.core.ExpandUrl.statuses.PENDING
              }
            });
          });

          yield bulk.execute();
        }

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

          N.live.debounce('admin.core.rebuild.messages_urls', task_info);
        }

        return this.data.runid;
      },

      reduce(chunksResult) {
        var task_info = {
          current: 1,
          total:   1,
          runid:   chunksResult[0] || 0
        };

        N.live.emit('admin.core.rebuild.messages_urls', task_info);
      }
    });
  });
};
