import { z } from 'zod';

const optionalText = (max) => z.union([z.string().trim().max(max), z.null()]).optional().nullable();

export const universityPayloadSchema = z.object({
    name: z.string().trim().min(2).max(200),
    location: z.string().trim().min(1).max(200),
    rating: z.coerce.number().min(0).max(5).optional().nullable(),
    description: optionalText(5000),
    image_url: z
        .string()
        .trim()
        .refine((v) => v === '' || /^https?:\/\//i.test(v), { message: 'image_url must be an http(s) URL' })
        .optional()
        .nullable(),
    details: z.record(z.string(), z.any()).optional().nullable(),
    courses_and_fees: z.array(z.record(z.string(), z.any())).optional().nullable(),
    placements: z.record(z.string(), z.any()).optional().nullable(),
    facilities: z.array(z.string().trim().max(200)).max(60).optional().nullable(),
    admission_open: z.coerce.boolean().optional().nullable(),
    admission_year: z.coerce.number().int().min(2000).max(2100).optional().nullable(),
    is_top_university: z.coerce.boolean().optional().nullable(),
    stream_ids: z.array(z.coerce.number().int().positive()).max(50).optional(),
    top_stream_ids: z.array(z.coerce.number().int().positive()).max(50).optional(),
    offerings: z
        .array(
            z.object({
                course_id: z.coerce.number().int().positive(),
                fee_amount: z.coerce.number().min(0).max(99999999).optional().nullable(),
                fee_currency: z.string().trim().length(3).toUpperCase().optional().nullable(),
                fee_display: z.string().trim().max(120).optional().nullable(),
                duration: z.string().trim().max(120).optional().nullable(),
                eligibility: z.string().trim().max(1000).optional().nullable(),
                admission_year: z.coerce.number().int().min(2000).max(2100).optional().nullable(),
            })
        )
        .max(200)
        .optional(),
});

export const coursePayloadSchema = z.object({
    name: z.string().trim().min(2).max(200),
    description: optionalText(5000),
    icon_name: optionalText(100),
    stream_ids: z.array(z.coerce.number().int().positive()).max(50).optional(),
});

export const examPayloadSchema = z.object({
    name: z.string().trim().min(2).max(200),
    exam_date: optionalText(60),
    exam_level: optionalText(100),
    info: optionalText(5000),
    application_form: z.union([z.record(z.string(), z.any()), z.array(z.any()), z.string(), z.null()]).optional(),
    important_dates: z.union([z.record(z.string(), z.any()), z.array(z.any()), z.string(), z.null()]).optional(),
    syllabus: z.union([z.record(z.string(), z.any()), z.array(z.any()), z.string(), z.null()]).optional(),
    exam_pattern: z.union([z.record(z.string(), z.any()), z.array(z.any()), z.string(), z.null()]).optional(),
    admit_card_details: z.union([z.record(z.string(), z.any()), z.array(z.any()), z.string(), z.null()]).optional(),
    result_details: z.union([z.record(z.string(), z.any()), z.array(z.any()), z.string(), z.null()]).optional(),
    cutoff_details: z.union([z.record(z.string(), z.any()), z.array(z.any()), z.string(), z.null()]).optional(),
});

export const partnerPayloadSchema = z.object({
    name: z.string().trim().min(2).max(200),
    location: optionalText(200),
    featured_text: optionalText(500),
    logo_url: z
        .string()
        .trim()
        .refine((v) => v === '' || /^https?:\/\//i.test(v), { message: 'logo_url must be an http(s) URL' })
        .optional()
        .nullable(),
    link_stream_slug: optionalText(120),
    link_city_slug: optionalText(120),
});

export const streamPayloadSchema = z.object({
    name: z.string().trim().min(2).max(120),
});

export const streamCoursesSchema = z.object({
    course_ids: z.array(z.coerce.number().int().positive()).max(200),
});

export const applicationUpdateSchema = z
    .object({
        status: z.enum(['Applied', 'Called', 'Converted', 'Rejected']).optional(),
        course_name: z.string().trim().min(1).max(255).optional().nullable(),
        note: z.string().trim().max(1000).optional().nullable(),
    })
    .refine((v) => v.status !== undefined || v.course_name !== undefined, {
        message: 'Provide status and/or course_name',
    });

export const appointmentStatusSchema = z.object({
    status: z.enum(['Booked', 'Called', 'Converted', 'Cancelled', 'Completed', 'No Show']),
    note: z.string().trim().max(1000).optional().nullable(),
});

export const referralStatusSchema = z.object({
    status: z.enum(['Not Referred', 'Referred', 'Converted']),
});

export const roleSchema = z.object({
    role: z.enum(['user', 'agent', 'admin']),
});

export const universityListQuerySchema = z.object({
    filter: z.enum(['top']).optional(),
    city: z.string().trim().max(120).optional(),
    stream: z.string().trim().max(120).optional(),
    search: z.string().trim().max(120).optional(),
    admission_open: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});
