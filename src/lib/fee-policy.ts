// List of transaction types that should always use the 'GBL' country code.
export const GLOBAL_FEE_TYPES = [
    'PRODUCT_SALE_VAT', 
    'BUY_CARDS_USD_V_FEE', 'BUY_CARDS_USD_P_FEE', 
    'BUY_CARDS_EUR_V_FEE', 'BUY_CARDS_EUR_P_FEE',
    'BUY_CARDS_CDF_V_FEE', 'BUY_CARDS_CDF_P_FEE',
    'SMS_PACKAGE', 'B2B_CARD_ISSUE',
    'WD_ATM_USD', 'WD_ATM_EUR', 'WD_ATM_CDF',
    'AGENT_SUB_PROMO',
    'AGENT_SUB_NORMAL',
    'HSM_LOCK'
];

// List of mobile money withdrawal types that have a fallback mechanism to 'CD'.
export const MOBILE_MONEY_WD_TYPES = [
    'WD_AIRTEL_MONEY', 'WD_MPESA', 'WD_ORANGE_MONEY', 'WD_AFRIMONEY', 'WD_MTN_MOMO', 'WD_PAYPAL', 'WD_CRYPTO_MONEY'
];


