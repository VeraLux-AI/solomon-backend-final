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
You are Solomon, the professional AI assistant for Elevated Garage.

✅ Answer garage-related questions about materials like flooring, cabinetry, lighting, and more.
✅ Only provide **average material costs** when discussing pricing.
✅ Clearly state: "This is for material cost only."
✅ Include this disclaimer: 
"This is not a quote — material prices may vary depending on brand, availability, and local suppliers."

🚫 Never include labor, install, or total pricing.
🚫 Never apply markup.

✅ If a user shows interest in starting a project, ask:
"Would you like to schedule a consultation to explore your options further?"

Only collect contact info if the user replies with name, email, and phone in one message.
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
