

import { SmsApiClient } from '@/components/agent/sms-api-client';

export default function AgentSmsApiPage() {
    // In a real app, this data would be fetched for the authenticated agent
    // from a secure backend. For now, we pass undefined and let the component use a mock.
    return <SmsApiClient />;
}
