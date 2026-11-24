import { z } from 'zod';

const emailSchema = z
    .string()
    .trim()
    .min(3, 'Email is required')
    .max(254, 'Email is too long')
    .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Provide a valid email address')
    .transform((value) => value.toLowerCase());

const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(200, 'Password is too long');

// Clients in this codebase mix camelCase and snake_case field names. Normalising
// on the server keeps one canonical shape internally without breaking either caller.
const acceptAliases = (aliases) => (value) => {
    if (!value || typeof value !== 'object') return value;
    const normalized = { ...value };
    for (const [canonical, alternatives] of Object.entries(aliases)) {
        if (normalized[canonical] !== undefined) continue;
        const found = alternatives.find((alias) => normalized[alias] !== undefined);
        if (found) normalized[canonical] = normalized[found];
    }
    return normalized;
};

const withAliases = (schema, aliases) => z.preprocess(acceptAliases(aliases), schema);

const optionalText = (max) =>
    z
        .string()
        .trim()
        .max(max)
        .nullish()
        .transform((value) => (value === '' ? null : value));

export const registerSchema = withAliases(
    z.object({
        fullName: z.string().trim().min(2, 'Full name is required').max(100),
        email: emailSchema,
        password: passwordSchema,
    }),
    { fullName: ['full_name', 'name'] }
);

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required').max(200),
});

export const oauthExchangeSchema = z.object({
    code: z.string().min(16, 'Invalid authorization code').max(128),
});

export const profileUpdateSchema = withAliases(
    z.object({
        fullName: z.string().trim().min(2).max(100).optional(),
        phoneNumber: z
            .string()
            .trim()
            .max(20)
            .refine((value) => value === '' || /^[0-9+\-\s()]{6,20}$/.test(value), 'Provide a valid phone number')
            .nullish()
            .transform((value) => (value === '' ? null : value)),
        whatsAppNumber: z
            .string()
            .trim()
            .max(20)
            .refine((value) => value === '' || /^[0-9+\-\s()]{6,20}$/.test(value), 'Provide a valid WhatsApp number')
            .nullish()
            .transform((value) => (value === '' ? null : value)),
        stateHometown: optionalText(100),
        choiceOfStream: optionalText(100),
        choiceOfStreamOther: optionalText(100),
        entryLevel: optionalText(100),
        entryLevelOther: optionalText(100),
        howHeard: optionalText(100),
        howHeardOther: optionalText(100),
    }),
    {
        fullName: ['full_name'],
        phoneNumber: ['phone_number'],
        whatsAppNumber: ['whatsapp_number', 'whatsApp_number'],
        stateHometown: ['state_hometown'],
        choiceOfStream: ['choice_of_stream'],
        choiceOfStreamOther: ['choice_of_stream_other'],
        entryLevel: ['entry_level'],
        entryLevelOther: ['entry_level_other'],
        howHeard: ['how_heard'],
        howHeardOther: ['how_heard_other'],
    }
);

export const applySchema = withAliases(
    z.object({
        universityId: z.coerce.number().int().positive('universityId must be a positive integer'),
        courseOfferingId: z.coerce.number().int().positive().nullish(),
    }),
    { universityId: ['university_id'], courseOfferingId: ['course_offering_id'] }
);

export const bookAppointmentSchema = withAliases(
    z.object({
        date: z.coerce
            .date({ message: 'A valid appointment date is required' })
            .refine((value) => value.getTime() > Date.now(), 'Select a future date and time'),
        notes: z
            .string()
            .trim()
            .max(1000, 'Notes must be 1000 characters or fewer')
            .nullish()
            .transform((value) => (value === '' ? null : value)),
    }),
    { date: ['appointment_date', 'appointmentDate', 'slot'] }
);

export const contactSchema = z.object({
    name: z.string().trim().min(2, 'Name is required').max(120),
    email: emailSchema,
    phone: z
        .string()
        .trim()
        .max(30)
        .refine((value) => value === '' || /^[0-9+\-\s()]{6,30}$/.test(value), 'Provide a valid phone number')
        .nullish()
        .transform((value) => (value === '' ? null : value)),
    message: z.string().trim().min(5, 'Message is required').max(4000),
});

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const slugParamSchema = z.object({
    slug: z.string().trim().min(1).max(255),
});
