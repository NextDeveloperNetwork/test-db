// Authentication Guard Middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  
  // Return 401 Unauthorized for API requests
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized: Session authentication required.' });
  }

  // Redirect HTML requests to login
  res.redirect('/login');
}

module.exports = requireAuth;
