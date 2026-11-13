const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {Client}=require('pg');
const {root,loadEnvironment,databaseConfig,checkSchema}=require('./runtime-config.cjs');
loadEnvironment();
const command=process.argv[2];
if(!['enable','status'].includes(command))throw Error('Usage: npm run loans:enable | npm run loans:status');
(async()=>{
 const db=new Client(databaseConfig());
 try {
  if(!process.env.INTERNAL_JOB_SECRET)throw Object.assign(Error('INTERNAL_JOB_SECRET missing'),{code:'JOB_SECRET_REQUIRED'});
  // Confirm that the deployed application contains the authenticated job before activating it.
  const url=new URL('/api/internal/jobs/loan-repayments',process.env.CASH_PAY_APP_URL||'http://127.0.0.1:8002');
  if(url.username||url.password||!(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))))throw Error('Invalid application origin');
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(10000)});
  if(response.status!==401)throw Object.assign(Error('Deployed repayment route unavailable'),{code:'DEPLOY_WALLET_FIRST'});
  await db.connect();
  if(command==='enable'){
   for(const name of ['20261101_loan_runtime_schema.sql','20261106_loan_repayment_queue.sql'])await db.query(fs.readFileSync(path.join(root,'migrations',name),'utf8'));
  }
  await checkSchema(db);
  const activatedAt=Date.now();
  if(command==='enable'){
   execFileSync('pm2',['startOrReload',path.join(__dirname,'ecosystem.config.cjs'),'--update-env'],{cwd:root,stdio:['ignore','ignore','inherit']});
   execFileSync('pm2',['save'],{stdio:['ignore','ignore','inherit']});
   console.log('Worker installé. Il peut recouvrer les dettes déjà éligibles, sans ouverture de LoanMe.');
  }
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
  console.error('Recouvrement non confirmé :',error.code||'SETUP_FAILED',error.missing||'');
  console.error('Consultez pm2 logs cashpay-loan-repayments --lines 40 --nostream et les erreurs cashpay-wallet.');
  process.exitCode=1;
 }finally {await db.end().catch(()=>{});}
})();
