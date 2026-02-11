import express from "express";
import { conn } from "../dbconnect";
import { user_model } from "../model/user_model";


import mysql from "mysql2/promise";
import { RowDataPacket } from "mysql2";
import { ResultSetHeader } from "mysql2/promise";


import util from "util";

export const queryAsync = util.promisify(conn.query).bind(conn);
export const router = express.Router();

// router.get('/',(req,res)=>{
//     res.send("Get in login.ts")
// });

router.get("/users", async (req, res) => {
  try {
    const [rows] = await conn.query("SELECT * FROM `user` ");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});
//admid
router.get("/admin",async(req,res)=>{
  try{
    const [rows] = await conn.query("SELECT * FROM `user` WHERE type = 'admin'");
    res.status(200).json(rows);
  }catch(err){
    console.error(err);
    res.status(500).send("Database error");
  }
}); 
//อาจายร์
router.get("/professor",async(req,res)=>{
  try{
    const [rows] = await conn.query("SELECT * FROM `user` WHERE type != 'admin'");
    res.status(200).json(rows);
  }catch(err){
    console.error(err);
    res.status(500).send("Database error");
  }
}); 


//หา id_user:
router.get("/user_id/:id",async(req,res)=>{
    try {
    const id = req.params.id;

    const [rows] = await conn.query("SELECT * FROM `user` WHERE user_id = ?", [id]);

    res.json(rows);
  } catch (error) {
    console.error("❌ Database error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ล็อกอินแยกระหว่าง user และ admin
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier คือ email หรือ username

    if(!identifier || !password ){
      return res.status(400).json({message : "Missing credentials"});
    }

    const sql = `
     SELECT * FROM user 
      WHERE (email = ? OR username = ?)
        AND password = ?
    `;
    const [rows]  = await conn.query<RowDataPacket[] & user_model[]>(
      sql,
      [identifier, identifier, password]
    );

    if(rows.length===0){
      return res.status(401).json({message : "Missing data"});
    }
    const user = rows[0];
    //ไม่ show password //
    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

//add user <--
router.post("/add", async(req,res)=>{
  try{
    const user : user_model = req.body;
    

    // ✅ 1. เพิ่มขั้นตอนการเช็ค Email ซ้ำ
    const checkSql = "SELECT uid FROM user WHERE email = ?";
    const [existingUsers] = await conn.query(checkSql, [user.email]);

    // ถ้า array ไม่ว่าง แปลว่ามี email นี้แล้ว
    if ((existingUsers as any[]).length > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }
    
    const sql =`INSERT INTO user (username, email, password, phone, type, status) VALUES (?,?,?,?,?,1)
    `;
    const [rows] = await conn.query<ResultSetHeader>(
          sql,
          [user.username,
           user.email,
           user.password,
           user.phone,
           user.type
    ]);

    res.status(201).json({ message: "User created",row : rows.affectedRows });

  }catch(err){
    console.error(err);
    res.status(500).send("Database error");
  }
});

//edit user โดยใช้ id (update)
router.put("/update/:id", async(req,res)=>{
 try {
    const user_id = req.params.id;
    const userDatail: user_model = req.body; // ใช้ Partial เพราะอาจ update ไม่ครบทุก field

    if (!user_id) {
      return res.status(400).send("User ID not found");
    }

    // 1. ตรวจสอบ user เดิม
    const selectSql = 'SELECT * FROM `user` WHERE uid = ?';
    const [rows] = await conn.execute<user_model[]&RowDataPacket[]>(selectSql, [user_id]);

    if (rows.length === 0) {
      return res.status(404).send("User not found");
    }

    const userOri = rows[0];
    const updateUser = { ...userOri, ...userDatail }; // merge object

    // 2. Update database
    const updateSql = `
      UPDATE user
      SET username = ?, email = ?, password = ?, phone = ?, type = ?
      WHERE uid = ?
    `;
    const [result] = await conn.execute<ResultSetHeader>(updateSql, [
      updateUser.username,
      updateUser.email,
      updateUser.password,
      updateUser.phone,
      updateUser.type,
      user_id
    ]);

    if(result.affectedRows === 0){
      return res.status(400).json({ message : "User not found"});
    }
    res.status(200).json({
      message: "Updated User",
      affectedRows: result.affectedRows
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

//delete user 
router.delete("/delete/:id", async(req,res)=>{
  try{
    const user_id = req.params.id;

    if(!user_id){
      return res.status(400).send("User not found");
    }

    const sql = "DELETE FROM user WHERE `uid` = ?";
    const [rows] = await conn.execute<ResultSetHeader>(sql,[user_id]);

    if(rows.affectedRows === 0){
      return res.status(404).json({ message : "User not found"});
    }
    res.status(200).json({
      message: "Delete User",
      affectedRows: rows.affectedRows
    });
  }catch(err){
    console.error(err);
    res.status(500).send("Database error");
  }
});

//เปลี่ยนสถาะ user
router.put("/change-status", async (req, res) => {
  try {
    const { uid } = req.body; // รับ uid ที่ต้องการเปลี่ยน

    if (!uid) {
      return res.status(400).json({ message: "UID is required" });
    }

    // เพิ่มเงื่อนไข WHERE status = '1' ด้วยถ้าต้องการให้เปลี่ยนเฉพาะคนที่เป็น 1 เท่านั้น
    const sql = `
      UPDATE user 
      SET status = '0' 
      WHERE uid = ?
    `;

    const [result] = await conn.query(sql, [uid]);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: "ไม่พบ User หรือ Status ไม่ได้เปลี่ยนแปลง" });
    }

    res.status(200).json({ message: "เปลี่ยน Status เป็น 0 สำเร็จ" });

  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ message: "Database error", error: err });
  }
});

//แสดง user ที่ Status เป็น 0 
router.get("/status", async (req, res) => {
  try {
    const [rows] = await conn.query("SELECT * FROM `user` WHERE status = 0");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});