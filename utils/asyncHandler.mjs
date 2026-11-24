// Express 4 does not forward rejected promises from async handlers to the error
// middleware, so every async route is wrapped explicitly.
export const asyncHandler = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};

export default asyncHandler;
