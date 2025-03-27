import jwt from "jsonwebtoken";



const verifySuperAdminToken = (req, res, next) => {
    try {
        const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ error: "Access denied. No token provided." });
        }

        jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: "Invalid or expired token." });
            }

            // Check if the user has superadmin role
            if (decoded.role !== "superadmin") {
                return res.status(403).json({ error: "Forbidden: You do not have the required permissions." });
            }

            // Attach user data to request object
            req.user = decoded;
            next(); // Allow request to continue
        });
    } catch (error) {
        res.status(500).json({ error: "Server error." });
    }
};

export default verifySuperAdminToken;
