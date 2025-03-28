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

let awaitingConsultConfirmation = false;
let awaitingContactDetails = false;

app.post('/message', async (req, res) => {
  const { message } = req.body;
  const lower = message.toLowerCase();

  if (awaitingConsultConfirmation) {
    const confirmed = /(yes|sure|please|okay|ok|yeah|let's do it)/.test(lower);
    awaitingConsultConfirmation = false;

    if (confirmed) {
      awaitingContactDetails = true;
      return res.json({
        reply: "Awesome! Could you please share your name, email, and phone number so we can schedule the consultation?"
      });
    } else {
      return res.json({
        reply: "No problem at all! Let me know if you’d like help with anything else."
      });
    }
  }

  if (awaitingContactDetails) {
    awaitingContactDetails = false;

    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/);
    const phoneMatch = message.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const nameMatch = message
      .replace(emailMatch?.[0] || "", "")
      .replace(phoneMatch?.[0] || "", "")
      .replace(/[,\s]+/g, " ")
      .trim();

    const name = nameMatch || "N/A";
    const email = emailMatch?.[0] || "N/A";
    const phone = phoneMatch?.[0] || "N/A";

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
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: "system",
          content: `
You are Solomon, a helpful, friendly AI assistant for Elevated Garage.
- Your job is to educate users about garage flooring, cabinetry, lighting, saunas, cold plunges, gym setups, and more.
- You're allowed to give ballpark price ranges, but you must always include a clear disclaimer: 
  "This is not a quote — actual pricing may vary based on availability, garage size, design complexity, and installation factors."
- Do NOT give exact pricing or timelines.
- If the user expresses interest in a quote or project, ask: "Can I schedule a consultation for you?"
- If they say yes, ask for name, email, and phone to collect their contact info.
          `.trim()
        },
        { role: "user", content: message }
      ]
    });

    const reply = aiResponse.choices[0].message.content;
    const interested = /(quote|estimate|start|get started|how much|upgrade|design|consult|schedule|ready)/.test(lower);

    if (interested) {
      awaitingConsultConfirmation = true;
      return res.json({
        reply: "Can I schedule a consultation for you?"
      });
    }

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
