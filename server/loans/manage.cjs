const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {Client}=require('pg');
const {root,loadEnvironment,databaseConfig,checkSchema}=require('./runtime-config.cjs');
loadEnvironment();
function networkCode(error) {
 const codes=new Set(['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENOTFOUND','EAI_AGAIN','UND_ERR_CONNECT_TIMEOUT','ERR_TLS_CERT_ALTNAME_INVALID','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT']);
 const causes=[error,error?.cause,...(error?.cause?.errors||[])];
 return causes.map(cause=>cause?.code).find(code=>codes.has(code)) || (error?.name==='TimeoutError'?'TIMEOUT':'NETWORK_ERROR');
}
async function waitForApplication(url) {
 let failure;
 for(let attempt=0;attempt<15;attempt++) {
  try {
   const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(3000)});
   if(response.status===401)return;
   failure=Object.assign(Error('Job endpoint unavailable'),{code:'DEPLOY_WALLET_FIRST',httpStatus:response.status});
   if(![502,503,504].includes(response.status))throw failure;
  } catch(error) {
   if(error.code==='DEPLOY_WALLET_FIRST')throw error;
   failure=Object.assign(Error('Backend unreachable'),{code:'BACKEND_UNREACHABLE',network:networkCode(error)});
  }
  if(attempt===0)console.log('Attente du démarrage de cashpay-wallet…');
  if(attempt<14)await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw failure;
}
const command=process.argv[2];
if(!['enable','status'].includes(command))throw Error('Usage: npm run loans:enable | npm run loans:status');
(async()=>{
 const db=new Client(databaseConfig());
 let stage='configuration';
 try {
  if(!process.env.INTERNAL_JOB_SECRET)throw Object.assign(Error('INTERNAL_JOB_SECRET missing'),{code:'JOB_SECRET_REQUIRED'});
  // Confirm that the deployed application contains the authenticated job before activating it.
  const url=new URL('/api/internal/jobs/loan-repayments',process.env.CASH_PAY_APP_URL||'http://127.0.0.1:8002');
  if(url.username||url.password||!(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))))throw Object.assign(Error('Invalid application origin'),{code:'APP_ORIGIN_INVALID'});
  stage='application';
  await waitForApplication(url);
  stage='database';
  await db.connect();
  if(command==='enable'){
   for(const name of ['20261101_loan_runtime_schema.sql','20261106_loan_repayment_queue.sql']){stage='migration:'+name;await db.query(fs.readFileSync(path.join(root,'migrations',name),'utf8'));}
  }
  stage='trigger';
  await checkSchema(db);
  const activatedAt=Date.now();
  if(command==='enable'){
   stage='pm2';
   execFileSync('pm2',['startOrReload',path.join(__dirname,'ecosystem.config.cjs'),'--update-env'],{cwd:root,stdio:['ignore','ignore','inherit']});
   execFileSync('pm2',['save'],{stdio:['ignore','ignore','inherit']});
   console.log('Worker installé. Il peut recouvrer les dettes déjà éligibles, sans ouverture de LoanMe.');
  }
  stage='worker-verification';
  const deadline=Date.now()+(command==='enable'?65000:0);
  let state;
  do {
   const result=await db.query("SELECT application_name FROM pg_stat_activity WHERE datname=current_database() AND application_name LIKE 'cashpay-loan-repayments:%' ORDER BY backend_start DESC");
   state=result.rows.map(row=>row.application_name).find(name=>/^cashpay-loan-repayments:ok:\d+$/.test(name) && Date.now()-Number(name.split(':')[2])<180000 && (command!=='enable'||Number(name.split(':')[2])>=activatedAt));
   if(state)break;
   if(command!=='enable')break;
   await new Promise(resolve=>setTimeout(resolve,1000));
  }while(Date.now()<deadline);
  if(!state)throw Object.assign(Error('No recent successful background run'),{code:'WORKER_NOT_HEALTHY'});
  console.log('Déclencheur de dépôt actif ; passage automatique confirmé :',new Date(Number(state.split(':')[2])).toISOString());
 } catch(error){
  const code=error.code || (stage==='pm2'?'PM2_FAILED':'SETUP_FAILED');
  console.error('Recouvrement non confirmé :',code,'— étape :',stage);
  if(error.network)console.error('Connexion :',error.network);
  if(Number.isInteger(error.httpStatus))console.error('Statut HTTP :',error.httpStatus);
  if(error.missing?.length)console.error('Éléments manquants :',error.missing.join(', '));
  console.error('Consultez pm2 logs cashpay-loan-repayments --lines 40 --nostream et les erreurs cashpay-wallet.');
  process.exitCode=1;
 }finally {await db.end().catch(()=>{});}
})();
