const { storagePath, deployPath, shellPath} = require('../config/path');
const path = require('path');
function getFullPath(name, type) { // 获取完整路径, type: storage, deploy, shell
    let basePath = ''
    switch (type) {
        case 'storage':
            basePath = storagePath;
            break;
        case 'deploy':
            basePath = deployPath;
            break;
        case 'shell':
            basePath = shellPath;
            break;
    }
    return path.resolve(basePath, name)
}
module.exports = getFullPath;