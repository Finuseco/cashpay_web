const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript');
function load(mnemonic){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').resolve(__dirname, '../src/services/tron.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process:{env:{TRON_HD_MNEMONIC:mnemonic}},require:n=>require(n)});return exports;}
const seed='abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
let api=load(seed);const first=api.deriveUserTronAddress(1);assert(api.isBase58TronAddress(first));assert.equal(first,api.deriveUserTronAddress(1));assert.notEqual(first,api.deriveUserTronAddress(2));assert.equal(first,load('  '+seed.replaceAll(' ','  ')+' ').deriveUserTronAddress(1));
for(const [seed,code]of [[undefined,'SECURE_KEY_CUSTODY_NOT_CONFIGURED'],['invalid test phrase','INVALID_KEY_CUSTODY_CONFIGURATION']]){assert.throws(()=>load(seed).deriveUserTronAddress(1),e=>e.code===code&&!e.message.includes('invalid test phrase'));}
assert.throws(()=>api.deriveUserTronAddress(0));assert(!api.isBase58TronAddress('USDT_fake'));
console.log('PASS: deterministic distinct real addresses, whitespace normalization, missing/invalid seed classification without secret disclosure, invalid IDs and fake addresses refused.');
