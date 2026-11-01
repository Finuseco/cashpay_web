import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(){
 const fingerprints=(process.env.ONCHAT_ANDROID_SHA256_CERT_FINGERPRINTS||'').split(',').map(value=>value.trim().toUpperCase()).filter(value=>/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(value));
 return NextResponse.json(fingerprints.length?[{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'com.aistudio.onchat.vqpz',sha256_cert_fingerprints:fingerprints}}]:[]);
}
