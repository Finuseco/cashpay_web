"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateContentId = void 0;
exports.cn = cn;
exports.countryToCode = countryToCode;
exports.getCountryByCode = getCountryByCode;
exports.generateReferenceCode = generateReferenceCode;
exports.formatKiloMega = formatKiloMega;
exports.formatUser = formatUser;
exports.currentPrice = currentPrice;
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
const countries_1 = require("./countries");
function cn(...inputs) {
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
const countryNameToCodeMap = countries_1.countries.reduce((acc, country) => {
    acc[country.name.toLowerCase()] = country.code;
    return acc;
}, {});
const countryCodeToInfoMap = countries_1.countries.reduce((acc, country) => {
    acc[country.code] = country;
    return acc;
}, {});
function countryToCode(countryIdentifier) {
    if (!countryIdentifier)
        return null;
    // Check if it's a valid 2-letter code
    if (countryIdentifier.length === 2 && countryCodeToInfoMap[countryIdentifier.toUpperCase()]) {
        return countryIdentifier.toUpperCase();
    }
    // Check if it's a country name
    const lowercasedIdentifier = countryIdentifier.toLowerCase();
    return countryNameToCodeMap[lowercasedIdentifier] || null;
}
function getCountryByCode(countryCode) {
    return countryCode ? countryCodeToInfoMap[countryCode.toUpperCase()] : null;
}
function generateReferenceCode(type) {
    const prefix = type.substring(0, 4).toUpperCase();
    const timestamp = Date.now().toString(36).slice(-6).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}${randomPart}`;
}
function formatKiloMega(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
}
const generateContentId = (prefix = 'item') => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};
exports.generateContentId = generateContentId;
// Formats a raw user object from the database into the client-side User type.
function formatUser(rawUser) {
    if (!rawUser) {
        throw new Error("formatUser was called with an undefined user object.");
    }
    let channels = [];
    if (rawUser.notifications_channel) {
        try {
            const parsed = typeof rawUser.notifications_channel === 'string'
                ? JSON.parse(rawUser.notifications_channel)
                : rawUser.notifications_channel;
            if (Array.isArray(parsed)) {
                channels = parsed;
            }
        }
        catch (e) {
            console.error("Failed to parse notifications_channel:", e);
        }
    }
    return {
        id: rawUser.id,
        role: rawUser.role,
        status: rawUser.status,
        account_type: rawUser.account_type,
        id_wallet: rawUser.id_wallet,
        language: rawUser.language || 'fr',
        full_name: rawUser.full_name,
        first_name: rawUser.first_name,
        last_name: rawUser.last_name,
        middle_name: rawUser.middle_name,
        gender: rawUser.gender,
        marital_status: rawUser.marital_status,
        birth_date: rawUser.birth_date ? new Date(rawUser.birth_date).toISOString().split('T')[0] : null,
        birth_place: rawUser.birth_place,
        nationality: rawUser.nationality,
        email: rawUser.email,
        phone: rawUser.phone,
        country: rawUser.country,
        province: rawUser.province,
        city: rawUser.city,
        address: rawUser.address,
        profession: rawUser.profession,
        activity_description: rawUser.activity_description,
        income_per_month: rawUser.income_per_month ? parseFloat(rawUser.income_per_month) : null,
        profile_photo: rawUser.profile_photo,
        cover_photo: rawUser.cover_photo,
        signature_image: rawUser.signature_image,
        pin_hash: rawUser.pin_hash,
        password_hash: rawUser.password_hash,
        google_id: rawUser.google_id,
        zoom_id: rawUser.zoom_id,
        zoom_refresh_token: rawUser.zoom_refresh_token,
        totp_secret: rawUser.totp_secret,
        notifications_channel: channels,
        assistantSettings: typeof rawUser.assistantsettings === 'string' ? JSON.parse(rawUser.assistantsettings) : rawUser.assistantsettings,
        availabilityStatus: rawUser.availabilitystatus,
        schedule: typeof rawUser.schedule === 'string' ? JSON.parse(rawUser.schedule) : rawUser.schedule,
        representative: typeof rawUser.representative === 'string' ? JSON.parse(rawUser.representative) : rawUser.representative,
        created_at: new Date(rawUser.created_at).toISOString(),
        updated_at: rawUser.updated_at ? new Date(rawUser.updated_at).toISOString() : undefined,
        verification_status: rawUser.verification_status,
        temp_photo_expires_at: rawUser.temp_photo_expires_at ? new Date(rawUser.temp_photo_expires_at).toISOString() : undefined,
        is_crypto_active: rawUser.is_crypto_active,
        mlm_rank_id: rawUser.mlm_rank_id,
        api_key: rawUser.api_key,
        api_secret: rawUser.api_secret,
        test_api_key: rawUser.test_api_key,
        test_api_secret: rawUser.test_api_secret,
        left_child_id: rawUser.left_child_id,
        right_child_id: rawUser.right_child_id,
    };
}
function currentPrice(product, quantity) {
    // Resilience: handle product coming from various sources (DB, Scan, Cart)
    const basePrice = Number(product.sellingPrice || product.price || product.selling_price || 0);
    if (isNaN(basePrice))
        return 0;
    const promotionalPackages = product.promotionalPackages || product.promotional_packages;
    if (!promotionalPackages || !Array.isArray(promotionalPackages) || promotionalPackages.length === 0) {
        return basePrice;
    }
    let applicablePromo = null;
    for (const pkg of promotionalPackages) {
        const minQty = Number(pkg.minQuantity || pkg.min_quantity || 0);
        const promoPrice = Number(pkg.price || 0);
        if (Number(quantity) >= minQty) {
            if (!applicablePromo || minQty > Number(applicablePromo.minQuantity || applicablePromo.min_quantity)) {
                applicablePromo = pkg;
            }
        }
    }
    const finalPrice = applicablePromo ? Number(applicablePromo.price || 0) : basePrice;
    return isNaN(finalPrice) ? 0 : finalPrice;
}
