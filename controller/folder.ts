import express from "express";
import { conn } from "../dbconnect";

import { RowDataPacket } from "mysql2";
import { ResultSetHeader } from "mysql2/promise";


import util from "util";

export const queryAsync = util.promisify(conn.query).bind(conn);
export const router = express.Router();

// router.get("/" ,(req,res)=>{
//     res.json("folder.ts pages")
// });

router.get("/jae", async (req,res)=>{
    try{
        const sql = 'SELECT d.did,d.file_name,d.file_url,d.semester,d.create_at FROM document_category dc INNER JOIN category c ON dc.category_id = c.category_id INNER JOIN document d ON dc.did = d.did WHERE dc.category_id = 1;';
        const [rows] = await conn.query(sql);
        if ((rows as any[]).length === 0) {
            return res.status(204).json({
                message: `No documents found in category JAE`,
            });
        }
        res.status(200).json({
            category: "JAE",
            count: (rows as any[]).length,
            data: rows,
        });
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

//แสดงประเภทของ folder
router.get("/:id", async (req,res)=>{
    try{
        const catetogyID = req.params.id;

        if(!catetogyID){
            res.status(400).json({ messeage : "Catetogy ID not found"});
        }

        const sql_category_name =  'SELECT * FROM `category` WHERE category_id = ?';
        const [categoryRows] :any  = await conn.query(sql_category_name,[
            catetogyID
        ]);

        const sql = 'SELECT d.did,d.file_name,d.file_url,d.semester,d.create_at FROM document_category dc INNER JOIN category c ON dc.category_id = c.category_id INNER JOIN document d ON dc.did = d.did WHERE dc.category_id = ? GROUP BY d.did;';
        const [rows] = await conn.query(sql,[
            catetogyID
        ]);

        const categoryName = categoryRows[0]; // ✅ JSON object
        if ((rows as any[]).length === 0) {
            return res.status(204).json({
                message: `No documents found in category '${categoryName}'`,
            });
        }
        res.status(200).json({
            category: categoryName,
            count: (rows as any[]).length,
            data: rows,
        });
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

//add ประเภทของ forlder
router.post("/", async (req,res)=>{
    try{
        const { document_id, categories } = req.body;

    if (
      !document_id ||
      !Array.isArray(categories) ||
      categories.length === 0
    ) {
      return res.status(400).json({ message: "Invalid data" });
    }

    const values = categories.map((catId: number) => [
      document_id,
      catId
    ]);

    const sql = `
      INSERT INTO document_category (did, category_id)
      VALUES ?
    `;

    const [result]: any = await conn.query(sql, [values]);

    res.status(201).json({
      message: "Categories added successfully",
      inserted: result.affectedRows
    });
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

// ดึงหมวดหมู่ทั้งหมด
router.get("/", async (req, res) => {
  try {
    const sql = "SELECT * FROM category ";
    const [rows] = await conn.query(sql);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});




// ✅ ส่งเอกสารให้อาจารย์หลายคน พร้อมหมวดหมู่หลายหมวด
router.post("/sendToTeachers", async (req, res) => {
  try {
    const { document_id, teacher_ids, category_ids, text } = req.body;

    console.log('Received data:', { document_id, teacher_ids, category_ids, text });

    // ✅ Validation
    if (!document_id || !teacher_ids || !Array.isArray(teacher_ids) || !text) {
      return res.status(400).json({ 
        message: "document_id และ teacher_ids (array) จำเป็น",
        received: req.body
      });
    }

    if (!category_ids || !Array.isArray(category_ids) || category_ids.length === 0) {
      return res.status(400).json({ 
        message: "กรุณาเลือกหมวดหมู่อย่างน้อย 1 หมวด",
        received: req.body
      });
    }

    if (teacher_ids.length === 0) {
      return res.status(400).json({ 
        message: "กรุณาเลือกอาจารย์อย่างน้อย 1 คน" 
      });
    }

    try {
      // ========================================
      // 1️⃣ บันทึกหมวดหมู่ของเอกสาร
      // ========================================
      console.log('Step 1: Saving categories...');
      
      for (const categoryId of category_ids) {
        const sqlCategory = `
          INSERT INTO document_category (did, category_id)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE category_id = category_id
        `;
        await conn.query(sqlCategory, [document_id, categoryId]);
      }
      
      console.log(`✅ Saved ${category_ids.length} categories`);

      // ========================================
      // 2️⃣ ส่งเอกสารให้อาจารย์แต่ละคน
      // ========================================
      console.log('Step 2: Sending to teachers...');
      
      let successCount = 0;
      //เลข id สำหรับการใช้ปฏิทิน
      const batchId = Date.now().toString() + '-' + Math.floor(Math.random() * 1000);

      for (const teacherId of teacher_ids) {
        const sqlSend = `
          INSERT INTO doc_send (title, uid, did, batch_id)
          VALUES (?, ?, ?, ?)
        `;
        const [result] = await conn.query<ResultSetHeader>(sqlSend, [
          text,
          teacherId,
          document_id,
          batchId
        ]);
        
        if (result.affectedRows > 0) {
          successCount++;
        }
      }
      
      console.log(`✅ Sent to ${successCount} teachers`);

      // ========================================
      // 3️⃣ อัพเดทสถานะเอกสารเป็น "ส่งแล้ว"
      // ========================================
      console.log('Step 3: Updating document status...');
      
      const sqlUpdateStatus = `
        UPDATE document SET statue = '1' WHERE did = ?
      `;
      await conn.query(sqlUpdateStatus, [document_id]);
      
      console.log('✅ Status updated');

      // ✅ Commit Transaction
  

      // ✅ Response สำเร็จ
      res.status(200).json({
        success: true,
        message: "ส่งเอกสารสำเร็จ",
        data: {
          document_id: document_id,
          teachers_sent: successCount,
          categories_saved: category_ids.length,
          teacher_ids: teacher_ids,
          category_ids: category_ids
        }
      });

    } catch (err) {
      console.error('Transaction error:', err);
      throw err;
    }

  } catch (err) {
    console.error('Send to teachers error:', err);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการส่งเอกสาร",
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

//delete
