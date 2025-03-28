import jwt from "jsonwebtoken";

const verifyGeneralUserToken = (req, res, next) => {
    try {
        const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1]; // Get token from cookies or headers

        if (!token) {
            return res.status(401).json({ error: "You are not authenticated." });
        }

        jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: "Invalid or expired token." });
            }

            // Check if the user has agent, landlord, or tenant role
            if (!["agent", "landlord", "tenant"].includes(decoded.role)) {
                return res.status(403).json({ error: "Access denied: Only general users (landlord, tenant, or agent) are allowed." });
            }

            // Attach user data to request object
            req.user = decoded;
            next(); // Allow request to continue    
        });
    } catch (error) {
        res.status(500).json({ error: "Internal server error." });
    }
};

export default verifyGeneralUserToken;
