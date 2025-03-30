import jwt from "jsonwebtoken";


const verifyTenantToken = (req, res, next) => {
    try {
        const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];; // Get token from cookies

        if (!token) {
            return res.status(401).json({ error: "You are not authenticated..." });
        }


        jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: "Invalid or expired token." });
            }

            // Check if the user has tenant role
            if (decoded.role !== "tenant"){
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

export default verifyTenantToken;
