import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const version=process.argv[2];
const fail=message=>{console.error(`Release check failed: ${message}`);process.exit(1)};
const run=(command,args)=>execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();

if(!version||!/^v\d+\.\d+\.\d+$/.test(version)) fail('pass a stable semantic version such as v0.0.5');

const expectedName='anthonyjohnsonga';
const expectedEmail='289307528+anthonyjohnsonga@users.noreply.github.com';
if(run('git',['config','--local','user.name'])!==expectedName) fail(`git user.name must be ${expectedName}`);
if(run('git',['config','--local','user.email'])!==expectedEmail) fail(`git user.email must be ${expectedEmail}`);
if(run('git',['branch','--show-current'])!=='main') fail('the current branch must be main');
if(run('git',['status','--porcelain'])) fail('the working tree must be clean');

const head=run('git',['rev-parse','HEAD']);
const originMain=run('git',['rev-parse','origin/main']);
if(head!==originMain) fail('main must match origin/main');
if(run('git',['tag','--list',version])) fail(`${version} already exists locally`);
if(run('git',['ls-remote','--tags','origin',`refs/tags/${version}`])) fail(`${version} already exists on origin`);

const changelog=readFileSync(new URL('../CHANGELOG.md',import.meta.url),'utf8');
const numericVersion=version.slice(1).replaceAll('.','\\.');
if(!new RegExp(`^## \\[${numericVersion}\\] - \\d{4}-\\d{2}-\\d{2}$`,'m').test(changelog)) fail(`CHANGELOG.md does not contain a dated ${version} section`);

let runs;
try {
  runs=JSON.parse(run('gh',['run','list','--repo','anthonyjohnsonga/Kinfolk-Family-Tree','--workflow','ci.yaml','--commit',head,'--limit','1','--json','status,conclusion,headSha,url']));
} catch {
  fail('GitHub CLI could not verify CI; confirm gh is installed and authenticated');
}
const ci=runs[0];
if(!ci||ci.headSha!==head||ci.status!=='completed'||ci.conclusion!=='success') fail('Continuous integration has not passed for HEAD');

console.log(`Release preflight passed for ${version}.`);
console.log(`Commit: ${head}`);
console.log(`CI: ${ci.url}`);
console.log('Publish with:');
console.log(`  git tag -a ${version} -m "Kinfolk Family Tree ${version}"`);
console.log(`  git push origin ${version}`);
