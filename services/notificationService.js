import Notification from "../models/Notification.js";
import { io, onlineUsers } from "../index.js";

function emitToUser(userId, event, payload) {
    const sockets = onlineUsers.get(userId.toString());
    if (!sockets) return;
    for (const socketId of sockets) {
        io.to(socketId).emit(event, payload);
    }
}


export async function createAndEmitNotification({ userId, role, message, meta = {} }) {
    const notif = await Notification.create({ user: userId, role, message, meta });
    emitToUser(userId, "newNotification", notif);
    return notif;
}


// Fan-out with batching to avoid blocking request
export async function bulkCreateAndEmit(notifInputs) {
    // 1) Insert all docs at once
    const inserted = await Notification.insertMany(
        notifInputs.map((n) => ({ user: n.userId, role: n.role, message: n.message, meta: n.meta || {} })),
        { ordered: false }
    );

    // 2) Emit to all online recipients
    for (const doc of inserted) {
        emitToUser(doc.user.toString(), "newNotification", doc);
    }

    return inserted;
}
