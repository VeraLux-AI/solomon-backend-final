const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const transporter = nodemailer.createTransport({
  host: 'smtp.titan.email',
  port: 465,
  secure: true,
  auth: {
    user: process.env.LEAD_EMAIL_USER,
    pass: process.env.LEAD_EMAIL_PASS,
  }
});

app.post('/message', async (req, res) => {
  const { message } = req.body;
  const lower = message.toLowerCase();

  // Check if message contains all lead info
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/);
  const phoneMatch = message.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const nameLikely = /([A-Z][a-z]+\s[A-Z][a-z]+)/.test(message);

  if (emailMatch && phoneMatch && nameLikely) {
    const nameMatch = message.match(/([A-Z][a-z]+\s[A-Z][a-z]+)/);
    const name = nameMatch ? nameMatch[0] : "N/A";
    const email = emailMatch[0];
    const phone = phoneMatch[0];

    const mailOptions = {
      from: process.env.LEAD_EMAIL_USER,
      to: 'nick@elevatedgarage.com',
      subject: '📥 New Consultation Request',
      text: `
New Lead Captured:

Name: ${name}
Email: ${email}
Phone: ${phone}
Original Message: ${message}
      `.trim()
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("❌ Email failed to send:", error);
      } else {
        console.log("✅ Contact info sent via email:", info.response);
      }
    });

    return res.json({
      reply: "Thanks, I've submitted your information to our team! We'll reach out shortly to schedule your consultation."
    });
  }

  try {
    const systemPrompt = `
You are Solomon, the expert AI assistant for Elevated Garage.

- Help users explore garage products like flooring, cabinetry, cold plunges, gym equipment, and lighting.
- You're allowed to give ballpark pricing, but you MUST apply this internal formula to your estimates:
  (base material + labor cost) × 1.15 × 2
- Round your answers to the nearest dollar or whole range (e.g., $13–$14/sq ft).
- Do NOT explain this formula to the user.
- Always include the disclaimer: 
  "This is not a quote — actual pricing may vary based on availability, garage size, design complexity, and installation factors."
- Fully answer the user’s question first.
- If the user expresses interest in moving forward, ask: 
  "Would you like to schedule a consultation to explore your options further?"
- If the user responds with their name, email, and phone in a single message, capture the lead.
    `.trim();

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ]
    });

    const reply = aiResponse.choices[0].message.content;
    res.json({ reply });

  } catch (err) {
    console.error("OpenAI Error:", err.message);
    res.status(500).json({ reply: "Sorry, something went wrong." });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Solomon backend running on port ${PORT}`);
});
