var mongoose = require('mongoose'),
    Schema   = mongoose.Schema;


var User = module.exports = mongoose.model('User', new Schema({
  username: String,
  password: String
}));
