
import 'dotenv/config';

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  app: {
    port: process.env.PORT || 8002,
    googleCallbackUrl: process.env.GOOGLE_LOGIN_CALLBACK_URL || 'http://app.cashpay-all.com/api/auth/google/callback/login',
    googleDriveCallbackUrl: process.env.GOOGLE_DRIVE_CALLBACK_URL || 'app.cashpay-all.com/api/auth/google/callback/drive',
    zoomCallbackUrl: process.env.ZOOM_OAUTH_REDIRECT_URI || 'http://app.cashpay-all.com/api/auth/zoom/callback',
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL || 'app.cashpay-all.com',
    adServerUrl: process.env.NEXT_PUBLIC_AD_SERVER_URL || 'ads.cashpay-all.com',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    devPortalSecret: process.env.DEV_PORTAL_JWT_SECRET,
    fxPortalSecret: process.env.FX_PORTAL_JWT_SECRET,
  },
  marqeta: {
    baseUrl: process.env.MARQETA_BASE_URL || 'https://sandbox-api.marqeta.com/v3',
    appToken: process.env.MARQETA_APP_TOKEN,
    adminAccessToken: process.env.MARQETA_ADMIN_ACCESS_TOKEN,
    productTokenVirtual: process.env.MARQETA_CARD_PRODUCT_TOKEN_VIRTUAL,
    productTokenPhysical: process.env.MARQETA_CARD_PRODUCT_TOKEN_PHYSICAL,
    webhookSecret: process.env.MARQETA_WEBHOOK_SECRET,
  },
  apiKeys: {
    google: process.env.GOOGLE_CLIENT_ID,
    googleSecret: process.env.GOOGLE_CLIENT_SECRET,
    zoomVideoSdkKey: process.env.ZOOM_VIDEO_SDK_KEY,
    zoomVideoSdkSecret: process.env.ZOOM_VIDEO_SDK_SECRET,
    zoomClientId: process.env.ZOOM_CLIENT_ID,
    zoomClientSecret: process.env.ZOOM_CLIENT_SECRET,
    zoomAccountId: process.env.ZOOM_ACCOUNT_ID,
    maxicashMerchantId: process.env.MAXICASH_MERCHANT_ID,
    maxicashMerchantPassword: process.env.MAXICASH_MERCHANT_PASSWORD,
    airtelClientId: process.env.AIRTEL_API_CLIENT_ID,
    airtelClientSecret: process.env.AIRTEL_API_CLIENT_SECRET,
    airtelEncryptionPublicKey: process.env.AIRTEL_ENCRYPTION_PUBLIC_KEY,
    airtelSystemPin: process.env.AIRTEL_SYSTEM_PIN,
    mpesaApiKey: process.env.MPESA_API_KEY,
    mpesaEncryptionPublicKey: process.env.MPESA_ENCRYPTION_PUBLIC_KEY,
    mpesaBusinessShortcode: process.env.MPESA_BUSINESS_SHORTCODE,
    ubaPublicKey: process.env.UBA_PUBLIC_KEY,
    ubaSecretKey: process.env.UBA_SECRET_KEY,
    airlinesApiKey: process.env.AIRLINES_API_KEY,
    airlinesApiSecret: process.env.AIRLINES_API_SECRET,
    jengaMerchantCode: process.env.JENGA_MERCHANT_CODE,
    jengaConsumerSecret: process.env.JENGA_CONSUMER_SECRET,
    jengaPrivateKey: process.env.JENGA_PRIVATE_KEY,
  },
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },
};

export default config;
