import express from "express";
import { router as user } from "./controller/user";

import { router as document } from "./controller/document";
import { router as board } from "./controller/board";
import { router as folder } from "./controller/folder";



import bodyParser from "body-parser";
import * as os from "os"; // <-- แก้ตรงนี้
import cors from "cors";

export const app = express();

app.use(bodyParser.text());
app.use(bodyParser.json());

app.use(cors({
  origin: "*", // หรือกำหนด domain frontend
  methods: ["GET", "POST", "PUT", "DELETE"],
}));

app.use("/", user);


app.use("/document", document);
app.use("/board", board);
app.use("/folder",folder);
app.use("/uploads", express.static("uploads"));

// หา IP ของเครื่อง
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

const localIP = getLocalIP();

const PORT = 3000;

//คำสั่งรันserver npx nodemon server.ts

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://${localIP}:${PORT}/`);
  console.log(`Login route: http://localhost:${PORT}/`);
  console.log(`Register route: http://localhost:${PORT}/register`);
});