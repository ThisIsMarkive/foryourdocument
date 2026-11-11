import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileHash, verifySources, engineFingerprint, listFiles } from './source-tools.mjs';

async function logged(command, args, { cwd, env, log }) {
  const handle = await fs.open(log, 'w');
  try {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, env, windowsHide: true, shell: false, stdio: ['ignore', handle.fd, handle.fd] });
      child.on('error', reject); child.on('close', resolve);
    });
    if (code !== 0) throw new Error(`Source build failed (exit ${code}). See ${log}\n${(await fs.readFile(log, 'utf8')).slice(-5000)}`);
  } finally { await handle.close(); }
}

export async function buildEngines({ plugin, home, runtime, assets, download, unzip, status }) {
  await status('Verifying the included Filee and kordoc source snapshots.');
  const sourceLock = await verifySources(plugin);
  const inputFingerprint = await engineFingerprint(plugin);
  const receiptPath = path.join(runtime, 'build-receipt.json');
  try {
    const previous = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
    if (previous.fingerprint === inputFingerprint) {
      let valid = true;
      for (const item of previous.artifacts) {
        if (await fileHash(path.join(runtime, item.path)).catch(() => '') !== item.sha256) { valid = false; break; }
      }
      if (valid) { await status('Source-built engines already verified.'); return previous; }
    }
  } catch { /* missing or stale build receipt: rebuild from included source */ }

  const sdkDir = path.join(home, 'toolchains', `dotnet-${assets.dotnet.version}`);
  const sdkExe = path.join(sdkDir, 'dotnet.exe');
  const sdkMarker = path.join(sdkDir, '.bridge-sdk-sha512');
  if (await fs.readFile(sdkMarker, 'utf8').catch(() => '') !== assets.dotnet.sha512) {
    await status(`Preparing private .NET SDK ${assets.dotnet.version} for the Filee source build.`);
    await unzip(await download(assets.dotnet), sdkDir);
    await fs.writeFile(sdkMarker, assets.dotnet.sha512);
  }

  // Build in a private copy. The distributed upstream source snapshot is immutable.
  const buildBase = path.join(home, 'build');
  await fs.mkdir(buildBase, { recursive: true });
  const work = await fs.mkdtemp(path.join(buildBase, 'engines-'));
  const fileeSource = path.join(work, 'filee');
  await fs.cp(path.join(plugin, 'vendor/filee'), fileeSource, { recursive: true });
  await fs.writeFile(path.join(fileeSource, 'global.json'), JSON.stringify({ sdk: { version: assets.dotnet.version, rollForward: 'disable' } }));
  // Change only the output identity; converter algorithms, presets and CLI dispatch stay upstream.
  const project = path.join(fileeSource, 'src/Filee.Cli/Filee.Cli.csproj');
  const originalProject = await fs.readFile(project, 'utf8');
  if (!originalProject.includes('<AssemblyName>filee-cli</AssemblyName>')) throw new Error('Filee CLI assembly declaration changed.');
  await fs.writeFile(project, originalProject.replace('<AssemblyName>filee-cli</AssemblyName>', '<AssemblyName>hwpx-converter</AssemblyName>'));
  for (const file of await fs.readdir(path.join(plugin, 'runtime/nuget-locks'))) {
    if (!file.endsWith('.json')) continue;
    await fs.copyFile(path.join(plugin, 'runtime/nuget-locks', file), path.join(fileeSource, 'src', file.slice(0, -5), 'packages.lock.json'));
  }
  const env = {
    ...process.env,
    DOTNET_ROOT: sdkDir, DOTNET_ROOT_X64: sdkDir, DOTNET_MULTILEVEL_LOOKUP: '0',
    DOTNET_CLI_HOME: path.join(home, 'toolchains/dotnet-home'),
    DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
    DOTNET_GENERATE_ASPNET_CERTIFICATE: 'false', DOTNET_NOLOGO: '1',
    NUGET_PACKAGES: path.join(home, 'nuget-cache'), NUGET_HTTP_CACHE_PATH: path.join(home, 'nuget-http-cache'),
    NUGET_XMLDOC_MODE: 'skip'
  };
  const nugetConfig = path.join(work, 'NuGet.Config');
  await fs.writeFile(nugetConfig, '<?xml version="1.0"?><configuration><packageSources><clear/><add key="nuget.org" value="https://api.nuget.org/v3/index.json"/></packageSources></configuration>');
  const properties = ['-p:NuGetAudit=false', '-p:RestorePackagesWithLockFile=true', `-p:RuntimeFrameworkVersion=${assets.dotnet.runtimeVersion}`];
  await status('Restoring locked Filee build dependencies (NuGet).');
  await logged(sdkExe, ['restore', project, '-r', 'win-x64', '--locked-mode', '--configfile', nugetConfig, ...properties], { cwd: fileeSource, env, log: path.join(home, 'filee-restore.log') });
  await status('Compiling included Filee source into the internal hwpx-converter.exe.');
  const fileeOutput = path.join(work, 'filee-published');
  await logged(sdkExe, ['publish', project, '-c', 'Release', '-r', 'win-x64', '--self-contained', 'true', '--no-restore', '-p:PublishReadyToRun=false', ...properties, '-o', fileeOutput], { cwd: fileeSource, env, log: path.join(home, 'filee-build.log') });
  await fs.access(path.join(fileeOutput, 'hwpx-converter.exe'));
  await fs.cp(fileeOutput, path.join(runtime, 'filee'), { recursive: true });
  for (const file of ['LICENSE', 'THIRD-PARTY-NOTICES.md']) await fs.copyFile(path.join(fileeSource, file), path.join(runtime, 'filee', file));
  // Retain the exact dependency metadata and available license files for offline distribution.
  const lockedPackages = new Map();
  for (const file of await fs.readdir(path.join(plugin, 'runtime/nuget-locks'))) {
    const lock = JSON.parse(await fs.readFile(path.join(plugin, 'runtime/nuget-locks', file), 'utf8'));
    for (const group of Object.values(lock.dependencies)) for (const [name, info] of Object.entries(group)) {
      if (info.resolved) lockedPackages.set(name.toLowerCase(), info.resolved);
    }
  }
  for (const [name, version] of lockedPackages) {
    const packageDir = path.join(env.NUGET_PACKAGES, name, version.toLowerCase());
    for (const file of await listFiles(packageDir)) {
      if (!/(^|\/)(license[^/]*|copying[^/]*|notice[^/]*|third[-_.]?party[^/]*)$|\.nuspec$/i.test(file)) continue;
      const target = path.join(runtime, 'filee/notices/nuget', name, version, file);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(path.join(packageDir, file), target);
    }
  }

  await status('Compiling included kordoc source into one in-process MCP module.');
  const require = createRequire(path.join(runtime, 'npm/package.json'));
  const esbuild = require('esbuild');
  const build = await esbuild.build({
    absWorkingDir: plugin, entryPoints: ['server/kordoc-entry.ts'],
    outfile: path.join(runtime, assets.kordocSource.module), bundle: true, platform: 'node', format: 'esm', target: 'node20',
    packages: 'external', nodePaths: [path.join(runtime, 'npm/node_modules')],
    define: { __KORDOC_VERSION__: JSON.stringify(assets.kordocVersion) },
    sourcemap: 'external', sourcesContent: true, metafile: true, logLevel: 'warning'
  });
  const sourceInputs = Object.keys(build.metafile.inputs).filter(file => file.replaceAll('\\', '/').includes('vendor/kordoc/src/'));
  if (sourceInputs.length < 100) throw new Error('Integrated kordoc build did not include the expected source modules.');
  await fs.cp(path.join(plugin, 'vendor/kordoc/templates'), path.join(runtime, 'npm/templates'), { recursive: true });
  await fs.mkdir(path.join(runtime, 'npm/notices/kordoc'), { recursive: true });
  for (const item of ['LICENSE', 'NOTICE', 'THIRD_PARTY']) await fs.cp(path.join(plugin, 'vendor/kordoc', item), path.join(runtime, 'npm/notices/kordoc', item), { recursive: true });
  const artifacts = [];
  // Only record source-build outputs. Auxiliary downloads may be unpacked or
  // rearranged later by install.mjs and are independently pinned in assets.json.
  const fileeArtifacts = [...await listFiles(fileeOutput), 'LICENSE', 'THIRD-PARTY-NOTICES.md'];
  for (const file of fileeArtifacts) artifacts.push({ path: `filee/${file}`, sha256: await fileHash(path.join(runtime, 'filee', file)) });
  for (const folder of ['filee/notices/nuget', 'npm/dist', 'npm/templates']) {
    for (const file of await listFiles(path.join(runtime, folder))) {
      const relative = `${folder}/${file}`;
      artifacts.push({ path: relative, sha256: await fileHash(path.join(runtime, relative)) });
    }
  }
  const receipt = {
    architecture: 'source-integrated', version: assets.bundleVersion, fingerprint: inputFingerprint,
    builtAt: new Date().toISOString(), dotnetSdk: assets.dotnet.version, dotnetRuntime: assets.dotnet.runtimeVersion,
    node: process.version, esbuild: esbuild.version, kordocSourceModules: sourceInputs.length,
    sources: sourceLock.sources.map(({ name, version, commit, archiveSha256, files }) => ({ name, version, commit, archiveSha256, sourceFiles: files.length })),
    fileeChanges: ['Build-copy AssemblyName: filee-cli -> hwpx-converter; conversion source unchanged'],
    artifacts
  };
  await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2));
  // The build directory is created by this function, never supplied by a document tool.
  const checkedWork = await fs.realpath(work);
  if (!checkedWork.startsWith((await fs.realpath(buildBase)) + path.sep)) throw new Error('Build cleanup escaped its private directory.');
  await fs.rm(checkedWork, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  return receipt;
}
