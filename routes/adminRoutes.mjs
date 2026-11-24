import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware.mjs';
import { writeLimiter, searchLimiter } from '../middleware/rateLimiters.mjs';
import { validate } from '../utils/validate.mjs';
import { idParamSchema } from '../schemas/authSchemas.mjs';
import {
    universityPayloadSchema,
    examPayloadSchema,
    coursePayloadSchema,
    partnerPayloadSchema,
    streamPayloadSchema,
    streamCoursesSchema,
    applicationUpdateSchema,
    appointmentStatusSchema,
    referralStatusSchema,
    roleSchema,
} from '../schemas/catalogSchemas.mjs';

import { getDashboardStats } from '../controllers/adminController.mjs';
import {
    createUniversity, deleteUniversity, getAllUniversitiesAdmin, updateUniversity, getUniversityByIdAdmin,
} from '../controllers/adminUniversityController.mjs';
import {
    createExam, deleteExam, getAllExamsAdmin, updateExam, getExamByIdAdmin,
} from '../controllers/adminExamController.mjs';
import {
    createStream, deleteStream, getAllStreams, updateStream, updateStreamCourses,
} from '../controllers/adminStreamController.mjs';
import { getCoursesByStreams } from '../controllers/courseController.mjs';
import {
    createCourse, deleteCourse, getAllCoursesAdmin, updateCourse, getCourseByIdAdmin,
} from '../controllers/adminCourseController.mjs';
import {
    createPartner, deletePartner, getAllPartnersAdmin, updatePartner, getPartnerByIdAdmin,
} from '../controllers/adminPartnerController.mjs';
import {
    getAllUsers, updateUserRole, getAllAgents, getAgentDetails, updateReferralStatus,
} from '../controllers/adminUserController.mjs';
import {
    getAllAppointments, updateAppointmentStatus, getAppointmentHistory,
} from '../controllers/adminAppointmentController.mjs';
import {
    getAllApplications, updateApplication, getApplicationHistory,
} from '../controllers/adminApplicationController.mjs';
import { listContactMessages, markContactMessageHandled } from '../controllers/contactController.mjs';

const router = Router();
router.use(authMiddleware, adminMiddleware);

router.get('/dashboard-stats', getDashboardStats);

// University management
router.get('/universities', getAllUniversitiesAdmin);
router.post('/universities', writeLimiter, validate({ body: universityPayloadSchema }), createUniversity);
router.get('/universities/:id', validate({ params: idParamSchema }), getUniversityByIdAdmin);
router.put('/universities/:id', writeLimiter, validate({ params: idParamSchema, body: universityPayloadSchema }), updateUniversity);
router.delete('/universities/:id', writeLimiter, validate({ params: idParamSchema }), deleteUniversity);

// Exam management
router.get('/exams', getAllExamsAdmin);
router.post('/exams', writeLimiter, validate({ body: examPayloadSchema }), createExam);
router.get('/exams/:id', validate({ params: idParamSchema }), getExamByIdAdmin);
router.put('/exams/:id', writeLimiter, validate({ params: idParamSchema, body: examPayloadSchema }), updateExam);
router.delete('/exams/:id', writeLimiter, validate({ params: idParamSchema }), deleteExam);

// Stream management
router.get('/streams', getAllStreams);
router.post('/streams', writeLimiter, validate({ body: streamPayloadSchema }), createStream);
router.put('/streams/:id', writeLimiter, validate({ params: idParamSchema, body: streamPayloadSchema }), updateStream);
router.delete('/streams/:id', writeLimiter, validate({ params: idParamSchema }), deleteStream);
router.put('/streams/:id/courses', writeLimiter, validate({ params: idParamSchema, body: streamCoursesSchema }), updateStreamCourses);
router.get('/courses-by-streams', searchLimiter, getCoursesByStreams);

// Course management
router.get('/courses', getAllCoursesAdmin);
router.post('/courses', writeLimiter, validate({ body: coursePayloadSchema }), createCourse);
router.get('/courses/:id', validate({ params: idParamSchema }), getCourseByIdAdmin);
router.put('/courses/:id', writeLimiter, validate({ params: idParamSchema, body: coursePayloadSchema }), updateCourse);
router.delete('/courses/:id', writeLimiter, validate({ params: idParamSchema }), deleteCourse);

// Partner management
router.get('/partners', getAllPartnersAdmin);
router.post('/partners', writeLimiter, validate({ body: partnerPayloadSchema }), createPartner);
router.get('/partners/:id', validate({ params: idParamSchema }), getPartnerByIdAdmin);
router.put('/partners/:id', writeLimiter, validate({ params: idParamSchema, body: partnerPayloadSchema }), updatePartner);
router.delete('/partners/:id', writeLimiter, validate({ params: idParamSchema }), deletePartner);

// User management
router.get('/users', searchLimiter, getAllUsers);
router.put('/users/:id/role', writeLimiter, validate({ params: idParamSchema, body: roleSchema }), updateUserRole);

// Appointment management
router.get('/appointments', searchLimiter, getAllAppointments);
router.get('/appointments/:id/history', validate({ params: idParamSchema }), getAppointmentHistory);
router.put('/appointments/:id/status', writeLimiter, validate({ params: idParamSchema, body: appointmentStatusSchema }), updateAppointmentStatus);

// Application management
router.get('/applications', searchLimiter, getAllApplications);
router.get('/applications/:id/history', validate({ params: idParamSchema }), getApplicationHistory);
router.put('/applications/:id', writeLimiter, validate({ params: idParamSchema, body: applicationUpdateSchema }), updateApplication);

// Agent management
router.get('/agents', searchLimiter, getAllAgents);
router.get('/agents/:id', validate({ params: idParamSchema }), getAgentDetails);
router.put('/referrals/:referralId/status', writeLimiter, validate({ body: referralStatusSchema }), updateReferralStatus);

// Contact inbox
router.get('/contact-messages', searchLimiter, listContactMessages);
router.put('/contact-messages/:id/handled', writeLimiter, markContactMessageHandled);

export default router;
