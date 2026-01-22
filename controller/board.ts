import express from "express";
import {conn} from "../dbconnect";
import { ResultSetHeader } from "mysql2/promise";
export const router = express.Router();

//Get board
router.get("/",async (req,res)=>{
    try{
        const [rows] = await conn.query("SELECT * FROM `board` ");
        res.json(rows);
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

//Add board
// POST - เพิ่ม Board
router.post("/", async (req, res) => {
  try {
    const { detail, did, harder } = req.body;
    
    // ✅ ตรวจสอบเฉพาะ detail และ harder (did สามารถเป็น null ได้)
    if (!detail || !harder) {
      return res.status(400).json({
        message: "กรุณาระบุ detail และ harder",
        received: req.body
      });
    }

    // ✅ ถ้า did เป็น null ให้ใส่ NULL ลง database
    const sql = 'INSERT INTO `board` (`detail`, `did`, `harder`) VALUES (?, ?, ?)';
    const [rows] = await conn.query<ResultSetHeader>(sql, [
      detail,
      did || null,  // ✅ ถ้าไม่มี did ให้เป็น null
      harder
    ]);

    if (rows.affectedRows === 0) {
      return res.status(500).json({ message: "Insert failed" });
    }

    res.status(201).json({
      message: "Board created successfully",
      bid: rows.insertId,
      affectedRows: rows.affectedRows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Database error",
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

router.get("/send", async (req, res) => {
  try {
    const [rows] = await conn.query("SELECT * FROM `doc_send`");
    console.log("Rows:", rows);
    res.json({
      count: Array.isArray(rows) ? rows.length : 0,
      data: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});