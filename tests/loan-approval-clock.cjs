// Runs the actual approval action with isolated DB/payment boundaries. No live data or services.
process.env.TZ='UTC';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function moduleAt(file,requireFn){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:requireFn,Date,console,process,Promise});return exports;}
const calendar=moduleAt('src/lib/loan-calendar.ts',()=>{throw Error('unexpected import')});
const requested='2026-10-01T08:00:00.000Z',approved='2026-11-16T11:12:13.456Z';
assert.deepEqual(JSON.parse(JSON.stringify(calendar.loanCalendarMetadata({status:'pending',request_date:requested,approval_date:approved},['2026-12-01T00:00:00Z']))),{request_date:requested,approval_date:null,start_date:null,end_date:null});
assert.equal(calendar.loanCalendarMetadata({status:'approved',approval_date:approved},[]).end_date,null);
assert.equal(calendar.loanCalendarMetadata({status:'approved',approval_date:approved},['2026-12-14T11:12:13.456Z']).end_date,'2026-12-14T11:12:13.456Z');
let pending=true,credited=0,failCredit=false,calls=[],installments=[],stamp=approved,duration=1,frequency='weekly',count=4;
const actor={id:10,role:'SuperAgent',country:'CD',province:'X'};
const conn={async query(sql,args){calls.push(sql);
 if(sql.includes('SELECT l.*,to_jsonb(u)'))return {rows:pending?[{id:1,user_id:20,amount:100,interest_rate:24,duration,repayment_frequency:frequency,installment_count:count,borrower:{id:20}}]:[]};
 if(sql.includes('SELECT role,country,province'))return {rows:[actor]};
 if(sql.startsWith('UPDATE loans SET')){assert(sql.includes('clock_timestamp()'));assert(sql.includes('RETURNING approval_date'));return {rows:[{approval_date:stamp ? new Date(stamp) : null}]};}
 if(sql.includes('INSERT INTO loan_installments'))installments.push(args);
 return {rows:[]};},release(){}};
const actions=moduleAt('src/lib/actions/loan.actions.ts',name=>{
 if(name==='date-fns'||name==='date-fns/locale')return require(name);
 if(name==='@/lib/loan-calendar')return calendar;
 if(name==='@/lib/super-agent-access')return {requireSuperAgent:async()=>actor,assertManagedUser:async()=>{},countryIdentity:s=>s};
 if(name==='@/lib/db')return {db:{query:async()=>({rows:[{user_id:20}]}),getConnection:async()=>conn}};
 if(name==='./transaction.actions')return {createTransaction:async()=>{credited++;return failCredit?{success:false,error:'isolated test failure'}:{success:true,transactionId:99}}};
 if(name==='./helpers')return {handleDbError:async e=>({error:e.message})};
 if(name==='./notification.actions')return {createNotification:async()=>{}};
 return {};
});
(async()=>{
 assert.equal((await actions.approveLoanRequest(1,10)).success,true);
 assert.equal(credited,1);assert.equal(installments.length,4);
 assert.deepEqual(installments.map(x=>x[2].toISOString()),['2026-11-23T11:12:13.456Z','2026-11-30T11:12:13.456Z','2026-12-07T11:12:13.456Z','2026-12-14T11:12:13.456Z']);
 assert.equal(calls.at(-1),'COMMIT');
 pending=false;calls=[];installments=[];assert.equal((await actions.approveLoanRequest(1,10)).success,false);assert.equal(credited,1);assert.equal(installments.length,0);assert(calls.includes('ROLLBACK'));
 pending=true;failCredit=true;calls=[];assert.equal((await actions.approveLoanRequest(1,10)).success,false);assert(calls.includes('ROLLBACK'));assert.equal(installments.length,0);
 failCredit=false;stamp=null;calls=[];installments=[];const priorCredit=credited;
 assert.equal((await actions.approveLoanRequest(1,10)).success,false);assert.equal(credited,priorCredit);assert.equal(installments.length,0);
 stamp='2026-01-31T12:15:16.123Z';duration=3;frequency='monthly';count=3;calls=[];
 assert.equal((await actions.approveLoanRequest(1,10)).success,true);
 assert.deepEqual(installments.map(x=>x[2].toISOString()),['2026-02-28T12:15:16.123Z','2026-03-31T12:15:16.123Z','2026-04-30T12:15:16.123Z']);
 console.log('PASS pending calendars hidden; approval uses DB instant including milliseconds; four Monday installments preserve time; repeat/failed approvals do not create another schedule.');
})().catch(error=>{console.error(error);process.exit(1)});
