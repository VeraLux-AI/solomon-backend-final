const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Email transporter (Nodemailer using Gmail SMTP or similar)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.LEAD_EMAIL_USER,
    pass: process.env.LEAD_EMAIL_PASS,
  },
});

// Chat logic with intelligent lead detection
app.post('/message', async (req, res) => {
  const { name, email, phone, message } = req.body;

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: "system",
          content: `
You are Solomon, a friendly and professional garage design assistant for Elevated Garage. Your role is to educate and assist users on remodeling projects.

If the user expresses interest in scheduling, a consultation, or getting started, respond like a human assistant would: ask for their name, email, and phone number. Never give exact prices or timelines — always say these vary by project complexity and product availability.

Once contact details are collected, thank them and let them know a team member will follow up.
`.trim()
        },
        { role: "user", content: message },
      ],
    });

    const reply = chatCompletion?.choices?.[0]?.message?.content || "I'm here to help whenever you're ready.";
    console.log(`Message from ${name || 'Visitor'}: "${message}"`);

    // If full contact info is provided, email the lead
    if (name && email && phone) {
      const mailOptions = {
        from: process.env.LEAD_EMAIL_USER,
        to: 'nick@elevatedgarage.com',
        subject: '📥 New Solomon Lead',
        text: `
New Lead Captured:

Name: ${name}
Email: ${email}
Phone: ${phone}
Message: ${message}
        `.trim()
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Email error:", error);
        } else {
          console.log("Lead email sent:", info.response);
        }
      });
    }

    res.json({ reply });

  } catch (error) {
    console.error("OpenAI Error:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Message:", error.message);
    }
    res.status(500).json({ error: "Error contacting OpenAI" });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Solomon backend running on port ${PORT}`);
});
