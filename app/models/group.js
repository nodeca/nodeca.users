module.exports = (function initLocaleSchema(app, callback) {
  var Schema = app.mongoose.Schema,
      ObjectId = Schema.ObjectId;
  
  
  var GroupSchema = new Schema({
    title:      {type: String},
    settings:   {type: Schema.Types.Mixed}
  });


  callback(null, GroupSchema);
});
  

////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
