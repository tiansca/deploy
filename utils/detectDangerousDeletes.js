const parse = require('bash-parser');

// 定义危险命令规则
const DANGEROUS_COMMANDS = {
  'rm': {
    dangerousFlags: ['-r', '-f', '-rf', '--recursive', '--force'],
    dangerousPaths: ['/', '/root', '/home', '*', '/bin', '/usr/bin', '/sbin', '/usr/sbin', '/ect'] // 可根据需求扩展
  }
  // 可添加其他危险命令，如 'dd', 'mv' 等
};

function isDangerousCommand(commandNode) {
  console.log(commandNode)
  const cmdName = commandNode?.name?.text;
  if (!cmdName || !DANGEROUS_COMMANDS[cmdName]) return false;
  console.log(cmdName)
  const { dangerousFlags, dangerousPaths } = DANGEROUS_COMMANDS[cmdName];
  const args = commandNode.suffix.map(arg => arg.text);

  // 检查危险参数
  const hasDangerousFlag = args.some(arg =>
    dangerousFlags.includes(arg) ||
    arg.startsWith('-') && [...arg.slice(1)].some(c => ['r', 'f'].includes(c))
  );

  // 检查危险路径
  console.log(args, dangerousPaths)
  const hasDangerousPath = args.some(arg =>
    // path包含arg或者path + / 包含arg或者path + / + * 包含arg

    dangerousPaths.some(path =>{
      return path.includes(arg) || (path + '/').includes(arg) || (path + '/' + '*').includes(arg)
    } )
  );
  console.log(hasDangerousFlag, hasDangerousPath)
  return hasDangerousFlag || hasDangerousPath;
}

function detectDangerousDeletes(script) {
  try {
    const ast = parse(script);
    let isDangerous = false;

    // 递归遍历 AST
    function traverse(node) {
      if (node.type === 'Command') {
        console.log('执行判断')
        if (isDangerousCommand(node)) {
          isDangerous = true;
        }
      }
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          traverse(node[key]);
        }
      }
    }

    traverse(ast);
    return !!isDangerous;
  } catch (error) {
    console.error('解析失败:', error);
    return false; // 解析失败视为不安全
  }
}



module.exports = detectDangerousDeletes;
