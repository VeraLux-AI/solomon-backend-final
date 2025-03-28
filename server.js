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

// Titan Mail SMTP setup
const transporter = nodemailer.createTransport({
  host: 'smtp.titan.email',
  port: 465,
  secure: true,
  auth: {
    user: process.env.LEAD_EMAIL_USER,
    pass: process.env.LEAD_EMAIL_PASS,
  }
});

// Memory store for conversation history
const conversationMemory = {};

function extractLeadDetails(message) {
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/);
  const phoneMatch = message.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const nameMatch = message
    .replace(emailMatch?.[0] || "", "")
    .replace(phoneMatch?.[0] || "", "")
    .replace(/[,\s]+/g, " ")
    .trim();

  return {
    name: nameMatch || "",
    email: emailMatch?.[0] || "",
    phone: phoneMatch?.[0] || ""
  };
}

async function summarizeContext(messages) {
  try {
    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: "system",
          content: `
You're an assistant summarizing customer interest from a garage design conversation. Your goal is to detect if the customer mentioned any of these: flooring, cabinetry, lighting, saunas, cold plunges, gym equipment, walk-in coolers.

Provide a concise summary of what they expressed interest in or asked about.
Example: "User discussed flooring options including epoxy and tile, and showed interest in gym equipment."
`
        },
        { role: "user", content: messages.join("\n") }
      ]
    });

    return chatCompletion.choices[0].message.content;
  } catch (err) {
    console.error("❌ Failed to summarize context:", err.message);
    return "No additional context extracted.";
  }
}

app.post('/message', async (req, res) => {
  const { message, sessionId = "default" } = req.body;

  if (!conversationMemory[sessionId]) {
    conversationMemory[sessionId] = [];
  }

  conversationMemory[sessionId].push(`User: ${message}`);

  try {
    const aiResponse = await openai.chat.completions.create({
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
        { role: "user", content: message }
      ],
    });

    const reply = aiResponse?.choices?.[0]?.message?.content || "I'm here to help whenever you're ready.";
    conversationMemory[sessionId].push(`Solomon: ${reply}`);
    console.log(`Message from Visitor: "${message}"`);

    const { name, email, phone } = extractLeadDetails(message);
    console.log("🔍 Parsed Contact Details:");
    console.log("   Name:", name);
    console.log("   Email:", email);
    console.log("   Phone:", phone);

    if (name && email && phone) {
      const contextSummary = await summarizeContext(conversationMemory[sessionId]);

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

Context: ${contextSummary}
        `.trim()
      };

      console.log("📤 Attempting to send email via Titan SMTP...");
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("❌ Email failed to send:", error);
        } else {
          console.log("✅ Lead email sent successfully:", info.response);
        }
      });

      // Reset memory for this session
      conversationMemory[sessionId] = [];
    }

    res.json({ reply });

  } catch (error) {
    console.error("OpenAI Error:", error.message);
    res.status(500).json({ error: "Error contacting OpenAI" });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Solomon backend running on port ${PORT}`);
});
