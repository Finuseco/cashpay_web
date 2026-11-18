'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCareersHandler } = require('../src/lib/careers/handler');
const { createProjectsHandler } = require('../src/lib/projects/handler');
const NOW = Date.parse('2026-11-18T20:00:00Z');
function fixture(kind, registry, failMail = false) {
  const options = { env: { SMTP_HOST:'smtp.example.test',SMTP_PORT:'465',SMTP_USER:'sender@example.test',SMTP_PASSWORD:'synthetic',CAREERS_MAIL_TO:'info@example.test' },
    clock:()=>NOW, logger:{log(){},error(){}}, recordContact:registry,
    transportFactory:()=>({ async sendMail(message) {
      if (failMail) throw new Error('SMTP test refusal');
      return {accepted: message.to};
    },close(){} }) };
  return kind === 'careers' ? createCareersHandler(options) : createProjectsHandler(options);
}
function form(kind) {
  const common = {firstName:'Candidate',lastName:'Private',phone:'+243850000000',email:'candidate@example.test',country:'CD',consent:'1',t:String(NOW-10000)};
  const data = kind === 'careers' ? {...common,province:'Kinshasa',position:'manager',gender:'F',profession:'Manager',age:'30',message:'Private motivation'} : {...common,projectName:'AgriPay',kind:'startup',stage:'prototype',sector:'Agritech',city:'Kinshasa',description:'Un projet de financement des entreprises agricoles avec paiement et livraison dans les provinces.'};
  const body = new FormData(); for (const [k,v] of Object.entries(data)) body.set(k,v);
  if (kind === 'careers') {
    body.set('photo',new Blob([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a])]),'private.png');
    body.set('cv',new Blob(['%PDF-1.4 Private CV body']),'private.pdf');
  } else body.append('docs',new Blob(['%PDF-1.4 Private project']),'private.pdf');
  return body;
}
const request = kind => new Request(`https://app.cashpay-all.com/api/${kind === 'careers' ? 'careers' : 'projects'}`,{method:'POST',headers:{origin:'https://cashpay-all.com'},body:form(kind)});
for (const kind of ['careers','project']) {
  test(`${kind}: delivered dossiers register only contact email/reference/type`,async()=>{
    const recorded=[];const r=await fixture(kind,async value=>recorded.push(value))(request(kind));
    assert.equal(r.status,200);assert.equal(recorded.length,1);
    assert.deepEqual(Object.keys(recorded[0]).sort(),['email','kind','ref']);
    assert.equal(recorded[0].email,'candidate@example.test');assert.equal(recorded[0].kind,kind);
    assert.match(recorded[0].ref,kind === 'careers' ? /^CP-/ : /^PR-/);
  });
  test(`${kind}: metadata outage preserves confirmed delivery`,async()=>{
    const r=await fixture(kind,async()=>{throw new Error('Database offline');})(request(kind));
    assert.equal(r.status,200);assert.equal((await r.json()).delivery.internal,'accepted');
  });
  test(`${kind}: refused internal mail never creates a contact`,async()=>{
    let recorded=false;const r=await fixture(kind,async()=>{recorded=true;},true)(request(kind));
    assert.equal(r.status,503);assert.equal(recorded,false);
  });
}
