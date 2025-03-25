import jwt from "jsonwebtoken";


const verifyToken = (req, res, next) => {
    const authHeader = req.headers.token;
    if(authHeader){
        const token = authHeader.split(" ")[1];
        jwt.verify(token, process.env.JWT_SECRET_KEY, (err, user) => {
            if(err) {
                res.status(403).json({ error: "Token is invalid..." });
            } else {
                req.user = user;
                next(); // Call next callback here
            }
        });
    } else {
        return res.status(401).json({ error: "You are not authenticated..." });
    }
};

export default verifyToken;
