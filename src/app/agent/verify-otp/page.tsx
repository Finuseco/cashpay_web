import { Suspense } from 'react';
import { AgentOtpForm } from '@/components/auth/agent-otp-form';

function AgentVerifyOtpPage() {
  return (
    <main className="flex h-full min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-[#000e38] to-[#223a7a]">
      <div className="w-full max-w-md">
        <AgentOtpForm />
      </div>
    </main>
  );
}


export default function AgentVerifyOtp() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AgentVerifyOtpPage />
    </Suspense>
  );
}
