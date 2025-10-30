import axios from "axios";
import dotenv from "dotenv";
dotenv.config()


export const sendWelcomeMail = async (recipientEmail) => {
    try {
        const response = await axios.post(
            "https://api.brevo.com/v3/smtp/email",
            {
                sender: { name: "zebra", email: "ramoniabiola61@gmail.com" },
                to: [{ email: recipientEmail }],
                subject: "Welcome to Zebra",
                htmlContent: `<p>Hello there! Your signup was successful 🎉</p>`,
            },
            {
                headers: {
                    "api-key": process.env.BREVO_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        console.log("Email sent successfully:", response.data);
    } catch (error) {
        console.error("Error sending email:", error.response?.data || error.message);
    }
};
