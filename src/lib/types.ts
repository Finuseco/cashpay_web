
import type { VerifyUserInput, VerifyUserOutput, Article } from '@/lib/actions/types';

export interface Address {
    id: string;
    label: string;
    fullName: string;
    phone: string;
    address: string;
    province: string;
    city: string;
    countryCode: string;
    isPrimary?: boolean;
}

export interface Province {
  code: string;
  name: string;
}

export interface Session {
    id: string;
    loginTime: string;
    logoutTime?: string;
    ipAddress: string;
    browser: string;
    os: string;
    device: string;
    workerRole?: 'Vendeur' | 'Gérant' | 'Caissier';
}

export interface AssistantSettings {
  isEnabled: boolean;
  customMessage: string;
  activeDays: string[];
}

export interface Agency {
    id: number;
    name: string;
    address: string;
    managerName: string;
    managerContact: string;
    status: 'Active' | 'Inactive';
    balances: Record<string, number>;
    last_client_id_sequence: number;
}

export interface ATM {
    id: string;
    location: string;
    agency_id: string;
    status: 'Active' | 'Inactive' | 'Out of Service';
    cash_levels: Record<string, number>;
    last_transaction: string;
    created_at: string;
}

export interface CivilServant {
    id: string;
    matricule: string;
    nom_complet: string;
    ministere: string;
    fonction: string;
    id_wallet: string;
    statut: 'actif' | 'suspendu';
    baseSalary: number;
    currency: 'USD' | 'CDF' | 'EUR';
}

export type SupportedLanguage = 'en' | 'fr' | 'es' | 'pt' | 'it' | 'ru' | 'zh' | 'hi' | 'sw' | 'ln' | 'ar';
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'fr', 'es', 'pt', 'it', 'ru', 'zh', 'hi', 'sw', 'ln', 'ar'];

export interface User {
    id: number;
    role: 'Client' | 'Agent' | 'Admin' | 'Seller' | 'Manager' | 'PartnerB2B' | 'Publisher' | 'Guarantor' | 'SuperAgent' | 'SubSuperAgent' | 'StationService';
    status: 'Active' | 'Inactive' | 'Suspended' | 'Pending';
    suspension_reason?: string | null;
    account_type: 'national' | 'diaspora' | 'business';
    id_wallet: string;
    language: SupportedLanguage;
    full_name: string;
    first_name?: string | null;
    last_name?: string | null;
    middle_name?: string | null;
    gender?: 'male' | 'female' | 'other' | null;
    marital_status?: 'single' | 'married' | 'divorced' | 'widowed' | null;
    birth_date?: string | null;
    birth_place?: string | null;
    nationality?: string | null;
    email?: string | null;
    phone?: string | null;
    country: string | null;
    province?: string | null;
    city?: string | null;
    address?: string | null;
    profession?: string | null;
    activity_description?: string | null;
    income_per_month?: number | null;
    profile_photo?: string | null;
    cover_photo?: string | null;
    signature_image?: string | null;
    pin_hash?: string | null;
    password_hash?: string | null;
    google_id?: string | null;
    zoom_id?: string | null;
    zoom_refresh_token?: string | null;
    totp_secret?: string | null;
    notifications_channel: ('sms' | 'email' | 'whatsapp' | 'in-app')[];
    assistantSettings?: AssistantSettings;
    availabilityStatus?: 'available' | 'busy' | 'away' | 'offline';
    schedule?: { day: string; start: string; end: string; }[];
    representative?: { name: string; relation: string; contact: string; };
    created_at: string;
    updated_at?: string;
    verification_status?: 'blue' | 'green' | 'red' | null;
    temp_photo_expires_at?: string | null;
    is_crypto_active: boolean;
    mlm_rank_id?: number | null;
    api_key?: string | null;
    api_secret?: string | null;
    test_api_key?: string | null;
    test_api_secret?: string | null;
    left_child_id?: number | null;
    right_child_id?: number | null;
}

export interface Country {
    code: string;
    name: string;
    continent: string;
    dial_code: string;
    currency_name: string;
    currency_code: string;
    currency_symbol: string;
    news_feeds?: { name: string; url: string; category: string }[];
}

export interface Status {
    id: number;
    userId: number;
    type: 'text' | 'image' | 'video';
    content: string;
    backgroundColor?: string | null;
    createdAt: string;
}

export interface StatusGroup {
    contact: Pick<User, 'id' | 'full_name' | 'profile_photo'>;
    statuses: Status[];
    hasUnseen: boolean;
}


export interface PaymentDetails {
    amount: number;
    currency: string;
    description: string;
    merchantName: string;
    status: string;
    redirect_url: string;
};


export interface Boutique {
    id: string;
    name: string;
    address: string;
}

export interface Currency {
    name: string;
    code: string;
    balance: string;
    symbol: string;
}

export interface Transaction {
    type: "received" | "sent";
    description: string;
    date: string;
    time: string;
    amount: string;
    currency: string;
    fee?: number;
    reference: string;
    metadata?: Record<string, any>;
};

export interface Card {
  id: string;
  user_id: number;
  card_provider_id: string;
  inventory_id?: number;
  card_type: 'virtuelle' | 'physique';
  brand: 'visa' | 'mastercard';
  currency: string;
  number: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  cvv_encrypted: string;
  status: 'active' | 'inactive' | 'cancelled' | 'pending_cancellation' | 'suspended';
  is_primary: boolean;
  created_at: string;
  holder: string;
  balance: number;
  spending_source_type: 'wallet' | 'cpk';
  linked_cpk_id?: string | null;
  linkedKeys?: HardwareKeyInfo[];
  metadata?: {
    nickname?: string;
  };
}

export interface HardwareKeyInfo {
    id: number;
    reference: string;
    signature: string;
    amount: number;
    currency: string;
    status: 'active' | 'partially_used' | 'claimed' | 'cancelled' | 'expired';
}

export interface Dispute {
    token: string;
    transaction_token: string;
    amount: number;
    category: 'FRAUD' | 'DISPUTE';
    reason: string;
    status: 'OPEN' | 'SUBMITTED' | 'RESOLVED' | 'WON' | 'LOST';
    notes?: string;
    created_time: string;
    last_modified_time: string;
}

export interface DisputeTransition {
    token: string;
    dispute_token: string;
    status: 'SUBMITTED' | 'RESOLVED' | 'WON' | 'LOST';
    notes?: string;
    created_time: string;
}

export interface SavedCard {
    id: number;
    user_id: number;
    card_brand: 'visa' | 'mastercard' | 'card';
    card_holder_name: string;
    last4: string;
    expiry_month: string;
    expiry_year: string;
    card_token: string;
    is_primary: boolean;
    created_at: string;
}


export interface Message {
  id: string;
  senderId: number;
  sender?: Pick<User, 'first_name'>;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'doc' | 'in_chat_transfer' | 'system' | 'product';
  status?: 'sent' | 'delivered' | 'read' | 'edited';
  metadata?: string; 
  isVoiceMessage?: boolean;
  image_id?: string | null;
}

export interface Conversation {
    id: string;
    userId: number;
    contact: User;
    lastMessage: string;
    lastMessageTimestamp: string;
    unreadCount: number;
    is_muted?: boolean;
    is_pinned?: boolean;
    messages: Message[];
}

export interface Call {
    id: string;
    type: 'audio' | 'video';
    caller: User;
    callee: User;
    status: 'ringing' | 'connected' | 'ended' | 'declined' | 'missed' | 'unavailable' | 'no-answer' | 'offline';
    startedAt?: string;
    endedAt?: string;
    sessionId?: number;
}

export interface LoanRepayment {
    id: number;
    amount: number;
    type: 'repayment' | 'penalty';
    payment_date: string;
}

export interface Loan {
  id: number;
  amount: number;
  remaining_balance: number;
  repaid_amount: number;
  currency: string;
  interest_rate: number;
  start_date: string;
  end_date: string;
  monthly_payment?: number;
}

export interface LoanHistory extends Loan {
    status: 'pending' | 'approved' | 'rejected' | 'repaid' | 'defaulted';
    repayments: LoanRepayment[];
    schedule?: { dueDate: string; amount: number; status: 'paid' | 'due' }[];
}

export interface Investment {
  id: number;
  amount: number;
  currency: string;
  duration: number;
  interest_rate: number;
  total_return: number;
  status: 'pending' | 'approved' | 'rejected' | 'matured' | 'cancelled';
  start_date: string | null;
  maturity_date: string | null;
  created_at: string;
}


export interface Referral {
    id: number;
    fullName: string;
    status: 'Pending Deposit' | 'Active';
    date: string;
    isClaimed: boolean;
}

export interface SportsOutcome {
    id: string;
    type: string;
    name: string;
    odd: number;
}
  
export interface SportsOffer {
    id: string;
    type: string;
    name: string;
    outcomes: SportsOutcome[];
}
  
export interface SportsEvent {
    id: string;
    name: string;
    team1: string;
    team2: string;
    status: string;
    category: {
        id: string;
        name: string;
        parent?: { id: string; name: string };
    };
    offers: SportsOffer[];
}

export interface BetSelection {
    id: string; 
    matchId: string;
    matchName: string;
    name: string;
    odd: number;
}

export interface Notification {
  id: number;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  type?: 'new_message' | 'missed_audio_call' | 'missed_video_call' | 'meeting_invite' | 'general' | 'game_invite' | 'pos_sale' | 'new_follower' | string;
  link?: string | null;
}

export interface Seller {
  id: number;
  fullName: string;
  id_wallet: string;
  profile_photo?: string;
  status: 'Active' | 'Inactive';
  totalSales: number; 
  phone: string;
  createdAt: string;
  boutiqueId: string;
  boutiqueName?: string;
  monthlySalary?: number;
  pin?: string;
  sessions?: Session[];
  role: 'Vendeur' | 'Gérant' | 'Caissier';
}

export interface ProductCategory {
  id: string;
  name: string;
  domain?: 'Habillement' | 'Alimentation' | 'Supermarché' | 'Quincaillerie' | 'Électronique' | 'Livre' | 'Autre' | 'Beauté' | 'Auto Mobil';
}

export interface ProductVariation {
    color: string;
    stock: number;
}

export interface PromotionalPackage {
    minQuantity: number;
    price: number;
}

export interface ShippingRate {
    destination: string;
    pricePerKg: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  details?: { 
    subtitle?: string;
    author?: string;
    publisher?: string;
    language?: string;
    publicationDate?: string;
    isbn10?: string;
    isbn13?: string;
    pageCount?: string;
    bookSize?: string;
    authorBio?: string;
    conclusion?: string;
    editionType?: 'cashpay' | 'external';
    authorImage?: string;
    pdfUrl?: string;
    sourceUrl?: string;
    audioUrl?: string;
  } | null;
  image: string;
  images: string[];
  purchasePrice?: number;
  sellingPrice: number;
  currency: string;
  weight?: number; 
  shippingRates?: ShippingRate[] | null;
  promotionalPackages?: PromotionalPackage[] | null;
  variations: ProductVariation[];
  barcode: string;
  isbn10?: string;
  isbn13?: string;
  stock: number; 
  categoryId: string;
  boutiqueId: string;
  boutiqueName?: string;
  isPublic: boolean;
  countryCode?: string;
  sellerWalletId?: string;
  seller: {
      id: string;
      name: string;
  };
  createdAt?: string; 
  pv?: number; 
  sellerSubscriptionStatus?: 'active' | 'inactive';
}

export interface CartItem extends Product {
  quantity: number;
  options?: { [key: string]: string };
}

export interface SmsPackage {
  id: number;
  name: string;
  smsCount: number;
  price: number;
  currency: 'USD' | 'EUR';
}

export interface SmsPurchase {
  id: string;
  packageId: number;
  smsCount: number;
  price: number;
  date: string;
}

export interface SentSmsCampaign {
  id: string;
  message: string;
  recipientsCount: number;
  costInSms: number;
  date: string;
}

export interface MarketingCampaign {
  id: number;
  agent_id: number;
  package_name: string;
  package_cost: number;
  layout_style: string;
  product_ids: string; 
  status: 'sent' | 'failed';
  created_at: string;
}


export type PlayerColor = 'white' | 'black';
export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
export interface ChessPiece {
    type: PieceType;
    color: PlayerColor;
    symbol: string;
}
export type Board = (ChessPiece | null)[][];
export interface Position {
    row: number;
    col: number;
}


export interface Meeting {
    id: number;
    host_user_id: number;
    topic: string;
    agenda?: string | null;
    meeting_provider_id: string;
    join_url: string;
    type: 'audio' | 'video' | 'meeting';
    status: 'pending' | 'active' | 'ended';
    entry_fee: number;
    currency: string;
    created_at: string;
}

export interface Subscription {
    id: string;
    userId: number;
    type: 'feedback_plus_annual';
    status: 'active' | 'expired' | 'cancelled';
    startDate: string;
    endDate: string;
    transactionId: string;
}

export interface Movie {
    id: string;
    title: string;
    description: string;
    coverPath: string;
    rating: number;
    year: number;
    dataAiHint?: string;
    progress?: number; 
    duration?: string; 
    isGame?: boolean;
    category?: 'Action' | 'Éducation' | 'Sport'; 
}

export interface TvChannel {
    id: string;
    name: string;
    logoUrl: string;
    streamUrl: string; 
}

export interface JojoVideo {
    id: string;
    videoUrl: string;
    user: {
        name: string;
        handle: string;
        avatar: string;
    };
    description: string;
    songTitle: string;
    likes: number;
    comments: number;
    shares: number;
    bookmarks: number;
}

export type MonPaysCategory = 'E-commerce' | 'Finance numérique' | 'Startups et fintech' | 'Banques digitales' | 'Sites d’actualités' | 'Hôtels' | 'Écoles' | 'Services publics' | 'Transferts d’argent' | 'Streaming' | 'Entreprises locales';

export interface MonPaysCompany {
  id: string;
  name: string;
  category: MonPaysCategory;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  isVerified: boolean;
  ownerWalletId: string;
  
  website?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface MonPaysActivity {
    id: string;
    companyId: string; 
    title: string;
    description: string;
    imageUrl: string;
    createdAt: string; 
    
    likes: number;
    shares: number;
    
    isMonetized: boolean;
    rewardPerShare: number; 
    monetizationBudget: number; 
}

export interface CasinoTransaction {
  id: string;
  user_wallet_id: string;
  platform_id: string;
  game_id: string;
  tx_type: 'deposit' | 'bet' | 'win' | 'loss';
  amount: number;
  currency: string;
  description: string;
  reference_code: string;
  timestamp: string; 
}

export interface MonPaysStory {
    id: string;
    companyId: string;
    imageUrl: string;
    createdAt: string;
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
    buyerPhone?: string;
    shippingAddress?: {
        address?: string;
        city?: string;
        province?: string;
        countryCode?: string;
    };
    shippingCost?: number;
    vatAmount?: number;
    seller?: {
        id: string;
        name: string;
    };
    items?: any[];
    metadata?: {
        transactionStatus?: string;
        transactionReference?: string;
        isDigital?: boolean;
        pdfUrl?: string;
        audioUrl?: string;
    };
}

export interface FlightBooking {
    id: number;
    userId: number;
    bookingReference: string;
    originCountry: string;
    destinationCountry: string;
    departureDate: string; 
    returnDate?: string; 
    status: 'pending' | 'confirmed' | 'ticketed' | 'cancelled' | 'rejected';
    paymentStatus: 'unpaid' | 'paid' | 'refunded';
    totalFare: number;
    currency: string;
    ticketPdfUrl?: string;
}

export interface FlightPassenger {
    id: number;
    bookingId: number;
    firstName: string;
    lastName: string;
    dateOfBirth: string; 
    passportNumber?: string;
}

export interface DigitalCheck {
    id: number;
    checkNumber: string;
    issuerUserId: number;
    recipientName: string;
    amount: number;
    currency: string;
    issueDate: string;
    status: 'valid' | 'cashed' | 'cancelled' | 'expired';
    cashingDate?: string;
}

export interface WesternUnionTransferDetails {
    success: boolean;
    status: 'available' | 'paid' | 'cancelled';
    senderName: string;
    senderCountry: string;
    amount: number;
    currency: string;
    error?: string;
}

export interface MoneyGramTransferDetails {
    success: boolean;
    status: 'available' | 'paid' | 'cancelled' | 'in_progress';
    senderName: string;
    senderCountry: string;
    amount: number;
    currency: string;
    error?: string;
}

export interface RiaTransferDetails {
    success: boolean;
    status: 'available' | 'paid' | 'cancelled';
    senderName: string;
    senderCountry: string;
    amount: number;
    currency: string;
    error?: string;
}

export interface RegidesoInvoice {
  statut_facture: 'Payée' | 'Impayée';
  numero_facture: string;
  nom_client: string;
  adresse_client: string;
  amount: number; 
  periode: string; 
  currency: 'CDF' | 'USD';
  abonnement_id: string;
}

export interface RegidesoAbonnement {
  id: number;
  user_id: number;
  alias: string;
  abonnement_id: string;
}

export interface ResellerApiCredentials {
    accountId: string;
    apiKey: string;
    apiSecret: string;
}

export interface LinkedBankAccount {
    id: number;
    userId: number;
    provider: 'mastercard' | 'visa' | 'bank' | 'card' | 'sahl';
    institutionName: string;
    accountHolderName: string;
    accountType: string;
    accountNumberMask: string;
    providerAccountId: string; 
    mastercardAccessToken?: string; 
    createdAt: string;
    updatedAt: string;
    balance?: number;
    currency?: string;
}

export interface PortalPinLockState {
    unlocked: boolean;
    timestamp?: number;
}

// MLM Types
export interface LoanMePartner {
    id: number;
    user_id: number;
    company_name: string;
    rccm: string;
    national_id: string;
    address: string;
    status: 'pending' | 'active' | 'rejected';
    created_at: string;
    groups: Group[];
    commissions: any[]; 
}

export interface MlmNetworkPartner {
    id: number;
    user_id: number;
    company_name: string;
    company_type: string;
    product_category: string;
    status: 'pending' | 'active' | 'rejected';
    commission_currency: 'USD' | 'CDF';
    inactivity_period: 6 | 12;
    created_at: string;
}

export interface MlmProductSettings {
    productId: string;
    partnerId: number;
    pv: number;
    directCommission: number;
    directCommission_percentage?: number;
    levelCommissions: number[];
    binaryCommission: number;
}

export interface GroupMember {
    id: number;
    group_id: number;
    user_id: number;
    role: 'admin' | 'member';
    status: 'active' | 'removed';
    joined_at: string;
}

export interface GroupMemberInfo {
    id: number; 
    full_name: string;
    profile_photo: string | null;
    role: 'admin' | 'member';
}

export interface GroupMessage extends Message {
    groupId: number;
}

export interface Group {
    id: number;
    name: string;
    description?: string | null;
    photo_url?: string | null;
    currency: 'USD' | 'EUR' | 'CDF';
    group_wallet_id: string;
    owner_user_id: number;
    created_at: string;
    member_count: number;
    balance: number;
    members: GroupMemberInfo[];
    messages: GroupMessage[];
    user_role?: 'admin' | 'member';
}

export interface GroupTransaction {
    id: number;
    group_id: number;
    user_id: number; 
    type: 'contribution' | 'payout';
    amount: number;
    currency: string;
    description: string;
    destination?: string; 
    created_at: string;
    source_transaction_id?: number;
    user_name?: string; 
}

export interface NewsFeed {
    name: string;
    url: string;
    category: string;
}

export type NewsCategory = 'Sport' | 'Économie' | 'Culture' | 'Science' | 'Santé' | 'General';

export interface AdCampaign {
    id: number;
    userId: number;
    name: string;
    targetUrl: string;
    imageUrl: string;
    format: 'banner' | 'popup' | 'video';
    budget: number;
    durationDays: number;
    status: 'pending_approval' | 'approved' | 'rejected' | 'active' | 'completed' | 'paused';
    createdAt: string;
}

export interface AdPlacement {
    id: number;
    blogger_user_id: number;
    site_id: number;
    placement_code: string;
    name: string;
    format: 'banner' | 'popup' | 'video';
    is_active: boolean;
}

export interface PublisherSite {
    id: number;
    name: string;
    url: string;
    status: 'pending' | 'approved' | 'rejected';
    verification_code: string;
}

export interface PublisherDetails {
    publisherId: string;
    sites: PublisherSite[];
    placements: AdPlacement[];
}

export interface FxPortalUser {
  id: number;
  username: string;
  password_hash: string;
  country_code: string;
  created_at: string;
}

export interface CryptoBalance {
    currency_code: string;
    balance: number;
}

export interface CryptoTransaction {
    id: number;
    type: 'deposit' | 'withdrawal';
    currency_code: string;
    amount: number;
    tx_hash: string;
    status: 'unconfirmed' | 'confirmed' | 'pending' | 'completed' | 'failed';
    created_at: string;
}

export type MarqetaEventType = 
  | 'card.active'
  | 'card.suspended'
  | 'card.terminated'
  | 'cardtransition.status.updated'
  | 'transaction.authorization'
  | 'transaction.clearing'
  | 'jit_funding.authorization'
  | 'digital_wallet_token.active'
  | 'digital_wallet_token.suspended'
  | 'digital_wallet_token.terminated';

export interface MarqetaEvent {
    type: MarqetaEventType | string;
    token: string;
    created_time: string;
    data: any;
}

export interface MarqetaMerchant {
    name: string;
    mcc: string;
    city?: string;
    state?: string;
    country?: string;
}

export interface JitFundingRequest {
    token: string;
    method: 'pgfs.authorization' | 'pgfs.clearing';
    user_token: string;
    amount: number;
    currency_code: string;
    card_token: string;
    local_amount?: number;
    local_currency_code?: string;
    merchant: MarqetaMerchant;
    jit_funding: {
        token: string;
        amount: number;
        currency_code: string;
        user_token: string;
        method: string;
    };
}

// --- FUEL SYSTEM TYPES ---

export interface FuelProduct {
    id: string;
    name: string; // Essence, Gasoil, etc.
    pricePerLiter: number;
    currency: string;
}

export interface FuelStation {
    id: string;
    name: string;
    address: string;
    ownerWalletId: string;
    ownerUserId: number;
    status: 'active' | 'inactive';
    products: FuelProduct[];
    logoUrl?: string;
    countryCode: string;
    province: string;
    baseCurrency: string;
}

export interface FuelPump {
    id: string;
    stationId: string;
    pumpNumber: string;
    status: 'idle' | 'busy' | 'out_of_order';
    supportedProductIds: string[];
}

export interface FuelTank {
    id: string;
    stationId: string;
    productId: string;
    capacity: number;
    currentVolume: number;
    lastReading: string;
}

export interface FuelToken {
    id: string;
    userId: number;
    stationId: string;
    productId: string;
    tokenCode: string;
    amount: number;
    liters: number;
    currency: string;
    status: 'valid' | 'used' | 'expired' | 'cancelled';
    createdAt: string;
    expiresAt: string;
}

export type { VerifyUserInput, VerifyUserOutput, Article };
