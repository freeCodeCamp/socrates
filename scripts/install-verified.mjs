import { createHash, createVerify } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REGISTRY = 'https://registry.npmjs.org';

const spec = process.argv[2];
if (!spec || !spec.includes('@')) {
  console.error('usage: install-verified.mjs <package>@<version>');
  process.exit(1);
}

const at = spec.lastIndexOf('@');
const name = spec.slice(0, at);
const version = spec.slice(at + 1);

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.json();
}

function toPem(key) {
  return `-----BEGIN PUBLIC KEY-----\n${key.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;
}

const { dist } = await getJson(`${REGISTRY}/${name}/${version}`);
const signature = dist.signatures?.[0];
if (!signature) throw new Error(`${spec} has no registry signature`);

const { keys } = await getJson(`${REGISTRY}/-/npm/v1/keys`);
const signingKey = keys.find((candidate) => candidate.keyid === signature.keyid);
if (!signingKey) throw new Error(`no registry key for ${signature.keyid}`);

const signed = createVerify('SHA256')
  .update(`${name}@${version}:${dist.integrity}`)
  .verify(toPem(signingKey.key), signature.sig, 'base64');
if (!signed) throw new Error(`${spec} failed registry signature verification`);

const tarball = Buffer.from(await (await fetch(dist.tarball)).arrayBuffer());
const digest = `sha512-${createHash('sha512').update(tarball).digest('base64')}`;
if (digest !== dist.integrity)
  throw new Error(`${spec} tarball does not match the signed integrity`);

const path = join(tmpdir(), `${name.replace('/', '-')}-${version}.tgz`);
writeFileSync(path, tarball);
execFileSync('npm', ['install', '-g', path], { stdio: 'inherit' });

console.log(`verified and installed ${spec}`);
