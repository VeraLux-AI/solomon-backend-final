const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/message', async (req, res) => {
  const { name, email, message } = req.body;

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: "system",
          content: `
You are Solomon, an AI assistant for Elevated Garage. Your job is to help potential clients understand the garage remodeling process, products, and options. You should be friendly, professional, and helpful.

🚫 Never provide exact pricing or timelines.
✅ Always explain that all estimates vary based on product availability, customization, and job complexity.
✅ Be transparent that a human consultant will provide the final quote.

If asked for price or time, respond with disclaimers such as:
"Great question — pricing and timelines can vary depending on product availability and the complexity of your garage. I can help you get a ballpark idea, but an exact quote will come after a design consultation."
          `.trim(),
        },
        { role: "user", content: message },
      ],
    });

    const reply = chatCompletion?.choices?.[0]?.message?.content || "Hmm… I wasn't able to generate a response. Try again?";
    console.log(`New lead: ${name} <${email}> said: "${message}"`);
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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Solomon backend running on port ${PORT}`);
});
