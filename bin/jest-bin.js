#!/usr/bin/env node

const spawn = require('react-dev-utils/crossSpawn');
const path = require('path');
const fs = require('fs');

function findPackageRoot(dir) {
  const package_json = path.resolve(dir, 'package.json');
  
  if (fs.existsSync(package_json)) {
    return dir;
  }
  
  return dir !== '/' ? findPackageRoot(path.dirname(dir)) : undefined;
}

function findJestBin(dir, rewired) {
  const node_modules = path.resolve(dir, 'node_modules');

  if (fs.existsSync(node_modules)) {
    const react_app_rewired = path.resolve(
      node_modules,
      '.bin/react-app-rewired',
    );
    const react_scripts = path.resolve(node_modules, '.bin/react-scripts');
    const jest = path.resolve(node_modules, '.bin/jest');

    const cwd = path.dirname(node_modules);

    const testPath =
      rewired && fs.existsSync(react_app_rewired)
        ? path.resolve(
            fs.realpathSync(react_app_rewired),
            '../../scripts/test.js',
          )
        : fs.existsSync(react_scripts)
        ? path.resolve(fs.realpathSync(react_scripts), '../../scripts/test.js')
        : fs.existsSync(jest)
        ? jest
        : undefined;
    
    if (testPath) {
      return testPath;
    }
  }

  return dir !== '/' ? findJestBin(path.dirname(dir), rewired) : undefined;
}

function getJestRunner(dir) {
  const cwd = findPackageRoot(dir);
  
  if (!cwd) {
    throw new Error(`Can't find package root from ${dir}`);
  }
  
  const testPath = findJestBin(cwd, fs.existsSync(path.resolve(cwd, 'config-overrides.js')));
  
  if (!testPath) {
    throw new Error(`Can't find jest testPath from ${cwd}`);
  }
  
  console.log(`CWD: ${cwd}`);
  console.log(`JEST TEST PATH: ${testPath}`);
  
  return ([node, , ...argv]) => {
    return spawn.sync(node, [testPath, ...argv], { stdio: 'inherit', cwd });
  };
}

const file = process.argv.find((a) => {
  return /\/__tests__\//.test(a) || /\.(test|spec).(js|jsx|ts|tsx)$/.test(a);
});

let runJest;

if (file) {
  process.env.CI = true;
  runJest = getJestRunner(path.dirname(file));
} else {
  runJest = getJestRunner(process.cwd());
}

if (typeof runJest === 'function') {
  const result = runJest(process.argv);

  if (result.signal) {
    if (result.signal === 'SIGKILL') {
      console.log(
        'The build failed because the process exited too early. ' +
          'This probably means the system ran out of memory or someone called ' +
          '`kill -9` on the process.',
      );
    } else if (result.signal === 'SIGTERM') {
      console.log(
        'The build failed because the process exited too early. ' +
          'Someone might have called `kill` or `killall`, or the system could ' +
          'be shutting down.',
      );
    }
    process.exit(1);
  }

  process.exit(result.status);
}
