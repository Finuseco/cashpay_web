// This file is dedicated to defining types for server actions
// to avoid circular dependency issues.

export interface VerifyUserInput {
  walletId: string;
}

export interface VerifyUserOutput {
  isValid: boolean;
  userName: string | null;
  reason: string;
  userId: number;
  walletId?: string;
  countryCode?: string;
}

// --- EVENT MANAGEMENT TYPES ---

export interface TicketType {
  id: number;
  type: string;
  price: number;
  quantity: number;
  sold: number;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  date: string; // ISO String
  time: string;
  location: string;
  imageUrl?: string;
  currency: string;
  organizerName: string;
  ticketTypes: TicketType[];
  ownerUserId: number; 
  ownerCountryCode: string; 
  validatedCount: number;
  eventType: 'live' | 'zoom';
  zoomEventId?: string;
}

export interface Ticket {
  id: string;
  event_id: string;
  ticket_type_id: number;
  user_id: number;
  ownerName: string;
  ticketCode: string;
  status: 'valid' | 'used' | 'invalid' | 'expired';
  ticketType: string;
}

export interface Order {
    id: string;
    reference: string;
    userId: number;
    productName: string;
    productImage?: string;
    quantity: number;
    totalPrice: number;
    currency: string;
    status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
    createdAt: string;
    buyerName?: string;
    seller?: {
        id: string;
        name: string;
    };
    items?: any[];
    shippingCost?: number;
    vatAmount?: number;
    shippingAddress?: {
        address?: string;
        city?: string;
        province?: string;
        countryCode?: string;
    },
    buyerPhone?: string;
    metadata?: Record<string, any>;
}

export interface Article {
    id: number;
    source: string;
    title: string;
    link: string;
    pubDate: string;
    content: string;
    contentSnippet: string;
    isoDate: string;
    author?: string;
    imageUrl?: string;
    views: number;
    likes: number;
    country_code: string;
    continent: string;
    category: string;
}
