import AdminLog from "../models/AdminLog.js"; 


const logAdminAction = async (adminId, action, target, ipAddress) => {
    try {
        await AdminLog.create({ adminId, action, target, ipAddress });
    } catch (err) {
        console.error("Error logging admin action:", err);
    }
};

export default logAdminAction;
