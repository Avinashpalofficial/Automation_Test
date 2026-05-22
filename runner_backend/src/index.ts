import dotenv from "dotenv";
dotenv.config();
import app from "./app";

const PORT = 4000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
  console.log(`runner Server is running on port ${PORT}`);
});
