'use strict';


const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  function set_content_type(name, value) {
    N.shared = N.shared || {};
    N.shared.content_type = N.shared.content_type || {};

    let duplicate = Object.entries(N.shared.content_type).find(([ , v ]) => v === value)?.[0];

    if (typeof duplicate !== 'undefined') {
      throw new Error(`Duplicate content type id=${value} for ${name} and ${duplicate}`);
    }

    N.shared.content_type[name] = value;
  }

  set_content_type('DIALOG_MESSAGE', 8);

  let DlgMessage = new Schema({
    // dialog id, needed because it is a part of URL to any message
    parent       : Schema.Types.ObjectId,

    // user who sees this copy of the message
    user         : Schema.Types.ObjectId,

    // 2nd participant
    with         : Schema.Types.ObjectId,

    // if false, 'user' is the author, if true, 'with' is the author
    incoming     : Boolean,

    ts           : { type: Date, default: Date.now },
    ip           : String,  // ip address
    exists       : { type: Boolean, default: true },
    common_id    : Schema.Types.ObjectId,


    html         : String,
    md           : String,
    params_ref   : Schema.ObjectId,
    imports      : [ String ],
    import_users : [ Schema.ObjectId ]
  }, {
    versionKey: false
  });


  /////////////////////////////////////////////////////////////////////////////
  // Indexes

  // Used in messages list
  DlgMessage.index({ parent: 1, exists: 1, _id: -1 });

  // Find all messages from and to any user
  DlgMessage.index({ user: 1, _id: -1 });

  /////////////////////////////////////////////////////////////////////////////


  // Store parser options separately and save reference to them
  //
  DlgMessage.pre('save', async function () {
    if (!this.params) return;

    let id = await N.models.core.MessageParams.setParams(this.params);

    /*eslint-disable no-undefined*/
    this.params = undefined;
    this.params_ref = id;
  });


  // Mark recipient as having new message
  //
  DlgMessage.post('save', async function () {
    if (!this.incoming) return;

    N.models.users.DlgUnread.set_last(this.user)
      .catch(err => N.logger.error(err));
  });


  N.wire.on('init:models', function emit_init_DlgMessage() {
    return N.wire.emit('init:models.' + collectionName, DlgMessage);
  });


  N.wire.on('init:models.' + collectionName, function init_model_DlgMessage(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
