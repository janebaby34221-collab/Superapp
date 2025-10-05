import express from "express";

const app = express();
const PORT = process.env.PORT || 4000;

app.get("/", (req, res) => {
  res.json({ message: "🚀 SuperApp Backend running!" });
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

