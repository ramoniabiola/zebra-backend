import jwt from "jsonwebtoken";


const verifyUserToken = (req, res, next) => {
    const token = req.cookies.accessToken; // Get token from cookies

    if (!token) {
        return res.status(401).json({ error: "You are not authenticated..." });
    }

    
    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Token is invalid..." });
        }
        req.user = user; // Attach user data to request
        next(); // Proceed to next middleware or route
    });

};

export default verifyUserToken;
