// import { Router } from 'express';
// import { getDashboardStats } from '../controllers/adminController.mjs';
// import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware.mjs';

// const router = Router();

// // All routes in this file are protected by auth and admin middleware
// router.use(authMiddleware, adminMiddleware);

// router.get('/dashboard-stats', getDashboardStats);

// export default router;


import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware.mjs';
import { getDashboardStats } from '../controllers/adminController.mjs';
import { createUniversity, deleteUniversity, getAllUniversitiesAdmin, updateUniversity,getUniversityByIdAdmin } from '../controllers/adminUniversityController.mjs';
import { createExam, deleteExam, getAllExamsAdmin, updateExam,getExamByIdAdmin } from '../controllers/adminExamController.mjs';
import { createStream, deleteStream, getAllStreams, updateStream } from '../controllers/adminStreamController.mjs';
import { createCourse, deleteCourse, getAllCoursesAdmin, updateCourse } from '../controllers/adminCourseController.mjs';
import { createPartner, deletePartner, getAllPartnersAdmin, updatePartner } from '../controllers/adminPartnerController.mjs';
import { getAllUsers, updateUserRole, getAllAgents, getAgentDetails, updateReferralStatus } from '../controllers/adminUserController.mjs';
import { getAllAppointments, updateAppointmentStatus } from '../controllers/adminAppointmentController.mjs';
import { getAllApplications, updateApplication } from '../controllers/adminApplicationController.mjs';
import { updateStreamCourses, getCoursesByStreams } from '../controllers/adminStreamController.mjs';

const router = Router();
router.use(authMiddleware, adminMiddleware); // Protect all admin routes

// Dashboard
router.get('/dashboard-stats', getDashboardStats);

// University Management
router.get('/universities', getAllUniversitiesAdmin);
router.post('/universities', createUniversity);
router.get('/universities/:id', getUniversityByIdAdmin);
router.put('/universities/:id', updateUniversity);
router.delete('/universities/:id', deleteUniversity);

// Exam Management
router.get('/exams', getAllExamsAdmin);
router.post('/exams', createExam);
router.get('/exams/:id', getExamByIdAdmin);
router.put('/exams/:id', updateExam);
router.delete('/exams/:id', deleteExam);

// Stream Management
router.get('/streams', getAllStreams);
router.post('/streams', createStream);
router.put('/streams/:id', updateStream);
router.delete('/streams/:id', deleteStream);

// NEW routes for managing stream-course relationships
router.put('/streams/:id/courses', updateStreamCourses);
router.get('/courses-by-streams', getCoursesByStreams); // For the dynamic dropdown in Uni form

// Course Management
router.get('/courses', getAllCoursesAdmin);
router.post('/courses', createCourse);
router.put('/courses/:id', updateCourse);
router.delete('/courses/:id', deleteCourse);

// Partner Management
router.get('/partners', getAllPartnersAdmin);
router.post('/partners', createPartner);
router.put('/partners/:id', updatePartner);
router.delete('/partners/:id', deletePartner);


// User Management
router.get('/users', getAllUsers);
router.put('/users/:id/role', updateUserRole);

// Appointment Management
router.get('/appointments', getAllAppointments);
router.put('/appointments/:id/status', updateAppointmentStatus);

// Application Management
router.get('/applications', getAllApplications);
router.put('/applications/:id', updateApplication);

// Agent Management
router.get('/agents', getAllAgents);
router.get('/agents/:id', getAgentDetails);
router.put('/referrals/:referralId/status', updateReferralStatus);

export default router;