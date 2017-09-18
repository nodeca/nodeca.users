'use strict';


const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;


module.exports = function (N, collectionName) {

  let DlgMessage = new Schema({
    parent       : Schema.Types.ObjectId,
    user         : Schema.Types.ObjectId,
    ts           : { type: Date, 'default': Date.now },
    exists       : { type: Boolean, 'default': true },


    html         : String,
    md           : String,
    attach       : [ Schema.Types.ObjectId ],
    params_ref   : Schema.ObjectId,
    imports      : [ String ],
    import_users : [ Schema.ObjectId ],
    tail         : [ new Schema({ // explicit definition to remove `_id` field
      media_id: Schema.ObjectId,
      file_name: String,
      type: { type: Number }
    }, { _id: false }) ]
  }, {
    versionKey: false
  });


  /////////////////////////////////////////////////////////////////////////////
  // Indexes

  // Used in messages list
  DlgMessage.index({ parent: 1, exists: 1, _id: -1 });

  /////////////////////////////////////////////////////////////////////////////


  // Store parser options separately and save reference to them
  //
  DlgMessage.pre('save', function (callback) {
    if (!this.params) {
      callback();
      return;
    }

    N.models.core.MessageParams.setParams(this.params)
      .then(id => {
        /*eslint-disable no-undefined*/
        this.params = undefined;
        this.params_ref = id;
      })
      .asCallback(callback);
  });


  N.wire.on('init:models', function emit_init_DlgMessage() {
    return N.wire.emit('init:models.' + collectionName, DlgMessage);
  });


  N.wire.on('init:models.' + collectionName, function init_model_DlgMessage(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
