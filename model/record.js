var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var recordSchema = new Schema({
    project_id:String,
    name: String,
    branch: String,
    createTime: {
        type: Date,
        default: Date.now
    },
    updateTime: {
        type: Date,
        default: Date.now
    },
    log: {
        type: String,
        default: ''
    },
    success: {
        type: Boolean,
        default: true
    }
}, {
    versionKey: false,
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
})

module.exports = mongoose.model('record', recordSchema);
