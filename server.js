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

// Email configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.titan.email',
  port: 465,
  secure: true,
  auth: {
    user: process.env.LEAD_EMAIL_USER,
    pass: process.env.LEAD_EMAIL_PASS,
  }
});

// Memory store for simple lead capture (could be expanded to per-session)
const contactPath = path.join(__dirname, 'lead-contact.json');

// Store contact info (name, email, phone)
app.post('/store-contact', (req, res) => {
  const { name, email, phone } = req.body;
  fs.writeFileSync(contactPath, JSON.stringify({ name, email, phone }));
  res.sendStatus(200);
});

// Handle optional garage form submission
app.post('/lead-details', (req, res) => {
  const { size, priority, timeline } = req.body;

  let contactInfo = { name: '', email: '', phone: '' };
  if (fs.existsSync(contactPath)) {
    contactInfo = JSON.parse(fs.readFileSync(contactPath));
  }

  const emailBody = `
📥 New Garage Design Lead

Name: ${contactInfo.name || 'N/A'}
Email: ${contactInfo.email || 'N/A'}
Phone: ${contactInfo.phone || 'N/A'}

Garage Size: ${size || 'N/A'}
Top Priority: ${priority || 'N/A'}
Timeline: ${timeline || 'N/A'}
  `.trim();

  const mailOptions = {
    from: process.env.LEAD_EMAIL_USER,
    to: 'nick@elevatedgarage.com',
    subject: '📥 New Garage Design Lead',
    text: emailBody,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("❌ Email failed:", error);
      res.status(500).send("Error sending lead");
    } else {
      console.log("✅ Lead email sent:", info.response);
      res.sendStatus(200);
    }
  });
});

// Handle chat messages via OpenAI
app.post('/message', async (req, res) => {
  const { message } = req.body;

  try {
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: "system",
          content: `
You are Solomon, an expert AI assistant for Elevated Garage. Your job is to help homeowners design their dream garages by answering questions, educating them, and capturing interest in services like flooring, cabinets, gym equipment, lighting, and saunas.

NEVER provide specific prices or timelines — always clarify they vary by project scope and product availability. If someone wants to proceed with a consultation, kindly ask for their name, email, and phone number. Respond conversationally and be helpful.
`.trim()
        },
        { role: "user", content: message }
      ]
    });

    const reply = chatResponse.choices[0].message.content;
    res.json({ reply });

  } catch (err) {
    console.error("OpenAI Error:", err.message);
    res.status(500).json({ reply: "Sorry, something went wrong." });
  }
});

// Serve chat UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Solomon backend running on port ${PORT}`);
});
