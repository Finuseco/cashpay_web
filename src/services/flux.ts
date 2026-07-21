
'use server';

/**
 * @fileoverview Service for interacting with the Flux E-Visa API.
 * Documentation: https://developer.fluxir.com
 */

const API_BASE_URL = 'https://api.fluxir.com/v1';
const API_KEY = process.env.FLUX_API_KEY;

interface ApiResponse {
    success: boolean;
    data?: any;
    error?: string;
}

interface EvisaApplicationPayload {
    destinationCountry: string;
    visaType: string;
    firstName: string;
    lastName:string;
    dateOfBirth: string;
    passportNumber: string;
    passportIssueDate: string;
    passportExpiryDate: string;
    passportPhotoUrl: string;
    passportScanUrl: string;
    email: string;
    phone: string;
}

const checkApiKey = () => {
    if (!API_KEY || API_KEY.includes('YOUR_FLUX_API_KEY')) {
        console.warn("[Flux Service] API Key not configured. Using mock data.");
        return false;
    }
    return true;
}

export async function getEviaCountries(): Promise<{ code: string; name: string }[]> {
    console.log("[Flux Service] Fetching e-visa countries...");
    
    if (!checkApiKey()) {
        await new Promise(resolve => setTimeout(resolve, 300));
        // Mock data fallback if API key is not present
        return [
            { code: 'TR', name: 'Turquie' },
            { code: 'EG', name: 'Égypte' },
            { code: 'AE', name: 'Émirats Arabes Unis' },
            { code: 'KE', name: 'Kenya' },
            { code: 'TZ', name: 'Tanzanie' },
        ];
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/evisa/countries`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        const data = await response.json();
        if (!response.ok) {
            console.error('[Flux Service] Get Countries Error:', data);
            throw new Error(data.message || 'Failed to fetch countries from Flux API.');
        }
        // Ensure the returned data is an array
        return Array.isArray(data.countries) ? data.countries : [];

    } catch (error: any) {
        console.error('[Flux Service] Critical error fetching countries:', error);
        return []; // Return empty array on critical error
    }
}

export async function getTravelServices(destinationCountryCode: string): Promise<{ success: boolean; services?: { id: string; name: string }[], error?: string }> {
    console.log(`[Flux Service] Fetching travel services for ${destinationCountryCode}...`);
    if (!checkApiKey()) {
        await new Promise(resolve => setTimeout(resolve, 350));
        // Mock data for visa types based on the new endpoint logic
        return {
            success: true,
            services: [
                { id: 'visa_tourist_single', name: 'Visa Touristique (Entrée Unique)' },
                { id: 'visa_business_multiple', name: 'Visa d\'Affaires (Entrées Multiples)' },
                { id: 'visa_transit_48h', name: 'Visa de Transit (48h)' },
            ]
        };
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/travel-services?destination=${destinationCountryCode}`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const data = await response.json();
        if (!response.ok) {
            return { success: false, error: data.message || 'Failed to fetch travel services.' };
        }
        // Filter for services of type 'E-VISA'
        const evisaServices = data.services?.filter((s: any) => s.type === 'E-VISA') || [];
        return { success: true, services: evisaServices };
    } catch (error: any) {
        console.error(`[Flux Service] Critical error fetching travel services for ${destinationCountryCode}:`, error);
        return { success: false, error: 'Failed to communicate with the travel services endpoint.' };
    }
}


export async function createEviaApplication(payload: EvisaApplicationPayload): Promise<{ success: boolean; applicationId?: string; error?: string }> {
    console.log("[Flux Service] Creating e-visa application:", payload);

    if (!checkApiKey()) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        // Mock success response
        return { success: true, applicationId: `mock_flux_${Date.now()}` };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/evisa/applications`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Flux Service] Create Application Error:', data);
            return { success: false, error: data.message || 'Failed to submit application.' };
        }

        return { success: true, applicationId: data.applicationId };

    } catch (error: any) {
        console.error('[Flux Service] Critical error:', error);
        return { success: false, error: 'Failed to communicate with the e-visa service.' };
    }
}

type EvisaStatus = 'pending' | 'approved' | 'rejected';

function isValidStatus(status: any): status is EvisaStatus {
    return ['pending', 'approved', 'rejected'].includes(status);
}

export async function getApplicationStatus(applicationId: string): Promise<{ success: boolean; status?: EvisaStatus; message?: string; visaUrl?: string, error?: string; }> {
    console.log(`[Flux Service] Checking status for application ID: ${applicationId}`);

    if (!checkApiKey()) {
        await new Promise(resolve => setTimeout(resolve, 800));
        const statuses: EvisaStatus[] = ['pending', 'approved', 'rejected'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        let visaUrl;
        if(randomStatus === 'approved') {
            const attachments = await getApplicationAttachments(applicationId);
            visaUrl = attachments.success ? attachments.attachments[0]?.url : undefined;
        }
        return {
            success: true,
            status: randomStatus,
            message: `Votre demande est ${randomStatus}.`,
            visaUrl: visaUrl
        };
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/evisa/applications/${applicationId}`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const data = await response.json();
        if (!response.ok) {
            return { success: false, error: data.message || 'Failed to get status.' };
        }
        if (!isValidStatus(data.status)) {
             return { success: false, error: `Invalid status received from API: ${data.status}` };
        }
         let visaUrl = data.visa_url; // Use URL from status if available
        if (data.status === 'approved' && !visaUrl) {
            const attachments = await getApplicationAttachments(applicationId);
            visaUrl = attachments.success ? attachments.attachments[0]?.url : undefined;
        }

        return { success: true, status: data.status, message: data.message, visaUrl };
    } catch (error: any) {
        return { success: false, error: 'Failed to communicate with the e-visa service.' };
    }
}

export async function getApplicationAppointments(applicationId: string): Promise<{ success: boolean; appointments: any[]; error?: string; }> {
    console.log(`[Flux Service] Getting appointments for application ID: ${applicationId}`);
    
    if (!checkApiKey()) {
        await new Promise(resolve => setTimeout(resolve, 600));
        if (applicationId.includes('mock')) {
             return {
                success: true,
                appointments: [
                    {
                        appointmentId: 'apt_12345',
                        date: '2024-08-15',
                        time: '10:30',
                        location: 'VFS Global Center, Kinshasa',
                        type: 'Biometrics Collection'
                    }
                ]
            };
        }
        return { success: true, appointments: [] };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/evisa/applications/${applicationId}/appointments`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const data = await response.json();
        if (!response.ok) {
            return { success: false, error: data.message || 'Failed to get appointments.', appointments: [] };
        }
        return { success: true, appointments: data.appointments || [] };
    } catch (error: any) {
        return { success: false, error: 'Failed to communicate with the e-visa appointment service.', appointments: [] };
    }
}


export async function getApplicationAttachments(fluxApplicationId: string): Promise<{ success: boolean; attachments: { url: string; fileName: string }[]; error?: string }> {
    console.log(`[Flux Service] Fetching attachments for application: ${fluxApplicationId}`);
    if (!checkApiKey()) {
        await new Promise(resolve => setTimeout(resolve, 400));
        return {
            success: true,
            attachments: [
                { url: `attachment_${fluxApplicationId}`, fileName: 'e-visa-document.pdf' }
            ]
        };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/attachments/evisa-application/${fluxApplicationId}`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const data = await response.json();
        if (!response.ok) {
            return { success: false, error: data.message || 'Failed to get attachments.', attachments: [] };
        }
        return { success: true, attachments: data.attachments || [] };
    } catch (error: any) {
        return { success: false, error: 'Failed to communicate with the attachment service.', attachments: [] };
    }
}

export async function downloadAttachmentFromFlux(attachmentId: string): Promise<{ success: boolean; fileData?: string; error?: string }> {
    console.log(`[Flux Service] Downloading attachment via Flux endpoint: ${attachmentId}`);
    
    if (!checkApiKey()) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const mockPdfBase64 = "JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PC9DcmVhdG9yIChEb2N1bWVudCkKL1Byb2R1Y2VyIChEb2N1bWVudCk+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlIC9DYXRhbG9nCi9QYWdlcyAzIDAgUgo+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlIC9QYWdlcwovS2lkcyBbIDQgMCBSIF0KL0NvdW50IDEKPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZSAvUGFnZQovUGFyZW50IDMgMCBSCi9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0KL0NvbnRlbnRzIDUgMCBSCi9SZXNvdXJjZXMgPDwKL1Byb2NTZXQgWyAvUERGIC9UZXh0IF0KL0ZvbnQgPDwKL0YxIDYgMCBSCi9GMiA3IDAgUgo+Pgo+Pgo+PgplbmRvYmoKNSAwIG9iago8PC9MZW5ndGggMTQzPj4Kc3RyZWFtCjIgSgpyZwogIEJUCiAgICAvRjEgMjQgVGYKICAgIDczLjUgNzE4LjY5IFRkCiAgICAoIE1vY2sgUERGIGZyb20gQ2FzaFBheSBFeHBlcmlvKSBUagogIEVUCjUgSgpyZwogIEJUCiAgICAvRjIgMTIgVGYKICAgIDczLjUgNjgwLjY5IFRkCiAgICAoIFRoaXMgaXMgYSBzaW1wbGUgUERGIGNyZWF0ZWQgZm9yIHRlc3RpbmcgdGhlIGRvd25sb2FkIGZ1bmN0aW9uYWxpdHkuICkgVGoKICBFVAplbmRzdHJlYW0KZW5kb2JqCjYgMCBvYmoKPDwvVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EtQm9sZAo+PgplbmRvYmoKNyAwIG9iago8PC9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBlMQovQmFzZUZvbnQgL0hlbHZldGljYQo+PgplbmRvYmoKeHJlZgowIDgKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNzAgMDAwMDAgbiAKMDAwMDAwMDA5OSAwMDAwMCBuIAowMDAwMDAwMTQ4IDAwMDAwIG4gCjAwMDAwMDAyOTggMDAwMDAgbiAKMDAwMDAwMDQzNCAwMDAwMCBuIAowMDAwMDAwNDk4IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA4Ci9Sb290IDIgMCBSCi9JbmZvIDEgMCBSCj4+CnN0YXJ0eHJlZgoxNDczCiUlRU9G";
        return { success: true, fileData: mockPdfBase64 };
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/azurestore/download/${attachmentId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Failed to download file from Flux: ${errorData}`);
        }
        
        const fileBuffer = await response.arrayBuffer();
        const base64Data = Buffer.from(fileBuffer).toString('base64');
        return { success: true, fileData: base64Data };

    } catch (error: any) {
        console.error(`[Flux Service] Download failed:`, error);
        return { success: false, error: "La fonctionnalité de téléchargement réel n'est pas encore implémentée ou a échoué." };
    }
}
    