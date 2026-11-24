import { ApiError } from './ApiError.mjs';

// Mirrors the frontend profile-completion calculation so a UI-only gate cannot
// be bypassed by calling the API directly.
export const PROFILE_FIELDS = [
    'phone_number',
    'whatsapp_number',
    'state_hometown',
    'choice_of_stream',
    'entry_level',
    'how_heard',
];

export const calculateProfileCompletion = (user) => {
    if (!user) return 0;
    const filled = PROFILE_FIELDS.filter((field) => {
        const value = user[field];
        return value !== null && value !== undefined && String(value).trim() !== '';
    }).length;
    return Math.round((filled / PROFILE_FIELDS.length) * 100);
};

export const missingProfileFields = (user) =>
    PROFILE_FIELDS.filter((field) => {
        const value = user?.[field];
        return value === null || value === undefined || String(value).trim() === '';
    });

export const requireCompleteProfile = (user) => {
    const missing = missingProfileFields(user);
    if (missing.length > 0) {
        throw ApiError.unprocessable('Complete your profile before continuing', { missingFields: missing });
    }
};

export default requireCompleteProfile;
